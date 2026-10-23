import { describe, expect, it } from 'vitest';
import { computeStats } from '../../src/domain/stats';
import { classifyRoster } from '../../src/domain/roster';
import { buildReport } from '../../src/domain/report';
import { buildSummaryModel, sectionStatLine, summaryOverflowNote, SUMMARY_LIMIT } from '../../src/domain/poster';
import { snapshotDay, type DaySheetSnapshot } from '../../src/domain/summary';
import type { Entries, PersistedStateV2, RecordDoc, ScoringScheme, SheetTemplateId } from '../../src/domain/types';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import {
  makeScheme, sampleAEntries, sampleBEntries, sampleCEntries, SAMPLE_C_SCHEME, studentsOf, e, score, text,
} from '../fixtures';

/** 黄金样例（PRD-V2 §8）：任何一位偏差都说明 classify / computeStats 写错 */

describe('样例 C：混合登记 + 满分 120 + 请假 + 补交', () => {
  const m = computeStats(sampleCEntries(), SAMPLE_C_SCHEME, 50, false);

  it('9 个数逐位相等（含四档合计校验）', () => {
    expect(m.entered).toBe(18);
    expect(m.excellent).toBe(7);
    expect(m.good).toBe(5);
    expect(m.pass).toBe(2);
    expect(m.fail).toBe(4);
    expect(m.excellent + m.good + m.pass + m.fail).toBe(18);
    expect(m.missing).toBe(1);
    expect(m.madeUp).toBe(1);
    expect(m.leave).toBe(1);
    expect(m.notSubmitted).toBe(31);
    expect(m.avgPercent).toBe(80.0);
    expect(m.avgScore).toBe(96.1);
    expect(m.excellentRate).toBe(0.389);
    expect(m.qualifiedRate).toBe(0.778);
  });

  it('名单：光荣榜 7、需更正 4（只抓不及格）、已补交 1、请假 1', () => {
    const g = classifyRoster(sampleCEntries(), SAMPLE_C_SCHEME, 50, { honorIncludesA: false });
    // 光荣榜按字母秩（A+/A）；A- (16) 与 B+ (9) 进需更正
    expect(g.honor.sort((a, b) => a - b)).toEqual([1, 2, 6, 7, 8, 19]);
    // 等级制「非荣即需」：A-(16) 与 B+(9) 也进需更正；分数制只抓不及格（5/10/17/20）
    expect(g.needsFix.sort((a, b) => a - b)).toEqual([5, 9, 10, 16, 17, 20]);
    expect(g.corrected).toHaveLength(0);
    expect(g.madeUp).toEqual([18]);
    expect(g.leave).toEqual([12]);
  });

  it('B+（85%）在满分 120 下是良好档，但名单里进需更正（等级制非荣即需）', () => {
    const g = classifyRoster(sampleCEntries(), SAMPLE_C_SCHEME, 50, { honorIncludesA: false });
    expect(g.honor).not.toContain(9);
    expect(g.needsFix).toContain(9);
  });

  it('D（55%）判不及格，进需更正', () => {
    const g = classifyRoster(sampleCEntries(), SAMPLE_C_SCHEME, 50, { honorIncludesA: false });
    expect(g.needsFix).toContain(20);
  });
});

describe('样例 A / B：V1 行为回归（R-1 / R-2 / R-3）', () => {
  it('R-1 样例 A 统计不变：20 / 87.7 / 13-3-3-1', () => {
    const m = computeStats(sampleAEntries(), makeScheme('score'), 50, false);
    expect([m.entered, m.avgPercent, m.excellent, m.good, m.pass, m.fail]).toEqual([20, 87.7, 13, 3, 3, 1]);
  });

  it('R-2 样例 B 名单：光荣榜 25（A+21+A4，按 PRD-V2 新口径）/ 需更正 24 / [17]', () => {
    const g = classifyRoster(sampleBEntries(), makeScheme('grade'), 50, { honorIncludesA: false });
    expect(g.honor).toHaveLength(25);
    expect(g.needsFix).toHaveLength(24);
    expect(g.notSubmitted).toEqual([17]);
  });

  it('R-3 报表折行 11 / 11 / 8 不变', () => {
    const g = classifyRoster(sampleAEntries(), makeScheme('score'), 50, { honorIncludesA: false });
    const report = buildReport({
      date: '2026-03-13',
      content: '语文本',
      templateId: 'quality',
      className: '三年二班',
      groups: g,
      n: 50,
    });
    const lines = report.split('\n');
    const start = lines.indexOf('❌ 【暂未提交】：');
    expect(lines[start + 1].split('、')).toHaveLength(11);
    expect(lines[start + 2].split('、')).toHaveLength(11);
    expect(lines[start + 3].split('、')).toHaveLength(8);
  });

  it('R-6 改班级名后报表同步', () => {
    const g = classifyRoster(sampleAEntries(), makeScheme('score'), 50, { honorIncludesA: false });
    const build = (className: string) => buildReport({
      date: '2026-03-13', content: '语文本', templateId: 'quality', className, groups: g, n: 50,
    });
    expect(build('三年二班')).toContain('🏫 班级：三年二班');
    expect(build('一年一班')).toContain('🏫 班级：一年一班');
  });
});

