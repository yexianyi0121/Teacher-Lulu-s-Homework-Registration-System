import { useStore } from '../store';
import { selectDigitKeyMode } from '../store/selectors';
import { buildHint } from '../domain/hint';
import { buildGradeKeyMap, keyMapPairs } from '../domain/keymap';
import { GRADE_ORDER } from '../domain/constants';
import {
  digitKeyAmbiguous,
  nextDigitKeyModeFor,
  resolveDigitMeaning,
  describeDigitMeaning,
} from '../domain/digitKey';
import type { ScoringScheme, SheetTemplateId } from '../domain/types';

/**
 * 提示条（V4 ADR-22）：最左侧是「数字键语义」chip——mixed 表下数字键有两种含义，
 * 状态必须始终可见；点击或按反引号 ` 循环 auto→grade→score。
 * 纯分数 / 纯等级 / 听写方案没有歧义，不渲染 chip（FR-46.6）。
 */
export function HintBar({
  templateId,
  scheme,
  filterNotPassed,
  notPassedCount,
  total,
}: {
  templateId: SheetTemplateId;
  scheme: ScoringScheme;
  filterNotPassed?: boolean;
  notPassedCount?: number;
  total?: number;
}) {
  const mode = useStore(selectDigitKeyMode);
  const setDigitKey = useStore((s) => s.setDigitKey);
  const meaning = resolveDigitMeaning(mode, scheme, templateId);
  const showChip = digitKeyAmbiguous(scheme);
  const km = buildGradeKeyMap(scheme);
  const hint = filterNotPassed
    ? `👁 只看未过关：${notPassedCount ?? 0} 人 / 共 ${total ?? 0} 人（编号保持原学号）`
    : buildHint(templateId, scheme, km, meaning);
  // v2.5.10 FR-68.1：方案启用等级时，把“按键=等级”化一组小片显示出来。
  // 原来只有一行可能被截断的纯文字，老师看不出 1–8 到底分别对应哪一桩。
  // v2.6.1 FR-70.5：本表未启用的等级（旧表常只勾 5/6 档）在提示条给出入口，
  // 否则老师找不到 B- 在哪一键、也想不到要去「本表设置」勾选。
  const pairs = meaning === 'grade' && scheme.grades.some((g) => GRADE_ORDER.includes(g)) ? keyMapPairs(km) : [];
  const missing = GRADE_ORDER.filter((g) => !scheme.grades.includes(g));

  return (
    <div className="hint" role="note">
      {showChip ? (
        <button
          type="button"
          className="digit-chip"
          data-meaning={meaning}
          aria-pressed={meaning === 'grade'}
          title="切换数字键含义（快捷键 ` ）"
          onClick={() => setDigitKey(nextDigitKeyModeFor(mode, scheme, templateId))}
        >
          ⌨ {describeDigitMeaning(meaning)}
        </button>
      ) : null}
      {pairs.length ? (
        <span className="hint-grades" aria-label="等级按键">
          {pairs.map((p) => (
            <span className="hint-grade" key={p.key} data-grade={p.grade}>
              <span className="hint-grade-key">{p.key}</span>
              {p.grade}
            </span>
          ))}
        </span>
      ) : null}
      {missing.length ? (
        <button
          type="button"
          className="hint-missing"
          title="点此去本表的可用等级里勾选"
          onClick={() => useStore.getState().setModal('scheme')}
        >
          未启用 {missing.join('/')}，点此添加
        </button>
      ) : null}
      <span className="hint-text">{hint}</span>
    </div>
  );
}
