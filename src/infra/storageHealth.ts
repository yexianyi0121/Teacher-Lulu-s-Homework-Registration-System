import type { PersistedStateV3 } from '../domain/types';
import { STORAGE_KEY } from '../domain/constants';

/**
 * 存储健康与覆盖保护（设计 06 §3.8 / BR-75 / BR-76）—— 纯函数，便于单测。
 */

export interface StorageHealth {
  mode: 'file' | 'http';
  origin: string;
  key: string;
  bytes: number;
  lastSavedAt: number | null;
  snapshotCount: number;
  records: number;
  history: number;
  classes: number;
}

export function readHealth(state: PersistedStateV3, snapshotCount: number): StorageHealth {
  const mode: StorageHealth['mode'] =
    typeof location !== 'undefined' && location.protocol === 'file:' ? 'file' : 'http';
  const origin = typeof location !== 'undefined' ? location.origin : '';
  return {
    mode,
    origin,
    key: STORAGE_KEY,
    bytes: byteLength(JSON.stringify(state)),
    lastSavedAt: state.lastSavedAt || null,
    snapshotCount,
    records: state.records.length,
    history: state.history.length,
    classes: state.classes.length,
  };
}

function byteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length;
}

interface LooseState {
  records?: unknown[];
  history?: unknown[];
}

function isEmpty(s: LooseState): boolean {
  return (s.records?.length ?? 0) === 0 && (s.history?.length ?? 0) === 0;
}

/**
 * 覆盖保护（BR-75）：
 *   - 首次启动（prevRaw 为空）→ 放行
 *   - 磁盘内容坏了（parse 失败）→ 放行（有快照兜底，强行拦截会让用户永远写不进去）
 *   - 仅当「即将写入为空」且「磁盘非空」→ 拦截
 */
export function shouldBlockOverwrite(next: PersistedStateV3, prevRaw: string | null): boolean {
  if (!prevRaw) return false;
  let prev: LooseState;
  try {
    prev = JSON.parse(prevRaw) as LooseState;
  } catch {
    return false;
  }
  if (!prev || typeof prev !== 'object') return false;
  return isEmpty(next) && !isEmpty(prev);
}
