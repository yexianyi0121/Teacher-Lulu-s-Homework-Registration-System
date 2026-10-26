import { describe, expect, it } from 'vitest';
import { fromPersisted, useStore } from '../../src/store';
import { selectPosterBySheet, selectSheetsOfDay } from '../../src/store/selectors';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { studentsOf } from '../fixtures';
import { todayISO } from '../../src/domain/date';
import type { PersistedStateV4, RecordDoc } from '../../src/domain/types';

/**
 * v2.5.9 回归（FR-64）：表身份 = 记录 key，不是 sheetId。
 *
 * 老师现场（问题 3 + 问题 4）：同一个班登记了两张常规作业（同 sheetId、不同内容），
 * 「选择登记表」里第二张永远不出现（被第一张按 sheetId 去重吞掉），生成图片取到的
 * 永远是第一张；填完质量监测再切回常规作业，落回的是"默认空表"，已录的那张看不见。
 * fixture 形态与老师微信备份一致（records 是 list，key = classId|date|content|sheetId）。
 */

const scheme = {
  kind: 'grade' as const, maxScore: null,
  grades: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'] as ('A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C' | 'D')[],
  allowCheck: true, allowText: true, decimals: 0,
  excellentRate: 0.9, goodRate: 0.8, passRate: 0.6,
};

const entry = {
  value: { kind: 'grade' as const, grade: 'A+' as const },
  stamp: 'none' as const, status: 'normal' as const, pass: false,
  makeup: null, updatedAt: 1,
};

type State = Parameters<typeof selectSheetsOfDay>[0];

function stateOf(p: PersistedStateV4): State {
  return fromPersisted(p) as unknown as State;
}

function rec(templateId: 'homework' | 'quality', content: string, updatedAt: number): RecordDoc {
  const date = todayISO();
  const sheetId = templateId === 'homework' ? 'sheet_default_homework' : 'sheet_default_quality';
  return {
    key: `cls_1|${date}|${content}|${sheetId}`,
    classId: 'cls_1', date, content, sheetId, templateId, scheme,
    entries: { 1: entry }, createdAt: updatedAt, updatedAt,
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

describe('FR-64：同模板多张表必须都能被选中/出图（identity = 记录 key）', () => {
  const hwEmpty = rec('homework', '', 100);
  const hwYueyang = rec('homework', '岳阳楼', 300);
  const quality = rec('quality', '默写×错误', 999);

  it('选择登记表里两张常规作业都出现（按 key 去重，不再被 sheetId 吞掉）', () => {
    const st = stateOf(persisted([hwEmpty, hwYueyang, quality]));
    const hw = selectSheetsOfDay(st).filter((x) => x.templateId === 'homework');
    expect(hw).toHaveLength(2);
    expect(hw.map((x) => x.key).sort()).toEqual([hwEmpty.key, hwYueyang.key].sort());
  });

  it('单条海报按 key 取到正确的那张表', () => {
    const st = stateOf(persisted([hwEmpty, hwYueyang]));
    const got = selectPosterBySheet(st, hwYueyang.key);
    expect(got?.badges?.content).toContain('岳阳楼'); // badges.content 带模板装饰前缀（📖）
  });

  it('记录不在 records、只在 history 快照里时，按 key 也能取到', () => {
    const st = stateOf(persisted([hwEmpty], [hwYueyang]));
    const got = selectPosterBySheet(st, hwYueyang.key);
    expect(got?.badges?.content).toContain('岳阳楼'); // badges.content 带模板装饰前缀（📖）
  });

  it('同一条记录同时在 records 和 history → 选择器只出现一次（key 去重不重复）', () => {
    const st = stateOf(persisted([hwYueyang], [hwYueyang]));
    expect(selectSheetsOfDay(st).filter((x) => x.key === hwYueyang.key)).toHaveLength(1);
  });

  it('切回当天已登记过的模板 → 落到该模板当天最近的记录（问题 3 现场）', () => {
    useStore.getState().replaceState(persisted([hwEmpty, hwYueyang, quality]));
    // FR-62.1 不变量先确认：打开落在最近有内容的记录 = 质量监测那条
    expect(useStore.getState().draft.content).toBe('默写×错误');
    // 老师填完质量监测切回常规作业：旧代码落默认空表（看不见已录的那张），新代码落最近那张
    useStore.getState().switchTemplate('homework');
    const d = useStore.getState().draft;
    expect(d.key).toBe(hwYueyang.key);
    expect(d.content).toBe('岳阳楼');
  });

  it('当天该模板没有任何登记 → 仍然落到默认空表（不破坏 v2.5.7 的落点规则）', () => {
    useStore.getState().replaceState(persisted([]));
    expect(useStore.getState().draft.date).toBe(todayISO());
    useStore.getState().switchTemplate('quality');
    const d = useStore.getState().draft;
    expect(d.content).toBe('');
    expect(d.sheetId).toBe('sheet_default_quality');
    // 硬不变量（FR-62.1）：draft.key 必须等于它自己那条记录的 key（空表 = 自己新建的 key）
    expect(d.key).toBe(`cls_1|${todayISO()}||sheet_default_quality`);
  });
});
