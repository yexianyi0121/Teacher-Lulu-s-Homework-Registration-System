import type { Entries, Settings } from '../src/domain/types';
import { DEFAULT_SETTINGS } from '../src/domain/constants';

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

function entryOf(value: Entries[string]['value']): Entries[string] {
  return { value, stamp: 'none', updatedAt: 0 };
}

/** 样例 A：单元测试 20 人（PRD §7.1） */
export const SAMPLE_A_SCORES: Array<[number, number]> = [
  [1, 98], [2, 95], [3, 94], [4, 89], [5, 92],
  [6, 91], [7, 95], [8, 98], [9, 98], [10, 94],
  [11, 92], [12, 90.5], [13, 94], [14, 88], [15, 72],
  [16, 94], [17, 43], [18, 88], [19, 73], [20, 75],
];

export function sampleAEntries(): Entries {
  const entries: Entries = {};
  for (const [no, score] of SAMPLE_A_SCORES) {
    entries[String(no)] = entryOf({ kind: 'score', score });
  }
  return entries;
}

/** 样例 B：常规作业 50 人（PRD §7.2） */
export const SAMPLE_B_A_PLUS = [1, 2, 5, 6, 9, 10, 12, 14, 22, 24, 28, 32, 33, 34, 36, 37, 40, 41, 44, 49, 50];
export const SAMPLE_B_A = [7, 23, 26, 39];
export const SAMPLE_B_A_MINUS = [3, 4, 8, 11, 13, 15, 16, 18, 19, 20, 21, 25, 27, 29, 30, 31, 35, 38, 42, 43, 45, 46, 47, 48];
export const SAMPLE_B_CROSS = [17];

export function sampleBEntries(): Entries {
  const entries: Entries = {};
  for (const no of SAMPLE_B_A_PLUS) entries[String(no)] = entryOf({ kind: 'grade', grade: 'A+' });
  for (const no of SAMPLE_B_A) entries[String(no)] = entryOf({ kind: 'grade', grade: 'A' });
  for (const no of SAMPLE_B_A_MINUS) entries[String(no)] = entryOf({ kind: 'grade', grade: 'A-' });
  for (const no of SAMPLE_B_CROSS) entries[String(no)] = entryOf({ kind: 'grade', grade: 'CROSS' });
  return entries;
}

/** PRD §7.1.3 期望报表文案（逐字） */
export const EXPECTED_REPORT_A = [
  '🌸 3月13日 【💯 单元测试】综合反馈 🌸',
  '📖 作业内容：语文本',
  '-------------------------',
  '🏆 【光荣榜】本次表现优异/全对的同学：',
  '1号、2号、3号、5号、6号、7号、8号、9号、10号、11号、12号、13号、16号',
  '',
  '❌ 【暂未提交】：',
  '21号、22号、23号、24号、25号、26号、27号、28号、29号、30号、31号',
  '32号、33号、34号、35号、36号、37号、38号、39号、40号、41号、42号',
  '43号、44号、45号、46号、47号、48号、49号、50号',
  '',
  '⚠️ 【需更正】：',
  '17号',
  '（请核对后及时找老师更正）',
].join('\n');
