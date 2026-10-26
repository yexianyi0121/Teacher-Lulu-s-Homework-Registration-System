import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { selectPosterBySheet, selectSummary, selectWeek } from '../store/selectors';
import type { PosterTarget } from '../domain/types';
import { Poster } from './Poster';
import { DailySummaryPoster } from './DailySummaryPoster';
import { WeekSummaryPoster } from './WeekSummaryPoster';

/**
 * 屏幕外海报容器（设计 04 §6.6 / V3 §3.6）：position:fixed; left:-20000px; width:1080px
 * target 变化 → 重新栅格化；本周汇总可能有多页（分卷），一次性交给父组件。
 */
export function PosterRaster({
  target,
  onReady,
}: {
  target: PosterTarget;
  onReady: (nodes: HTMLElement[]) => void;
}) {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const poster = useStore((s) => selectPosterBySheet(s, target.mode === 'single' ? target.key : s.draft.key));
  const summary = useStore(selectSummary);
  const week = useStore((s) => selectWeek(s, target.mode === 'week' ? target.weekStart : undefined));
  // FR-48.3：海报默认不跟随背景主题（发家长群要稳定的白卡 + 品牌粉）；
  // 设置里打开「海报也套用背景」后才跟随。
  const posterTheme = useStore((s) => (s.settings.posterFollowTheme ? s.settings.theme : 'pink'));

  const pageCount = target.mode === 'week' ? week.pages.length : 1;

  const signature = useMemo(
    () => `${target.mode}|${target.mode === 'single' ? target.key : ''}|${pageCount}|${week.subtitle}`,
    [target, pageCount, week.subtitle],
  );

  useEffect(() => {
    const nodes = refs.current.slice(0, pageCount).filter((n): n is HTMLDivElement => !!n);
    if (nodes.length) readyRef.current(nodes);
  }, [signature, pageCount]);

  return (
    <div className="poster-stage" aria-hidden="true" data-theme={posterTheme}>
      {target.mode === 'week' ? (
        week.pages.map((_, i) => (
          <div key={i} ref={(el) => { refs.current[i] = el; }}>
            <WeekSummaryPoster model={week} page={i} />
          </div>
        ))
      ) : (
        <div ref={(el) => { refs.current[0] = el; }}>
          {target.mode === 'single' ? <Poster model={poster} /> : <DailySummaryPoster model={summary} />}
        </div>
      )}
    </div>
  );
}
