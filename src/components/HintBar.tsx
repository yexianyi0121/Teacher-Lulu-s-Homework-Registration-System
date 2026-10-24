import { useStore } from '../store';
import { selectDigitKeyMode } from '../store/selectors';
import { buildHint } from '../domain/hint';
import { buildGradeKeyMap } from '../domain/keymap';
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
  const hint = filterNotPassed
    ? `👁 只看未过关：${notPassedCount ?? 0} 人 / 共 ${total ?? 0} 人（编号保持原学号）`
    : buildHint(templateId, scheme, buildGradeKeyMap(scheme), meaning);

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
      <span className="hint-text">{hint}</span>
    </div>
  );
}
