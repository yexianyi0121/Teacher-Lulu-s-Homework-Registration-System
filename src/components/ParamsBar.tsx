import { useStore } from '../store';
import { SHEET_TEMPLATES, TEMPLATE_LIST } from '../domain/constants';
import type { SheetTemplateId } from '../domain/types';

export function ParamsBar() {
  const draft = useStore((s) => s.draft);
  const switchTemplate = useStore((s) => s.switchTemplate);
  const setDate = useStore((s) => s.setDate);
  const setContent = useStore((s) => s.setContent);

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
          value={draft.content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
    </div>
  );
}
