import { describe, expect, it } from 'vitest';
import { estimateWeekPart, groupWeek, paginateWeek, WEEK_MAX_HEIGHT } from '../../src/domain/posterWeek';
import { DEFAULT_GRADE_EMOJI } from '../../src/domain/constants';
import { DEFAULT_PASS_RULE } from '../../src/domain/passRule';
import type { PersistedStateV4, RecordDoc } from '../../src/domain/types';
import { e, makeScheme, score, studentsOf } from '../fixtures';

const DISPLAY = { passRule: DEFAULT_PASS_RULE, showEmoji: false, gradeEmoji: DEFAULT_GRADE_EMOJI };

function rec(date: string, sheetId: string, content: string, createdAt: number): RecordDoc {
  return {
    key: `cls_1|${date}|${content}|${sheetId}`,
    classId: 'cls_1', date, content, sheetId, templateId: 'quality', scheme: makeScheme('score'),
    entries: { '1': e(score(90)) }, createdAt, updatedAt: createdAt,
  };
}

function state(records: RecordDoc[]): PersistedStateV4 {
  return {
    version: 4, activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '三年二班', school: '某某中学', teacher: '刘露', subject: '语文', students: studentsOf(10), count: 10, createdAt: 1 }],
    records, history: [], pointRules: [], pointLedger: [],
    settings: {
      secondsJump: true, showName: false, honorIncludesA: false, voiceEnabled: true, voiceAutoConfirmMs: 1500, theme: 'pink',
      passRule: DEFAULT_PASS_RULE, gradeEmoji: DEFAULT_GRADE_EMOJI, showEmoji: false,
      defaultComment: '', showSchoolInPoster: false, autoBackupDays: 7, digitKey: 'auto',
      posterFollowTheme: false, installHintDismissed: false, lastExportAt: null,
    },
    lastSavedAt: 1,
  };
}

describe('groupWeek：ISO 周一→周日', () => {
  it('2026-10-23 所在周的周一是 10-19，共 7 天', () => {
    const parts = groupWeek(state([]), 'cls_1', '2026-10-23', DISPLAY);
    expect(parts).toHaveLength(7);
    expect(parts[0].date).toBe('2026-10-19');
    expect(parts[6].date).toBe('2026-10-25');
    expect(parts[0].heading).toBe('10月19日 周一');
  });

  it('按日归组，无登记的日期保留为空（FR-43.4）', () => {
    const parts = groupWeek(state([
      rec('2026-10-19', 's1', '听写', 1),
      rec('2026-10-19', 's2', '语文本', 2),
      rec('2026-10-21', 's3', '卷子', 3),
    ]), 'cls_1', '2026-10-19', DISPLAY);

    expect(parts[0].sheets).toHaveLength(2);
    expect(parts[1].empty).toBe(true);
    expect(parts[2].sheets).toHaveLength(1);
    expect(parts[0].sheets[0].cells).toHaveLength(10);
  });

  it('跨周记录不会混入', () => {
    const parts = groupWeek(state([rec('2026-10-26', 'sx', '下周', 1)]), 'cls_1', '2026-10-19', DISPLAY);
    expect(parts.every((p) => p.empty)).toBe(true);
  });
});

describe('paginateWeek：分卷边界（D-9 / AC-81）', () => {
  const parts = groupWeek(state([]), 'cls_1', '2026-10-19', DISPLAY);

  it('15999px 单页；16001px 分两页', () => {
    const a = paginateWeek(parts.slice(0, 1), () => 15999);
    expect(a).toHaveLength(1);
    const b = paginateWeek(parts.slice(0, 2), () => 8001);
    expect(b).toHaveLength(2);
    expect(b[0]).toHaveLength(1);
    expect(b[1]).toHaveLength(1);
  });

  it('页数按贪心装填', () => {
    const pages = paginateWeek(parts, () => 100, 250);
    expect(pages.map((p) => p.length)).toEqual([2, 2, 2, 1]);
  });

  it('单日超过上限时独占一页，不拆日', () => {
    const pages = paginateWeek(parts.slice(0, 2), (p) => (p.date === '2026-10-19' ? WEEK_MAX_HEIGHT + 1 : 10));
    expect(pages).toHaveLength(2);
    expect(pages[0][0].date).toBe('2026-10-19');
  });

  it('高度估算随表数与行数增长', () => {
    const one = estimateWeekPart(parts[0]);
    const withSheet = estimateWeekPart({ ...parts[0], sheets: [{
      key: 'k', icon: '📊', sheetName: '质量监测', content: '', statLine: '', createdAt: 1,
      comment: '',
      cells: Array.from({ length: 50 }, (_, i) => ({
        no: i + 1, text: '', kind: 'empty' as const, tone: 'empty' as const,
        stamp: 'none' as const, status: 'normal' as const, pass: false, makeup: false,
      })),
    }] });
    expect(withSheet).toBeGreaterThan(one);
  });
});
