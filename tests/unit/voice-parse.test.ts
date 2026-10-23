import { describe, expect, it } from 'vitest';
import { parseVoice, parseVoiceReport } from '../../src/domain/voice/parse';
import { makeScheme } from '../fixtures';

const gradeScheme = makeScheme('grade');
const scoreScheme = makeScheme('score', { maxScore: 120 });
const checkScheme = makeScheme('check');

describe('voice/parse：槽位解析（AC-30.x）', () => {
  it('「十二号 优秀」→ 12 号（AC-30.1）', () => {
    const [cmd] = parseVoice('十二号 优秀', { n: 50, scheme: gradeScheme });
    expect(cmd.no).toBe(12);
    expect(cmd.value).toEqual({ kind: 'grade', grade: 'A+' });
  });

  it('「五号 以更正」→ 5 号盖已更正章（AC-30.2）', () => {
    const [cmd] = parseVoice('五号 以更正', { n: 50, scheme: gradeScheme });
    expect(cmd.no).toBe(5);
    expect(cmd.stamp).toBe('corrected');
  });

  it('「二十三号 过官」→ 23 号过关（AC-30.3）', () => {
    const [cmd] = parseVoice('二十三号 过官', { n: 50, scheme: checkScheme });
    expect(cmd.no).toBe(23);
    expect(cmd.pass).toBe(true);
  });

  it('「99号 优秀」超出 50 人 → 不写入并给出 range 提示（AC-30.4）', () => {
    const { commands, issues } = parseVoiceReport('99号 优秀', { n: 50, scheme: gradeScheme });
    expect(commands).toHaveLength(0);
    expect(issues[0].reason).toBe('range');
    expect(issues[0].text).toContain('1–50');
  });

  it('越界 1 位时按最近邻纠正（51 → 50）', () => {
    const [cmd] = parseVoice('51号 优秀', { n: 50, scheme: gradeScheme });
    expect(cmd.no).toBe(50);
    expect(cmd.conf).toBe('fuzzy');
  });

  it('一句话多指令：1号全对，2号错1', () => {
    const cmds = parseVoice('1号全对，2号错1', { n: 50, scheme: checkScheme });
    expect(cmds).toHaveLength(2);
    expect(cmds[0].no).toBe(1);
    expect(cmds[0].pass).toBe(true);
    expect(cmds[1].value).toEqual({ kind: 'text', text: '错1' });
  });

  it('分数：12号98分（满分 120）', () => {
    const [cmd] = parseVoice('12号 98分', { n: 50, scheme: scoreScheme });
    expect(cmd.value).toEqual({ kind: 'score', score: 98 });
  });

  it('方案校验：等级制收到分数 → 拒绝（L-4 闭集优先）', () => {
    const { commands, issues } = parseVoiceReport('12号 98分', { n: 50, scheme: gradeScheme });
    expect(commands).toHaveLength(0);
    expect(issues[0].reason).toBe('scheme');
  });

  it('方案校验：分数超出满分 → 拒绝', () => {
    const { commands } = parseVoiceReport('12号 130分', { n: 50, scheme: scoreScheme });
    expect(commands).toHaveLength(0);
  });

  it('歧义表：不交 → 缺交（status=missing）', () => {
    const [cmd] = parseVoice('7号不交', { n: 50, scheme: gradeScheme });
    expect(cmd.status).toBe('missing');
  });

  it('补交 → makeup 标记', () => {
    const [cmd] = parseVoice('9号 补交', { n: 50, scheme: gradeScheme });
    expect(cmd.makeup).toBe(true);
  });

  it('同号重复：后者覆盖前者并标记 overwritten', () => {
    const cmds = parseVoice('3号优秀 3号错2', { n: 50, scheme: checkScheme });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].no).toBe(3);
    expect(cmds[0].value).toEqual({ kind: 'text', text: '错2' });
  });

  it('拼音近似：全兑（全对）能命中', () => {
    const [cmd] = parseVoice('4号全怼', { n: 50, scheme: checkScheme });
    expect(cmd).toBeUndefined(); // 相似度不足 0.6 → 宁可不猜（L-4）
    const [cmd2] = parseVoice('4号全队', { n: 50, scheme: checkScheme });
    expect(cmd2.pass).toBe(true);
  });

  it('没有学号且没有焦点 → 给出提示，不猜', () => {
    const { commands, issues } = parseVoiceReport('优秀', { n: 50, scheme: gradeScheme });
    expect(commands).toHaveLength(0);
    expect(issues[0].text).toContain('学号');
  });

  it('没有学号但有焦点 → 落到当前格', () => {
    const [cmd] = parseVoice('优秀', { n: 50, scheme: gradeScheme, focusNo: 8 });
    expect(cmd.no).toBe(8);
  });

  it('结果按学号升序', () => {
    const cmds = parseVoice('5号优秀 2号A减', { n: 50, scheme: gradeScheme });
    expect(cmds.map((c) => c.no)).toEqual([2, 5]);
  });

  it('「清空」清除值/状态/过关', () => {
    const [cmd] = parseVoice('6号 清空', { n: 50, scheme: gradeScheme });
    expect(cmd.value).toBeNull();
    expect(cmd.status).toBe('normal');
    expect(cmd.pass).toBe(false);
  });

  it('听写「错5」是文本值，不是分数', () => {
    const [cmd] = parseVoice('10号 错5', { n: 50, scheme: checkScheme });
    expect(cmd.value).toEqual({ kind: 'text', text: '错5' });
  });
});