describe('样例 E：当日汇总海报', () => {
  const snap = (over: Partial<DaySheetSnapshot>): DaySheetSnapshot => ({
    key: 'k', sheetId: 's', templateId: 'quality', sheetName: '质量监测', icon: '📊',
    content: '', scheme: makeScheme('score'),
    entries: {}, metrics: {
      n: 50, entered: 0, excellent: 0, good: 0, pass: 0, fail: 0,
      missing: 0, leave: 0, madeUp: 0, notSubmitted: 50,
      avgPercent: null, avgScore: null, excellentRate: null, qualifiedRate: null,
      passCount: 0, max: null, min: null,
    },
    createdAt: 0, ...over,
  });

  // 听写 45 人过关 + 5 人「错2」：metrics 必须由 computeStats 真实生成，
  // 不能手写（评审 F1 指出，手写 metrics 让「未过关恒为 0」的缺陷逃过了单测）
  const dictationScheme = makeScheme('check');
  const dictationEntries: Entries = {};
  for (let no = 1; no <= 45; no++) dictationEntries[String(no)] = e(null, { pass: true });
  for (let no = 46; no <= 50; no++) dictationEntries[String(no)] = e(text('错2'));

  const dictation = snap({
    templateId: 'dictation', sheetName: '听写默写', icon: '📖', content: '第3单元字词', createdAt: 1,
    scheme: dictationScheme,
    entries: dictationEntries,
    metrics: computeStats(dictationEntries, dictationScheme, 50, false),
  });

  const homework = snap({
    templateId: 'homework', sheetName: '常规作业', icon: '📝', content: '生字抄写', createdAt: 2,
    scheme: makeScheme('grade'),
    entries: {
      '1': e({ kind: 'grade', grade: 'A+' }),
      '2': e({ kind: 'grade', grade: 'A' }),
      '3': e({ kind: 'grade', grade: 'A-' }),
    },
    metrics: {
      n: 50, entered: 49, excellent: 12, good: 8, pass: 0, fail: 24,
      missing: 1, leave: 0, madeUp: 0, notSubmitted: 1,
      avgPercent: 90, avgScore: null, excellentRate: 0.245, qualifiedRate: 0.408,
      passCount: 0, max: null, min: null,
    },
  });

  const quality = snap({
    content: '第3单元', createdAt: 3,
    metrics: {
      n: 50, entered: 19, excellent: 7, good: 0, pass: 0, fail: 0,
      missing: 0, leave: 0, madeUp: 0, notSubmitted: 31,
      avgPercent: 80, avgScore: 96.1, excellentRate: 0.368, qualifiedRate: 0.8,
      passCount: 0, max: null, min: null,
    },
  });

  it('标题/副标题带班级与日期', () => {
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘露', school: '某某中学',
      sheets: [dictation, homework, quality], n: 50,
    });
    expect(model.title).toBe('🌸 三年二班 · 10月23日 登记汇总 🌸');
    expect(model.subtitle).toContain('2026年10月23日');
    expect(model.footer).toBe('© Designed by 刘露 | 某某中学');
  });

  it('sections 按录入时间升序，统计行不串类型', () => {
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘露', school: '某某中学',
      sheets: [dictation, homework, quality], n: 50,
    });
    expect(model.sections.map((s) => s.icon)).toEqual(['📖', '📝', '📊']);
    expect(sectionStatLine(dictation, 50)).toBe('过关 45 · 未过关 5');
    expect(sectionStatLine(homework, 50)).toContain('A+ 1');
    expect(sectionStatLine(homework, 50)).toContain('未交 1');
    expect(sectionStatLine(quality, 50)).toBe('平均 96.1 · 优秀 7 · 未交 31');
  });

  it('超过 6 条取**最近** 6 条，并在标题下给出提示（PRD FR-24-2）', () => {
    const sheets = Array.from({ length: 9 }, (_, i) => snap({ key: `k${i}`, createdAt: i }));
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘', school: '某',
      sheets, n: 50,
    });
    expect(model.sections).toHaveLength(SUMMARY_LIMIT);
    // 保留尾部（最近）而不是头部（最早），且展示仍保持升序
    expect(model.sections.map((s) => s.key)).toEqual(['k3', 'k4', 'k5', 'k6', 'k7', 'k8']);
    expect(model.sections.map((s) => s.createdAt)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(model.total).toBe(9);
    expect(model.overflowNote).toBe('（今日共 9 项，仅展示最近 6 项）');
    expect(model.empty).toBe(false);
  });

  it('未超过 6 条时 total 正确且无提示', () => {
    const sheets = Array.from({ length: 3 }, (_, i) => snap({ key: `k${i}`, createdAt: i }));
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘', school: '某',
      sheets, n: 50,
    });
    expect(model.total).toBe(3);
    expect(model.overflowNote).toBe('');
    expect(summaryOverflowNote(6)).toBe('');
  });

  it('当日无登记 → empty=true（AC-24.3）', () => {
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘', school: '某', sheets: [], n: 50,
    });
    expect(model.empty).toBe(true);
    expect(model.sections).toHaveLength(0);
  });

  it('mini 网格保留原学号与状态', () => {
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘', school: '某', sheets: [quality], n: 50,
    });
    expect(model.sections[0].cells).toHaveLength(50);
    expect(model.sections[0].cells[0].no).toBe(1);
  });

  it('请假格显示「假」、缺交显示「×」（AC-24.2）', () => {
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘', school: '某',
      sheets: [snap({
        entries: {
          '1': e(null, { status: 'leave' }),
          '2': e(null, { status: 'missing' }),
        },
      })],
      n: 3,
    });
    expect(model.sections[0].cells[0].text).toBe('假');
    expect(model.sections[0].cells[1].text).toBe('×');
  });

  it('分数格显示原值（120 分制不折算）', () => {
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘', school: '某',
      sheets: [snap({ scheme: SAMPLE_C_SCHEME, entries: { '1': e(score(118)) } })],
      n: 2,
    });
    expect(model.sections[0].cells[0].text).toBe('118');
  });
});

