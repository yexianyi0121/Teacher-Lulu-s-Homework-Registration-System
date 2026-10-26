import { describe, expect, it, beforeEach, vi } from 'vitest';
import { stampForFile } from '../../src/domain/date';
import { savePreimportSnapshot, saveState } from '../../src/infra/storage';

describe('FR-58 数据落盘安全', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('FR-58.5 文件名精确到秒，连导两次不重名', () => {
    const a = stampForFile(new Date(2026, 9, 26, 12, 31, 5));
    const b = stampForFile(new Date(2026, 9, 26, 12, 31, 47));
    expect(a).toBe('20261026-123105');
    expect(b).toBe('20261026-123147');
    expect(a).not.toBe(b);
  });

  it('FR-58.1 QuotaExceededError 必须识别为 quota', () => {
    const real = globalThis.localStorage;
    const err = new Error('full');
    err.name = 'QuotaExceededError';
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: {
        getItem: () => null,
        setItem: () => { throw err; },
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
    });
    const r = saveState({ version: 4, classes: [{ id: 'c1' }], history: [] } as never);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('quota');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: real });
  });

  it('FR-58.1 其它异常识别为 unavailable', () => {
    const real = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: {
        getItem: () => null,
        setItem: () => { throw new Error('SecurityError'); },
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
    });
    const r = saveState({ version: 4, classes: [{ id: 'c1' }], history: [] } as never);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unavailable');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: real });
  });

  it('FR-58.3 隔离副本 / 导入快照最多各留 2 条', () => {
    for (let i = 0; i < 5; i += 1) savePreimportSnapshot(`{"i":${i}}`);
    const left = Object.keys(localStorage).filter((k) => k.startsWith('xq.preimport.'));
    expect(left).toHaveLength(2);
    // 留下的是最新的两条
    const vals = left.sort().map((k) => localStorage.getItem(k));
    expect(vals).toEqual(['{"i":3}', '{"i":4}']);
    // 键唯一（同一毫秒连写也不撞）
    expect(new Set(left).size).toBe(left.length);
  });
});
