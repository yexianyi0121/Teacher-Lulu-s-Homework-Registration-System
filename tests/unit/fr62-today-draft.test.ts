import { describe, expect, it } from 'vitest';
import { fromPersisted, useStore } from '../../src/store';
import { todayISO } from '../../src/domain/date';
import type { PersistedStateV4, RecordDoc } from '../../src/domain/types';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { studentsOf } from '../fixtures';

/**
 * v2.5.7 事故回归：老师反馈「上方一直有数据为空的提示，点清空并重来也没用」。
 *
 * 三个叠加的根因，任何一个都足以让老师以为数据丢了 / 数据真丢了：
 *   BUG-1 `fromPersisted` 取「updatedAt 最大的记录」当当前表 → 今天打开看到的是**昨天的表**，
 *          今天的录入全部写进昨天那条记录，覆盖昨天的成绩。
 *   BUG-2 `exportState()` 不含当前草稿 → 录了一整天、不切表就关浏览器，磁盘上根本没有今天的数据。
 *   BUG-3 覆盖保护把「当天还没录入（records/history 为空）」当成「数据被清空」
 *          → 永久只读，且「清空并重来」后仍然为空、仍然被拦，出不来死循环。
 */

const scheme = {
  kind: 'grade' as const, maxScore: null,
  grades: ['A+', 'A', 'A-', 'B+', 'B', 'C', 'D'] as ('A+' | 'A' | 'A-' | 'B+' | 'B' | 'C' | 'D')[],
  allowCheck: true, allowText: true, decimals: 0,
  excellentRate: 0.9, goodRate: 0.8, passRate: 0.6,
};

function rec(date: string, entries: Record<string, unknown>, updatedAt: number): RecordDoc {
  return {
    key: `cls_1|${date}||sheet_default_homework`,
    classId: 'cls_1', date, content: '',
    sheetId: 'sheet_default_homework', templateId: 'homework', scheme,
    entries,
    createdAt: updatedAt, updatedAt,
  } as unknown as RecordDoc;
}

const gradeEntry = {
  value: { kind: 'grade' as const, grade: 'A+' as const },
  stamp: 'none' as const, status: 'normal' as const, pass: false,
  makeup: null, updatedAt: 1,
};

function persisted(records: RecordDoc[]): PersistedStateV4 {
  return {
    version: 4,
    activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '三年二班', school: '', teacher: '', subject: '语文', students: studentsOf(5), count: 5, createdAt: 1 }],
    records,
    history: [],
    pointRules: [],
    pointLedger: [],
    settings: { ...DEFAULT_SETTINGS },
    lastSavedAt: 1,
  } as unknown as PersistedStateV4;
}

describe('v2.5.7 回归：打开后必须落在「今天」的表上', () => {
  // ⚠️ 这条用例在 v2.5.7 开发中改过一次，别改回去：
  // 第一版断言「磁盘只有昨天 → 打开必须是新建的空表」，结果 v1 迁移上来的老数据
  // 日期不是今天，老师升级后第一眼看到空表，以为数据丢了（persistence.spec 现场）。
  // 最终裁定：今天有内容 → 今天；今天没内容 → **库里最近一条有内容的记录**（看得见数据），
  // 且 draft 的 key 就是那条记录自己的 key，所以编辑不会串写到别的记录上。
  it('磁盘上只有昨天的记录 → 打开最近那条有内容的记录（不吞数据、也不串写）', () => {
    const yesterday = '2026-10-25';
    const yKey = `cls_1|${yesterday}||sheet_default_homework`;
    const st = fromPersisted(persisted([rec(yesterday, { 1: gradeEntry }, 9999)]));
    expect(st.draft?.date).toBe(yesterday);
    // 关键不变量：draft.key 必须是它自己那条记录的 key，否则录入会写到别人身上（事故根因）
    expect(st.draft?.key).toBe(yKey);
    expect(st.records?.[yKey]).toBeTruthy();
    expect(Object.keys(st.draft?.entries ?? {})).toHaveLength(1);
  });

  it('磁盘上有今天的记录 → 打开就是今天那张（继续录），哪怕昨天那条更新时间更晚', () => {
    const today = todayISO();
    const st = fromPersisted(persisted([
      rec('2026-10-25', { 1: gradeEntry }, 999999),
      rec(today, { 2: gradeEntry }, 10),
    ]));
    expect(st.draft?.date).toBe(today);
    expect(st.draft?.key).toBe(`cls_1|${today}||sheet_default_homework`);
  });

  it('今天已有一条更新的空表 + 昨天有成绩 → 仍然落在今天', () => {
    const today = todayISO();
    const st = fromPersisted(persisted([
      rec('2026-10-25', { 1: gradeEntry }, 9999),
      rec(today, { 2: gradeEntry }, 1),
    ]));
    expect(st.draft?.date).toBe(today);
  });

  it('磁盘完全为空 → 新建今天的空表，且 draft.key 与记录 key 一致', () => {
    const st = fromPersisted(persisted([]));
    expect(st.draft?.date).toBe(todayISO());
    expect(st.records?.[st.draft!.key]).toBeTruthy();
    expect(Object.keys(st.draft?.entries ?? {})).toHaveLength(0);
  });

  it('草稿必须进导出（录一整天不切表也不能丢）', () => {
    // BUG-2 的本质：exportState 只导 records，而新表在切日期/切模式之前
    // 只存在于 draft 里 → 关浏览器当天的录入全丢。这里直接调 store 方法验证。
    const store = useStore;
    const key = store.getState().draft.key;
    // 直接往草稿写一条（等价于键盘录入的结果）
    store.setState((s) => ({
      draft: { ...s.draft, entries: { ...s.draft.entries, 3: gradeEntry as never } },
    }));
    const snap = store.getState().exportState();
    const out = (snap.records as unknown as RecordDoc[]).find((r) => r.key === key);
    expect(out, '当前草稿必须出现在导出的 records 里，否则关浏览器就丢').toBeTruthy();
    expect(Object.keys(out?.entries ?? {})).toContain('3');
  });
});
