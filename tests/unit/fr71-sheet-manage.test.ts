import { describe, expect, it } from 'vitest';
import { fromPersisted, useStore } from '../../src/store';
import { selectSheetsOfDay, selectSummary } from '../../src/store/selectors';
import { isPassed } from '../../src/domain/passRule';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { studentsOf } from '../fixtures';
import { todayISO } from '../../src/domain/date';
import type { GradeLetter, PassRule, PersistedStateV4, RecordDoc, ScoringScheme } from '../../src/domain/types';

/**
 * v2.6.2 回归（FR-71，用户三问）：
 * - FR-71.1：「选择登记表」只列当天**已登记**的表。以前作业内容里每打一个字，
 *   switchRecord 就生成一张空记录，选择器立刻多一项，而且没有任何入口能删掉它。
 * - FR-71.2：整张表可以删（records + history 一起清）；删当前表时回到同模板当天
 *   最近一条有内容的记录，不会把界面丢在一张不存在的表上。
 * - FR-71.3：缺交 / 请假是否算过关由老师自己选（默认不算，与 V2 起一致）。
 */

const grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'] as const;

const scheme: ScoringScheme = {
  kind: 'grade', maxScore: null,
  grades: [...grades],
  allowCheck: true, allowText: true, decimals: 0,
  excellentRate: 0.9, goodRate: 0.8, passRate: 0.6,
};

const entry = {
  value: { kind: 'grade' as const, grade: 'A+' as const },
  stamp: 'none' as const, status: 'normal' as const, pass: false,
  makeup: null, updatedAt: 1,
};

const date = todayISO();
const sheetId = 'sheet_default_homework';

function rec(content: string, updatedAt: number, opts: { entries?: Record<string, unknown> } = {}): RecordDoc {
  return {
    key: `cls_1|${date}|${content}|${sheetId}`,
    classId: 'cls_1', date, content, sheetId, templateId: 'homework', scheme,
    entries: opts.entries ?? { 1: entry },
    createdAt: updatedAt, updatedAt,
  } as unknown as RecordDoc;
}

function persisted(records: RecordDoc[], history: RecordDoc[] = []): PersistedStateV4 {
  return {
    version: 4,
    activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '2025级19班', school: '', teacher: '', subject: '语文', students: studentsOf(5), count: 5, createdAt: 1 }],
    records, history, pointRules: [], pointLedger: [],
    settings: { ...DEFAULT_SETTINGS }, lastSavedAt: 1,
  } as unknown as PersistedStateV4;
}

describe('FR-71.1：选择器只列已登记的表（作业内容随手打字不再污染选项）', () => {
  it('空表不进列表；当前草稿即使没登记也保留（要能切回来）', () => {
    const a = rec('默写', 100);
    const empty = rec('随手打的空表', 200, { entries: {} });
    useStore.getState().replaceState(persisted([a, empty]));
    // 当前就在那张空表上
    useStore.getState().switchRecord({ content: '随手打的空表', sheetId, templateId: 'homework' });
    const sheets = selectSheetsOfDay(useStore.getState());
    const contents = sheets.map((s) => s.content);
    expect(contents).toContain('默写');
    expect(contents).toContain('随手打的空表');   // 当前表必须在，否则选择器没有「当前」锚点
    // 但只登记过的那张才有 entered 数字；空表 entered=0
    const emptyRow = sheets.find((s) => s.content === '随手打的空表')!;
    expect(emptyRow.entered).toBe(0);
  });

  it('history 里的空表也被过滤掉', () => {
    const a = rec('默写', 100);
    const ghost = rec('空的历史表', 200, { entries: {} });
    useStore.getState().replaceState(persisted([a], [ghost as never]));
    const sheets = selectSheetsOfDay(useStore.getState());
    expect(sheets.map((s) => s.content)).toEqual(['默写']);
  });

  it('切到别的内容再切回来，数据都还在（选择器不会把表弄丢）', () => {
    const a = rec('默写', 100);
    const b = rec('作文', 200);
    useStore.getState().replaceState(persisted([a, b]));
    useStore.getState().switchRecord({ content: '作文', sheetId, templateId: 'homework' });
    useStore.getState().switchRecord({ content: '默写', sheetId, templateId: 'homework' });
    expect(useStore.getState().draft.key).toBe(a.key);
    expect(useStore.getState().records[b.key].entries[1]).toBeTruthy();
  });
});

