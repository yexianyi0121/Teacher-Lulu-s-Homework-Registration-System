import { describe, expect, it } from 'vitest';
import { cellText, cellTone } from '../../src/domain/tone';
import { makeSettings } from '../fixtures';

describe('cellTone（设计 §9.3）', () => {
  const s = makeSettings({ count: 50 });

  it('常规作业等级映射', () => {
    expect(cellTone('homework', { kind: 'grade', grade: 'A+' }, s)).toBe('green');
    expect(cellTone('homework', { kind: 'grade', grade: 'A' }, s)).toBe('green');
    expect(cellTone('homework', { kind: 'grade', grade: 'A-' }, s)).toBe('amber');
    expect(cellTone('homework', { kind: 'grade', grade: 'CHECK' }, s)).toBe('blue');
    expect(cellTone('homework', { kind: 'grade', grade: 'CROSS' }, s)).toBe('gray');
  });

  it('单元测试默认阈值 90/60', () => {
    expect(cellTone('quiz', { kind: 'score', score: 90 }, s)).toBe('green');
    expect(cellTone('quiz', { kind: 'score', score: 89.9 }, s)).toBe('blue');
    expect(cellTone('quiz', { kind: 'score', score: 80 }, s)).toBe('blue');
    expect(cellTone('quiz', { kind: 'score', score: 79.9 }, s)).toBe('amber');
    expect(cellTone('quiz', { kind: 'score', score: 60 }, s)).toBe('amber');
    expect(cellTone('quiz', { kind: 'score', score: 59.9 }, s)).toBe('red');
  });

  it('阈值跟随设置（优秀线 85）', () => {
    const s85 = makeSettings({ count: 50, excellentLine: 85 });
    expect(cellTone('quiz', { kind: 'score', score: 87 }, s85)).toBe('green');
    expect(cellTone('quiz', { kind: 'score', score: 84 }, s85)).toBe('blue');
  });

  it('听写默写：0 错绿 / 1–3 黄 / ≥4 红 / 缺交灰 / 其他蓝', () => {
    expect(cellTone('dictation', { kind: 'text', text: '全对' }, s)).toBe('green');
    expect(cellTone('dictation', { kind: 'text', text: '错1' }, s)).toBe('amber');
    expect(cellTone('dictation', { kind: 'text', text: '错3' }, s)).toBe('amber');
    expect(cellTone('dictation', { kind: 'text', text: '错4' }, s)).toBe('red');
    expect(cellTone('dictation', { kind: 'text', text: '缺交' }, s)).toBe('gray');
    expect(cellTone('dictation', { kind: 'text', text: '字迹工整' }, s)).toBe('blue');
  });

  it('空值 tone 为 empty', () => {
    expect(cellTone('homework', null, s)).toBe('empty');
  });
});

describe('cellText（空值不渲染任何字符）', () => {
  it('null → 空串，不是 —', () => {
    expect(cellText(null)).toBe('');
  });

  it('等级与分数展示', () => {
    expect(cellText({ kind: 'grade', grade: 'CHECK' })).toBe('√');
    expect(cellText({ kind: 'grade', grade: 'CROSS' })).toBe('×');
    expect(cellText({ kind: 'score', score: 90 })).toBe('90');
    expect(cellText({ kind: 'score', score: 90.5 })).toBe('90.5');
    expect(cellText({ kind: 'text', text: '错2' })).toBe('错2');
  });
});
