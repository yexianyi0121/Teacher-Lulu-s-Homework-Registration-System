import { useStore } from '../store';
import { selectSheetsOfDay } from '../store/selectors';
import { SHEET_TEMPLATES, TEMPLATE_LIST } from '../domain/constants';
import type { SheetTemplateId } from '../domain/types';
import { hasEntries } from '../store/initial';

/**
 * 参数行（PRD FR-14）：登记类型 / 选择登记表 / 日期 / 作业内容。
 * v2.5.10 用户反馈：同一天同一类型可以有多张表（作业内容不同），
 * 此前主屏只显示当前这一张，之前的表「再也看不到」。
 * 这里补一个选择器，只列当天该类型的表；切换 = switchRecord 落到既有记录。
 */
export function ParamsBar() {
  const draft = useStore((s) => s.draft);
  const switchTemplate = useStore((s) => s.switchTemplate);
  const setDate = useStore((s) => s.setDate);
  const setContent = useStore((s) => s.setContent);
  const switchRecord = useStore((s) => s.switchRecord);
  const deleteRecord = useStore((s) => s.deleteRecord);
  const openConfirm = useStore((s) => s.openConfirm);
  const sheets = useStore(selectSheetsOfDay).filter((s) => s.templateId === draft.templateId);
  const multi = sheets.length > 1;

  const pickSheet = (key: string) => {
    const hit = sheets.find((s) => s.key === key);
    if (!hit || hit.key === draft.key) return;
    // 作业内容就是同模板多张表的区分点（sheetId 相同），带上它才能落回原记录
    switchRecord({ content: hit.content, sheetId: hit.sheetId, templateId: hit.templateId as SheetTemplateId });
  };

  /** v2.6.2 FR-71.2：删除当前这张表（常见于作业内容随手打字打出来的空表） */
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
          onChange={(e) => switchTemplate(e.target.value as SheetTemplateId)}
        >
          {TEMPLATE_LIST.map((id) => (
            <option key={id} value={id}>
              {`${SHEET_TEMPLATES[id].icon} ${SHEET_TEMPLATES[id].name}`}
            </option>
          ))}
        </select>
      </label>

      {multi ? (
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

      {sheets.length > 1 || hasEntries(draft.entries) ? (
        <button
          type="button"
          className="pill pill--ghost pill--danger"
          aria-label="删除此表"
          onClick={deleteCurrentSheet}
        >
          🗑 删除此表
        </button>
      ) : null}

      <label className="params-field">
        <span className="field-label">日期</span>
        <input
          type="date"
          aria-label="日期"
          value={draft.date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </label>

      <label className="params-field params-grow">
        <span className="field-label">作业内容</span>
        <input
          type="text"
          aria-label="作业内容"
          maxLength={20}
          placeholder="如：第3单元字词"
          value={draft.content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
    </div>
  );
}
