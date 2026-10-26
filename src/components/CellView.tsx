import type { CellDisplay } from '../domain/tone';
import type { EntryStatus, Stamp } from '../domain/types';

/** 展示用单元格（V3 设计 06 §3.2）：网格、海报、汇总图共用同一套视觉 */
export interface CellViewProps {
  no: number;
  display: CellDisplay;
  stamp: Stamp;
  status: EntryStatus;
  pass: boolean;
  makeup: boolean;
  variant?: 'grid' | 'poster' | 'mini';
  focused?: boolean;
  selected?: boolean;
  matched?: boolean;
  error?: boolean;
  title?: string;
}

const BADGE_TEXT: Record<string, string> = {
  missing: '缺',
  leave: '假',
  madeup: '补',
  passed: '✓',
};

export function CellView({
  no,
  display,
  stamp,
  status,
  pass,
  makeup,
  variant = 'grid',
  focused,
  selected,
  matched,
  error,
  title,
}: CellViewProps) {
  const { text, kind, tone, grade, emoji, badge, subText, full } = display;

  return (
    <div
      className="cell"
      data-no={no}
      data-kind={kind}
      data-grade={grade}
      data-tone={tone}
      data-variant={variant}
      data-status={status}
      data-pass={pass ? '1' : undefined}
      data-badge={badge}
      data-focus={focused ? '1' : undefined}
      data-selected={selected ? '1' : undefined}
      data-match={matched ? '1' : undefined}
      data-error={error ? '1' : undefined}
      // v2.5.8：`[data-len="3"]`… 那组字号规则此前从未生效 —— 属性根本没渲染出来，
      // 于是「假」「缺交」这种多字文本只能按 24px 撑破格子。补上。
      data-len={text ? Math.min(6, Array.from(text).length) : undefined}
      title={title}
      aria-label={`${no}号 ${full || text || '空'}${badge ? ` · ${BADGE_TEXT[badge]}` : ''}`}
    >
      <span className="cell-no" aria-hidden="true">{no}</span>

      {text ? (
        <span className="cell-value">
          {text}
          {emoji ? <span className="cell-emoji" aria-hidden="true">{emoji}</span> : null}
        </span>
      ) : null}

      {badge ? (
        <span className="cell-badge" data-badge={badge} aria-hidden="true">
          {BADGE_TEXT[badge]}
        </span>
      ) : null}

      {subText ? <span className="cell-sub">{subText}</span> : null}

      {stamp !== 'none' ? (
        <span className="cell-stamp" data-stamp={stamp} aria-hidden="true">
          {stamp === 'corrected' ? '✅' : '⭐'}
        </span>
      ) : null}

      {makeup ? <span className="sr-only">已补交</span> : null}
    </div>
  );
}
