import type { Stamp } from '../domain/types';

export interface StampBadgeProps {
  kind: Exclude<Stamp, 'none'>;
}

/** 右下角盖章角标（16×16，不遮挡等级文字） */
export function StampBadge({ kind }: StampBadgeProps) {
  return (
    <span className="stamp-badge" data-kind={kind} aria-hidden="true" title={kind === 'corrected' ? '已更正' : '优秀'}>
      {kind === 'corrected' ? '✓' : '★'}
    </span>
  );
}
