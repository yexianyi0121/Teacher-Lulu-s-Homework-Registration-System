import { useEffect, useMemo, useRef } from 'react';
import type { ClassInfo, Entries, Mode, Settings } from '../domain/types';
import { buildPosterModel } from '../domain/poster-model';
import { Poster } from './Poster';

export interface PosterRasterProps {
  classInfo: ClassInfo;
  date: string;
  content: string;
  mode: Mode;
  entries: Entries;
  n: number;
  settings: Settings;
  onReady: (node: HTMLElement) => void;
}

/**
 * 屏幕外海报容器（设计 §6.6.2）
 * position: fixed; left: -20000px; width: 1080px —— 不参与布局，不影响编辑态
 */
export function PosterRaster({ classInfo, date, content, mode, entries, n, settings, onReady }: PosterRasterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const model = useMemo(
    () =>
      buildPosterModel({
        subject: classInfo.subject,
        teacher: classInfo.teacher,
        school: classInfo.school,
        date,
        content,
        mode,
        entries,
        n,
        settings,
      }),
    [classInfo, date, content, mode, entries, n, settings],
  );

  useEffect(() => {
    if (ref.current) readyRef.current(ref.current);
  }, [model]);

  return (
    <div className="poster-stage" aria-hidden="true">
      <div ref={ref}>
        <Poster model={model} />
      </div>
    </div>
  );
}
