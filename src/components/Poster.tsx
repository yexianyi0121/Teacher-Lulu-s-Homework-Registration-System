import type { PosterModel } from '../domain/poster-model';
import { CellView } from './CellView';

export interface PosterProps {
  model: PosterModel;
}

/**
 * 海报 DOM（设计 §6.6.3）：与编辑态共用 CellView 的视觉实现
 * 海报态不挂任何事件、不显示姓名与统计信息（PRD BR-24）。
 */
export function Poster({ model }: PosterProps) {
  return (
    <div className="poster-root">
      <div className="poster-card">
        <h1 className="poster-title">{model.title}</h1>

        <div className="poster-badges">
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
              value={cell.value}
              stamp={cell.stamp}
              mode={model.mode}
              tone={cell.tone}
            />
          ))}
        </div>

        <div className="poster-footer">{model.footer}</div>
      </div>
    </div>
  );
}
