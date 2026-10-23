import type {
  ClassInfo,
  Entries,
  HistoryEntry,
  RecordDoc,
  SessionMetrics,
  Settings,
  Student,
} from '../domain/types';
import { HISTORY_LIMIT, MAX_DRAFTS, PRUNE_DRAFTS_TO, STORAGE_KEY } from '../domain/constants';
import { clampThresholds } from '../domain/thresholds';
import { getSnapshots, putSnapshot } from './idb';

export interface PersistedState {
  version: 1;
  classInfo: ClassInfo;
  drafts: Record<string, RecordDoc>;
  activeKey: string;
  history: HistoryEntry[];
  settings: Settings;
  savedAt: number;
}

export const CURRENT_VERSION = 1;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const GRADES = new Set(['A+', 'A', 'A-', 'CHECK', 'CROSS']);
const STAMPS = new Set(['none', 'corrected', 'excellent']);
const MODES = new Set(['homework', 'quiz', 'dictation']);

function isEntry(v: unknown): boolean {
  if (!isObject(v)) return false;
  if (typeof v.stamp !== 'string' || !STAMPS.has(v.stamp)) return false;
  if (typeof v.updatedAt !== 'number') return false;
  const val = v.value;
  if (val === null) return true;
  if (!isObject(val)) return false;
  if (val.kind === 'grade') return typeof val.grade === 'string' && GRADES.has(val.grade);
  if (val.kind === 'score') {
    return typeof val.score === 'number' && Number.isFinite(val.score) && val.score >= 0 && val.score <= 100;
  }
  if (val.kind === 'text') return typeof val.text === 'string' && val.text.length <= 20;
  return false;
}

function isEntries(v: unknown): v is Entries {
  if (!isObject(v)) return false;
  return Object.values(v).every(isEntry);
}

function isStudent(v: unknown): v is Student {
  if (!isObject(v)) return false;
  if (typeof v.no !== 'number' || !Number.isInteger(v.no)) return false;
  return v.name === undefined || typeof v.name === 'string';
}

function isClassInfo(v: unknown): v is ClassInfo {
  if (!isObject(v)) return false;
  const fields = ['id', 'name', 'school', 'teacher', 'subject'];
  if (!fields.every((f) => typeof v[f] === 'string')) return false;
  return Array.isArray(v.students) && v.students.every(isStudent);
}

function isRecordDoc(v: unknown): v is RecordDoc {
  if (!isObject(v)) return false;
  if (typeof v.id !== 'string' || typeof v.date !== 'string' || typeof v.content !== 'string') return false;
  if (typeof v.mode !== 'string' || !MODES.has(v.mode)) return false;
  if (typeof v.createdAt !== 'number' || typeof v.updatedAt !== 'number') return false;
  return isEntries(v.entries);
}

function isMetrics(v: unknown): v is SessionMetrics {
  if (!isObject(v)) return false;
  const nums = ['entered', 'excellent', 'good', 'pass', 'fail', 'corrected', 'notSubmitted'];
  if (!nums.every((k) => typeof v[k] === 'number')) return false;
  const nullable = ['avg', 'excellentRate', 'max', 'min'];
  return nullable.every((k) => v[k] === null || typeof v[k] === 'number');
}

function isHistoryEntry(v: unknown): v is HistoryEntry {
  if (!isObject(v)) return false;
  if (typeof v.id !== 'string' || typeof v.date !== 'string' || typeof v.content !== 'string') return false;
  if (typeof v.mode !== 'string' || !MODES.has(v.mode)) return false;
  if (typeof v.savedAt !== 'number') return false;
  return isEntries(v.entries) && isMetrics(v.metrics);
}

function isSettings(v: unknown): v is Settings {
  if (!isObject(v)) return false;
  return (
    typeof v.count === 'number' &&
    Number.isInteger(v.count) &&
    v.count >= 1 &&
    v.count <= 120 &&
    typeof v.secondsJump === 'boolean' &&
    typeof v.showName === 'boolean' &&
    typeof v.excellentLine === 'number' &&
    typeof v.passLine === 'number' &&
    typeof v.honorIncludesA === 'boolean'
  );
}

