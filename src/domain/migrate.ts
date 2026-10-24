import type {
  CellValue,
  ClassDoc,
  Entries,
  Entry,
  HistoryEntry,
  PersistedStateV1,
  PersistedStateV2,
  PersistedStateV3,
  PersistedStateV4,
  RecordDoc,
  ScoringScheme,
  SheetTemplateId,
  Student,
  V1Entry,
} from './types';
import { DEFAULT_RULES, DEFAULT_SCHEMES, DEFAULT_SHEET_ID, DEFAULT_SETTINGS } from './constants';
import { themeOf } from './theme';
import { round1 } from './round';

/**
 * v1 → v2 迁移（设计 04 §4.6）—— 纯函数、不可变、幂等。
 * 语义迁移的关键：`√` 不是等级（→ pass=true），`×` 不是等级（→ status='missing'）。
 */

export const V1_CLASS_ID = 'cls_default';

export class UnknownStateError extends Error {
  constructor() {
    super('UNKNOWN_STATE');
    this.name = 'UnknownStateError';
  }
}

export function isV4State(raw: unknown): raw is PersistedStateV4 {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Partial<PersistedStateV4>;
  return o.version === 4 && Array.isArray(o.classes) && Array.isArray(o.records);
}

export function isV3State(raw: unknown): raw is PersistedStateV3 {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Partial<PersistedStateV3>;
  return o.version === 3 && Array.isArray(o.classes) && Array.isArray(o.records);
}

export function isV2State(raw: unknown): raw is PersistedStateV2 {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Partial<PersistedStateV2>;
  return o.version === 2 && Array.isArray(o.classes) && Array.isArray(o.records);
}

export function isV1State(raw: unknown): raw is PersistedStateV1 {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Partial<PersistedStateV1> & { version?: number };
  return (o.version === 1 || o.version === undefined) && !!o.classInfo && typeof o.drafts === 'object';
}

const TEMPLATE_OF_MODE: Record<string, SheetTemplateId> = {
  homework: 'homework',
  quiz: 'quality',
  dictation: 'dictation',
};

/** 用一个模板的默认方案 + v1 的绝对分数线（满分 100）推导方案 */
export function schemeForTemplate(templateId: SheetTemplateId, v1?: { excellentLine?: number; passLine?: number }): ScoringScheme {
  const base = DEFAULT_SCHEMES[templateId];
  const ex = v1?.excellentLine;
  const pa = v1?.passLine;
  return {
    ...base,
    grades: [...base.grades],
    excellentRate: typeof ex === 'number' && ex > 0 && ex <= 100 ? ex / 100 : base.excellentRate,
    goodRate: base.goodRate,
    passRate: typeof pa === 'number' && pa > 0 && pa <= 100 ? pa / 100 : base.passRate,
  };
}

function mapEntry(v1: V1Entry): Entry {
  const base: Entry = {
    value: null,
    stamp: v1.stamp ?? 'none',
    status: 'normal',
    pass: false,
    makeup: null,
    updatedAt: v1.updatedAt ?? 0,
  };
  const v = v1.value;
  if (!v) return base;

  if (v.kind === 'grade') {
    const g = v.grade ?? '';
    if (g === 'CHECK') return { ...base, value: null, pass: true };
    if (g === 'CROSS') return { ...base, value: null, status: 'missing' };
    if (g === 'A+' || g === 'A' || g === 'A-') {
      return { ...base, value: { kind: 'grade', grade: g } };
    }
    return base;
  }
  if (v.kind === 'score' && typeof v.score === 'number') {
    return { ...base, value: { kind: 'score', score: v.score } };
  }
  if (v.kind === 'text' && typeof v.text === 'string') {
    return { ...base, value: { kind: 'text', text: v.text } };
  }
  return base;
}

function mapEntries(source: Record<string, V1Entry> | undefined): Entries {
  const out: Entries = {};
  if (!source) return out;
  for (const [no, e] of Object.entries(source)) out[no] = mapEntry(e);
  return out;
}

