import type {
  ClassDoc,
  Entries,
  Entry,
  HistoryEntry,
  PersistedStateV4,
  RecordDoc,
  ScoringScheme,
  SessionMetrics,
  SheetTemplateId,
  Student,
} from '../domain/types';
import {
  DEFAULT_COUNT,
  DEFAULT_RULES,
  DEFAULT_SCHEMES,
  DEFAULT_SETTINGS,
  DEFAULT_SHEET_ID,
} from '../domain/constants';
import { recordKey } from '../utils/id';
import { todayISO } from '../domain/date';

/** 初始状态构造（纯函数，便于测试与 resetAll 复用） */

export function createStudents(count: number, prev?: Student[]): Student[] {
  return Array.from({ length: count }, (_, i) => {
    const no = i + 1;
    const name = prev?.find((s) => s.no === no)?.name;
    return name ? { no, name } : { no };
  });
}

export function createClass(partial?: Partial<ClassDoc>): ClassDoc {
  const count = partial?.count ?? DEFAULT_COUNT;
  return {
    id: partial?.id ?? `cls_${Math.random().toString(36).slice(2, 10)}`,
    name: partial?.name ?? '三年二班',
    school: partial?.school ?? '',
    teacher: partial?.teacher ?? '',
    subject: partial?.subject ?? '语文',
    students: partial?.students ?? createStudents(count),
    count,
    createdAt: partial?.createdAt ?? 0,
  };
}

export function cloneScheme(s: ScoringScheme): ScoringScheme {
  return { ...s, grades: [...s.grades] };
}

export function createRecord(args: {
  classId: string;
  date?: string;
  content?: string;
  templateId: SheetTemplateId;
  sheetId?: string;
  scheme?: ScoringScheme;
}): RecordDoc {
  const date = args.date ?? todayISO();
  const content = args.content ?? '';
  const sheetId = args.sheetId ?? DEFAULT_SHEET_ID[args.templateId];
  return {
    key: recordKey({ classId: args.classId, date, content, sheetId }),
    classId: args.classId,
    date,
    content,
    sheetId,
    templateId: args.templateId,
    scheme: args.scheme ? cloneScheme(args.scheme) : cloneScheme(DEFAULT_SCHEMES[args.templateId]),
    entries: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

export function emptyEntry(now = 0): Entry {
  return { value: null, stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: now };
}

export function createEmptyState(now = 0): PersistedStateV4 {
  const cls = createClass({ id: 'cls_default', createdAt: now });
  const rec = createRecord({ classId: cls.id, templateId: 'homework' });
  rec.createdAt = now;

  return {
    version: 4,
    activeClassId: cls.id,
    classes: [cls],
    records: [rec],
    history: [],
    pointRules: DEFAULT_RULES.map((r) => ({ ...r, condition: { ...r.condition } })),
    pointLedger: [],
    settings: { ...DEFAULT_SETTINGS },
    lastSavedAt: now,
  };
}

/** 记录是否「有内容」（决定是否入历史 / 是否持久化） */
export function hasEntries(entries: Entries): boolean {
  return Object.values(entries).some(
    (e) => e.value !== null || e.status !== 'normal' || e.pass || e.stamp !== 'none' || e.makeup !== null,
  );
}

export function cloneEntries(entries: Entries): Entries {
  const out: Entries = {};
  for (const [no, e] of Object.entries(entries)) {
    out[no] = {
      value: e.value ? { ...e.value } : null,
      stamp: e.stamp,
      status: e.status,
      pass: e.pass,
      makeup: e.makeup ? { ...e.makeup } : null,
      updatedAt: e.updatedAt,
    };
  }
  return out;
}

/** 草稿 → 历史条目（方案是快照，原样带过去） */
export function toHistoryEntry(rec: RecordDoc, metrics: SessionMetrics, savedAt: number): HistoryEntry {
  return {
    ...rec,
    entries: cloneEntries(rec.entries),
    metrics,
    metricsVersion: 2,
    savedAt,
  };
}