describe('FR-71.2：删除整张登记表', () => {
  it('records 与 history 里的同 key 一起清掉', () => {
    const a = rec('默写', 100);
    const b = rec('作文', 200);
    useStore.getState().replaceState(persisted([a, b], [b as never]));
    useStore.getState().deleteRecord(b.key);
    const st = useStore.getState();
    expect(st.records[b.key]).toBeUndefined();
    expect(st.history.some((h) => h.key === b.key)).toBe(false);
    expect(st.records[a.key]).toBeTruthy();   // 别人的表不受影响
  });

  it('删当前表：回到同模板当天最近一条有内容的记录', () => {
    const a = rec('默写', 100);
    const b = rec('作文', 200);
    useStore.getState().replaceState(persisted([a, b]));
    useStore.getState().switchRecord({ content: '作文', sheetId, templateId: 'homework' });
    useStore.getState().deleteRecord(b.key);
    expect(useStore.getState().draft.key).toBe(a.key);
    expect(useStore.getState().draft.content).toBe('默写');
  });

  it('删当前表且当天没有别的表：留一张新的空表（不丢界面）', () => {
    const a = rec('默写', 100);
    useStore.getState().replaceState(persisted([a]));
    useStore.getState().deleteRecord(a.key);
    const st = useStore.getState();
    expect(st.records[a.key]).toBeUndefined();
    expect(st.draft.key).not.toBe(a.key);
    expect(st.draft.templateId).toBe('homework');
    expect(st.draft.entries).toEqual({});
  });

  it('删别的班的同名表不受影响（key 带 classId）', () => {
    const a = rec('默写', 100);
    useStore.getState().replaceState(persisted([a]));
    useStore.getState().deleteRecord('cls_other|' + date + '|默写|' + sheetId);
    expect(useStore.getState().records[a.key]).toBeTruthy();
  });

  it('删过的表不再出现在当日汇总里', () => {
    const a = rec('默写', 100, { entries: { 1: entry } });
    const b = rec('作文', 200, { entries: { 2: { ...entry, value: { kind: 'grade' as const, grade: 'A' as const } } } });
    useStore.getState().replaceState(persisted([a, b]));
    expect(selectSummary(useStore.getState()).sections).toHaveLength(2);
    useStore.getState().deleteRecord(b.key);
    const sec = selectSummary(useStore.getState()).sections;
    expect(sec).toHaveLength(1);
    expect(sec[0].content).toBe('默写');
  });
});

describe('FR-71.3：缺交 / 请假是否算过关', () => {
  const missing = { value: null, stamp: 'none' as const, status: 'missing' as const, pass: false, makeup: null, updatedAt: 1 };
  const leave = { value: null, stamp: 'none' as const, status: 'leave' as const, pass: false, makeup: null, updatedAt: 1 };

  it('默认（旧数据没有这两个字段）：缺交/请假都不过关', () => {
    expect(isPassed(missing, scheme, { kind: 'mixed', gradePass: ['A+', 'A'] as GradeLetter[], dictationAutoPass: true })).toBe(false);
    expect(isPassed(leave, scheme, { kind: 'mixed', gradePass: ['A+', 'A'] as GradeLetter[], dictationAutoPass: true })).toBe(false);
  });

  it('打开 leavePass：请假算过关，缺交仍不算', () => {
    const rule: PassRule = { kind: 'mixed', gradePass: ['A+', 'A'], dictationAutoPass: true, leavePass: true };
    expect(isPassed(leave, scheme, rule)).toBe(true);
    expect(isPassed(missing, scheme, rule)).toBe(false);
  });

  it('打开 missingPass：缺交算过关', () => {
    const rule: PassRule = { kind: 'grade', gradePass: ['A+'], dictationAutoPass: true, missingPass: true };
    expect(isPassed(missing, scheme, rule)).toBe(true);
  });

  it('从 fromPersisted 读回的老数据同样按「不算过关」处理', () => {
    const dumped = persisted([rec('默写', 100)]);
    // 老数据没有 leavePass 字段
    delete (dumped.settings as { passRule: { leavePass?: boolean } }).passRule.leavePass;
    const st = fromPersisted(dumped);
    const rule = st.settings?.passRule ?? { kind: 'mixed' as const, gradePass: [] as GradeLetter[], dictationAutoPass: true };
    expect(rule.leavePass ?? false).toBe(false);
    expect(isPassed(leave, scheme, rule)).toBe(false);
  });
});