function studentsOf(count: number, given?: Student[]): Student[] {
  if (Array.isArray(given) && given.length === count) {
    return given.map((s, i) => ({ no: i + 1, name: s.name }));
  }
  return Array.from({ length: count }, (_, i) => ({ no: i + 1 }));
}

/** v1 metrics（绝对值）→ v2 metrics（百分比口径） */
function mapMetrics(v1: PersistedStateV1['history'][number]['metrics'], n: number): HistoryEntry['metrics'] {
  const entered = v1.entered ?? 0;
  const bands = (v1.excellent ?? 0) + (v1.good ?? 0) + (v1.pass ?? 0) + (v1.fail ?? 0);
  return {
    n,
    entered,
    excellent: v1.excellent ?? 0,
    good: v1.good ?? 0,
    pass: v1.pass ?? 0,
    fail: v1.fail ?? 0,
    missing: 0,
    leave: 0,
    madeUp: 0,
    notSubmitted: v1.notSubmitted ?? Math.max(0, n - entered),
    // 满分 100 时 v1 均分 == 平均百分
    avgPercent: v1.avg ?? null,
    avgScore: v1.avg ?? null,
    // v1 存的是 65 这样的百分数，v2 统一成 0-1 比例
    excellentRate: v1.excellentRate === null || entered === 0 ? null : round1(v1.excellentRate / 100 * 100) / 100,
    qualifiedRate: entered === 0 || bands === 0 ? null : round1(((v1.excellent + v1.good + v1.pass) / entered) * 100) / 100,
    passCount: 0,
    max: v1.max ?? null,
    min: v1.min ?? null,
  };
}

export function migrateV1toV2(raw: unknown): { state: PersistedStateV2; migrated: boolean } {
  if (isV2State(raw)) return { state: raw, migrated: false };
  if (!isV1State(raw)) throw new UnknownStateError();

  const v1 = raw;
  const count = Math.min(120, Math.max(1, Math.round(v1.settings?.count ?? v1.classInfo.count ?? 50)));
  const thresholds = { excellentLine: v1.settings?.excellentLine, passLine: v1.settings?.passLine };

  const cls: ClassDoc = {
    id: V1_CLASS_ID,
    name: v1.classInfo.name || '我的班级',
    school: v1.classInfo.school || '',
    teacher: v1.classInfo.teacher || '',
    subject: v1.classInfo.subject || '语文',
    students: studentsOf(count, v1.classInfo.students),
    count,
    createdAt: 0,
  };

  const records: RecordDoc[] = [];
  for (const r of Object.values(v1.drafts ?? {})) {
    const templateId = TEMPLATE_OF_MODE[r.mode] ?? 'homework';
    records.push({
      key: `${cls.id}|${r.date}|${(r.content ?? '').trim()}|${DEFAULT_SHEET_ID[templateId]}`,
      classId: cls.id,
      date: r.date,
      content: r.content ?? '',
      sheetId: DEFAULT_SHEET_ID[templateId],
      templateId,
      scheme: schemeForTemplate(templateId, thresholds),
      entries: mapEntries(r.entries),
      createdAt: r.createdAt ?? 0,
      updatedAt: r.updatedAt ?? 0,
    });
  }

  const history: HistoryEntry[] = (v1.history ?? []).map((h) => {
    const templateId = TEMPLATE_OF_MODE[h.mode] ?? 'homework';
    return {
      key: `${cls.id}|${h.date}|${(h.content ?? '').trim()}|${DEFAULT_SHEET_ID[templateId]}`,
      classId: cls.id,
      date: h.date,
      content: h.content ?? '',
      sheetId: DEFAULT_SHEET_ID[templateId],
      templateId,
      scheme: schemeForTemplate(templateId, thresholds),
      entries: mapEntries(h.entries),
      createdAt: h.createdAt ?? 0,
      updatedAt: h.updatedAt ?? 0,
      metrics: mapMetrics(h.metrics, count),
      metricsVersion: 1,     // §4.6.5：旧指标按 v1 口径展示，不重算、不回写
      savedAt: h.savedAt ?? 0,
    };
  });

  const state: PersistedStateV2 = {
    version: 2,
    activeClassId: cls.id,
    classes: [cls],
    records,
    history,
    pointRules: DEFAULT_RULES.map((r) => ({ ...r, condition: { ...r.condition } })),
    pointLedger: [],
    settings: {
      ...DEFAULT_SETTINGS,
      secondsJump: v1.settings?.secondsJump ?? DEFAULT_SETTINGS.secondsJump,
      showName: v1.settings?.showName ?? DEFAULT_SETTINGS.showName,
      honorIncludesA: v1.settings?.honorIncludesA ?? false,
    },
    lastSavedAt: 0,
  };

  return { state, migrated: true };
}

