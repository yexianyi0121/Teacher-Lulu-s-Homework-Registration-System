import type { PersistedStateV4, RecordDoc, Entry, ScoringScheme } from '../domain/types';
import {
  BACKUP_V1_KEY,
  BACKUP_V2_KEY,
  BACKUP_V3_KEY,
  HISTORY_LIMIT,
  STORAGE_KEY,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  STORAGE_KEY_V3,
} from '../domain/constants';
import { isV1State, isV2State, isV3State, isV4State, migrate, UnknownStateError } from '../domain/migrate';
import { refreshHistoryMetrics } from '../domain/history';
import { shouldBlockOverwrite } from './storageHealth';
import { getSnapshots, putSnapshot } from './idb';

/**
 * V4 持久化（设计 09 ADR-28 由 V3 升级）—— 只在这里碰 localStorage。
 * 规则：
 *   - 读：v4 → v3（迁移）→ v2（迁移）→ v1（迁移）→ IDB 快照；
 *   - 迁移前把原文写入 xq.backup.v2 / xq.backup.v1（只写一次，不覆盖已有备份）；
 *   - 迁移失败 → 不写回、不覆盖，返回 error 由 UI 进入只读并提供下载；
 *   - 写：saveState() 必须先过 shouldBlockOverwrite（INV-24）；
 *   - 主存损坏 → 原文另存 xq.corrupt.{ts}（不删），再回落快照。
 */

export const CURRENT_VERSION = 4;

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

export function validateState(data: unknown): data is PersistedStateV4 {
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

function diskSeq(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const o = JSON.parse(raw) as { saveSeq?: unknown };
    return typeof o.saveSeq === 'number' && Number.isFinite(o.saveSeq) ? o.saveSeq : 0;
  } catch {
    return 0;
  }
}

/** 序列化：截断历史到 200（V2 起不做草稿淘汰——L-2 不丢数据） */
export function serialize(state: PersistedStateV4): PersistedStateV4 {
  return {
    ...state,
    version: CURRENT_VERSION,
    // 防御：历史缺失不能把整个保存链路炸掉（写盘是最后一道防线，宁可截断不可抛）
    history: Array.isArray(state.history) ? state.history.slice(0, HISTORY_LIMIT) : [],
    lastSavedAt: Date.now(),
    // 序号从磁盘当前值 +1：内存里的 state 可能没有这个字段，靠它取序号会永远停在 1
    saveSeq: diskSeq() + 1,
  };
}

/**
 * 磁盘上那份数据的「指纹」（D-02 / D-03）。
 * 老师可能开着两个窗口（学校电脑 + 家里电脑、或两个标签页），两边的内存快照各自演化；
 * 不加检查的话，「后写的那份整表覆盖先写的」，而且关窗/切窗时内存旧快照会无条件把磁盘改回去。
 * 这里只读不写，供保存前比对。
 */
export function diskStamp(): string | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  // 指纹取「写入序号 + 时间」：同一毫秒内连写两次时，单靠时间戳区分不出新旧，
  // 会让冲突检测漏判（连点两下就发生）。raw 的长度与内容也一并计入，兜住老数据。
  return fingerprint(raw);
}

function fingerprint(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const o = JSON.parse(raw) as { saveSeq?: unknown; lastSavedAt?: unknown };
    const seq = typeof o.saveSeq === 'number' ? o.saveSeq : 0;
    const at = typeof o.lastSavedAt === 'number' ? o.lastSavedAt : 0;
    return `s${seq}-t${at}-l${raw.length}`;
  } catch {
    return `l${raw.length}`;
  }
}

export interface SaveResult {
  ok: boolean;
  /** 被覆盖保护拦截（调用方应进入只读 + 提示） */
  blocked?: boolean;
  /** 磁盘已被别的窗口改过，本次写入被拒绝（D-02/D-03：调用方决定是覆盖还是让老师选） */
  conflict?: boolean;
  /** 写成功后磁盘指纹，调用方存下来作为下次比对的基线 */
  stamp?: string;
  /** 写失败的具体原因（D-01）：空间不足 / 存储不可用。调用方据此给不同自救建议 */
  reason?: 'quota' | 'unavailable';
}

/**
 * 写盘（INV-24）：所有调用方只能走这里，不得直接 localStorage.setItem(STORAGE_KEY)。
 * 覆盖保护：内存空 + 磁盘非空 → 拒绝。
 */
