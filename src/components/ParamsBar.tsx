import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { selectSheetsOfDay } from '../store/selectors';
import { SHEET_TEMPLATES, TEMPLATE_LIST } from '../domain/constants';
import type { SheetTemplateId } from '../domain/types';
import { hasEntries } from '../store/initial';

/**
 * 参数行（PRD FR-14）：登记类型 / 日期 / 作业内容 / 选择登记表。
 * v2.5.10 用户反馈：同一天同一类型可以有多张表（作业内容不同），补了选择器。
 * v2.6.3 用户反馈（问题四）：以前在「作业内容」里每敲一个字就 switchRecord 建一张表，
 * 列表里凭空多出一堆删不完的表。现在作业内容只是**待新建**的名称，点「新建登记」才建表；
 * 想改已登记表的名称，先选中那张表再改这里的名字（改名 = 新建 + 删旧，不在本轮范围）。
 */
export function ParamsBar() {
  const draft = useStore((s) => s.draft);
  const switchTemplate = useStore((s) => s.switchTemplate);
  const setDate = useStore((s) => s.setDate);
  const newSheet = useStore((s) => s.newSheet);
  const switchRecord = useStore((s) => s.switchRecord);
  const deleteRecord = useStore((s) => s.deleteRecord);
  const openConfirm = useStore((s) => s.openConfirm);
  const sheets = useStore(selectSheetsOfDay).filter((s) => s.templateId === draft.templateId);
  const multi = sheets.length > 1;

  // 输入框只是「下一张表的作业内容」，不随每敲一个字写库
  const [content, setContent] = useState(draft.content);
  useEffect(() => {
    setContent(draft.content);
  }, [draft.key, draft.content]);

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

  const createSheet = () => newSheet(content);
  const dirty = content.trim() !== draft.content;

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
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              createSheet();
            }
          }}
        />
      </label>

      <button
        type="button"
        className={`pill${dirty ? ' pill--primary' : ''}`}
        aria-label="新建登记"
        title="用上面的作业内容新建一张登记表（同名则直接切过去）"
        onClick={createSheet}
      >
        ＋ 新建登记
      </button>

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
    </div>
  );
}
