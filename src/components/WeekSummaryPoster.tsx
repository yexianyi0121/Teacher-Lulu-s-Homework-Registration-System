import type { WeekModel } from '../domain/posterWeek';
import { SummarySectionBlock } from './SummarySectionBlock';

/**
 * 本周汇总（V3 FR-43）：按日纵向拼接，1:1 像素不缩放；一页装不下时由上层分卷。
 */
export function WeekSummaryPoster({ model, page }: { model: WeekModel; page: number }) {
  const parts = model.pages[page] ?? [];
  return (
    <div className="poster-root summary-root week-root">
      <div className="poster-card summary-card">
        <h1 className="poster-title">{model.title}</h1>
        <div className="summary-subtitle">{model.subtitle}</div>
        {model.pages.length > 1 ? (
          <div className="summary-note">（第 {page + 1} / {model.pages.length} 张）</div>
        ) : null}

        <div className="poster-divider" />

        {parts.map((part) => (
          <div className="week-day" key={part.date}>
            <div className="week-day-head">
              <strong>{part.heading}</strong>
              {part.empty ? <span className="week-empty">当日无登记</span> : null}
            </div>
            {part.sheets.map((sec) => <SummarySectionBlock key={sec.key} section={sec} />)}
          </div>
        ))}

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
