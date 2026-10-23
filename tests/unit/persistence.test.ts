import { beforeEach, describe, expect, it } from 'vitest';
import type { PersistedState } from '../../src/infra/persistence';
import {
  CURRENT_VERSION,
  loadPersistedState,
  migrate,
  savePersistedState,
  serialize,
  validate,
} from '../../src/infra/persistence';
import { STORAGE_KEY } from '../../src/domain/constants';
import { makeSettings } from '../fixtures';
import { createEmptyRecord, createInitialClass } from '../../src/store/initial';

function validState(): PersistedState {
  const rec = createEmptyRecord('2026-03-13', '语文本', 'quiz');
  rec.entries['1'] = { value: { kind: 'score', score: 98 }, stamp: 'none', updatedAt: 1 };
  return {
    version: 1,
    classInfo: createInitialClass(50),
    drafts: { [rec.id]: rec },
    activeKey: rec.id,
    history: [],
    settings: makeSettings({ count: 50 }),
    savedAt: 1,
  };
}

describe('migrate / validate（设计 §4.3）', () => {
  it('合法的 v1 数据直接通过', () => {
    const raw = validState();
    const out = migrate(raw);
    expect(out).not.toBeNull();
    expect(out?.version).toBe(CURRENT_VERSION);
  });

  it('v0 → v1（补 version）', () => {
    const raw = { ...validState(), version: 0 };
    const out = migrate(raw);
    expect(out?.version).toBe(1);
  });

  it('缺少 version 视为 v0', () => {
    const { version: _v, ...rest } = validState();
    void _v;
    const out = migrate(rest);
    expect(out?.version).toBe(1);
  });

  it('损坏数据返回 null（结构校验，不只是 JSON 解析）', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('not-an-object')).toBeNull();
    expect(migrate({ ...validState(), settings: { ...validState().settings, count: '50' } })).toBeNull();
    expect(migrate({ ...validState(), activeKey: 123 })).toBeNull();
    expect(migrate({ ...validState(), drafts: { bad: {} } })).toBeNull();
  });

  it('validate 拒绝 value.kind 与内容不符的条目', () => {
    const raw = validState();
    const rec = raw.drafts[raw.activeKey];
    rec.entries['2'] = { value: { kind: 'score', score: 200 }, stamp: 'none', updatedAt: 1 };
    expect(validate(raw)).toBe(false);
  });

  it('夹取阈值：及格线 ≤ 80 ≤ 优秀线 ≤ 100', () => {
    const raw = validState();
    raw.settings = { ...raw.settings, passLine: 90, excellentLine: 70 };
    const out = migrate(raw);
    expect(out?.settings.passLine).toBe(80);
    expect(out?.settings.excellentLine).toBe(80);
  });

  it('activeKey 不存在时回退到 updatedAt 最大的草稿', () => {
    const raw = validState();
    const older = createEmptyRecord('2026-03-12', '周记', 'homework');
    const newer = createEmptyRecord('2026-03-14', '默写', 'dictation');
    older.updatedAt = Date.now() + 10_000;
    newer.updatedAt = Date.now() + 20_000;
    raw.drafts[older.id] = older;
    raw.drafts[newer.id] = newer;
    raw.activeKey = 'missing';
    const out = migrate(raw);
    expect(out?.activeKey).toBe(newer.id);
  });
});

describe('serialize', () => {
  it('草稿超过 90 条时裁到 60 条并保留 activeKey', () => {
    const raw = validState();
    let last = '';
    for (let i = 0; i < 100; i++) {
      const rec = createEmptyRecord('2026-01-01', `内容${i}`, 'homework');
      rec.updatedAt = i;
      raw.drafts[rec.id] = rec;
      last = rec.id;
    }
    raw.activeKey = last;
    const out = serialize(raw);
    expect(Object.keys(out.drafts).length).toBeLessThanOrEqual(61);
    expect(out.drafts[raw.activeKey]).toBeDefined();
  });

  it('历史截断到 200 条', () => {
    const raw = validState();
    raw.history = Array.from({ length: 260 }, (_, i) => ({
      id: `h${i}`,
      date: '2026-03-13',
      content: 'x',
      mode: 'quiz' as const,
      entries: {},
      metrics: {
        entered: 0,
        avg: null,
        excellent: 0,
        good: 0,
        pass: 0,
        fail: 0,
        excellentRate: null,
        corrected: 0,
        notSubmitted: 0,
        max: null,
        min: null,
      },
      savedAt: i,
    }));
    expect(serialize(raw).history).toHaveLength(200);
  });
});

describe('读写路径', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('保存后可读回', async () => {
    const raw = validState();
    expect(savePersistedState(raw)).toBe(true);
    const { state, recovered } = await loadPersistedState();
    expect(recovered).toBe(false);
    expect(state?.activeKey).toBe(raw.activeKey);
    expect(state?.drafts[raw.activeKey].entries['1']).toBeDefined();
  });

  it('主存损坏时返回 null（无快照）', async () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    const { state, recovered } = await loadPersistedState();
    expect(state).toBeNull();
    expect(recovered).toBe(false);
  });
});
