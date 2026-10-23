import type { PosterModel } from '../domain/poster';
import { CellView } from './CellView';

/**
 * 单条海报（设计 04 §6.5）：与编辑态共用 CellView 的视觉实现。
 * 海报态不挂任何事件、不显示姓名与统计（PRD BR-24 / AC-09.1）。
 */
export function Poster({ model }: { model: PosterModel }) {
  return (
    <div className="poster-root">
      <div className="poster-card">
        <h1 className="poster-title">{model.title}</h1>

        <div className="poster-badges">
          <span className="poster-badge">{model.badges.className}</span>
          <span className="poster-badge">{model.badges.mode}</span>
          <span className="poster-badge">{model.badges.date}</span>
          {model.badges.content ? <span className="poster-badge">{model.badges.content}</span> : null}
        </div>

        <div className="poster-divider" />

        <div className="poster-grid">
          {model.cells.map((cell) => (
            <CellView
              key={cell.no}
              variant="poster"
              no={cell.no}
              text={cell.text}
              tone={cell.tone}
              stamp={cell.stamp}
              status={cell.status}
              pass={cell.pass}
              makeup={cell.makeup}
            />
          ))}
        </div>

        <div className="poster-footer">{model.footer}</div>
      </div>
    </div>
  );
}
