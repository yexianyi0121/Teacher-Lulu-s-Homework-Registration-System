import { HINT_TEXT } from '../domain/constants';
import type { SheetTemplateId } from '../domain/types';

export function HintBar({
  templateId,
  filterNotPassed,
  notPassedCount,
  total,
}: {
  templateId: SheetTemplateId;
  filterNotPassed?: boolean;
  notPassedCount?: number;
  total?: number;
}) {
  return (
    <div className="hint" role="note">
      {filterNotPassed
        ? `👁 只看未过关：${notPassedCount ?? 0} 人 / 共 ${total ?? 0} 人（编号保持原学号）`
        : HINT_TEXT[templateId]}
    </div>
  );
}
