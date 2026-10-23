import type { Mode } from '../domain/types';
import { MODE_EMOJI, MODE_LABEL, MODE_LIST } from '../domain/constants';
import { useStore } from '../store';

export function ParamsBar() {
  const rec = useStore((s) => s.drafts[s.activeKey]);
  const switchMode = useStore((s) => s.switchMode);
  const setDate = useStore((s) => s.setDate);
  const setContent = useStore((s) => s.setContent);

  const mode = rec?.mode ?? 'homework';

  return (
    <section className="params" aria-label="登记参数">
      <label className="pill pill--select pill-lg" title="录入模式">
        <span aria-hidden="true">{MODE_EMOJI[mode]}</span>
        <select
          aria-label="录入模式"
          value={mode}
          onChange={(e) => switchMode(e.target.value as Mode)}
        >
          {MODE_LIST.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </label>

      <label className="pill-input" title="日期">
        <span aria-hidden="true">📅</span>
        <input
          type="date"
          aria-label="日期"
          value={rec?.date ?? ''}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: 140 }}
        />
      </label>

      <label className="pill-input" style={{ flex: '1 1 auto', minWidth: 200 }} title="作业内容">
        <span aria-hidden="true">📖</span>
        <input
          type="text"
          aria-label="作业内容"
          placeholder="作业内容，如：语文本"
          maxLength={20}
          value={rec?.content ?? ''}
          onChange={(e) => setContent(e.target.value)}
          style={{ flex: 1 }}
        />
      </label>
    </section>
  );
}
