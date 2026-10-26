import { describe, expect, it } from 'vitest';
import { studentsFromRows } from '../../src/domain/roster-xlsx';

describe('FR-57 名单导入安全（R-01~R-16 回归）', () => {
  it('R-03：标题行含「学生姓名」时不能当表头', () => {
    const rows: unknown[][] = [
      ['2026级19班 学生姓名 登记表'],
      ['学号', '姓名'],
      ['1', '张三'],
      ['2', '李四'],
      ['3', '王五'],
    ];
    const got = studentsFromRows(rows);
    expect(got.students.map((s) => s.name)).toEqual(['张三', '李四', '王五']);
    expect(got.headerRow).toBe(1);
  });

  it('R-03：标题行含「名单」也不能当表头', () => {
    const rows: unknown[][] = [
      ['七年级19班学生名单'],
      ['序号', '姓名'],
      ['1', '张三'],
      ['2', '李四'],
    ];
    expect(studentsFromRows(rows).students).toHaveLength(2);
  });

  it('正常表头仍然被识别', () => {
    const got = studentsFromRows([
      ['序号', '学生姓名'],
      ['1', '张三'],
      ['2', '李四'],
    ]);
    expect(got.students).toHaveLength(2);
    expect(got.headerRow).toBe(0);
  });

  it('没有表头时首行不会被吃', () => {
    const got = studentsFromRows([['1', '张三'], ['2', '李四'], ['3', '王五']]);
    expect(got.students.map((s) => s.name)).toEqual(['张三', '李四', '王五']);
  });
});
