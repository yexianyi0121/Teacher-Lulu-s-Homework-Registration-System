import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { selectDigitKeyMode, selectVisibleNos } from '../store/selectors';
import { gradeAllowed } from '../domain/grading';
import { schemeAllowsGrade, schemeAllowsScore } from '../domain/scoring';
import type { GradeLetter, ScoringScheme, SheetTemplateId } from '../domain/types';
import { gridColumns } from '../domain/layout';
import { buildGradeKeyMap } from '../domain/keymap';
import { checkScore, maxScoreOf, reasonText, sanitizeScoreChar } from '../domain/scoreInput';
import { nextDigitKeyModeFor, resolveDigitMeaning, describeDigitMeaning } from '../domain/digitKey';

/** 键位引擎（设计 04 §9.2 / V3 06 §3.3）：命令键挂 document，弹窗内仍生效 */

const LETTERS = new Set(['a', 'b', 'c', 'd']);
const MODIFIERS = new Set(['+', '-', '=', '_']);
const DICTATION_WINDOW = 900;

function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return el.isContentEditable;
}

export function useInputEngine() {
  const pendingRef = useRef<{ no: number; base: string } | null>(null);
  const timerRef = useRef<number | null>(null);
  const dictRef = useRef<{ no: number; digits: string; at: number; timer: number | null } | null>(null);

  useEffect(() => {
    const store = () => useStore.getState();

    /** 听写语义的判定：check 方案或听写模板（与 resolveDigitMeaning 的 auto 口径一致） */
    const isDictationScheme = (sch: ScoringScheme, tid: SheetTemplateId): boolean =>
      sch.kind === 'check' || tid === 'dictation';

    const clearPending = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
    };

    const clearDict = () => {
      if (dictRef.current?.timer) window.clearTimeout(dictRef.current.timer);
      dictRef.current = null;
    };

    const maybeAdvance = (from: number) => {
      const s = store();
      if (!s.settings.secondsJump) return;
      const list = selectVisibleNos(s);
      const idx = list.indexOf(from);
      const next = list[idx + 1];
      if (next) s.setFocusedNo(next);
    };

    const commitPending = () => {
      const p = pendingRef.current;
      clearPending();
      if (!p) return;
      const s = store();
      const g = p.base as GradeLetter;
      if (gradeAllowed(g, s.draft.scheme)) {
        s.commitValue(p.no, { kind: 'grade', grade: g });
        maybeAdvance(p.no);
      }
    };

    const commitBuffer = (advance: boolean) => {
      const s = store();
      const buf = s.buffer;
      if (!buf) return;
      const scheme = s.draft.scheme;
      const max = maxScoreOf(scheme);
      const res = checkScore(buf.text, max, scheme.decimals);
      if (!res.ok) {
        s.setBuffer(null);
        s.setCellError(buf.no);
        s.showToast(reasonText(res.reason, max), 'error');
        return;
      }
      s.commitValue(buf.no, { kind: 'score', score: res.value });
      s.setBuffer(null);
      if (advance) {
        maybeAdvance(buf.no);
      } else {
        // 方向键/Tab 触发的「隐式提交」：老师很可能本想输 95 却按到了方向键。
        // 不吞掉值（丢数据更糟），但必须让她看见真正存进去的是什么。
        s.showToast(`${buf.no} 号已记为 ${res.value} 分（输入未按回车）`, 'warn');
      }
    };

    /** 分数缓冲：非法字符不进入缓冲区（FR-39） */
    const appendBuffer = (ch: string) => {
      const s = store();
      const no = s.focusedNo;
      if (no === null) return;
      const scheme = s.draft.scheme;
      const max = maxScoreOf(scheme);
      const current = s.buffer && s.buffer.no === no ? s.buffer.text : '';

      // 负号允许「进入缓冲区」但不允许提交：这样 -5 会整条被 checkScore 拒绝（AC-39.1），
      // 而不是悄悄把 5 存进去（那会让老师以为录了负数）。
      if (ch === '-' && !current) {
        s.setBuffer({ no, text: '-' });
        return;
      }

      const half = sanitizeScoreChar(ch, max, scheme.decimals);
      if (half === null) {
        if (ch === '.' && current) return;   // decimals=0 时静默忽略小数点
        s.showToast(`只能输入 0–${max} 的数字`, 'warn');
        return;
      }

      let next = current + half;
      if (half === '.' && !current) next = '0.';
      if (half === '.' && current.includes('.')) return;

      const [intPart, decPart] = next.split('.');
      if (decPart !== undefined && decPart.length > Math.max(0, scheme.decimals)) return;
      if (intPart.replace('-', '').length > 6) return;

      // 不在输入途中夹取/截断：允许显示 120，由 Enter 的 checkScore 整条拒绝（FR-39.5）
      const normalized = next.startsWith('-') ? `-${next.slice(1).replace(/^0+(?=\d)/, '')}` : next.replace(/^0+(?=\d)/, '');
      s.setBuffer({ no, text: normalized });
    };

    /** 听写数字：0=全对，1–9=错几；900ms 内第二位数字拼成两位数（12 → 错12） */
    const dictationDigit = (key: string) => {
      const s = store();
      const no = s.focusedNo;
      if (no === null) return;
      const now = Date.now();
      const prev = dictRef.current;
      const extend = !!prev && prev.no === no && now - prev.at < DICTATION_WINDOW && prev.digits.length < 2;
      const digits = extend ? prev.digits + key : key;

      const text = Number(digits) === 0 ? '全对' : `错${Number(digits)}`;
      s.commitText(no, text);

      if (prev?.timer) window.clearTimeout(prev.timer);
      const targetNo = no;
      const timer = window.setTimeout(() => {
        if (dictRef.current?.no === targetNo) dictRef.current = null;
        // 只在老师没有手动移开时自动跳格，避免抢焦点
        if (store().focusedNo === targetNo) maybeAdvance(targetNo);
      }, DICTATION_WINDOW);

      dictRef.current = { no, digits, at: now, timer };
    };

    /** 未处理 = 无值、无状态、无过关 */
    const nextUntreated = (dir: 1 | -1) => {
      const s = store();
      const list = selectVisibleNos(s);
      const from = s.focusedNo ?? 1;
      const start = Math.max(0, list.indexOf(from));
      for (let i = 1; i <= list.length; i++) {
        const no = list[(start + i * dir + list.length * 2) % list.length];
        const e = s.draft.entries[String(no)];
        if (!e || (e.value === null && e.status === 'normal' && !e.pass)) {
          s.setFocusedNo(no);
          return;
        }
      }
      s.showToast('全部已处理 ✓', 'ok');
    };

    const rejectScoreChar = (s: ReturnType<typeof store>) => {
      const max = maxScoreOf(s.draft.scheme);
      s.showToast(`只能输入 0–${max} 的数字`, 'warn');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;
      if (e.isComposing || e.keyCode === 229) return;

      const s = store();
      // I-08：确认框/弹窗开着时，全局快捷键必须全部失效。
      // 原来只挡了输入框，结果在「清空本条记录」确认框里下意识按 Enter，
      // 框没关、1 号格的成绩却被改成了「过关」——这是最典型的误操作。
      if (s.confirmRequest || s.modal) {
        // Esc 关弹窗；Tab 留给无障碍焦点移动，其余一律吞掉。
        // v2.5.7 修正：原来写成「放行 Esc 然后 return」，等于把 Esc 也让开了却没执行关闭，
        // 结果弹窗按 Esc 关不掉（E2E-38b 现场）。现在显式关闭。
        if (e.key === 'Escape') {
          e.preventDefault();
          if (s.confirmRequest) s.closeConfirm();
          else s.setModal(null);
        }
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;
      const lower = key.toLowerCase();
      const scheme = s.draft.scheme;
      const km = buildGradeKeyMap(scheme);

      /* ---------- 命令键 ---------- */
      if (mod) {
        if (lower === 'z' && !e.shiftKey) { e.preventDefault(); clearPending(); s.setBuffer(null); s.undo(); return; }
        if ((lower === 'z' && e.shiftKey) || lower === 'y') { e.preventDefault(); clearPending(); s.redo(); return; }
        if (lower === 's') { e.preventDefault(); clearPending(); s.commitToHistory(); return; }
        if (lower === 'm') { e.preventDefault(); window.dispatchEvent(new CustomEvent('xq:toggle-voice')); return; }
        if (lower === 'j') { e.preventDefault(); window.dispatchEvent(new CustomEvent('xq:poster')); return; }
        if (key === 'Enter') { e.preventDefault(); window.dispatchEvent(new CustomEvent('xq:report')); return; }
        return;
      }

      /* ---------- Esc 级联 ---------- */
      if (key === 'Escape') {
        if (s.modal) { s.setModal(null); return; }
        if (s.editing) { s.setEditing(null); return; }
        if (pendingRef.current) { clearPending(); return; }
        if (s.selection.size) { s.exitSelection(); return; }
        if (s.searchOpen) { s.setSearchOpen(false); return; }
        if (s.buffer) { s.setBuffer(null); return; }
        return;
      }

      /* ---------- 反引号：切换数字键语义（V4 FR-46.3） ---------- */
      if (key === '`') {
        e.preventDefault();
        const next = nextDigitKeyModeFor(selectDigitKeyMode(s), scheme, s.draft.templateId);
        s.setDigitKey(next);
        s.showToast(`数字键已切到「${describeDigitMeaning(resolveDigitMeaning(next, scheme, s.draft.templateId))}」`, 'ok');
        return;
      }

      /* ---------- 搜索 ---------- */
      if (key === '/') {
        e.preventDefault();
        s.setSearchOpen(true);
        return;
      }
      if (s.searchOpen) return;

      /* ---------- 待定等级的 +/- 修饰 ---------- */
      if (pendingRef.current && MODIFIERS.has(key)) {
        e.preventDefault();
        const p = pendingRef.current;
        const g = (p.base + (key === '+' || key === '=' ? '+' : '-')) as GradeLetter;
        clearPending();
        if (gradeAllowed(g, s.draft.scheme)) {
          s.commitValue(p.no, { kind: 'grade', grade: g });
          maybeAdvance(p.no);
        } else {
          s.showToast(`本表没有等级 ${g}`, 'warn');
        }
        return;
      }

      /* ---------- 改当前格等级 ---------- */
      if (MODIFIERS.has(key)) {
        const no = s.focusedNo;
        const v = no !== null ? s.draft.entries[String(no)]?.value : null;
        if (no !== null && v?.kind === 'grade') {
          e.preventDefault();
          const g = (v.grade[0] + (key === '+' || key === '=' ? '+' : '-')) as GradeLetter;
          if (gradeAllowed(g, s.draft.scheme)) s.commitValue(no, { kind: 'grade', grade: g });
          else s.showToast(`本表没有等级 ${g}`, 'warn');
          return;
        }
        // 分数方案里的负号：空缓冲时放进缓冲区（这样 Enter 会被 checkScore 整条拒绝，
        // 老师能看见自己确实按了负号），已有缓冲时明确拒绝（FR-39 / AC-39.1）
        if (schemeAllowsScore(scheme)) {
          e.preventDefault();
          const no = s.focusedNo;
          const cur = s.buffer && s.buffer.no === no ? s.buffer.text : '';
          if (no !== null && !cur && key === '-') {
            s.setBuffer({ no, text: '-' });
            return;
          }
          rejectScoreChar(s);
          return;
        }
        return;
      }

      /* ---------- 字母等级（A/B/C/D + 700ms 内可加修饰） ---------- */
      if (LETTERS.has(lower)) {
        if (!schemeAllowsGrade(scheme)) {
          s.showToast('本表只接受分数', 'warn');
          return;
        }
        e.preventDefault();
        if (pendingRef.current) commitPending();
        const no = s.focusedNo;
        if (no === null) return;
        pendingRef.current = { no, base: lower.toUpperCase() };
        timerRef.current = window.setTimeout(() => {
          const p = pendingRef.current;
          if (!p) return;
          pendingRef.current = null;
          const st = store();
          const g = p.base as GradeLetter;
          if (gradeAllowed(g, st.draft.scheme)) {
            st.commitValue(p.no, { kind: 'grade', grade: g });
            maybeAdvance(p.no);
          }
        }, 700);
        return;
      }

      /* ---------- 状态键 / 补交 / 文字 ---------- */
      if (lower === 'x' || lower === 'l' || lower === 'g' || lower === 'm' || key === 'F2') {
        const no = s.focusedNo;
        if (no === null) return;
        e.preventDefault();
        if (pendingRef.current) commitPending();
        if (lower === 'x') { s.setStatus(no, 'missing'); maybeAdvance(no); return; }
        if (lower === 'l') { s.setStatus(no, 'leave'); maybeAdvance(no); return; }
        if (lower === 'g') { s.togglePass(no); maybeAdvance(no); return; }
        if (lower === 'm') { s.setModal('makeup'); return; }
        const cur = s.draft.entries[String(no)]?.value;
        s.setEditing({ no, draft: cur?.kind === 'text' ? cur.text : '' });
        return;
      }

      /* ---------- 空格盖章 ---------- */
      if (key === ' ') {
        e.preventDefault();
        const no = s.focusedNo;
        if (no === null) return;
        if (pendingRef.current) commitPending();
        if (s.selection.size > 0) s.batchStamp([...s.selection]);
        else s.toggleStamp(no);
        return;
      }

      /* ---------- 删除 ---------- */
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        if (pendingRef.current) { clearPending(); return; }
        if (s.buffer) { s.setBuffer(null); return; }
        const no = s.focusedNo;
        if (no === null) return;
        if (s.selection.size > 0) s.batchClear([...s.selection]);
        else s.clearCell(no);
        return;
      }

      /* ---------- 数字 / 小数点 ----------
       * V4 ADR-22：语义先由 resolveDigitMeaning 裁决，再分支。
       * mixed 表默认解析为 grade（敲 1 = A+）；切到 score 后才进分数缓冲区。 */
      if (/^[0-9]$/.test(key) || key === '.') {
        if (pendingRef.current) commitPending();

        const meaning = resolveDigitMeaning(selectDigitKeyMode(s), scheme, s.draft.templateId);

        if (meaning === 'grade') {
          const g = km[key];
          if (g && gradeAllowed(g, scheme)) {
            e.preventDefault();
            const no = s.focusedNo;
            if (no === null) return;
            s.commitValue(no, { kind: 'grade', grade: g });
            maybeAdvance(no);
            return;
          }
          // 小数点在任何语义下都是分数入口
          if (key === '.' && schemeAllowsScore(scheme)) {
            e.preventDefault();
            appendBuffer(key);
            return;
          }
          // 等级模式下按到没有对应等级的数字（如 8/9，或档位不足时的 4）：
          // 不静默吞键（R-10），也不偷偷变成分数
          if (key !== '.') {
            e.preventDefault();
            s.showToast(
              schemeAllowsScore(scheme) ? '本表没有该等级键，可按 ` 切到「数字＝分数」再输入' : '本表没有该等级键',
              'warn',
            );
          }
          return;
        }

        if (meaning === 'score') {
          if (schemeAllowsScore(scheme)) {
            e.preventDefault();
            appendBuffer(key);
            return;
          }
          // v2.6.8：听写表（check 方案）若被切到「数字＝分数」，数字键仍应按听写语义记「错几」。
          // 原来这里直接吞键并提示「本表不接受分数」——提示条写着「0–9（0=全对）」，
          // 键按下去却什么都没发生，老师以为功能坏了。
          if (isDictationScheme(scheme, s.draft.templateId) && /^[0-9]$/.test(key)) {
            e.preventDefault();
            dictationDigit(key);
            return;
          }
          s.showToast('本表不接受分数', 'warn');
          return;
        }

        // dictation
        if (/^[0-9]$/.test(key)) {
          e.preventDefault();
          dictationDigit(key);
          return;
        }
        s.showToast('听写只接受 0–9', 'warn');
        return;
      }

      /* ---------- Enter ---------- */
      if (key === 'Enter') {
        e.preventDefault();
        if (pendingRef.current) { commitPending(); return; }
        if (s.buffer) { commitBuffer(true); return; }
        const no = s.focusedNo;
        if (no === null) return;
        if (scheme.kind === 'check' || scheme.allowCheck) s.togglePass(no);
        maybeAdvance(no);
        return;
      }

      /* ---------- Tab ---------- */
      if (key === 'Tab') {
        e.preventDefault();
        if (pendingRef.current) commitPending();
        if (s.buffer) commitBuffer(false);
        nextUntreated(e.shiftKey ? -1 : 1);
        return;
      }

      /* ---------- 方向键（按当前列数） ---------- */
      const cols = gridColumns(typeof window === 'undefined' ? 1366 : window.innerWidth);
      const list = selectVisibleNos(s);
      const from = s.focusedNo ?? 1;
      const idx = Math.max(0, list.indexOf(from));
      let to: number | null = null;
      if (key === 'ArrowRight') to = list[idx + 1] ?? null;
      if (key === 'ArrowLeft') to = list[idx - 1] ?? null;
      if (key === 'ArrowDown') to = list[idx + cols] ?? null;
      if (key === 'ArrowUp') to = list[idx - cols] ?? null;
      if (to !== null) {
        e.preventDefault();
        if (pendingRef.current) commitPending();
        if (s.buffer) commitBuffer(false);
        s.setFocusedNo(to);
        return;
      }

      /* ---------- 其他字符 → 自定义文字 ---------- */
      if (key.length === 1 && /[\u4e00-\u9fa5a-zA-Z]/.test(key)) {
        const no = s.focusedNo;
        if (no !== null && (s.draft.scheme.allowText || s.draft.scheme.kind === 'text')) {
          e.preventDefault();
          s.setEditing({ no, draft: key });
        }
      }
    };

    /** 粘贴：分数方案下整条校验，非法整条拒绝（FR-39） */
    const onPaste = (ev: ClipboardEvent) => {
      if (isEditableElement(ev.target)) return;
      const s = store();
      if (!schemeAllowsScore(s.draft.scheme)) return;
      const no = s.focusedNo;
      if (no === null) return;
      const text = ev.clipboardData?.getData('text') ?? '';
      if (!text) return;
      ev.preventDefault();
      const max = maxScoreOf(s.draft.scheme);
      const res = checkScore(text, max, s.draft.scheme.decimals);
      if (res.ok) {
        s.commitValue(no, { kind: 'score', score: res.value });
        maybeAdvance(no);
      } else {
        s.setCellError(no);
        s.showToast(reasonText(res.reason, max), 'error');
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('paste', onPaste);
      clearPending();
      clearDict();
    };
  }, []);
}
