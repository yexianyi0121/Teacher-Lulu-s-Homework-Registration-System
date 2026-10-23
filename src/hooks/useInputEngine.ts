import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { selectVisibleNos } from '../store/selectors';
import { gradeAllowed, normalizeScore } from '../domain/grading';
import { schemeAllowsGrade, schemeAllowsScore } from '../domain/scoring';
import type { GradeLetter } from '../domain/types';
import { gridColumns } from '../domain/layout';
import { MAX_STUDENTS } from '../domain/constants';

/** 键位引擎（设计 04 §9.2 / V1 BR-08）：命令键挂 document，弹窗内仍生效 */

const GRADE_DIGITS: Record<string, GradeLetter> = {
  '1': 'A+', '2': 'A', '3': 'A-', '4': 'B', '5': 'C', '6': 'D',
};

const LETTERS = new Set(['a', 'b', 'c', 'd']);
const MODIFIERS = new Set(['+', '-', '=', '_']);

function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return el.isContentEditable;
}

export function maxStudents(): number {
  return MAX_STUDENTS;
}

export function useInputEngine() {
  const pendingRef = useRef<{ no: number; base: string } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const store = () => useStore.getState();

    const clearPending = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
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
      const raw = Number(buf.text);
      if (!Number.isFinite(raw)) {
        s.setBuffer(null);
        return;
      }
      const max = scheme.maxScore ?? 100;
      s.commitValue(buf.no, { kind: 'score', score: normalizeScore(raw, max, scheme.decimals) });
      s.setBuffer(null);
      if (advance) maybeAdvance(buf.no);
    };

    const appendBuffer = (ch: string) => {
      const s = store();
      const no = s.focusedNo;
      if (no === null) return;
      const scheme = s.draft.scheme;
      const current = s.buffer && s.buffer.no === no ? s.buffer.text : '';
      let next = current + ch;

      if (ch === '.') {
        if (current.includes('.') || scheme.decimals === 0) return;
        if (!current) next = '0.';
      }
      if (next.includes('.')) {
        const dec = next.split('.')[1] ?? '';
        if (dec.length > 1) return;
      } else {
        const max = scheme.maxScore ?? 100;
        const intPart = next.replace(/^0+(?=\d)/, '');
        if (Number(intPart) > max) {
          if (!current) {
            s.showToast(`本表满分 ${max} 分`, 'warn');
            return;
          }
          next = String(max);
        } else {
          next = intPart;
        }
      }
      s.setBuffer({ no, text: next });
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;
      if (e.isComposing || e.keyCode === 229) return;

      const s = store();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;
      const lower = key.toLowerCase();

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
        }
        return;
      }

      /* ---------- 字母等级（A/B/C/D + 700ms 内可加修饰） ---------- */
      if (LETTERS.has(lower)) {
        if (!schemeAllowsGrade(s.draft.scheme)) {
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

      /* ---------- 数字 / 小数点 ---------- */
      if (/^[0-9]$/.test(key) || key === '.') {
        const scheme = s.draft.scheme;
        if (pendingRef.current) commitPending();

        if (schemeAllowsScore(scheme)) {
          e.preventDefault();
          appendBuffer(key);
          return;
        }
        if (schemeAllowsGrade(scheme) && GRADE_DIGITS[key]) {
          e.preventDefault();
          const no = s.focusedNo;
          if (no === null) return;
          const g = GRADE_DIGITS[key];
          if (gradeAllowed(g, scheme)) {
            s.commitValue(no, { kind: 'grade', grade: g });
            maybeAdvance(no);
          }
          return;
        }
        if (scheme.kind === 'check' && /^[0-9]$/.test(key)) {
          e.preventDefault();
          const no = s.focusedNo;
          if (no === null) return;
          const n = Number(key);
          s.commitText(no, n === 0 ? '全对' : `错${n}`);
          maybeAdvance(no);
          return;
        }
        s.showToast('本表不接受分数', 'warn');
        return;
      }

      /* ---------- Enter ---------- */
      if (key === 'Enter') {
        e.preventDefault();
        if (pendingRef.current) { commitPending(); return; }
        if (s.buffer) { commitBuffer(true); return; }
        const scheme = s.draft.scheme;
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

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearPending();
    };
  }, []);
}
