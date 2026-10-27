import { describe, expect, it } from 'vitest';
import { useStore } from '../../src/store';
import { selectSheetsOfDay } from '../../src/store/selectors';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { studentsOf } from '../fixtures';
import { todayISO } from '../../src/domain/date';
import type { Entry, GradeLetter, PersistedStateV4, RecordDoc, ScoringScheme } from '../../src/domain/types';

/**
 * v2.6.3 回归（FR-73.3，用户问题四）：
 * 「作业内容」只是**待新建**的名称——点「新建登记」才建表，随手打字不该凭空多出一张表。
 * 同名再点一次 = 切回那张表（不重复建）。
 */

const grades: GradeLetter[] = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'];
const scheme: ScoringScheme = {
  kind: 'grade', maxScore: null, grades: [...grades],
  allowCheck: true, allowText: true, decimals: 0,
  excellentRate: 0.9, goodRate: 0.8, passRate: 0.6,
  gradePass: ['A+', 'A'], scorePassTier: 'pass',
  missingPass: false, leavePass: false, dictationAutoPass: true,
};

const date = todayISO();
const sheetId = 'sheet_default_homework';

const entry: Entry = {
  value: { kind: 'grade', grade: 'A+' },
  stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 1,
};

function rec(content: string, updatedAt: number, entries: Record<string, Entry> = { 1: entry }): RecordDoc {
  return {
    key: `cls_1|${date}|${content}|${sheetId}`,
    classId: 'cls_1', date, content, sheetId, templateId: 'homework', scheme,
    entries, createdAt: updatedAt, updatedAt,
  } as unknown as RecordDoc;
}

function persisted(records: RecordDoc[]): PersistedStateV4 {
  return {
    version: 4, activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '2025级19班', school: '', teacher: '', subject: '语文', students: studentsOf(5), count: 5, createdAt: 1 }],
    records, history: [], pointRules: [], pointLedger: [],
    settings: { ...DEFAULT_SETTINGS }, lastSavedAt: 1,
  } as unknown as PersistedStateV4;
}

describe('FR-73.3：新建登记才建表', () => {
  it('空内容：拒绝建表，给 warn 提示，当前表不变', () => {
    useStore.getState().replaceState(persisted([rec('默写', 100)]));
    const before = useStore.getState().draft.key;
    useStore.getState().newSheet('   ');
    expect(useStore.getState().draft.key).toBe(before);
    expect(Object.keys(useStore.getState().records)).toHaveLength(1);
  });

  it('新内容：建一张空表并切过去，旧表不受影响', () => {
    const a = rec('默写', 100);
    useStore.getState().replaceState(persisted([a]));
    useStore.getState().newSheet('作文');
    const st = useStore.getState();
    expect(st.draft.content).toBe('作文');
    expect(st.draft.entries).toEqual({});
    expect(st.records[a.key].entries[1].value).not.toBeNull();
    expect(selectSheetsOfDay(st).map((s) => s.content).sort()).toEqual(['作文', '默写']);
  });

  it('同名再点一次：切回那张表，不重复建（records 数量不变）', () => {
    const a = rec('默写', 100);
    const b = rec('作文', 200);
    useStore.getState().replaceState(persisted([a, b]));
    useStore.getState().switchRecord({ content: '作文', sheetId, templateId: 'homework' });
    useStore.getState().newSheet('默写');
    expect(useStore.getState().draft.key).toBe(a.key);
    expect(Object.keys(useStore.getState().records)).toHaveLength(2);
  });

  it('内容首尾空格会被去掉，且截到 20 字', () => {
    useStore.getState().replaceState(persisted([]));
    useStore.getState().newSheet('  第3单元  ');
    expect(useStore.getState().draft.content).toBe('第3单元');
    useStore.getState().newSheet('一二三四五六七八九十一二三四五六七八九十超出的字');
    expect(Array.from(useStore.getState().draft.content)).toHaveLength(20);
  });

  it('新建的表不会把已登记的表挤掉（选择器里按 key 各算一张）', () => {
    const a = rec('默写', 100);
    useStore.getState().replaceState(persisted([a]));
    useStore.getState().newSheet('作文');
    // 新表还是空的：选择器列「已登记」+ 当前这张 → 2 项
    expect(selectSheetsOfDay(useStore.getState()).map((s) => s.content).sort()).toEqual(['作文', '默写']);
    // 再点同名「默写」= 切回那张表，不新建
    useStore.getState().newSheet('默写');
    expect(useStore.getState().draft.key).toBe(a.key);
    expect(Object.keys(useStore.getState().records)).toHaveLength(2);
  });
});

describe('FR-73.3：fromPersisted 之后仍能新建（不依赖已有表）', () => {
  it('空 records 时也能新建第一张表', () => {
    const dumped = persisted([]);
    useStore.getState().replaceState(dumped);
    useStore.getState().newSheet('默写');
    const st = useStore.getState();
    expect(st.draft.content).toBe('默写');
    expect(Object.values(st.records).some((r) => r.content === '默写')).toBe(true);
  });
});
