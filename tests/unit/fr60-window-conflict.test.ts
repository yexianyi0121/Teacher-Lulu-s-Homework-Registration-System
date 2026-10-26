import { beforeEach, describe, expect, it } from 'vitest';
import { diskStamp, saveState } from '../../src/infra/storage';

const KEY = 'xq.state.v4';

function base(savedAt = 1000) {
  return {
    version: 4,
    activeClassId: 'c1',
    classes: [{ id: 'c1', name: 'A', students: [] }],
    records: [],
    history: [],
    pointRules: [],
    pointLedger: [],
    settings: {},
    savedAt,
    lastSavedAt: savedAt,
  } as never;
}

describe('FR-60 多窗口互写保护（D-02 / D-03）', () => {
  beforeEach(() => localStorage.clear());

  it('磁盘没被别人动过 → 正常写入', () => {
    const first = saveState(base(1), null);
    expect(first.ok).toBe(true);
    const stamp = diskStamp();
    const second = saveState(base(2), stamp);
    expect(second.ok).toBe(true);
  });

  it('磁盘已被别的窗口改过 → 拒绝写入并回报 conflict', () => {
    saveState(base(1), null);
    const myStamp = diskStamp();          // 我以为磁盘是我写的这份
    saveState(base(2), null);             // 另一个窗口写入
    const r = saveState(base(3), myStamp);
    expect(r.ok).toBe(false);
    expect(r.conflict).toBe(true);
  });

  it('拒写后磁盘内容保持不变（不静默覆盖）', () => {
    saveState(base(1), null);
    const myStamp = diskStamp();
    saveState(base(2), null);             // 别的窗口
    const before = localStorage.getItem(KEY);
    saveState(base(3), myStamp);
    expect(localStorage.getItem(KEY)).toBe(before);
  });

  it('用最新 stamp 重试可成功（老师确认覆盖后的路径）', () => {
    saveState(base(1), null);
    const myStamp = diskStamp();
    saveState(base(2), null);
    expect(saveState(base(3), myStamp).conflict).toBe(true);
    const fresh = diskStamp();
    expect(saveState(base(3), fresh).ok).toBe(true);
  });
});
