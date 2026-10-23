import type { SummaryModel } from '../domain/poster';
import { SummarySectionBlock } from './SummarySectionBlock';

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
        {model.overflowNote ? <div className="summary-note">{model.overflowNote}</div> : null}

        <div className="poster-divider" />

        {model.empty ? (
          <div className="summary-empty">今日暂无登记</div>
        ) : (
          model.sections.map((sec) => <SummarySectionBlock key={sec.key} section={sec} />)
        )}

        {model.comment || model.schoolLine ? (
          <div className="poster-footer">
            {model.comment ? <div className="poster-comment">{model.comment}</div> : null}
            {model.schoolLine ? <div className="poster-school">{model.schoolLine}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
