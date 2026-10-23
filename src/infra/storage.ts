import type { PersistedStateV2, RecordDoc, Entry, ScoringScheme } from '../domain/types';
import { BACKUP_V1_KEY, HISTORY_LIMIT, STORAGE_KEY } from '../domain/constants';

/** V1 的存储键：老用户的数据在这里，读取时必须回落 */
const STORAGE_KEY_V1 = 'xq.state.v1';
import { migrate, isV1State, isV2State, UnknownStateError } from '../domain/migrate';
import { getSnapshots, putSnapshot } from './idb';

/**
 * V2 持久化（设计 04 §4.6 / §11）—— 只在这里碰 localStorage。
 * 规则：
 *   - 读到 v1 → 先备份原始 JSON 到 xq.backup.v1（只写一次），再纯函数迁移；
 *   - 迁移失败 → 不覆盖、不写回，返回 error 由 UI 进入只读并提示下载原始备份；
 *   - version > 2 → 拒绝写入（提示升级）。
 */

export const CURRENT_VERSION = 2;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const GRADES = new Set(['A+', 'A', 'A-', 'B+', 'B', 'C', 'D']);
const STAMPS = new Set(['none', 'corrected', 'excellent']);
const STATUSES = new Set(['normal', 'missing', 'leave']);
const TEMPLATES = new Set(['homework', 'dictation', 'quality', 'custom']);

function isEntry(v: unknown): v is Entry {
  if (!isObject(v)) return false;
  if (typeof v.stamp !== 'string' || !STAMPS.has(v.stamp)) return false;
  if (typeof v.status !== 'string' || !STATUSES.has(v.status)) return false;
  if (typeof v.pass !== 'boolean') return false;
  if (typeof v.updatedAt !== 'number') return false;
  if (v.makeup !== null) {
    if (!isObject(v.makeup)) return false;
    if (typeof v.makeup.at !== 'number' || typeof v.makeup.note !== 'string') return false;
  }
  const val = v.value;
  if (val === null) return true;
  if (!isObject(val)) return false;
  if (val.kind === 'grade') return typeof val.grade === 'string' && GRADES.has(val.grade);
  if (val.kind === 'score') return typeof val.score === 'number' && Number.isFinite(val.score);
  if (val.kind === 'text') return typeof val.text === 'string';
  if (val.kind === 'pass') return true;
  return false;
}

function isScheme(v: unknown): v is ScoringScheme {
  if (!isObject(v)) return false;
  return (
    typeof v.kind === 'string' &&
    ['grade', 'score', 'check', 'mixed', 'text'].includes(v.kind) &&
    (v.maxScore === null || typeof v.maxScore === 'number') &&
    Array.isArray(v.grades) &&
    typeof v.allowCheck === 'boolean' &&
    typeof v.allowText === 'boolean' &&
    typeof v.decimals === 'number' &&
    typeof v.excellentRate === 'number' &&
    typeof v.goodRate === 'number' &&
    typeof v.passRate === 'number'
  );
}

function isRecord(v: unknown): v is RecordDoc {
  if (!isObject(v)) return false;
  if (typeof v.key !== 'string' || typeof v.classId !== 'string') return false;
  if (typeof v.date !== 'string' || typeof v.content !== 'string') return false;
  if (typeof v.sheetId !== 'string') return false;
  if (typeof v.templateId !== 'string' || !TEMPLATES.has(v.templateId)) return false;
  if (typeof v.createdAt !== 'number' || typeof v.updatedAt !== 'number') return false;
  if (!isScheme(v.scheme)) return false;
  if (!isObject(v.entries)) return false;
  return Object.values(v.entries).every(isEntry);
}