export function validate(data: unknown): data is PersistedState {
  if (!isObject(data)) return false;
  if (data.version !== CURRENT_VERSION) return false;
  if (!isClassInfo(data.classInfo)) return false;
  if (!isSettings(data.settings)) return false;
  if (typeof data.activeKey !== 'string' || typeof data.savedAt !== 'number') return false;
  if (!isObject(data.drafts)) return false;
  const drafts = data.drafts;
  if (!Object.entries(drafts).every(([k, v]) => isRecordDoc(v) && (v as RecordDoc).id === k)) return false;
  if (!Array.isArray(data.history) || !data.history.every(isHistoryEntry)) return false;
  if (data.history.length > HISTORY_LIMIT) return false;
  return true;
}

/** 结构校验通过后的归一化：修 activeKey / 夹阈值 / 裁剪历史与草稿 */
function normalize(data: PersistedState): PersistedState {
  const drafts = data.drafts;
  const keys = Object.keys(drafts);

  let activeKey = data.activeKey;
  if (!drafts[activeKey]) {
    const newest = keys
      .map((k) => drafts[k])
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    activeKey = newest ? newest.id : '';
  }

  const t = clampThresholds(data.settings.passLine, data.settings.excellentLine);

  return {
    ...data,
    version: CURRENT_VERSION,
    activeKey,
    settings: { ...data.settings, passLine: t.passLine, excellentLine: t.excellentLine },
    history: data.history.slice(0, HISTORY_LIMIT),
    drafts,
  };
}

/**
 * 版本迁移（设计 §4.3）
 * v0（无 version 或 version<1）→ v1：结构相同，仅补 version 并做归一化。
 */
export function migrate(raw: unknown): PersistedState | null {
  if (!isObject(raw)) return null;
  const v = typeof raw.version === 'number' ? raw.version : 0;
  let data: Record<string, unknown> = raw;
  if (v !== CURRENT_VERSION) data = { ...data, version: CURRENT_VERSION };
  if (!validate(data)) return null;
  return normalize(data);
}

/** 序列化：裁剪草稿（>90 → 60）与历史（≤200），夹取阈值 */
export function serialize(state: PersistedState): PersistedState {
  let drafts = state.drafts;
  const ids = Object.keys(drafts);
  if (ids.length > MAX_DRAFTS) {
    const keep = ids
      .map((id) => drafts[id])
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, PRUNE_DRAFTS_TO)
      .map((d) => d.id);
    const keepSet = new Set(keep);
    keepSet.add(state.activeKey);
    const next: Record<string, RecordDoc> = {};
    for (const id of keepSet) if (drafts[id]) next[id] = drafts[id];
    drafts = next;
  }

  const t = clampThresholds(state.settings.passLine, state.settings.excellentLine);

  return {
    ...state,
    version: CURRENT_VERSION,
    drafts,
    settings: { ...state.settings, passLine: t.passLine, excellentLine: t.excellentLine },
    history: state.history.slice(0, HISTORY_LIMIT),
    savedAt: Date.now(),
  };
}

/** 写主存：失败返回 false（隐私模式 / 配额满），不抛异常 */
export function savePersistedState(state: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state)));
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult {
  state: PersistedState | null;
  recovered: boolean;
}

/** 读路径与恢复（设计 §6.7.2） */
export async function loadPersistedState(): Promise<LoadResult> {
  let state: PersistedState | null = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = migrate(JSON.parse(raw) as unknown);
  } catch {
    state = null;
  }

  if (state) return { state, recovered: false };

  const snapshots = await getSnapshots();
  for (const snap of snapshots) {
    try {
      const parsed = migrate(JSON.parse(snap.payload) as unknown);
      if (parsed) return { state: parsed, recovered: true };
    } catch {
      // 继续尝试更旧的快照
    }
  }

  return { state: null, recovered: false };
}

/** 定时快照到 IDB */
export async function takeSnapshot(state: PersistedState): Promise<void> {
  const at = Date.now();
  await putSnapshot({ id: String(at), at, payload: JSON.stringify(serialize(state)) });
}
