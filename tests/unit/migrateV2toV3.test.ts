import { describe, expect, it } from 'vitest';
import { migrateV2toV3 } from '../../src/domain/migrate';
import { DEFAULT_PASS_RULE } from '../../src/domain/passRule';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import type { PersistedStateV2 } from '../../src/domain/types';
import { e, makeScheme, score, studentsOf } from '../fixtures';

function v2(): PersistedStateV2 {
  const scheme = makeScheme('mixed', { maxScore: null });
  return {
    version: 2,
    activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '三年二班', school: '', teacher: '刘露', subject: '语文', students: studentsOf(10), count: 10, createdAt: 1 }],
    records: [{
      key: 'r1', classId: 'cls_1', date: '2026-10-20', content: '第1单元', sheetId: 's1',
      templateId: 'custom', scheme, entries: { '1': e(score(90)), '2': e(null, { status: 'missing' }) },
      createdAt: 1, updatedAt: 2,
    }],
    history: [{
      key: 'h1', classId: 'cls_1', date: '2026-10-19', content: '第0单元', sheetId: 's0',
      templateId: 'custom', scheme, entries: { '1': e(score(80)) },
      createdAt: 1, updatedAt: 1, savedAt: 1, metricsVersion: 2,
      metrics: {
        n: 10, entered: 1, excellent: 0, good: 1, pass: 0, fail: 0, missing: 0, leave: 0,
        madeUp: 0, notSubmitted: 9, avgPercent: 80, avgScore: 80, excellentRate: 0,
        qualifiedRate: 1, passCount: 0, max: 80, min: 80,
      },
    }],
    pointRules: [],
    pointLedger: [],
    settings: {
      ...DEFAULT_SETTINGS,
      secondsJump: false, showName: true, honorIncludesA: true,
      voiceEnabled: true, voiceAutoConfirmMs: 1500, theme: 'auto',
    },
    lastSavedAt: 1,
  };
}

describe('migrateV2toV3：只加字段，不动数据（§2.2）', () => {
  const old = v2();
  const snapshot = JSON.stringify(old);
  const next = migrateV2toV3(old);

  it('version 升到 3，settings 补齐默认值', () => {
    expect(next.version).toBe(3);
    expect(next.settings.passRule).toEqual(DEFAULT_PASS_RULE);
    expect(next.settings.showEmoji).toBe(true);
    expect(next.settings.showSchoolInPoster).toBe(false);
    expect(next.settings.autoBackupDays).toBe(7);
  });

  it('既有 settings 语义保留（secondsJump / showName / honorIncludesA）', () => {
    expect(next.settings.secondsJump).toBe(false);
    expect(next.settings.showName).toBe(true);
    expect(next.settings.honorIncludesA).toBe(true);
  });

  it('mixed 缺 maxScore → 补 100（BR-66.3）', () => {
    expect(next.records[0].scheme.maxScore).toBe(100);
    expect(next.history[0].scheme.maxScore).toBe(100);
  });

  it('entries / history metrics 一个字节都不改', () => {
    expect(next.records[0].entries).toEqual(old.records[0].entries);
    expect(next.history[0].metrics).toEqual(old.history[0].metrics);
    expect(next.history[0].metricsVersion).toBe(2);
  });

  it('不改写原始对象（不可变）', () => {
    expect(JSON.stringify(old)).toBe(snapshot);
  });

  it('默认设置里的默认评价语为空、默认显示表情', () => {
    expect(next.settings.defaultComment).toBe(DEFAULT_SETTINGS.defaultComment);
    expect(next.settings.gradeEmoji).toEqual(DEFAULT_SETTINGS.gradeEmoji);
  });
});