export function validateState(data: unknown): data is PersistedStateV2 {
  if (!isObject(data)) return false;
  if (data.version !== CURRENT_VERSION) return false;
  if (typeof data.activeClassId !== 'string') return false;
  if (!Array.isArray(data.classes) || data.classes.length === 0) return false;
  if (!data.classes.every((c) => isObject(c) && typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.students))) {
    return false;
  }
  if (!Array.isArray(data.records) || !data.records.every(isRecord)) return false;
  if (!Array.isArray(data.history) || !data.history.every(isRecord)) return false;
  if (!Array.isArray(data.pointRules) || !Array.isArray(data.pointLedger)) return false;
  if (!isObject(data.settings)) return false;
  return true;
}

/** 序列化：截断历史到 200（其余保持原样，V2 不做草稿淘汰——L-2 不丢数据） */
export function serialize(state: PersistedStateV2): PersistedStateV2 {
  return {
    ...state,
    version: CURRENT_VERSION,
    history: state.history.slice(0, HISTORY_LIMIT),
    lastSavedAt: Date.now(),
  };
}

export function saveState(state: PersistedStateV2): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state)));
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult {
  state: PersistedStateV2 | null;
  /** 从 IDB 快照恢复 */
  recovered: boolean;
  /** 由 v1 迁移而来 */
  migrated: boolean;
  /** 迁移/解析失败（此时 state 为 null，UI 应进入只读并提示下载备份） */
  error?: 'MIGRATE_FAILED' | 'UNKNOWN_STATE' | 'NEWER_VERSION';
  /** 迁移失败时用于「下载原始备份」的原始字符串 */
  rawBackup?: string;
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readV1Raw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_V1);
  } catch {
    return null;
  }
}

function backupV1(raw: string): void {
  try {
    if (!localStorage.getItem(BACKUP_V1_KEY)) localStorage.setItem(BACKUP_V1_KEY, raw);
  } catch {
    // 备份失败不阻断：迁移本身是纯函数，raw 仍在 error.rawBackup 里
  }
}

/** 解析 + 迁移 + 校验（不落盘） */
export function parseState(rawText: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { state: null, recovered: false, migrated: false, error: 'UNKNOWN_STATE', rawBackup: rawText };
  }

  if (isObject(parsed) && typeof parsed.version === 'number' && parsed.version > CURRENT_VERSION) {
    return { state: null, recovered: false, migrated: false, error: 'NEWER_VERSION', rawBackup: rawText };
  }

  if (isV2State(parsed)) {
    return { state: validateState(parsed) ? parsed : null, recovered: false, migrated: false, error: validateState(parsed) ? undefined : 'UNKNOWN_STATE', rawBackup: rawText };
  }

  if (isV1State(parsed)) {
    backupV1(rawText);
    try {
      const { state } = migrate(parsed);
      return { state, recovered: false, migrated: true };
    } catch (e) {
      return {
        state: null,
        recovered: false,
        migrated: false,
        error: e instanceof UnknownStateError ? 'UNKNOWN_STATE' : 'MIGRATE_FAILED',
        rawBackup: rawText,
      };
    }
  }

  return { state: null, recovered: false, migrated: false, error: 'UNKNOWN_STATE', rawBackup: rawText };
}

export async function loadState(): Promise<LoadResult> {
  const raw = readRaw() ?? readV1Raw();
  if (raw) {
    const result = parseState(raw);
    if (result.state || result.error === 'NEWER_VERSION') return result;
    // 主存损坏/迁移失败 → 尝试快照（快照也是 v2 序列化格式）
  }

  const snapshots = await getSnapshots();
  for (const snap of snapshots) {
    const result = parseState(snap.payload);
    if (result.state) return { ...result, recovered: true };
  }

  if (raw) return parseState(raw);
  return { state: null, recovered: false, migrated: false };
}

export async function takeSnapshot(state: PersistedStateV2): Promise<void> {
  const at = Date.now();
  await putSnapshot({ id: String(at), at, payload: JSON.stringify(serialize(state)) });
}

/** 读取 v1 备份（设置里【下载原始备份】用） */
export function readV1Backup(): string | null {
  try {
    return localStorage.getItem(BACKUP_V1_KEY);
  } catch {
    return null;
  }
}
