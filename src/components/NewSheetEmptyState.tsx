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
  const history = useStore((s) => s.history);
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

      {history.length > 0 ? (
        <div className="empty-cta-hint empty-cta-hint--ok">
          本地历史数据仍在：共 {history.length} 条（最近 {formatDateCN(history[0].date)}）。
          <button type="button" className="empty-cta-link" onClick={() => setModal('settings')}>查看历史记录</button>
        </div>
      ) : (
        <div className="empty-cta-hint empty-cta-hint--warn">
          这个浏览器里没有历史数据。若你之前登记过，请用<strong>原来打开系统的浏览器/窗口</strong>打开；
          或用【设置 → 导入恢复】导入备份文件。
        </div>
      )}

      {!hasRoster ? (
        <div className="empty-cta-hint empty-cta-hint--warn">
          还没导入花名册？请先点右上角 📁 导入，或在设置里确认班级人数。
          <button type="button" className="empty-cta-link" onClick={() => setModal('import')}>去导入</button>
        </div>
      ) : null}
    </div>
  );
}
