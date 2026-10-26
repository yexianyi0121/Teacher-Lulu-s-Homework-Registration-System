import type { SummarySection } from '../domain/poster';
import { CellView } from './CellView';

/** 当日/本周汇总共用的一段（标题 + 右侧统计 + 迷你网格） */
export function SummarySectionBlock({ section }: { section: SummarySection }) {
  return (
    <section className="summary-section" data-key={section.key}>
      <div className="summary-head">
        <div className="summary-title">
          <span aria-hidden="true">{section.icon}</span>
          <strong>{section.sheetName}</strong>
          {section.content ? <span className="summary-content">· {section.content}</span> : null}
        </div>
        <div className="summary-stat">{section.statLine}</div>
      </div>
      <div className="summary-grid">
        {section.cells.map((c) => (
          <CellView
            key={c.no}
            variant="mini"
            no={c.no}
            display={{
              text: c.text,
              kind: c.kind,
              tone: c.tone,
              grade: c.grade,
              emoji: c.emoji,
              badge: c.badge,
              subText: c.subText,
              full: c.text,
            }}
            stamp={c.stamp}
            status={c.status}
            pass={c.pass}
            makeup={c.makeup}
          />
        ))}
      </div>
      {/* v2.5.10 FR-66.2：这张表自己的评价语（汇总图按作业内容逐表写） */}
      {section.comment ? <div className="summary-section-comment">{section.comment}</div> : null}
    </section>
  );
}
