import { describe, expect, it } from 'vitest';
import { buildGradeKeyMap, describeKeyMap, gradeKeyOf } from '../../src/domain/keymap';
import { makeScheme } from '../fixtures';

describe('buildGradeKeyMap：键位随启用等级左到右绑定', () => {
  it('启用 3 档 → 1/2/3', () => {
    const km = buildGradeKeyMap(makeScheme('grade', { grades: ['A+', 'A', 'A-'] }));
    expect(km).toEqual({ '1': 'A+', '2': 'A', '3': 'A-' });
  });

  it('启用 4 档（含 B+）→ 4 B+', () => {
    const km = buildGradeKeyMap(makeScheme('grade', { grades: ['A+', 'A', 'A-', 'B+'] }));
    expect(km['4']).toBe('B+');
    expect(describeKeyMap(km)).toBe('1 A+ 2 A 3 A- 4 B+');
  });

  it('全 8 档 → 1..8（v2.5.9 B-）', () => {
    const km = buildGradeKeyMap(makeScheme('grade', { grades: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'] }));
    expect(Object.keys(km)).toHaveLength(8);
    expect(km['7']).toBe('C');
    expect(km['8']).toBe('D');
  });

  it('只启用 B+ → 1 B+（不按原档位硬编码）', () => {
    const km = buildGradeKeyMap(makeScheme('grade', { grades: ['B+'] }));
    expect(km).toEqual({ '1': 'B+' });
    expect(gradeKeyOf(km, 'B+')).toBe('1');
  });
});
