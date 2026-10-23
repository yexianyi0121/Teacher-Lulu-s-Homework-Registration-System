import { describe, expect, it } from 'vitest';
import { cellDisplay } from '../../src/domain/tone';
import { e, g, makeScheme, score, text } from '../fixtures';

/**
 * 单元格配色（设计 04 §9.1 + 评审 F4 / §4 待裁定项）
 * 规则：
 *   - 状态位优先：请假/缺交 → 灰
 *   - 过关 → 绿 √
 *   - 分数/等级按档位；但等级 A- 固定琥珀（沿用 V1「很好但要订正」）
 *   - 文字按 classifyDictation：全对绿、错1–3 琥珀、错≥4 红、其他灰
 */

const check = makeScheme('check');
const grade = makeScheme('grade');
const scoreScheme = makeScheme('score');

describe('cellDisplay：状态位', () => {
  it('请假 → 假 / gray；缺交 → × / gray', () => {
    expect(cellDisplay(e(null, { status: 'leave' }), check)).toEqual({ text: '假', tone: 'gray', full: '请假' });
    expect(cellDisplay(e(null, { status: 'missing' }), check)).toEqual({ text: '×', tone: 'gray', full: '缺交' });
  });

  it('过关 → √ / green（pass=true 与 value.kind=pass 等价）', () => {
    expect(cellDisplay(e(null, { pass: true }), check)).toMatchObject({ text: '√', tone: 'green' });
    expect(cellDisplay(e({ kind: 'pass' }), check)).toMatchObject({ text: '√', tone: 'green' });
  });

  it('空格子 → empty', () => {
    expect(cellDisplay(undefined, check)).toMatchObject({ text: '', tone: 'empty' });
  });
});

describe('cellDisplay：听写「错N」配色（V1 §4.2 继承，F4 回归）', () => {
  it('错1 / 错2 / 错3 → amber', () => {
    for (const t of ['错1', '错2', '错3', '错 2']) {
      expect(cellDisplay(e(text(t)), check).tone).toBe('amber');
    }
  });

  it('错4 / 错5 → red', () => {
    expect(cellDisplay(e(text('错4')), check).tone).toBe('red');
    expect(cellDisplay(e(text('错12')), check).tone).toBe('red');
  });

  it('全对 → green；其他文字 → gray', () => {
    expect(cellDisplay(e(text('全对')), check).tone).toBe('green');
    expect(cellDisplay(e(text('字迹工整')), check).tone).toBe('gray');
  });

  it('文字值保留原文（不截断，截断在 Cell 层做）', () => {
    expect(cellDisplay(e(text('错3')), check).text).toBe('错3');
  });
});

describe('cellDisplay：等级配色（V1 黄色语义）', () => {
  it('A+ 绿、A 绿（95% ≥ 优秀线）', () => {
    expect(cellDisplay(e(g('A+')), grade).tone).toBe('green');
    expect(cellDisplay(e(g('A')), grade).tone).toBe('green');
  });

  it('A- 固定 amber：统计里算优秀，但老师的批改直觉是「要订正」', () => {
    expect(cellDisplay(e(g('A-')), grade).tone).toBe('amber');
  });

  it('B+/B 蓝、C 琥珀、D 红（按档位）', () => {
    expect(cellDisplay(e(g('B+')), grade).tone).toBe('blue');
    expect(cellDisplay(e(g('B')), grade).tone).toBe('blue');
    expect(cellDisplay(e(g('C')), grade).tone).toBe('amber');
    expect(cellDisplay(e(g('D')), grade).tone).toBe('red');
  });
});

describe('cellDisplay：分数配色（按百分比）', () => {
  it('90 绿、72 琥珀、43 红', () => {
    expect(cellDisplay(e(score(90)), scoreScheme).tone).toBe('green');
    expect(cellDisplay(e(score(72)), scoreScheme).tone).toBe('amber');
    expect(cellDisplay(e(score(43)), scoreScheme).tone).toBe('red');
  });

  it('满分 120 时按比例判定：108 = 90% 绿，72 = 60% 琥珀', () => {
    const s120 = makeScheme('score', { maxScore: 120 });
    expect(cellDisplay(e(score(108)), s120).tone).toBe('green');
    expect(cellDisplay(e(score(72)), s120).tone).toBe('amber');
  });
});
