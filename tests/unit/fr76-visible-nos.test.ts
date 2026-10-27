import { describe, expect, it } from 'vitest';
import { fromPersisted, useStore } from '../../src/store';
import { selectVisibleNos } from '../../src/store/selectors';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { studentsOf } from '../fixtures';
import { todayISO } from '../../src/domain/date';
import type { PersistedStateV4, RecordDoc, ScoringScheme } from '../../src/domain/types';

/**
 * v2.6.5 需求4：请假 / 缺交算不算过关，由本表 scheme.leavePass / missingPass 决定。
 * 以前 selectVisibleNos 里硬编码「请假一律不算未过关」，老师把「请假算过关」取消勾选后，
 * 请假的学生仍然不出现在「只看未过关」里 —— 与判定口径不一致。
 */
const scheme = (patch: Partial<ScoringScheme>): ScoringScheme => ({
  kind: 'grade',
  maxScore: null,
  grades: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'],
  allowCheck: true,
  allowText: true,
  decimals: 0,
  excellentRate: 0.9,
  goodRate: 0.8,
  passRate: 0.6,
  gradePass: ['A+', 'A'],
  ...patch,
});

const date = todayISO();
const sheetId = 'sheet_default_homework';

function rec(s: ScoringScheme, entries: RecordDoc['entries']): RecordDoc {
  return {
    key: `cls_1|${date}|默写|${sheetId}`,
    classId: 'cls_1', date, content: '默写', sheetId, templateId: 'homework', scheme: s,
    entries, createdAt: 1, updatedAt: 1,
  } as unknown as RecordDoc;
}

function persisted(r: RecordDoc): PersistedStateV4 {
  return {
    version: 4,
    activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '2025级19班', school: '', teacher: '', subject: '语文', students: studentsOf(3), count: 3, createdAt: 1 }],
    records: [r], history: [], pointRules: [], pointLedger: [],
    settings: { ...DEFAULT_SETTINGS }, lastSavedAt: 1,
  } as unknown as PersistedStateV4;
}

const leaveEntry = { value: null, stamp: 'none' as const, status: 'leave' as const, pass: false, makeup: null, updatedAt: 1 };
const missingEntry = { value: null, stamp: 'none' as const, status: 'missing' as const, pass: false, makeup: null, updatedAt: 1 };
const passEntry = {
  value: { kind: 'grade' as const, grade: 'A' as const },
  stamp: 'none' as const, status: 'normal' as const, pass: false, makeup: null, updatedAt: 1,
};

/** 学生 1 = 请假、学生 2 = 缺交、学生 3 = A（过关） */
const entries = { 1: leaveEntry, 2: missingEntry, 3: passEntry } as unknown as RecordDoc['entries'];

function visible(s: ScoringScheme): number[] {
  useStore.getState().replaceState(persisted(rec(s, entries)));
  // 「只看未过关」是 UI 态，replaceState 会把它重置成 false
  useStore.getState().setFilterNotPassed(true);
  return selectVisibleNos(useStore.getState());
}

describe('FR-76.3：请假 / 缺交是否算未过关，跟着本表开关走', () => {
  it('leavePass=false：请假学生算未过关，出现在「只看未过关」', () => {
    expect(visible(scheme({ leavePass: false, missingPass: false }))).toEqual([1, 2]);
  });

  it('leavePass=true：请假学生不算未过关', () => {
    expect(visible(scheme({ leavePass: true, missingPass: false }))).toEqual([2]);
  });

  it('missingPass=false 与 true 同样只影响缺交学生', () => {
    expect(visible(scheme({ leavePass: true, missingPass: true }))).toEqual([]);
  });

  it('开关只是判定口径，不影响已经过关的等级格', () => {
    const nos = visible(scheme({ leavePass: false, missingPass: false }));
    expect(nos).not.toContain(3);
  });

  it('读库回来的老数据缺字段时按默认（不算过关）', () => {
    const st = fromPersisted(persisted(rec(scheme({}), entries)));
    useStore.getState().replaceState(persisted(rec(scheme({}), entries)));
    useStore.getState().setFilterNotPassed(true);
    const draft = useStore.getState().draft;
    expect(draft.scheme.leavePass ?? false).toBe(false);
    expect(draft.scheme.missingPass ?? false).toBe(false);
    expect(st.draft?.entries[1].status).toBe('leave');
  });
});
