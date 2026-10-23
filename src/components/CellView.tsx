import type { ReactNode } from 'react';
import type { CellTone, CellValue, Mode, Stamp } from '../domain/types';
import { cellText } from '../domain/tone';
import { StampBadge } from './StampBadge';

export interface CellViewProps {
  variant: 'edit' | 'poster';
  no: number;
  value: CellValue | null;
  stamp: Stamp;
  mode: Mode;
  tone: CellTone;
  focused?: boolean;
  selected?: boolean;
  matched?: boolean;
  pulsing?: boolean;
  showName?: boolean;
  name?: string;
  /** 缓冲态预览文本（单元测试输入中，尚未写入 entries） */
  displayText?: string;
  flash?: boolean;
  tabIndex?: number;
  onClick?: () => void;
  onAnimationEnd?: () => void;
  children?: ReactNode;
}

/**
 * 单元格纯展示（设计 §9.3 / §10.3）
 * 编辑态与海报态共用同一份视觉实现，颜色与边框只有一份 CSS 来源。
 */
export function CellView({
  variant,
  no,
  value,
  stamp,
  mode,
  tone,
  focused,
  selected,
  matched,
  pulsing,
  showName,
  name,
  displayText,
  flash,
  tabIndex,
  onClick,
  onAnimationEnd,
  children,
}: CellViewProps) {
  const isEdit = variant === 'edit';
  const text = displayText !== undefined ? displayText : cellText(value);
  const grade = value?.kind === 'grade' ? value.grade : undefined;
  const labelled = showName && !!name;

  return (
    <div
      className="cell"
      data-variant={variant}
      data-mode={mode}
      data-tone={tone}
      data-no={isEdit ? no : undefined}
      data-grade={grade}
      data-len={mode === 'dictation' && text ? Math.min(6, text.length) : undefined}
      data-focus={isEdit && focused && !selected ? '1' : undefined}
      data-selected={isEdit && selected ? '1' : undefined}
      data-match={isEdit && matched ? '1' : undefined}
      data-pulse={isEdit && pulsing ? '1' : undefined}
      data-flash={isEdit && flash ? '1' : undefined}
      tabIndex={isEdit ? tabIndex : undefined}
      role={isEdit ? 'gridcell' : undefined}
      aria-label={isEdit ? `${no}号${labelled ? ` ${name}` : ''}${text ? ` ${text}` : ' 空'}` : undefined}
      aria-selected={isEdit && selected ? true : undefined}
      onClick={isEdit ? onClick : undefined}
      onAnimationEnd={isEdit ? onAnimationEnd : undefined}
    >
      <span className="cell-no" data-with-name={labelled ? '1' : undefined}>
        {no}
        {labelled ? ` ${name}` : ''}
      </span>
      {text ? (
        <span className="cell-value" data-grade={grade}>
          {text}
        </span>
      ) : null}
      {stamp !== 'none' ? <StampBadge kind={stamp} /> : null}
      {children}
    </div>
  );
}
