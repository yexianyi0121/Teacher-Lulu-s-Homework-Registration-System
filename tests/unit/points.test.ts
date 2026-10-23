import { describe, expect, it } from 'vitest';
import { evaluatePoints, monthStats, revokePoint, dedupeKeyOf, isoWeek, pointsOf } from '../../src/domain/points';
import { DEFAULT_RULES } from '../../src/domain/constants';
import type { HistoryEntry, PointLedgerEntry, RecordDoc } from '../../src/domain/types';
import { makeScheme, e, score } from '../fixtures';

const scoreScheme = makeScheme('score');

const dictationScheme = makeScheme('check');

function record(over: Partial<RecordDoc> = {}): RecordDoc {
  return {
    key: 'cls_default|2026-03-13|第3单元|sheet_default_dictation',
    classId: 'cls_default',
    date: '2026-03-13',
    content: '第3单元',
    sheetId: 'sheet_default_dictation',
    templateId: 'dictation',
    scheme: dictationScheme,
    entries: {},
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

function hist(date: string, entries: HistoryEntry['entries']): HistoryEntry {
  return {
    key: `cls_default|${date}|第3单元|sheet_default_dictation`,
    classId: 'cls_default',
    date,
    content: '第3单元',
    sheetId: 'sheet_default_dictation',
    templateId: 'dictation',
    scheme: dictationScheme,
    entries,
    createdAt: 1,
    updatedAt: 1,
    metrics: {
      n: 50, entered: 1, excellent: 0, good: 0, pass: 0, fail: 0,
      missing: 0, leave: 0, madeUp: 0, notSubmitted: 49,
      avgPercent: null, avgScore: null, excellentRate: null, qualifiedRate: null,
      passCount: 1, max: null, min: null,
    },
    metricsVersion: 2,
    savedAt: 1,
  };
}

describe('points：默认 8 条规则', () => {
  it('缺交 → 规则6 −3（AC-26.3）', () => {
    const rows = evaluatePoints({
      entry: e(null, { status: 'missing' }),
      studentNo: 4,
      record: record(),
      prevRecords: [],
      rules: DEFAULT_RULES,
      ledger: [],
      date: '2026-03-13',
    });
    const hit = rows.find((r) => r.ruleId === 'rule_6');
    expect(hit?.delta).toBe(-3);
  });

  it('补交 → 规则8 −2（AC-26.4）', () => {
    const rows = evaluatePoints({
      entry: e(null, { status: 'missing', makeup: { at: 1, note: '补' } }),
      studentNo: 5,
      record: record(),
      prevRecords: [],
      rules: DEFAULT_RULES,
      ledger: [],
      date: '2026-03-13',
    });
    expect(rows.find((r) => r.ruleId === 'rule_8')?.delta).toBe(-2);
  });

  it('连续 3 次听写全对 → 只加一次 +5（AC-26.1 / AC-26.2）', () => {
    const prev = [
      hist('2026-03-12', { '1': e(null, { pass: true }) }),
      hist('2026-03-11', { '1': e(null, { pass: true }) }),
    ];
    const input = {
      entry: e(null, { pass: true }),
      studentNo: 1,
      record: record({ date: '2026-03-13' }),
      prevRecords: prev,
      rules: DEFAULT_RULES,
      ledger: [] as PointLedgerEntry[],
      date: '2026-03-13',
    };
    const first = evaluatePoints(input);
    const streak = first.find((r) => r.ruleId === 'rule_1');
    expect(streak?.delta).toBe(5);

    const again = evaluatePoints({ ...input, ledger: first });
    expect(again.find((r) => r.ruleId === 'rule_1')).toBeUndefined();
  });

  it('只有 2 次连续不触发 streak', () => {
    const rows = evaluatePoints({
      entry: e(null, { pass: true }),
      studentNo: 1,
      record: record({ date: '2026-03-13' }),
      prevRecords: [hist('2026-03-12', { '1': e(null, { pass: true }) })],
      rules: DEFAULT_RULES,
      ledger: [],
      date: '2026-03-13',
    });
    expect(rows.find((r) => r.ruleId === 'rule_1')).toBeUndefined();
  });

  it('优秀档 → 规则3 +3；D → 规则7 −1', () => {
    const excellent = evaluatePoints({
      entry: e(score(96)),
      studentNo: 2,
      record: record({ templateId: 'quality', scheme: scoreScheme }),
      prevRecords: [],
      rules: DEFAULT_RULES,
      ledger: [],
      date: '2026-03-13',
    });
    expect(excellent.find((r) => r.ruleId === 'rule_3')?.delta).toBe(3);

    const bad = evaluatePoints({
      entry: e(score(40)),
      studentNo: 3,
      record: record({ templateId: 'quality', scheme: scoreScheme }),
      prevRecords: [],
      rules: DEFAULT_RULES,
      ledger: [],
      date: '2026-03-13',
    });
    expect(bad.find((r) => r.ruleId === 'rule_7')?.delta).toBe(-1);
  });

  it('停用的规则不触发', () => {
    const rules = DEFAULT_RULES.map((r) => (r.id === 'rule_6' ? { ...r, enabled: false } : r));
    const rows = evaluatePoints({
      entry: e(null, { status: 'missing' }),
      studentNo: 4,
      record: record(),
      prevRecords: [],
      rules,
      ledger: [],
      date: '2026-03-13',
    });
    expect(rows.find((r) => r.ruleId === 'rule_6')).toBeUndefined();
  });

  it('dedupeKey 按频率收敛（perEntry / perWeek / once）', () => {
    const base = DEFAULT_RULES[0];
    const k1 = dedupeKeyOf(base, 'c', 1, 'rec-key', '2026-03-13');
    expect(k1).toBe('c|1|rule_1|rec-key');
    const weekly = dedupeKeyOf({ ...base, freq: 'perWeek' }, 'c', 1, 'rec-key', '2026-03-13');
    expect(weekly).toContain(isoWeek('2026-03-13'));
    expect(dedupeKeyOf({ ...base, freq: 'once' }, 'c', 1, 'rec-key', '2026-03-13')).toBe('c|1|rule_1|once');
  });
});

describe('points：撤销与月度', () => {
  const ledger: PointLedgerEntry[] = [
    { id: 'a', classId: 'c', studentNo: 1, date: '2026-03-13', ruleId: 'rule_1', delta: 5, reason: '连续3次听写全对', source: 'auto', dedupeKey: 'k1', createdAt: 1 },
  ];

  it('撤销写反向行，不删原行（INV-10）', () => {
    const next = revokePoint(ledger, 'a', 2);
    expect(next).toHaveLength(2);
    expect(next[1].delta).toBe(-5);
    expect(next[1].source).toBe('revert');
    expect(next[0].id).toBe('a');
  });

  it('重复撤销同一条不会叠加', () => {
    const once = revokePoint(ledger, 'a', 2);
    const twice = revokePoint(once, 'a', 3);
    expect(twice).toHaveLength(2);
  });

  it('月度合并：样例 D（AC-27.1）', () => {
    const entries = { '1': e(null, { pass: true }), '4': e(null, { status: 'missing' }), '5': e(null, { status: 'missing', makeup: { at: 1, note: '补' } }) };
    const history = [
      hist('2026-03-13', entries),
      hist('2026-03-12', { '1': e(null, { pass: true }) }),
      hist('2026-03-11', { '1': e(null, { pass: true }) }),
    ];
    const ledgerD: PointLedgerEntry[] = [
      { id: 'p1', classId: 'cls_default', studentNo: 1, date: '2026-03-13', ruleId: 'rule_1', delta: 5, reason: '连续3次听写全对', source: 'auto', dedupeKey: 'k1', createdAt: 1 },
      { id: 'p2', classId: 'cls_default', studentNo: 4, date: '2026-03-13', ruleId: 'rule_6', delta: -3, reason: '作业未完成', source: 'auto', dedupeKey: 'k2', createdAt: 1 },
      { id: 'p3', classId: 'cls_default', studentNo: 5, date: '2026-03-13', ruleId: 'rule_8', delta: -2, reason: '补交', source: 'auto', dedupeKey: 'k3', createdAt: 1 },
      { id: 'p4', classId: 'cls_default', studentNo: 5, date: '2026-03-13', ruleId: 'rule_2', delta: 2, reason: '课堂积极回答', source: 'manual', dedupeKey: 'k4', createdAt: 1 },
    ];

    const stats = monthStats({ history, ledger: ledgerD, classId: 'cls_default', month: '2026-03', n: 50 });
    const row = (no: number) => stats.rows.find((r) => r.no === no)!;

    expect(row(1).sessions).toBe(3);
    expect(row(1).qualified).toBe(3);
    expect(row(1).points).toBe(5);
    expect(row(4).missing).toBe(1);
    expect(row(4).points).toBe(-3);
    expect(row(5).madeUp).toBe(1);
    expect(row(5).points).toBe(0);
    expect(stats.total).toBe(2);
  });

  it('名次：积分降序、同分按学号升序', () => {
    const l: PointLedgerEntry[] = [
      { id: 'x', classId: 'c', studentNo: 9, date: '2026-03-01', ruleId: null, delta: 3, reason: 'a', source: 'manual', dedupeKey: 'x', createdAt: 1 },
      { id: 'y', classId: 'c', studentNo: 2, date: '2026-03-01', ruleId: null, delta: 3, reason: 'b', source: 'manual', dedupeKey: 'y', createdAt: 1 },
    ];
    const stats = monthStats({ history: [], ledger: l, classId: 'c', month: '2026-03', n: 10 });
    expect(stats.rows[0].no).toBe(2);
    expect(stats.rows[1].no).toBe(9);
  });

  it('pointsOf 只算指定月份', () => {
    expect(pointsOf(ledger, 'c', 1, '2026-03')).toBe(5);
    expect(pointsOf(ledger, 'c', 1, '2026-04')).toBe(0);
  });
});
