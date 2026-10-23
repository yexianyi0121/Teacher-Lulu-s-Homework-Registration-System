import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { matchStudents } from '../domain/search';
import { useInputEngine } from '../hooks/useInputEngine';
import { Cell } from './Cell';

export interface GridProps {
  mode: import('../domain/types').Mode;
}

export function Grid({ mode }: GridProps) {
  const count = useStore((s) => s.settings.count);
  const focusedNo = useStore((s) => s.focusedNo);
  const searchQuery = useStore((s) => s.searchQuery);
  const modal = useStore((s) => s.modal);
  const gridRef = useRef<HTMLDivElement>(null);
  const { handleKey } = useInputEngine();

  const matched = useMemo(() => new Set(matchStudents(searchQuery, count)), [searchQuery, count]);

  // roving tabindex + 最小滚动（设计 §6.1.1）
  useEffect(() => {
    if (focusedNo === null) return;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-no="${focusedNo}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest' });
  }, [focusedNo, count, modal]);

  return (
    <div className="grid-wrap">
      <div
        ref={gridRef}
        className="grid"
        role="grid"
        aria-label="学号网格"
        aria-rowcount={Math.ceil(count / 10)}
        onKeyDown={handleKey}
      >
        {Array.from({ length: count }, (_, i) => i + 1).map((no) => (
          <Cell key={no} no={no} mode={mode} matched={matched.has(no)} />
        ))}
      </div>
    </div>
  );
}
