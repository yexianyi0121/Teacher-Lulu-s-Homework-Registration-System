import { describe, expect, it } from 'vitest';
import { migrateV3toV4, migrate, isV4State, isV3State } from '../../src/domain/migrate';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import type { PersistedStateV3 } from '../../src/domain/types';
import { studentsOf, makeScheme, e, g } from '../fixtures';

/** 构造一份最小 v3 状态（settings 只带 V3 及更早的字段） */
function v3(patch: Partial<PersistedStateV3['settings']> = {}): PersistedStateV3 {
  return {
    version: 3,
    activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '三年二班', school: '', teacher: '', subject: '语文', students: studentsOf(4), count: 4, createdAt: 1 }],
    records: [],
    history: [],
    pointRules: [],
    pointLedger: [],
    settings: {
      secondsJump: true,
      showName: false,
      honorIncludesA: false,
      voiceEnabled: true,
      voiceAutoConfirmMs: 1500,
      theme: 'auto',           // v3 的旧值：不是合法 ThemeKey
      passRule: DEFAULT_SETTINGS.passRule,
      gradeEmoji: DEFAULT_SETTINGS.gradeEmoji,
      showEmoji: true,
      defaultComment: '',
      showSchoolInPoster: false,
      autoBackupDays: 7,
      digitKey: 'auto',
      ...patch,
    } as PersistedStateV3['settings'],
    lastSavedAt: 1,
  };
}

describe('migrateV3toV4：只补字段，不动数据（设计 09 ADR-28）', () => {
  it('4 个新字段取默认值', () => {
    const out = migrateV3toV4(v3());
    expect(out.version).toBe(4);
    expect(out.settings.theme).toBe('pink');
    expect(out.settings.posterFollowTheme).toBe(false);
    expect(out.settings.installHintDismissed).toBe(false);
    expect(out.settings.lastExportAt).toBeNull();
  });

  it('未知 theme 回落 pink（B-4）', () => {
    expect(migrateV3toV4(v3({ theme: 'auto' as never })).settings.theme).toBe('pink');
    expect(migrateV3toV4(v3({ theme: 'light' as never })).settings.theme).toBe('pink');
    expect(migrateV3toV4(v3({ theme: 'neon' as never })).settings.theme).toBe('pink');
  });

  it('已有的 digitKey / 其它设置不被覆盖', () => {
    const out = migrateV3toV4(v3({ digitKey: 'score', autoBackupDays: 30, defaultComment: '加油' }));
    expect(out.settings.digitKey).toBe('score');
    expect(out.settings.autoBackupDays).toBe(30);
    expect(out.settings.defaultComment).toBe('加油');
  });

  it('合法主题原样保留', () => {
    expect(migrateV3toV4(v3({ theme: 'mint' as never })).settings.theme).toBe('mint');
  });

  it('entries / history / pointLedger 一个字节都不动', () => {
    const withData: PersistedStateV3 = {
      ...v3(),
      records: [{
        key: 'cls_1|2026-03-13|第3单元|sheet_1',
        classId: 'cls_1', date: '2026-03-13', content: '第3单元',
        sheetId: 'sheet_1', templateId: 'homework',
        scheme: makeScheme('grade'),
        entries: { '1': e(g('A+')) },
        createdAt: 1, updatedAt: 1,
      }],
    };
    const out = migrateV3toV4(withData);
    expect(out.records).toEqual(withData.records);
    expect(out.history).toEqual(withData.history);
    expect(out.pointLedger).toEqual(withData.pointLedger);
    expect(out.classes).toEqual(withData.classes);
  });
});

describe('migrate：统一入口到 v4', () => {
  it('v3 输入 → v4 且 migrated=true', () => {
    const out = migrate(v3());
    expect(out.migrated).toBe(true);
    expect(isV4State(out.state)).toBe(true);
    expect(out.state.version).toBe(4);
  });

  it('v4 输入原样返回、migrated=false', () => {
    const v4 = migrateV3toV4(v3());
    const again = migrate(v4);
    expect(again.migrated).toBe(false);
    expect(again.state).toBe(v4);
  });

  it('v2 输入一路迁到 v4', () => {
    const v2 = { ...v3(), version: 2 as const };
    const out = migrate(v2);
    expect(out.migrated).toBe(true);
    expect(out.state.version).toBe(4);
    expect(isV3State(out.state)).toBe(false);
  });
});
