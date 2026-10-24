import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { selectDigitKeyMode } from '../store/selectors';
import { GRADE_ORDER } from '../domain/constants';
import { buildGradeKeyMap } from '../domain/keymap';
import { resolveDigitMeaning } from '../domain/digitKey';
import { checkScore, maxScoreOf, reasonText, sanitizeScoreChar } from '../domain/scoreInput';
import { schemeHasPass } from '../domain/scoring';
import type { GradeLetter } from '../domain/types';

/**
 * 手机端数字键盘（V4 FR-50.4 / ADR-26.4）：点格子 → 底部升起。
 * 手机不指望物理键盘，改为大按钮点选：数字 0–9 / 小数点 / 等级 6 钮 /
 * 过关 / 缺交 / 请假 / 清空。语义与键盘引擎同源（resolveDigitMeaning），
 * 分数同样走 checkScore 唯一校验入口——不允许键盘与键盘板两套规则。
 * 秒跳开启时焦点前移，由 App 把键盘板跟着焦点搬到新格（见 App keypadNo 同步）。
 */
export function MobileKeypad({ no, onClose }: { no: number; onClose: () => void }) {
  const draft = useStore((s) => s.draft);
  const settings = useStore((s) => s.settings);
  const [buf, setBuf] = useState('');

  const scheme = draft.scheme;
  const meaning = resolveDigitMeaning(selectDigitKeyMode(useStore.getState()), scheme, draft.templateId);
  const km = buildGradeKeyMap(scheme);
  // V4.1 P3-2：等级行按方案实际档数全出（V4 起等级扩到 7 档 A+~D，
  // 旧的 slice(0, 6) 会让 D 没有按钮——「看得见的缺失」）
  const grades = GRADE_ORDER.filter((g) => scheme.grades.includes(g));

  // 格子切换时清空分数缓冲
  useEffect(() => setBuf(''), [no]);

  const pressDigit = (d: string) => {
    const st = useStore.getState();
    if (meaning === 'grade') {
      const g = km[d];
      if (!g) {
        st.showToast('本表没有该等级键', 'warn');
        return;
      }
      st.commitValue(no, { kind: 'grade', grade: g });
      return;
    }
    if (meaning === 'dictation') {
      st.commitText(no, Number(d) === 0 ? '全对' : `错${Number(d)}`);
      return;
    }
    // score：本地缓冲，提交时整条校验（与键盘输入同一套 checkScore）
    const max = maxScoreOf(scheme);
    const half = sanitizeScoreChar(d, max, scheme.decimals);
    if (half === null) {
      st.showToast(`只能输入 0–${max} 的数字`, 'warn');
      return;
    }
    setBuf((b) => {
      let next = b + half;
      if (half === '.' && !b) next = '0.';
      if (next.split('.')[1]?.length > Math.max(0, scheme.decimals)) return b;
      return next;
    });
  };

  const submitScore = () => {
    if (!buf) return;
    const st = useStore.getState();
    const res = checkScore(buf, maxScoreOf(scheme), scheme.decimals);
    if (!res.ok) {
      st.showToast(reasonText(res.reason, maxScoreOf(scheme)), 'error');
      return;
    }
    st.commitValue(no, { kind: 'score', score: res.value });
    setBuf('');
  };

  const current = draft.entries[String(no)]?.value;
  const display = buf || (current?.kind === 'score' ? String(current.score) : current?.kind === 'grade' ? current.grade : current?.kind === 'text' ? current.text : '');

  return (
    <div className="mobile-keypad" role="dialog" aria-label="手机端录入键盘" data-testid="mobile-keypad">
      <div className="mk-head">
        <span className="mk-title">{no} 号{display ? ` · ${display}` : ''}</span>
        <button type="button" className="mk-done" onClick={onClose}>完成</button>
      </div>

      {meaning === 'score' ? (
        <div className="mk-display" data-testid="mk-display">{buf || '输入分数'}</div>
      ) : null}

      <div className="mk-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', meaning === 'score' ? '.' : '0', '0'].map((d, i) => (
          <button
            key={`${d}-${i}`}
            type="button"
            className="mk-key"
            onClick={() => pressDigit(d)}
            aria-label={`数字 ${d}`}
          >
            {d}
          </button>
        ))}
        {meaning === 'score' ? (
          <button type="button" className="mk-key mk-key--ok" onClick={submitScore} aria-label="提交分数">✔</button>
        ) : (
          <button
            type="button"
            className="mk-key mk-key--ok"
            onClick={() => useStore.getState().togglePass(no)}
            aria-label="过关"
          >
            ✅
          </button>
        )}
      </div>

      {grades.length ? (
        <div className="mk-row" aria-label="等级">
          {grades.map((g) => (
            <button
              key={g}
              type="button"
              className="mk-key mk-key--grade"
              onClick={() => useStore.getState().commitValue(no, { kind: 'grade', grade: g as GradeLetter })}
              aria-label={`等级 ${g}`}
            >
              {g}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mk-row">
        <button type="button" className="mk-key mk-key--act" onClick={() => useStore.getState().setStatus(no, 'missing')}>❌ 缺交</button>
        <button type="button" className="mk-key mk-key--act" onClick={() => useStore.getState().setStatus(no, 'leave')}>🏖️ 请假</button>
        <button type="button" className="mk-key mk-key--act" onClick={() => useStore.getState().clearCell(no)}>🧽 清空</button>
        {schemeHasPass(scheme) ? (
          <button type="button" className="mk-key mk-key--act" onClick={() => useStore.getState().togglePass(no)}>✅ 过关</button>
        ) : null}
      </div>

      <div className="mk-hint">
        {meaning === 'grade' ? '点数字 = 等级，点等级钮也可直接录' : meaning === 'score' ? '输入分数后点 ✔ 提交' : '0 = 全对，1–9 = 错几'}
        {settings.secondsJump ? ' · 秒跳开' : ''}
      </div>
    </div>
  );
}