export function saveState(state: PersistedStateV4, expectStamp: string | null = null): SaveResult {
  let prevRaw: string | null = null;
  try {
    prevRaw = localStorage.getItem(STORAGE_KEY);
  } catch {
    prevRaw = null;
  }

  if (shouldBlockOverwrite(state, prevRaw)) {
    quarantine('blocked', JSON.stringify(state));
    return { ok: false, blocked: true };
  }

  // D-02/D-03：写前比对基线——磁盘若不是「我上次写的那份」，说明有别的窗口改过，
  // 直接覆盖会静默抹掉那边的录入。此处拒绝并回报冲突，由调用方询问老师。
  if (expectStamp !== null && diskStamp() !== expectStamp) {
    return { ok: false, conflict: true };
  }

  // 序列化放在 try 外面：如果 serialize 自己抛错（数据结构异常），
  // 不能伪装成「存储不可用」——那是两回事，误判会把老师引向错误的自救动作。
  const payload = JSON.stringify(serialize(state));

  try {
    localStorage.setItem(STORAGE_KEY, payload);
    // stamp 直接用刚写下去的原文算，避免「返回值与磁盘实际内容不一致」
    return { ok: true, stamp: fingerprint(payload) ?? undefined };
  } catch (e) {
    // 必须区分原因：QuotaExceededError 老师可以删历史自救，存储被禁用则只能换浏览器。
    // 旧版一律返回 {ok:false} 且界面只说「存储不可用」，等于把「写满了」误诊成「坏了」（D-01）。
    const name = (e as { name?: string } | null)?.name ?? '';
    const isQuota =
      name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      (typeof e === 'object' && e !== null && (e as { code?: number }).code === 22);
    return { ok: false, reason: isQuota ? 'quota' : 'unavailable' };
  }
}

export interface LoadResult {
  state: PersistedStateV4 | null;
  recovered: boolean;
  migrated: boolean;
  error?: 'MIGRATE_FAILED' | 'UNKNOWN_STATE' | 'NEWER_VERSION';
  rawBackup?: string;
  notes: string[];
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function backupOnce(key: string, raw: string): void {
  try {
    if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
  } catch {
    // 备份失败不阻断：原文还在 error.rawBackup 里
  }
}

/** 损坏原文另存（不覆盖、不删除，供人工导出） */
/** 隔离副本 / 导入前快照最多各留几条（D-14：它们只增不减，会吃满配额反过来造成 D-01） */
const KEEP_QUARANTINE = 2;
const KEEP_PREIMPORT = 2;

/**
 * 按前缀修剪旧的 localStorage 记录，只保留最近 keep 条。
 * 时间戳是可排序的定长序列，按字符串排就是按时间排。
 */
function prunePrefix(prefix: string, keep: number): void {
  try {
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - keep))) {
      localStorage.removeItem(k);
    }
  } catch {
    // 修剪失败不影响主流程
  }
}

function quarantine(kind: 'corrupt' | 'blocked', raw: string): void {
  try {
    localStorage.setItem(`xq.${kind}.${Date.now()}`, raw);
  } catch {
    // 存不下就放弃存证，不能因此阻断启动
  }
  prunePrefix(`xq.${kind}.`, KEEP_QUARANTINE);
}

/** 单调递增的毫秒时间戳：同一毫秒内连写两次不会撞键 */
let lastStamp = 0;
function nextStamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

/** 供导入名单等处复用：写入导入前快照并修剪旧快照 */
export function savePreimportSnapshot(json: string): boolean {
  try {
    localStorage.setItem(`xq.preimport.${nextStamp()}`, json);
    prunePrefix('xq.preimport.', KEEP_PREIMPORT);
    return true;
  } catch {
    return false;
  }
}

