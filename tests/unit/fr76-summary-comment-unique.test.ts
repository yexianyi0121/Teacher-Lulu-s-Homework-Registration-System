import { describe, expect, it } from 'vitest';
import { useStore } from '../../src/store';
import { selectSummary, selectWeek } from '../../src/store/selectors';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { studentsOf } from '../fixtures';
import { todayISO, weekStartOf } from '../../src/domain/date';
import type { PersistedStateV4, RecordDoc, ScoringScheme } from '../../src/domain/types';

/**
 * v2.6.5 回归（FR-76.5）：
 * 建 3 张表、各写各的评价语，点「重新生成」后，最后一张表的位置会多出一行
 * 与第一张相同的评价语——根因是汇总图还画着「整图评价语」，
 * 而它的来源是当前草稿那张表的 comment。
 * 结论：汇总图（当日/本周）不再有整图评价语，评价语只跟着各自的表走。
 */

const grades = ['A+', 'A', 'A-', 'B+', 'B', 'C', 'D'] as const;

const scheme: ScoringScheme = {
  kind: 'grade',
  maxScore: null,
  grades: [...grades],
  allowCheck: true,
  allowText: true,
  decimals: 0,
  excellentRate: 0.9,
  goodRate: 0.8,
  passRate: 0.6,
};

const entry = {
  value: { kind: 'grade' as const, grade: 'A' as const },
  stamp: 'none' as const,
  status: 'normal' as const,
  pass: false,
  makeup: null,
  updatedAt: 1,
};

function rec(content: string, createdAt: number, comment?: string): RecordDoc {
  const date = todayISO();
  return {
    key: `cls_1|${date}|${content}|sheet_default_homework`,
    classId: 'cls_1',
    date,
    content,
    sheetId: 'sheet_default_homework',
    templateId: 'homework',
    scheme,
    entries: { 1: entry },
    createdAt,
    updatedAt: createdAt,
    comment,
  } as unknown as RecordDoc;
}

function persisted(records: RecordDoc[]): PersistedStateV4 {
  return {
    version: 4,
    activeClassId: 'cls_1',
    classes: [
      {
        id: 'cls_1',
        name: '2025级19班',
        school: '',
        teacher: '',
        subject: '语文',
        students: studentsOf(5),
        count: 5,
        createdAt: 1,
      },
    ],
    records,
    history: [],
    pointRules: [],
    pointLedger: [],
    settings: { ...DEFAULT_SETTINGS },
    lastSavedAt: 1,
  } as unknown as PersistedStateV4;
}

/** 三张表，各写各的评价语；草稿落在最后一张（它的 comment 就是「还行」） */
function threeSheets() {
  const state = persisted([rec('第1单元', 100, '可以'), rec('第2单元', 200, '不错'), rec('第3单元', 300, '还行')]);
  useStore.getState().replaceState(state);
  return useStore.getState();
}

describe('FR-76.5：汇总图不再重复整图评价语', () => {
  it('当日汇总的整图 comment 恒为空（页脚不再重复某张表的评价语）', () => {
    const st = threeSheets();
    expect(st.draft.comment).toBe('还行');
    expect(selectSummary(st).comment).toBe('');
  });

  it('每张表的评价语仍各就各位（顺序与表顺序一致）', () => {
    const st = threeSheets();
    expect(selectSummary(st).sections.map((s) => s.comment)).toEqual(['可以', '不错', '还行']);
  });

  it('每条评价语在汇总图里只出现一次（不会多出重复的一行）', () => {
    const st = threeSheets();
    const model = selectSummary(st);
    const all = [model.comment, ...model.sections.map((s) => s.comment)].filter(Boolean);
    for (const text of ['可以', '不错', '还行']) {
      expect(all.filter((x) => x === text)).toHaveLength(1);
    }
  });

  it('本周汇总同样没有整图评价语', () => {
    const st = threeSheets();
    const model = selectWeek(st, weekStartOf(todayISO()));
    expect(model.comment).toBe('');
    const texts = model.pages.flat().flatMap((p) => p.sheets.map((s) => s.comment));
    expect(texts).toEqual(['可以', '不错', '还行']);
  });
});
