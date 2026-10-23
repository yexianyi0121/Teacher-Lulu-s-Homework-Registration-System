import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/domain/report';
import { classifyRoster } from '../../src/domain/roster';
import { EXPECTED_REPORT_A, makeSettings, sampleAEntries, sampleBEntries } from '../fixtures';

const argsA = () => ({
  date: '2026-03-13',
  content: '语文本',
  mode: 'quiz' as const,
  groups: classifyRoster('quiz', sampleAEntries(), makeSettings({ count: 50 })),
  n: 50,
});

describe('buildReport（AC-08.1 逐字）', () => {
  it('样例 A 文案完全相等', () => {
    expect(buildReport(argsA())).toBe(EXPECTED_REPORT_A);
  });

  it('分隔线恰好 25 个连字符', () => {
    const line = buildReport(argsA()).split('\n')[2];
    expect(line).toHaveLength(25);
    expect(line).toBe('-'.repeat(25));
  });

  it('日期不补零', () => {
    const text = buildReport({ ...argsA(), date: '2026-01-05' });
    expect(text.startsWith('🌸 1月5日 ')).toBe(true);
  });

  it('空分组整段省略', () => {
    const groups = { honor: [1, 2], notSubmitted: [], needsFix: [], fixed: [] };
    const text = buildReport({ date: '2026-03-13', content: '语文本', mode: 'homework', groups, n: 50 });
    expect(text).toContain('🏆 【光荣榜】');
    expect(text).not.toContain('【暂未提交】');
    expect(text).not.toContain('【需更正】');
    expect(text).not.toContain('（请核对后及时找老师更正）');
  });

  it('全空输出三段退化为「暂无可统计的数据」', () => {
    const text = buildReport({
      date: '2026-03-13',
      content: '语文本',
      mode: 'quiz',
      groups: { honor: [], notSubmitted: [], needsFix: [], fixed: [] },
      n: 50,
    });
    expect(text).toBe('🌸 3月13日 综合反馈 🌸\n📖 作业内容：语文本\n（暂无可统计的数据）');
  });

  it('作业内容为空显示「未填写」', () => {
    const text = buildReport({ ...argsA(), content: '' });
    expect(text.split('\n')[1]).toBe('📖 作业内容：未填写');
  });

  it('存在 fixed 时输出第四段，且插在需更正之后、提示语之前', () => {
    const groups = { honor: [1], notSubmitted: [2], needsFix: [3], fixed: [4, 5] };
    const text = buildReport({ date: '2026-03-13', content: '语文本', mode: 'homework', groups, n: 50 });
    const lines = text.split('\n');
    const iNeeds = lines.indexOf('⚠️ 【需更正】：');
    const iFixed = lines.indexOf('✅ 【已更正】：');
    const iTip = lines.indexOf('（请核对后及时找老师更正）');
    expect(iNeeds).toBeGreaterThan(-1);
    expect(iFixed).toBe(iNeeds + 3);
    expect(lines[iNeeds + 2]).toBe('');
    expect(lines[iFixed + 1]).toBe('4号、5号');
    expect(iTip).toBe(iFixed + 2);
  });

  it('无 fixed 时不输出第四段（样例 B）', () => {
    const groups = classifyRoster('homework', sampleBEntries(), makeSettings({ count: 50 }));
    const text = buildReport({ date: '2026-03-13', content: '生字抄写', mode: 'homework', groups, n: 50 });
    expect(text).not.toContain('✅ 【已更正】：');
    expect(text).toContain('🌸 3月13日 【📝 常规作业】综合反馈 🌸');
  });

  it('常规作业标题使用全角书名号位置与 emoji', () => {
    const groups = { honor: [1], notSubmitted: [], needsFix: [], fixed: [] };
    expect(buildReport({ date: '2026-12-31', content: '周记', mode: 'dictation', groups, n: 50 })).toContain(
      '🌸 12月31日 【✍️ 听写默写】综合反馈 🌸',
    );
  });
});
