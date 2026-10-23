import type { Entries, Entry, ScoringScheme, SheetTemplateId, Student } from '../src/domain/types';
import { DEFAULT_SCHEMES } from '../src/domain/constants';

/** 样例与断言共用的构造器 */

export function makeScheme(
  kind: ScoringScheme['kind'] = 'score',
  overrides: Partial<ScoringScheme> = {},
): ScoringScheme {
  const base = DEFAULT_SCHEMES['quality' as SheetTemplateId];
  return {
    ...base,
    kind,
    maxScore: kind === 'score' || kind === 'mixed' ? 100 : null,
    grades: [...base.grades],
    ...overrides,
  };
}

export function e(value: Entry['value'], extra: Partial<Entry> = {}): Entry {
  return {
    value,
    stamp: 'none',
    status: 'normal',
    pass: false,
    makeup: null,
    updatedAt: 0,
    ...extra,
  };
}

export const score = (n: number) => ({ kind: 'score' as const, score: n });
export const g = (letter: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C' | 'D') => ({ kind: 'grade' as const, grade: letter });
export const text = (t: string) => ({ kind: 'text' as const, text: t });

/** V1 样例 A 的 20 个分数（PRD §7.1） */
export const SAMPLE_A_SCORES: Array<[number, number]> = [
  [1, 98], [2, 95], [3, 94], [4, 89], [5, 92],
  [6, 91], [7, 95], [8, 98], [9, 98], [10, 94],
  [11, 92], [12, 90.5], [13, 94], [14, 88], [15, 72],
  [16, 94], [17, 43], [18, 88], [19, 73], [20, 75],
];

export function sampleAEntries(): Entries {
  const entries: Entries = {};
  for (const [no, s] of SAMPLE_A_SCORES) entries[String(no)] = e(score(s));
  return entries;
}

/** V1 样例 B：常规作业 50 人（PRD §7.2） */
export const SAMPLE_B_A_PLUS = [1, 2, 5, 6, 9, 10, 12, 14, 22, 24, 28, 32, 33, 34, 36, 37, 40, 41, 44, 49, 50];
export const SAMPLE_B_A = [7, 23, 26, 39];
export const SAMPLE_B_A_MINUS = [3, 4, 8, 11, 13, 15, 16, 18, 19, 20, 21, 25, 27, 29, 30, 31, 35, 38, 42, 43, 45, 46, 47, 48];
export const SAMPLE_B_CROSS = [17];

export function sampleBEntries(): Entries {
  const entries: Entries = {};
  for (const no of SAMPLE_B_A_PLUS) entries[String(no)] = e(g('A+'));
  for (const no of SAMPLE_B_A) entries[String(no)] = e(g('A'));
  for (const no of SAMPLE_B_A_MINUS) entries[String(no)] = e(g('A-'));
  for (const no of SAMPLE_B_CROSS) entries[String(no)] = e(null, { status: 'missing' });
  return entries;
}

/** PRD-V2 §8.1 样例 C：混合登记 + 满分 120 + 请假 + 补交 */
export function sampleCEntries(): Entries {
  const entries: Entries = {};
  const put = (no: number, entry: Entry) => { entries[String(no)] = entry; };

  put(1, e(score(118)));
  put(2, e(g('A+')));
  put(3, e(score(100)));
  put(4, e(score(92)));
  put(5, e(score(70)));
  put(6, e(g('A')));
  put(7, e(score(110)));
  put(8, e(score(115)));
  put(9, e(g('B+')));
  put(10, e(score(60)));
  put(11, e(null, { status: 'missing' }));
  put(12, e(null, { status: 'leave' }));
  put(13, e(score(105)));
  put(14, e(score(96)));
  put(15, e(score(88)));
  put(16, e(g('A-')));
  put(17, e(score(45)));
  put(18, e(score(100), { makeup: { at: 1, note: '课后补交' } }));
  put(19, e(score(120)));
  put(20, e(g('D')));
  return entries;
}

export const SAMPLE_C_SCHEME: ScoringScheme = makeScheme('mixed', {
  maxScore: 120,
  excellentRate: 0.9,
  goodRate: 0.8,
  passRate: 0.6,
});

export const EXPECTED_C = {
  n: 50,
  entered: 18,
  excellent: 7,
  good: 5,
  pass: 2,
  fail: 4,
  missing: 1,
  madeUp: 1,
  leave: 1,
  notSubmitted: 31,
  avgPercent: 80,
  avgScore: 96.1,
  excellentRate: 0.389,
  qualifiedRate: 0.778,
};

export function studentsOf(n: number): Student[] {
  return Array.from({ length: n }, (_, i) => ({ no: i + 1 }) as Student);
}

/**
 * V1 报表原文（回归基线）。
 * V2 只允许三处差异：①插入「🏫 班级：」行；②「单元测试」→「质量监测」；③】后加一个空格。
 */
export const V1_REPORT_A_LINES = [
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
];