/** 供迁移测试与调试：把 V2 值再折回可读字符串（不参与运行时） */
export function describeMigratedValue(v: CellValue | null): string {
  if (!v) return '空';
  if (v.kind === 'grade') return v.grade;
  if (v.kind === 'score') return String(v.score);
  if (v.kind === 'text') return v.text;
  return '√';
}


/* ---------------- v2 → v3（设计 06 §2.2） ---------------- */

/** mixed 方案缺 maxScore → 补 100（BR-66.3）；其余方案原样 */
function fixScheme(s: ScoringScheme): ScoringScheme {
  if ((s.kind === 'mixed' || s.kind === 'score') && (s.maxScore === null || s.maxScore <= 0)) {
    return { ...s, maxScore: 100 };
  }
  return s;
}

function fixRecord<T extends RecordDoc>(r: T): T {
  return { ...r, scheme: fixScheme(r.scheme) };
}

/**
 * v2 → v3：只加字段，**不动** entries / history / pointLedger 的任何值。
 * 过关规则不猜老师偏好，一律默认；表情与评价语用默认值。
 */
export function migrateV2toV3(old: PersistedStateV2): PersistedStateV3 {
  return {
    ...old,
    version: 3,
    settings: {
      ...DEFAULT_SETTINGS,
      ...old.settings,
      passRule: { ...DEFAULT_SETTINGS.passRule, gradePass: [...DEFAULT_SETTINGS.passRule.gradePass] },
      gradeEmoji: { ...DEFAULT_SETTINGS.gradeEmoji },
      showEmoji: true,
      defaultComment: '',
      showSchoolInPoster: false,
      autoBackupDays: 7,
    },
    records: old.records.map(fixRecord),
    history: old.history.map((h) => ({ ...fixRecord(h), metrics: { ...h.metrics } })),
  };
}

/**
 * v3 → v4（设计 09 ADR-28）：只补 settings 字段，**不动** entries / history / pointLedger。
 * 旧 theme 值（'auto' | 'light'）不是合法 ThemeKey → 回落 pink（B-4）。
 */
export function migrateV3toV4(old: PersistedStateV3): PersistedStateV4 {
  return {
    ...old,
    version: 4,
    settings: {
      ...DEFAULT_SETTINGS,
      ...old.settings,
      theme: themeOf(old.settings?.theme),
      passRule: { ...DEFAULT_SETTINGS.passRule, gradePass: [...DEFAULT_SETTINGS.passRule.gradePass] },
      gradeEmoji: { ...DEFAULT_SETTINGS.gradeEmoji },
      digitKey: old.settings?.digitKey ?? DEFAULT_SETTINGS.digitKey,
      posterFollowTheme: old.settings?.posterFollowTheme ?? false,
      installHintDismissed: old.settings?.installHintDismissed ?? false,
      lastExportAt: old.settings?.lastExportAt ?? null,
    },
  };
}

/** 统一入口：任何版本 → v4 */
export function migrate(raw: unknown): { state: PersistedStateV4; migrated: boolean } {
  if (isV4State(raw)) return { state: raw, migrated: false };
  if (isV3State(raw)) return { state: migrateV3toV4(raw), migrated: true };
  if (isV2State(raw)) {
    const v3 = migrateV2toV3(raw);
    return { state: migrateV3toV4(v3), migrated: true };
  }
  if (isV1State(raw)) {
    const v2 = migrateV1toV2(raw);
    return { state: migrateV3toV4(migrateV2toV3(v2.state)), migrated: true };
  }
  throw new UnknownStateError();
}
