import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CellView } from '../../src/components/CellView';
import { cellDisplay } from '../../src/domain/tone';
import type { Entry } from '../../src/domain/types';
import { e, makeScheme, text } from '../fixtures';

/**
 * v2.5.8 回归（FR-63.2）：CellView 必须渲染 data-len。
 * 这个属性此前从未输出过，CSS 里那组「多字文本降级字号」的规则（[data-len="3"] 等）
 * 因此一直没被触发，「假」「一二三」这类文本只能按基础字号撑破格子。
 * 本用例只守这一个属性——v2.5.8 这一批里唯一可自动化的部分；
 * 两带布局、重复角标、弹窗宽度是 CSS，靠截图取证（见 docs/23 §5）。
 */
const check = makeScheme('check');

function renderCell(entry: Entry) {
  const display = cellDisplay(entry, check);
  const { container } = render(
    <CellView
      no={7}
      display={display}
      stamp={entry.stamp}
      status={entry.status}
      pass={display.kind === 'pass'}
      makeup={Boolean(entry.makeup)}
    />,
  );
  return container.querySelector('.cell') as HTMLElement;
}

describe('v2.5.8 回归：data-len 必须出现在格子上（否则字号阶梯永不生效）', () => {
  it('三字文本 → data-len="3"', () => {
    expect(renderCell(e(text('一二三'))).getAttribute('data-len')).toBe('3');
  });

  it('请假主值「假」（单字）→ data-len="1"', () => {
    expect(renderCell(e(null, { status: 'leave' })).getAttribute('data-len')).toBe('1');
  });

  it('超过六字按上限 6（字号阶梯只写到 6）', () => {
    expect(renderCell(e(text('一二三四五六七八'))).getAttribute('data-len')).toBe('6');
  });

  it('空格不渲染 data-len（没有文本就没有字号规则）', () => {
    expect(renderCell(e(null)).hasAttribute('data-len')).toBe(false);
  });
});