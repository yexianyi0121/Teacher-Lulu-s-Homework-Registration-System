import { currentClass, useStore } from '../store';
import { SHEET_TEMPLATES } from '../domain/constants';
import { formatDateCN, weekdayCN } from '../domain/date';

/**
 * 空态：今天 / 当前登记类型下还没有登记表时，不显示学生网格，
 * 只显示一个醒目的「＋ 新建登记」按钮，明确告诉老师第一步该做什么。
 */
export function NewSheetEmptyState() {
  const draft = useStore((s) => s.draft);
  const openSheetDialog = useStore((s) => s.openSheetDialog);
  const setModal = useStore((s) => s.setModal);
  const cls = currentClass();
  const hasRoster = !!cls?.students.some((st) => st.name?.trim());
  const tpl = SHEET_TEMPLATES[draft.templateId];

  return (
    <div className="empty-cta" role="region" aria-label="还没有登记表">
      <div className="empty-cta-icon" aria-hidden="true">{tpl.icon}</div>
      <div className="empty-cta-title">还没有登记表</div>
      <div className="empty-cta-sub">
        {formatDateCN(draft.date)} {weekdayCN(draft.date)} · {tpl.name}
      </div>

      <button
        type="button"
        className="empty-cta-btn"
        onClick={() => openSheetDialog('create')}
      >
        ＋ 新建登记
      </button>

      <div className="empty-cta-hint">先点上面的按钮，输入作业内容后即可开始登记。</div>

      {!hasRoster ? (
        <div className="empty-cta-hint empty-cta-hint--warn">
          还没导入花名册？请先点右上角 📁 导入，或在设置里确认班级人数。
          <button type="button" className="empty-cta-link" onClick={() => setModal('import')}>去导入</button>
        </div>
      ) : null}
    </div>
  );
}
