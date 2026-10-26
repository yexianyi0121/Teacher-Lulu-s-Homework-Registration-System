import type { PersistedStateV4 } from '../domain/types';
import { ENV_MARK_KEY } from '../domain/constants';
import { isV1State, isV2State, isV3State, isV4State, migrate } from '../domain/migrate';
import { validateState } from './storage';

/**
 * 数据导出 / 导入 / 环境指纹（设计 06 §3.8 / FR-44）。
 * 导出用带 meta 的信封，导入同时兼容「信封」与「裸 state」，方便旧备份直接导入。
 */

export interface BackupEnvelope {
  app: '学情登记分析系统';
  version: number;
  exportedAt: string;
  state: PersistedStateV4;
}

export interface EnvMark {
  origin: string;
  href: string;
  at: number;
}

export function exportAllBlob(s: PersistedStateV4): Blob {
  const env: BackupEnvelope = {
    app: '学情登记分析系统',
    version: s.version,
    exportedAt: new Date().toISOString(),
    state: s,
  };
  return new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
}

export type ImportResult =
  | { ok: true; state: PersistedStateV4 }
  | { ok: false; reason: string };

export function importAll(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: '不是合法的 JSON 文件' };
  }

  const maybe = parsed as { state?: unknown; app?: string } | null;
  const raw = maybe && typeof maybe === 'object' && 'state' in maybe && maybe.state ? maybe.state : parsed;

  try {
    if (isV4State(raw)) {
      return validateState(raw)
        ? { ok: true, state: raw }
        : { ok: false, reason: '数据结构校验未通过（version 4）' };
    }
    if (isV3State(raw) || isV2State(raw) || isV1State(raw)) {
      const { state } = migrate(raw);
      return validateState(state)
        ? { ok: true, state }
        : { ok: false, reason: '旧版数据迁移后校验未通过' };
    }
  } catch {
    return { ok: false, reason: '数据升级失败，文件未导入' };
  }

  return { ok: false, reason: '无法识别的数据版本' };
}

/**
 * 「导出坏数据原文」（FR-54.3）：只读状态下横幅上的第二个出口。
 * 主存内容解析失败时，老师至少要能把原始文本拿走，才有办法找人修。
 */
export function exportRawBackup(raw: string): Blob {
  const envelope = {
    app: '学情登记分析系统',
    kind: 'RAW_UNRECOVERABLE',
    exportedAt: new Date().toISOString(),
    note: '这是无法解析的原始存储内容，不是可用备份。保留它是为了以后能尝试修复。',
    raw,
  };
  return new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
}

/** 读取主存原文（只读救援用；不解析、不校验） */
export function readRawStateText(): string | null {
  try {
    return localStorage.getItem('xq.state.v4');
  } catch {
    return null;
  }
}

export function readEnvMark(): EnvMark | null {
  try {
    const raw = localStorage.getItem(ENV_MARK_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<EnvMark>;
    return typeof o.origin === 'string' && typeof o.href === 'string' && typeof o.at === 'number'
      ? { origin: o.origin, href: o.href, at: o.at }
      : null;
  } catch {
    return null;
  }
}

export function writeEnvMark(): void {
  try {
    const mark: EnvMark = {
      origin: typeof location !== 'undefined' ? location.origin : '',
      href: typeof location !== 'undefined' ? location.href : '',
      at: Date.now(),
    };
    localStorage.setItem(ENV_MARK_KEY, JSON.stringify(mark));
  } catch {
    // 存储不可用时静默：环境提示不是核心功能
  }
}

/* ---------------- 自动备份提醒（BR-78） ---------------- */

const LAST_BACKUP_KEY = 'xq.lastBackupAt';

export function readLastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function markBackupDone(at = Date.now()): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(at));
  } catch {
    // 忽略
  }
}

/** 距上次导出超过 days 天 → 提醒（days=0 关闭） */
export function shouldRemindBackup(days: number, now = Date.now()): boolean {
  if (!days || days <= 0) return false;
  const last = readLastBackupAt();
  if (last === null) return true;
  return now - last > days * 24 * 60 * 60 * 1000;
}
