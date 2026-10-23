import { describe, expect, it } from 'vitest';
import { buildReport, fmtList, fmtListWithNotes } from '../../src/domain/report';
import { classifyRoster } from '../../src/domain/roster';
import { makeScheme, sampleAEntries, sampleCEntries, SAMPLE_C_SCHEME, V1_REPORT_A_LINES, e, score, text } from '../fixtures';

const emptyGroups = () => ({
  honor: [], needsFix: [], corrected: [], notSubmitted: [], leave: [], passed: [], madeUp: [],
});

describe('report：样例 A 与 V1 逐字符回归（只允许 3 处 V2 差异）', () => {
  const scheme = makeScheme('score');
  const entries = sampleAEntries();
  const groups = classifyRoster(entries, scheme, 50, { honorIncludesA: false });
  const report = buildReport({
    date: '2026-03-13',
    content: '语文本',
    templateId: 'quality',
    className: '三年二班',
    groups,
    n: 50,
  });

  it('V2 文案（含班级行、质量监测；】后无空格，与 PRD AC-19.1 逐字一致）', () => {
    expect(report.split('\n')[0]).toBe('🌸 3月13日 【📊 质量监测】综合反馈 🌸');
    expect(report.split('\n')[3]).toBe('🏫 班级：三年二班');
  });

  it('去掉 2 处 V2 必需差异后，与 V1 原文逐字相等', () => {
    const normalized = report
      .split('\n')
      .filter((line) => !line.startsWith('🏫 班级：'))
      .map((line) => line.replace('【📊 质量监测】', '【💯 单元测试】'))
      .join('\n');
    expect(normalized).toBe(V1_REPORT_A_LINES.join('\n'));
  });

  it('名单折行仍是 11 / 11 / 8（R-3）', () => {
    const lines = report.split('\n');
    const start = lines.indexOf('❌ 【暂未提交】：');
    expect(lines.slice(start + 1, start + 4)).toHaveLength(3);
    expect(lines[start + 1].split('、')).toHaveLength(11);
    expect(lines[start + 2].split('、')).toHaveLength(11);
    expect(lines[start + 3].split('、')).toHaveLength(8);
  });

  it('【已更正】是需更正下的子段（缩进 + ⤷）', () => {
    const withStamp = buildReport({
      date: '2026-03-13',
      content: '语文本',
      templateId: 'quality',
      className: '三年二班',
      groups: { ...emptyGroups(), needsFix: [17], corrected: [17] },
      n: 50,
    });
    expect(withStamp).toContain('   ⤷ 【✅ 已更正】：17号');
    expect(withStamp.indexOf('⚠️ 【需更正】：')).toBeLessThan(withStamp.indexOf('⤷'));
  });
});

describe('report：段落规则（PRD-V2 §2.3.2 / §6.4）', () => {
  it('【暂未提交】恒输出，空时写（无）', () => {
    const report = buildReport({
      date: '2026-03-13',
      content: '',
      templateId: 'homework',
      className: '三年二班',
      groups: emptyGroups(),
      n: 50,
    });
    expect(report).toContain('❌ 【暂未提交】：\n（无）');
    expect(report).not.toContain('🏆');
    expect(report).not.toContain('🏖️');
  });

  it('班级行恒输出（§16-5 / INV-11）', () => {
    const report = buildReport({
      date: '2026-10-23',
      content: '',
      templateId: 'custom',
      customName: '作文',
      className: '一年一班',
      groups: emptyGroups(),
      n: 10,
    });
    expect(report).toContain('🏫 班级：一年一班');
    expect(report.split('\n')[0]).toBe('🌸 10月23日 【🏷️ 作文】综合反馈 🌸');
  });

  it('已补交段带说明，顺序在暂未提交之后、需更正之前', () => {
    const report = buildReport({
      date: '2026-10-23',
      content: '第3单元',
      templateId: 'quality',
      className: '三年二班',
      groups: { ...emptyGroups(), madeUp: [3], needsFix: [3], notSubmitted: [5] },
      notes: { 3: '10/24 课后补交' },
      n: 50,
    });
    const iSubmit = report.indexOf('❌ 【暂未提交】');
    const iMadeUp = report.indexOf('📥 【已补交】');
    const iFix = report.indexOf('⚠️ 【需更正】');
    expect(iSubmit).toBeLessThan(iMadeUp);
    expect(iMadeUp).toBeLessThan(iFix);
    expect(report).toContain('3号（10/24 课后补交）');
  });

  it('请假段独立输出', () => {
    const report = buildReport({
      date: '2026-10-23',
      content: '',
      templateId: 'dictation',
      className: '三年二班',
      groups: { ...emptyGroups(), leave: [4, 9] },
      n: 50,
    });
    expect(report).toContain('🏖️ 【请假】：4号、9号');
  });

  it('已过关段仅非空时出现', () => {
    const report = buildReport({
      date: '2026-10-23',
      content: '',
      templateId: 'dictation',
      className: '三年二班',
      groups: { ...emptyGroups(), passed: [1, 2, 3] },
      n: 50,
    });
    expect(report).toContain('✅ 【已过关】：1号、2号、3号');
  });
});

describe('report：折行工具', () => {
  it('70 半角单位折行，行尾不带顿号', () => {
    const nos = Array.from({ length: 30 }, (_, i) => i + 1);
    const lines = fmtList(nos).split('\n');
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line.endsWith('、')).toBe(false);
  });

  it('补交名单说明为空时只写学号', () => {
    expect(fmtListWithNotes([3, 4], { 3: '' })).toBe('3号、4号');
    expect(fmtListWithNotes([3], { 3: '课后补交' })).toBe('3号（课后补交）');
  });
});

describe('report：样例 C 的名单', () => {
  it('需更正：分数制只抓不及格，等级制非荣即需（A-/B+ 也进）', () => {
    const groups = classifyRoster(sampleCEntries(), SAMPLE_C_SCHEME, 50, { honorIncludesA: false });
    expect(groups.needsFix.sort((a, b) => a - b)).toEqual([5, 9, 10, 16, 17, 20]);
    expect(groups.madeUp).toEqual([18]);
    expect(groups.leave).toEqual([12]);
    expect(groups.notSubmitted).toContain(11);
    expect(groups.honor.sort((a, b) => a - b)).toEqual([1, 2, 6, 7, 8, 19]);
  });

  it('文字值在过关制下进需更正，在分数制下中立（PRD §2.3.1）', () => {
    const check = classifyRoster({ '1': e(text('半对')) }, makeScheme('check'), 2, { honorIncludesA: false });
    expect(check.needsFix).toEqual([1]);
    const scoreScheme = classifyRoster({ '1': e(text('半对')) }, makeScheme('score'), 2, { honorIncludesA: false });
    expect(scoreScheme.needsFix).toHaveLength(0);
    expect(scoreScheme.honor).toHaveLength(0);
  });

  it('分数 90 进光荣榜，89 中立', () => {
    const s = makeScheme('score');
    expect(classifyRoster({ '1': e(score(90)) }, s, 2, { honorIncludesA: false }).honor).toEqual([1]);
    const neutral = classifyRoster({ '1': e(score(89)) }, s, 2, { honorIncludesA: false });
    expect(neutral.honor).toHaveLength(0);
    expect(neutral.needsFix).toHaveLength(0);
  });
});
