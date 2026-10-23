import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { selectPosterModel, selectSummary } from '../store/selectors';
import { Poster } from './Poster';
import { DailySummaryPoster } from './DailySummaryPoster';

/**
 * 屏幕外海报容器（设计 04 §6.6）：position:fixed; left:-20000px; width:1080px
 * 不参与布局、不影响编辑态；高度自适应（汇总图很长）。
 */
export function PosterRaster({ onReady }: { onReady: (node: HTMLElement) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const mode = useStore((s) => s.posterMode);
  const poster = useStore(selectPosterModel);
  const summary = useStore(selectSummary);

  const ready = useMemo(() => (mode === 'daily' ? summary : poster), [mode, poster, summary]);

  useEffect(() => {
    if (ref.current) readyRef.current(ref.current);
  }, [ready]);

  return (
    <div className="poster-stage" aria-hidden="true">
      <div ref={ref}>
        {mode === 'daily' ? <DailySummaryPoster model={summary} /> : <Poster model={poster} />}
      </div>
    </div>
  );
}
