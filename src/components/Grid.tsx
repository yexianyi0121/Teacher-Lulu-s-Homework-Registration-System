import { useEffect, useMemo, useRef } from 'react';
import { useStore, currentClass } from '../store';
import { selectVisibleNos } from '../store/selectors';
import { matchStudents } from '../domain/search';
import { Cell } from './Cell';

export function Grid() {
  const nos = useStore(selectVisibleNos);
  const focusedNo = useStore((s) => s.focusedNo);
  const showName = useStore((s) => s.settings.showName);
  const searchQuery = useStore((s) => s.searchQuery);
  const students = currentClass()?.students;
  const ref = useRef<HTMLDivElement>(null);

  // 搜学号命中集合：命中格子强高亮，其余格子压暗，找人不靠运气
  const matched = useMemo(() => new Set(matchStudents(searchQuery, currentClass()?.count ?? 0)), [searchQuery, students?.length]);

  useEffect(() => {
    if (focusedNo === null) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-no="${focusedNo}"]`);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [focusedNo, nos.length]);

  // 输入过程中把第一个命中的格子滚进视野
  useEffect(() => {
    if (!searchQuery || matched.size === 0) return;
    const first = Math.min(...matched);
    const el = ref.current?.querySelector<HTMLElement>(`[data-no="${first}"]`);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [searchQuery]);

  return (
    <div className="grid-wrap" ref={ref}>
      <div
        className="grid"
        role="grid"
        aria-label="学生登记网格"
        data-searching={searchQuery ? '1' : undefined}
      >
        {nos.map((no) => (
          <Cell
            key={no}
            no={no}
            name={students?.find((s) => s.no === no)?.name}
            showName={showName}
            matched={matched.has(no)}
          />
        ))}
      </div>
    </div>
  );
}
