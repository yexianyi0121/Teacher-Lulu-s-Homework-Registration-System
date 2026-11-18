import { useStore } from '../store';
import { selectSheetsOfDay } from '../store/selectors';
import { SHEET_TEMPLATES, TEMPLATE_LIST } from '../domain/constants';
import type { SheetTemplateId } from '../domain/types';
import { hasEntries } from '../store/initial';
import { DatePicker } from './DatePicker';
import { useGuardedSwitch } from '../hooks/useGuardedSwitch';

/**
 * 参数行：登记类型 / 日期 / 作业内容 / 新建登记 / 修改表名 / 选择登记表。
 *
 * 作业内容框只读展示「当前这张表的名字」：
 *   - 新建：点「＋ 新建登记」→ 弹窗输入作业内容 → 确定后建表并显示；
 *   - 改名：点「✏️ 修改表名」→ 原地改名，保留已录数据；
 *   - 没有表时，输入框为空且不可输入，也不显示改名按钮。
 */
export function ParamsBar() {
  const draft = useStore((s) => s.draft);
  const switchTemplate = useStore((s) => s.switchTemplate);
  const setDate = useStore((s) => s.setDate);
  const switchRecord = useStore((s) => s.switchRecord);
  const deleteRecord = useStore((s) => s.deleteRecord);
  const openConfirm = useStore((s) => s.openConfirm);
  const openSheetDialog = useStore((s) => s.openSheetDialog);
  const guarded = useGuardedSwitch();

  // 只把「真正的表」放进选择器：空的占位草稿不算
  const sheets = useStore(selectSheetsOfDay).filter(
    (s) => s.templateId === draft.templateId && (s.content.trim() !== '' || s.entered > 0),
  );
  const showPicker = sheets.length > 0;
  const hasSheet = draft.content.trim() !== '' || hasEntries(draft.entries);

  const pickSheet = (key: string) => {
    const hit = sheets.find((s) => s.key === key);
    if (!hit || hit.key === draft.key) return;
    guarded(() => switchRecord({ content: hit.content, sheetId: hit.sheetId, templateId: hit.templateId as SheetTemplateId }), '切换登记表');
  };

  /** 删除当前这张表 */
  const deleteCurrentSheet = () => {
    const st = useStore.getState();
    const rec = st.records[st.draft.key] ?? st.draft;
    const tpl = SHEET_TEMPLATES[rec.templateId];
    openConfirm({
      title: '删除登记表',
      message: `将删除「${tpl.name}${rec.content ? ` · ${rec.content}` : ''}」（${rec.date}）这张表的全部录入，且无法恢复。`,
      confirmText: '删除',
      danger: true,
      onConfirm: () => deleteRecord(st.draft.key),
    });
  };

  return (
    <div className="params">
      <label className="params-field">
        <span className="field-label">登记类型</span>
        <select
          className="pill pill--select"
          aria-label="登记类型"
          value={draft.templateId}
          onChange={(e) => { const id = e.target.value as SheetTemplateId; guarded(() => switchTemplate(id), '切换类型'); }}
        >
          {TEMPLATE_LIST.map((id) => (
            <option key={id} value={id}>
              {`${SHEET_TEMPLATES[id].icon} ${SHEET_TEMPLATES[id].name}`}
            </option>
          ))}
        </select>
      </label>

      <label className="params-field params-date-field">
        <span className="field-label">日期</span>
        <DatePicker value={draft.date} onChange={(v) => guarded(() => setDate(v), '切换日期')} />
      </label>

      <label className="params-field params-grow">
        <span className="field-label">作业内容</span>
        <input
          type="text"
          className="params-content params-content--readonly"
          aria-label="作业内容"
          readOnly
          value={draft.content}
          placeholder="点「＋ 新建登记」创建"
          title="作业内容在新建登记时填写；建好后可点「修改表名」"
          onChange={() => undefined}
        />
      </label>

      <button
        type="button"
        className="pill pill--create pill--primary"
        aria-label="新建登记"
        title="新建一张登记表：先输入作业内容，再开始登记"
        onClick={() => guarded(() => openSheetDialog('create'), '新建登记')}
      >
        ＋ 新建登记
      </button>

      {hasSheet ? (
        <button
          type="button"
          className="pill pill--ghost"
          aria-label="修改表名"
          title="修改当前登记表的作业内容（保留已录数据）"
          onClick={() => openSheetDialog('rename')}
        >
          ✏️ 修改表名
        </button>
      ) : null}

      {showPicker ? (
        <label className="params-field">
          <span className="field-label">选择登记表</span>
          <select
            className="pill pill--select"
            aria-label="选择登记表"
            value={draft.key}
            onChange={(e) => pickSheet(e.target.value)}
          >
            {sheets.map((s) => (
              <option key={s.key} value={s.key}>
                {s.content || '未命名'}{s.key === draft.key ? ' · 当前' : ''}{s.entered ? ` · ${s.entered} 人` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {hasSheet ? (
        <button
          type="button"
          className="pill pill--ghost pill--danger"
          aria-label="删除此表"
          onClick={deleteCurrentSheet}
        >
          🗑 删除此表
        </button>
      ) : null}
    </div>
  );
}
