import { describe, expect, it } from 'vitest';
import { fromPersisted, useStore } from '../../src/store';
import { selectSummary } from '../../src/store/selectors';
import { buildSummaryModel } from '../../src/domain/poster';
import { snapshotDay } from '../../src/domain/summary';
import { keyMapPairs, buildGradeKeyMap } from '../../src/domain/keymap';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { studentsOf } from '../fixtures';
import { todayISO } from '../../src/domain/date';
import type { PersistedStateV4, RecordDoc, ScoringScheme } from '../../src/domain/types';

/**
 * v2.5.10 回归（FR-66 / FR-68）：
 * - FR-66.2：汇总里每张表的评价语来自它自己的记录，不再整图只有一条；
 * - FR-66.3：切换同模板的另一张表（作业内容不同）时，落到既有记录，数据不丢；
 * - FR-68.1：keyMapPairs 把「启用等级 → 数字键」摊平成有序数组，供提示条与本表设置用。
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

function rec(templateId: 'homework' | 'quality', content: string, updatedAt: number, comment?: string): RecordDoc {
  const date = todayISO();
  const sheetId = templateId === 'homework' ? 'sheet_default_homework' : 'sheet_default_quality';
  return {
    key: `cls_1|${date}|${content}|${sheetId}`,
    classId: 'cls_1', date, content, sheetId, templateId, scheme,
    entries: { 1: entry }, createdAt: updatedAt, updatedAt,
    comment,
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

describe('FR-66.2：汇总每张表各写各的评价语（不再整图一条）', () => {
  it('section.comment 取的是它自己那条记录的 comment', () => {
    const a = rec('homework', '默写', 100, '默写全对的同学请继续保持。');
    const b = rec('homework', '作文', 200, '作文注意审题。');
    const model = buildSummaryModel({
      className: '2025年19班',
      date: todayISO(),
      sheets: snapshotDay(persisted([a, b]), 'cls_1', todayISO()),
      n: 5,
      comment: '这是整图页脚那条，不该覆盖每张表',
      display: { passRule: { kind: 'grade', gradePass: ['A+', 'A'], dictationAutoPass: true }, showEmoji: true, gradeEmoji: DEFAULT_SETTINGS.gradeEmoji },
    });
    const byContent = Object.fromEntries(model.sections.map((s) => [s.content, s]));
    expect(byContent['默写'].comment).toBe('默写全对的同学请继续保持。');
    expect(byContent['作文'].comment).toBe('作文注意审题。');
  });

  it('记录没写评价语 → 该分节的 comment 是空串（海报上不渲染那一行）', () => {
    const a = rec('homework', '默写', 100);
    const model = buildSummaryModel({
      className: '2025年19班',
      date: todayISO(),
      sheets: snapshotDay(persisted([a]), 'cls_1', todayISO()),
      n: 5,
      comment: '',
      display: { passRule: { kind: 'grade', gradePass: ['A+', 'A'], dictationAutoPass: true }, showEmoji: true, gradeEmoji: DEFAULT_SETTINGS.gradeEmoji },
    });
    expect(model.sections[0].comment).toBe('');
  });

  it('整图 comment 与分节 comment 互不覆盖（页脚那条仍然单独存在）', () => {
    const a = rec('homework', '默写', 100, '本表自己的评价语');
    const model = buildSummaryModel({
      className: '2025年19班',
      date: todayISO(),
      sheets: snapshotDay(persisted([a]), 'cls_1', todayISO()),
      n: 5,
      comment: '页脚那条',
      display: { passRule: { kind: 'grade', gradePass: ['A+', 'A'], dictationAutoPass: true }, showEmoji: true, gradeEmoji: DEFAULT_SETTINGS.gradeEmoji },
    });
    expect(model.comment).toBe('页脚那条');
    expect(model.sections[0].comment).toBe('本表自己的评价语');
  });

  it('selectSummary 透出每张表的评价语（PosterModal 按节编辑用它）', () => {
    const a = rec('homework', '默写', 100, '请把错字抄三遍。');
    useStore.getState().replaceState(persisted([a]));
    const sum = selectSummary(useStore.getState());
    expect(sum.sections.find((s) => s.content === '默写')?.comment).toBe('请把错字抄三遍。');
  });
});

describe('FR-66.3：主屏切换同模板的另一张表（问题 1 现场）', () => {
  it('switchRecord 按内容落到既有记录，另一张表的数据仍在', () => {
    const a = rec('homework', '默写', 100);
    const b = rec('homework', '作文', 200);
    useStore.getState().replaceState(persisted([a, b]));

    // 主屏「选择登记表」的落点：带上内容 + sheetId，key 重新推导后 === 原记录 key
    useStore.getState().switchRecord({ content: '默写', sheetId: 'sheet_default_homework', templateId: 'homework' });
    expect(useStore.getState().draft.key).toBe(a.key);
    expect(useStore.getState().draft.content).toBe('默写');
    expect(useStore.getState().records[b.key]).toBeTruthy();

    useStore.getState().switchRecord({ content: '作文', sheetId: 'sheet_default_homework', templateId: 'homework' });
    expect(useStore.getState().draft.key).toBe(b.key);
    expect(useStore.getState().records[a.key]).toBeTruthy();
  });

  it('setSheetComment 写到目标记录上，不影响当前表', () => {
    const a = rec('homework', '默写', 100);
    const b = rec('homework', '作文', 200);
    useStore.getState().replaceState(persisted([a, b]));
    useStore.getState().switchRecord({ content: '作文', sheetId: 'sheet_default_homework', templateId: 'homework' });

    useStore.getState().setSheetComment(a.key, '请把错字抄三遍。');
    expect(useStore.getState().records[a.key].comment).toBe('请把错字抄三遍。');
    expect(useStore.getState().draft.key).toBe(b.key);
    expect(useStore.getState().draft.comment).not.toBe('请把错字抄三遍。');
  });

  it('setSheetComment 传当前表 key 时等价于改当前表评价语', () => {
    const a = rec('homework', '默写', 100);
    useStore.getState().replaceState(persisted([a]));
    useStore.getState().setSheetComment(a.key, '今天默写全对。');
    expect(useStore.getState().draft.comment).toBe('今天默写全对。');
    expect(useStore.getState().records[a.key].comment).toBe('今天默写全对。');
  });

  it('setSheetComment 超过 60 字截断，未知 key 安全无操作', () => {
    const a = rec('homework', '默写', 100);
    useStore.getState().replaceState(persisted([a]));
    useStore.getState().setSheetComment(a.key, '字'.repeat(80));
    expect(useStore.getState().draft.comment).toHaveLength(60);
    const before = useStore.getState().records;
    useStore.getState().setSheetComment('cls_1|2099-01-01|不存在|sheet_default_homework', 'x');
    expect(useStore.getState().records).toBe(before);
  });

  it('写过的评价语跟着记录走：重新打开当天汇总仍在（持久化路径）', () => {
    const a = rec('homework', '默写', 100);
    const b = rec('homework', '作文', 200);
    useStore.getState().replaceState(persisted([a, b]));
    useStore.getState().setSheetComment(b.key, '作文注意审题。');
    // 真正跨重开的路径：exportState → 存储 → fromPersisted
    const dumped = useStore.getState().exportState();
    fromPersisted(dumped as unknown as PersistedStateV4);   // 重开也能读回（不抛异常）
    const model = buildSummaryModel({
      className: '2025年19班',
      date: todayISO(),
      sheets: snapshotDay(dumped, 'cls_1', todayISO()),
      n: 5,
      comment: '',
      display: { passRule: { kind: 'grade', gradePass: ['A+', 'A'], dictationAutoPass: true }, showEmoji: true, gradeEmoji: DEFAULT_SETTINGS.gradeEmoji },
    });
    expect(model.sections.find((s) => s.content === '作文')?.comment).toBe('作文注意审题。');
  });
});

describe('FR-68.1：keyMapPairs 把键位摊平（提示条 / 本表设置共用）', () => {
  it('默认 7 档常规作业 → 1 A+ … 7 D（含 B-）', () => {
    const s: ScoringScheme = { ...scheme, grades: ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D'] };
    expect(keyMapPairs(buildGradeKeyMap(s))).toEqual([
      { key: '1', grade: 'A+' }, { key: '2', grade: 'A' }, { key: '3', grade: 'A-' },
      { key: '4', grade: 'B' }, { key: '5', grade: 'B-' }, { key: '6', grade: 'C' }, { key: '7', grade: 'D' },
    ]);
  });

  it('按启用顺序而不是 GRADE_ORDER 原序（勾掉 B+ 后 5 就是 B-）', () => {
    const s: ScoringScheme = { ...scheme, grades: ['A+', 'A', 'A-', 'B', 'C', 'D'] };
    const pairs = keyMapPairs(buildGradeKeyMap(s));
    expect(pairs.map((p) => p.grade)).toEqual(['A+', 'A', 'A-', 'B', 'C', 'D']);
    expect(pairs.map((p) => p.key)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('空 grades 不炸', () => {
    expect(keyMapPairs(buildGradeKeyMap({ ...scheme, grades: [] }))).toEqual([]);
  });
});

describe('FR-67.1：表情在主值下方单独一行（数据结构层面）', () => {
  it('等级格的表情仍然来自 settings.gradeEmoji，主值与表情是两个字段', () => {
    const a = rec('homework', '默写', 100);
    const model = buildSummaryModel({
      className: '2025年19班',
      date: todayISO(),
      sheets: snapshotDay(persisted([a]), 'cls_1', todayISO()),
      n: 5,
      comment: '',
      display: { passRule: { kind: 'grade', gradePass: ['A+', 'A'], dictationAutoPass: true }, showEmoji: true, gradeEmoji: DEFAULT_SETTINGS.gradeEmoji },
    });
    const cell = model.sections[0].cells.find((c) => c.kind === 'grade');
    expect(cell).toBeTruthy();
    expect(cell!.text).toBe('A+');
    expect(cell!.emoji).toBe(DEFAULT_SETTINGS.gradeEmoji['A+']);
  });

  it('关掉表情 → emoji 为 undefined（CellView 不渲染 .cell-emoji）', () => {
    const a = rec('homework', '默写', 100);
    const model = buildSummaryModel({
      className: '2025年19班',
      date: todayISO(),
      sheets: snapshotDay(persisted([a]), 'cls_1', todayISO()),
      n: 5,
      comment: '',
      display: { passRule: { kind: 'grade', gradePass: ['A+', 'A'], dictationAutoPass: true }, showEmoji: false, gradeEmoji: DEFAULT_SETTINGS.gradeEmoji },
    });
    expect(model.sections[0].cells.find((c) => c.kind === 'grade')?.emoji).toBeUndefined();
  });
});
