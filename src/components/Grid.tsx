import { useEffect, useRef } from 'react';
import { useStore, currentClass } from '../store';
import { selectVisibleNos } from '../store/selectors';
import { Cell } from './Cell';

export function Grid() {
  const nos = useStore(selectVisibleNos);
  const focusedNo = useStore((s) => s.focusedNo);
  const showName = useStore((s) => s.settings.showName);
  const students = currentClass()?.students;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusedNo === null) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-no="${focusedNo}"]`);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [focusedNo, nos.length]);

  return (
    <div className="grid-wrap" ref={ref}>
      <div className="grid" role="grid" aria-label="学生登记网格">
        {nos.map((no) => (
          <Cell key={no} no={no} name={students?.find((s) => s.no === no)?.name} showName={showName} />
        ))}
      </div>
    </div>
  );
}
