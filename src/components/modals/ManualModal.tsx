import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { MANUAL, searchManual } from '../../domain/manual';
import { Modal } from '../ui/Modal';

/** 内置使用手册（设计 04 §6.9）：左侧目录 + 右侧内容 + 页内搜索 */
export function ManualModal() {
  const setModal = useStore((s) => s.setModal);
  const [query, setQuery] = useState('');
  const list = useMemo(() => searchManual(query), [query]);

  return (
    <Modal title="📖 使用手册" size="xl" onClose={() => setModal(null)}>
      <div className="manual">
        <aside className="manual-toc">
          <input
            type="search"
            aria-label="搜索手册"
            placeholder="搜索：补交 / 积分 / 语音…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul>
            {list.map((sec, i) => (
              <li key={sec.id}>
                <a href={`#manual-${sec.id}`} onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`manual-${sec.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}>
                  {i + 1}. {sec.icon} {sec.title}
                </a>
              </li>
            ))}
            {list.length === 0 ? <li className="field-hint">没有匹配的章节</li> : null}
          </ul>
        </aside>

        <div className="manual-body">
          {list.map((sec, i) => (
            <section key={sec.id} id={`manual-${sec.id}`} className="manual-section">
              <h3>{i + 1}. {sec.icon} {sec.title}</h3>
              {sec.intro ? <p>{sec.intro}</p> : null}
              {sec.steps ? (
                <>
                  <h4>怎么用</h4>
                  <ol>{sec.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                </>
              ) : null}
              {sec.keys ? (
                <>
                  <h4>快捷键</h4>
                  <table className="data-table">
                    <tbody>
                      {sec.keys.map(([k, v]) => (
                        <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
              {sec.tips ? (
                <>
                  <h4>注意</h4>
                  <ul>{sec.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                </>
              ) : null}
            </section>
          ))}
          <div className="field-hint">共 {MANUAL.length} 章 · 内容随版本内置，不联网</div>
        </div>
      </div>
    </Modal>
  );
}