/** 解析 + 迁移 + 校验（不落盘） */
export function parseState(rawText: string, sourceKey = STORAGE_KEY): LoadResult {
  void sourceKey;
  const notes: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    quarantine('corrupt', rawText);
    return { state: null, recovered: false, migrated: false, error: 'UNKNOWN_STATE', rawBackup: rawText, notes };
  }

  if (isObject(parsed) && typeof parsed.version === 'number' && parsed.version > CURRENT_VERSION) {
    return { state: null, recovered: false, migrated: false, error: 'NEWER_VERSION', rawBackup: rawText, notes };
  }

  if (isV4State(parsed)) {
    if (!validateState(parsed)) {
      quarantine('corrupt', rawText);
      return { state: null, recovered: false, migrated: false, error: 'UNKNOWN_STATE', rawBackup: rawText, notes };
    }
    const state = refreshHistoryMetrics(parsed);
    return { state, recovered: false, migrated: false, notes };
  }

  if (isV3State(parsed)) {
    backupOnce(BACKUP_V3_KEY, rawText);
    try {
      const { state } = migrate(parsed);
      notes.push('已把旧版数据升级到 V4（原始数据已备份）');
      return { state: refreshHistoryMetrics(state), recovered: false, migrated: true, notes };
    } catch (e) {
      return {
        state: null, recovered: false, migrated: false,
        error: e instanceof UnknownStateError ? 'UNKNOWN_STATE' : 'MIGRATE_FAILED',
        rawBackup: rawText, notes,
      };
    }
  }

  if (isV2State(parsed)) {
    backupOnce(BACKUP_V2_KEY, rawText);
    try {
      const { state } = migrate(parsed);
      const fixed = countSchemesWithoutMax(parsed);
      if (fixed) notes.push(`已为 ${fixed} 张混合表补齐满分 100`);
      return { state: refreshHistoryMetrics(state), recovered: false, migrated: true, notes };
    } catch (e) {
      return {
        state: null, recovered: false, migrated: false,
        error: e instanceof UnknownStateError ? 'UNKNOWN_STATE' : 'MIGRATE_FAILED',
        rawBackup: rawText, notes,
      };
    }
  }

  if (isV1State(parsed)) {
    backupOnce(BACKUP_V1_KEY, rawText);
    try {
      const { state } = migrate(parsed);
      notes.push('已把 V1 数据升级到 V3（原始数据已备份）');
      return { state: refreshHistoryMetrics(state), recovered: false, migrated: true, notes };
    } catch (e) {
      return {
        state: null, recovered: false, migrated: false,
        error: e instanceof UnknownStateError ? 'UNKNOWN_STATE' : 'MIGRATE_FAILED',
        rawBackup: rawText, notes,
      };
    }
  }

  quarantine('corrupt', rawText);
  return { state: null, recovered: false, migrated: false, error: 'UNKNOWN_STATE', rawBackup: rawText, notes };
}

function countSchemesWithoutMax(state: { records?: RecordDoc[]; history?: RecordDoc[] }): number {
  const all = [...(state.records ?? []), ...(state.history ?? [])];
  return all.filter((r) => (r.scheme.kind === 'mixed' || r.scheme.kind === 'score') && !r.scheme.maxScore).length;
}

/** 启动读取：v4 → v3 → v2 → v1 → IDB 快照 */
export async function loadState(): Promise<LoadResult> {
  const candidates: Array<[string, string | null]> = [
    [STORAGE_KEY, readKey(STORAGE_KEY)],
    [STORAGE_KEY_V3, readKey(STORAGE_KEY_V3)],
    [STORAGE_KEY_V2, readKey(STORAGE_KEY_V2)],
    [STORAGE_KEY_V1, readKey(STORAGE_KEY_V1)],
  ];

  for (const [key, raw] of candidates) {
    if (!raw) continue;
    const result = parseState(raw, key);
    if (result.state || result.error === 'NEWER_VERSION') return result;
  }

  const snapshots = await getSnapshots();
  for (const snap of snapshots) {
    const result = parseState(snap.payload);
    if (result.state) return { ...result, recovered: true, notes: ['已从自动备份恢复'] };
  }

  for (const [key, raw] of candidates) {
    if (raw) return parseState(raw, key);
  }
  return { state: null, recovered: false, migrated: false, notes: [] };
}

export async function takeSnapshot(state: PersistedStateV4): Promise<void> {
  const at = Date.now();
  await putSnapshot({ id: String(at), at, payload: JSON.stringify(serialize(state)) });
}

/** 读取 v1 备份（设置里【下载原始备份】用） */
export function readV1Backup(): string | null {
  return readKey(BACKUP_V1_KEY);
}

/* ---------------- 启动闸门（防「空覆盖」） ---------------- */

let booted = false;

/** replaceState 之后调用：此前的 flush 一律跳过 */
export function markBooted(): void {
  booted = true;
}

export function isBooted(): boolean {
  return booted;
}