describe('F1 回归：当日汇总必须走真实链路（snapshotDay → computeStats → sectionStatLine）', () => {
  /** 造一份最小存档：同一班、同一天、若干条登记 */
  function makeState(
    sheets: Array<{
      key: string;
      templateId: SheetTemplateId;
      scheme: ScoringScheme;
      entries: Entries;
      content?: string;
      createdAt: number;
    }>,
    n = 50,
  ): PersistedStateV2 {
    const records: RecordDoc[] = sheets.map((s) => ({
      key: s.key,
      classId: 'cls_test',
      date: '2026-10-23',
      content: s.content ?? '',
      sheetId: `sheet_${s.key}`,
      templateId: s.templateId,
      scheme: s.scheme,
      entries: s.entries,
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
    }));
    return {
      version: 2,
      activeClassId: 'cls_test',
      classes: [{
        id: 'cls_test', name: '三年二班', school: '某某中学', teacher: '刘露', subject: '语文',
        students: studentsOf(n), count: n, createdAt: 1,
      }],
      records,
      history: [],
      pointRules: [],
      pointLedger: [],
      settings: { ...DEFAULT_SETTINGS },
      lastSavedAt: 1,
    };
  }

  it('听写 44 过 + 5 错 + 1 请假：过关 44 · 未过关 5，且未提交 = 0', () => {
    const scheme = makeScheme('check');
    const entries: Entries = {};
    for (let no = 1; no <= 44; no++) entries[String(no)] = e(null, { pass: true });
    for (let no = 45; no <= 49; no++) entries[String(no)] = e(text('错2'));
    entries['50'] = e(null, { status: 'leave' });

    const state = makeState([{ key: 'k1', templateId: 'dictation', scheme, entries, createdAt: 1 }]);
    const [snap0] = snapshotDay(state, 'cls_test', '2026-10-23');

    expect(snap0.metrics.passCount).toBe(44);
    expect(snap0.metrics.entered).toBe(49);
    expect(snap0.metrics.leave).toBe(1);
    expect(snap0.metrics.notSubmitted).toBe(0);          // v2.0.0 此处置为 50
    expect(sectionStatLine(snap0, 50)).toBe('过关 44 · 未过关 5');   // v2.0.0 此处未过关为 0
  });

  it('质量监测 20 人有值：统计条「有值 20 / 未提交 30」', () => {
    const scheme = makeScheme('score');
    const entries = sampleAEntries();   // 20 人
    const state = makeState([{ key: 'k2', templateId: 'quality', scheme, entries, createdAt: 1 }]);

    const [snap0] = snapshotDay(state, 'cls_test', '2026-10-23');
    expect(snap0.metrics.entered).toBe(20);
    expect(snap0.metrics.notSubmitted).toBe(30);
    expect(sectionStatLine(snap0, 50)).toBe('平均 87.7 · 优秀 13 · 未交 30');
  });

  it('同一天多张表：sections 按录入时间升序且统计不串类型', () => {
    const check = makeScheme('check');
    const scoreScheme = makeScheme('score');
    const dictationEntries: Entries = {};
    for (let no = 1; no <= 45; no++) dictationEntries[String(no)] = e(null, { pass: true });
    for (let no = 46; no <= 50; no++) dictationEntries[String(no)] = e(text('错3'));

    const state = makeState([
      { key: 'k1', templateId: 'dictation', scheme: check, entries: dictationEntries, createdAt: 1 },
      { key: 'k2', templateId: 'quality', scheme: scoreScheme, entries: sampleAEntries(), createdAt: 2 },
    ]);
    const snaps = snapshotDay(state, 'cls_test', '2026-10-23');
    const model = buildSummaryModel({
      className: '三年二班', date: '2026-10-23', teacher: '刘露', school: '某某中学',
      sheets: snaps, n: 50,
    });

    expect(model.sections.map((s) => s.icon)).toEqual(['📖', '📊']);
    expect(model.sections[0].statLine).toBe('过关 45 · 未过关 5');
    expect(model.sections[1].statLine).toBe('平均 87.7 · 优秀 13 · 未交 30');
  });
});
