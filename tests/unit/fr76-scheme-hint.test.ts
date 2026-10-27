import { describe, expect, it } from 'vitest';
import { schemeHint } from '../../src/domain/scheme';
import { DEFAULT_SCHEMES } from '../../src/domain/constants';
import type { ScoringScheme } from '../../src/domain/types';

/**
 * v2.6.5 需求3：输出带常驻「本表方案」提示。
 * 老师不用点进本表设置，就该知道现在按什么口径判过关。
 */
const base = (patch: Partial<ScoringScheme>): ScoringScheme => ({ ...DEFAULT_SCHEMES.homework, ...patch });

describe('FR-76.1：schemeHint 说清方案类型 + 过关口径', () => {
  it('等级制：列出算过关的等级', () => {
    const s = base({ kind: 'grade', grades: ['A+', 'A', 'A-', 'B', 'C', 'D'], gradePass: ['A+', 'A'] });
    expect(schemeHint(s)).toBe('等级制 · 过关 A+/A');
  });

  it('等级制没勾任何等级时给出明确提示', () => {
    const s = base({ kind: 'grade', gradePass: [] });
    expect(schemeHint(s)).toContain('（未勾等级）');
  });

  it('分数制：说出按哪一档算过关（默认及格）', () => {
    const s = base({ kind: 'score', scorePassTier: undefined });
    expect(schemeHint(s)).toBe('分数制 · 及格以上算过关');
  });

  it('分数制选「良好」时提示跟着变', () => {
    const s = base({ kind: 'score', scorePassTier: 'good' });
    expect(schemeHint(s)).toBe('分数制 · 良好以上算过关');
  });

  it('混合制：等级与分数两条口径都写出来', () => {
    const s = base({ kind: 'mixed', gradePass: ['A+', 'A'], scorePassTier: 'excellent' });
    expect(schemeHint(s)).toBe('混合制 · 等级 A+/A；分数 优秀以上');
  });

  it('过关制与纯文本给出各自口径', () => {
    expect(schemeHint(base({ kind: 'check' }))).toBe('过关制 · 按 ✓ 判定过关');
    expect(schemeHint(base({ kind: 'text' }))).toBe('纯文本 · 不计过关');
  });
});
