import { describe, expect, it } from 'vitest';
import { parseRosterText } from '../../src/domain/roster-import';

describe('parseRosterText（设计 §6.9）', () => {
  it('编号 + 空格 / 逗号 / 顿号', () => {
    const r = parseRosterText('1 张三\n2,李四\n3、王五');
    expect(r.students).toEqual([
      { no: 1, name: '张三' },
      { no: 2, name: '李四' },
      { no: 3, name: '王五' },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('纯姓名按行序编号', () => {
    const r = parseRosterText('张三\n李四\n王五');
    expect(r.students.map((s) => s.no)).toEqual([1, 2, 3]);
    expect(r.students[1].name).toBe('李四');
  });

  it('跳过表头', () => {
    const r = parseRosterText('学号,姓名\n1,张三\n2,李四');
    expect(r.students).toHaveLength(2);
    expect(r.students[0]).toEqual({ no: 1, name: '张三' });
  });

  it('编号重复/跳跃时重新连续编号并给出 warning', () => {
    const r = parseRosterText('1 张三\n1 李四\n7 王五');
    expect(r.students.map((s) => s.no)).toEqual([1, 2, 3]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('空行忽略、空文本返回 warning', () => {
    expect(parseRosterText('  \n\n ').students).toEqual([]);
    expect(parseRosterText('').warnings.length).toBe(1);
  });

  it('姓名截断到 20 字', () => {
    const long = '张'.repeat(30);
    const r = parseRosterText(`1 ${long}`);
    expect(r.students[0].name).toHaveLength(20);
  });
});
