import type { SummaryModel } from '../domain/poster';
import { CellView } from './CellView';

/**
 * 当日汇总长图（设计 04 §6.6.2 / ADR-18）
 * 每张登记一个 section：图标 + 表名 + 作业内容 + 右侧统计 + 迷你网格。
 */
export function DailySummaryPoster({ model }: { model: SummaryModel }) {
  return (
    <div className="poster-root summary-root">
      <div className="poster-card summary-card">
        <h1 className="poster-title">{model.title}</h1>
        <div className="summary-subtitle">{model.subtitle}</div>

        <div className="poster-divider" />

        {model.empty ? (
          <div className="summary-empty">今日暂无登记</div>
        ) : (
          model.sections.map((sec) => (
            <section className="summary-section" key={sec.key}>
              <div className="summary-head">
                <div className="summary-title">
                  <span aria-hidden="true">{sec.icon}</span>
                  <strong>{sec.sheetName}</strong>
                  {sec.content ? <span className="summary-content">· {sec.content}</span> : null}
                </div>
                <div className="summary-stat">{sec.statLine}</div>
              </div>
              <div className="summary-grid">
                {sec.cells.map((c) => (
                  <CellView
                    key={c.no}
                    variant="mini"
                    no={c.no}
                    text={c.text}
                    tone={c.tone}
                    stamp={c.stamp}
                    status={c.status}
                    pass={c.pass}
                    makeup={c.makeup}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        <div className="poster-footer">{model.footer}</div>
      </div>
    </div>
  );
}
