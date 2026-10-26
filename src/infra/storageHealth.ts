import type { PersistedStateV4 } from '../domain/types';
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

export function readHealth(state: PersistedStateV4, snapshotCount: number): StorageHealth {
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
  classes?: unknown[];
  points?: unknown[];
}

/**
 * 「这次要写入的内容里还剩多少**登记成果**」——只数真正不可再生的东西：
 * 已保存的记录、已固化的历史、积分流水。
 *
 * ⚠️ 不能把 records/history 为空当成「数据丢了」（v2.5.6 事故）：
 * 老师当天还没开始登记时 records=[]、history=[] 是**正常态**，旧判据据此判空，
 * 结果是「打开一个空当天 → 被判只读 → 点清空并重来 → 还是空 → 还是只读」，永远出不来。
 */
function workCount(s: LooseState): number {
  const n = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return n(s.records) + n(s.history) + n(s.points);
}

/** 「名单还在不在」——用来区分「正常空当天」和「真把数据弄丢了（班级/学生都没了）」 */
function rosterCount(s: LooseState): number {
  const classes = Array.isArray(s.classes) ? s.classes : [];
  let roster = 0;
  for (const c of classes) {
    const students = (c as { students?: unknown } | null)?.students;
    if (Array.isArray(students)) roster += students.length;
  }
  return roster;
}

/**
 * 覆盖保护（BR-75 / INV-24）：
 *   - 首次启动（prevRaw 为空）→ 放行
 *   - 磁盘内容坏了（parse 失败）→ 放行（有快照兜底，强行拦截会让用户永远写不进去）
 *   - 磁盘上没有任何登记成果 → 放行（没东西可保护）
 *   - 本次要写的内容**连名单都没有了**、而磁盘上有人有成绩 → 拦截（这才是真丢数据）
 *   - 本次只是「当天还没录入」、名单还在 → **放行**（正常态，不许拦）
 */
export function shouldBlockOverwrite(next: PersistedStateV4, prevRaw: string | null): boolean {
  if (!prevRaw) return false;
  let prev: LooseState;
  try {
    prev = JSON.parse(prevRaw) as LooseState;
  } catch {
    return false;
  }
  if (!prev || typeof prev !== 'object') return false;

  // 磁盘上没有可失去的东西，没必要拦
  if (workCount(prev) === 0) return false;
  // 磁盘上有人有成绩，而现在要写的东西连名单都没了 → 真丢了，拦住
  return rosterCount(next) === 0;
}
