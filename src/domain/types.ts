/**
 * 领域类型（设计说明书 §4.1，【必须】照抄，不得改名）
 */

export type Mode = 'homework' | 'quiz' | 'dictation';

export type Grade = 'A+' | 'A' | 'A-' | 'CHECK' | 'CROSS';
// CHECK = √（已交未评级）  CROSS = ×（未提交）

export type Stamp = 'none' | 'corrected' | 'excellent';

export type CellValue =
  | { kind: 'grade'; grade: Grade }
  | { kind: 'score'; score: number }      // 0–100，最多 1 位小数
  | { kind: 'text'; text: string };       // 听写默写原文，≤ 20 字符

export interface Entry {
  value: CellValue | null;
  stamp: Stamp;
  updatedAt: number;
}

/** 学号 -> Entry。键为 '1'..'120' 的字符串形式 */
export type Entries = Record<string, Entry>;

export interface Student {
  no: number;          // 1..120
  name?: string;       // 可选敏感字段
}

export interface ClassInfo {
  id: string;
  name: string;        // 班级名
  school: string;      // 学校名（海报署名）
  teacher: string;     // 教师名（海报署名）
  subject: string;     // 学科
  students: Student[]; // 长度 = 人数，no 从 1 连续
}

export interface RecordDoc {
  id: string;          // recordKey
  date: string;        // 'YYYY-MM-DD'
  content: string;     // 作业内容，≤ 20 字
  mode: Mode;
  entries: Entries;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;          // 与 RecordDoc.id 同源（覆盖更新）
  date: string;
  content: string;
  mode: Mode;
  entries: Entries;
  metrics: SessionMetrics;   // 落盘时快照，避免历史重算
  savedAt: number;
}

export interface Settings {
  count: number;               // 班级人数 N（1–120），所有统计/名单/报表/海报的取值域恒为 1..count
  secondsJump: boolean;        // 秒跳
  showName: boolean;           // 显示姓名
  excellentLine: number;       // 优秀线，默认 90
  passLine: number;            // 及格线，默认 60
  honorIncludesA: boolean;     // 光荣榜是否含 A（常规作业），默认 false
}

export interface SessionMetrics {
  entered: number;
  avg: number | null;
  excellent: number;
  good: number;
  pass: number;
  fail: number;
  excellentRate: number | null;
  corrected: number;
  notSubmitted: number;
  max: number | null;
  min: number | null;
}

export interface RosterGroups {
  honor: number[];
  notSubmitted: number[];
  needsFix: number[];
  fixed: number[];      // 需更正但已盖「已更正」章（PRD §6.6），只用于报表第四段
}

/** §9.3 tone 函数使用的值别名（与 CellValue 同构） */
export type EntryValue = CellValue;

/** 单元格视觉色调（设计 §9.3） */
export type CellTone = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'empty';
