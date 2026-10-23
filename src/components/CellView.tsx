import type { CellTone, EntryStatus, Stamp } from '../domain/types';

/** 展示用单元格（设计 04 §9.1）：网格、海报、汇总图共用同一套视觉 */
export interface CellViewProps {
  no: number;
  text: string;
  tone: CellTone;
  stamp: Stamp;
  status: EntryStatus;
  pass: boolean;
  makeup: boolean;
  variant?: 'grid' | 'poster' | 'mini';
  focused?: boolean;
  selected?: boolean;
  matched?: boolean;
  title?: string;
}

export function CellView({
  no,
  text,
  tone,
  stamp,
  status,
  pass,
  makeup,
  variant = 'grid',
  focused,
  selected,
  matched,
  title,
}: CellViewProps) {
  return (
    <div
      className="cell"
      data-no={no}
      data-tone={tone}
      data-variant={variant}
      data-status={status}
      data-pass={pass ? '1' : undefined}
      data-focus={focused ? '1' : undefined}
      data-selected={selected ? '1' : undefined}
      data-match={matched ? '1' : undefined}
      title={title}
      aria-label={`${no}号 ${text || '空'}`}
    >
      <span className="cell-no" aria-hidden="true">{no}</span>
      {text ? <span className="cell-value">{text}</span> : null}

      {stamp !== 'none' ? (
        <span className="stamp-badge" data-stamp={stamp} aria-hidden="true">
          {stamp === 'corrected' ? '✅' : '⭐'}
        </span>
      ) : null}

      {makeup ? (
        <span className="stamp-badge" data-stamp="makeup" aria-label="已补交">↺</span>
      ) : null}
    </div>
  );
}
