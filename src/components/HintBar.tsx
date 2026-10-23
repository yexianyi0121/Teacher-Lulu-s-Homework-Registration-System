import { buildHint } from '../domain/hint';
import type { ScoringScheme, SheetTemplateId } from '../domain/types';

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
  return (
    <div className="hint" role="note">
      {filterNotPassed
        ? `👁 只看未过关：${notPassedCount ?? 0} 人 / 共 ${total ?? 0} 人（编号保持原学号）`
        : buildHint(templateId, scheme)}
    </div>
  );
}
