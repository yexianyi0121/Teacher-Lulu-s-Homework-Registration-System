import { describe, expect, it } from 'vitest';
import { studentsFromRows } from '../../src/domain/roster-xlsx';

/**
 * FR-55 xlsx 名单解析：从二维行数据里认出学生。
 *
 * 真实文件（7.19名单.xlsx）结构：
 *   第 0 行：`7年级19班作业情况登记表`（大标题，跨列）
 *   第 1 行：`学号 | 姓名 | ...`（表头）
 *   第 2 行起：`01 | 王梓淇 | ...`
 *
 * 本文件覆盖老师各种「不标准」的表格，确保要么正确读到，要么明确报错不误导。
 */

describe('表头识别', () => {
  it('跳过跨列大标题，认准第 2 行的「学号/姓名」表头', () => {
    const rows = [
      ['7年级19班作业情况登记表', '', ''],
      ['学号', '姓名', '备注'],
      ['01', '王梓淇', ''],
      ['02', '林子玥', ''],
    ];
    const r = studentsFromRows(rows);
    expect(r.headerRow).toBe(1);
    expect(r.students.map((s) => s.name)).toEqual(['王梓淇', '林子玥']);
  });

  it('表头在第 1 行（无大标题）', () => {
    const rows = [
      ['学号', '姓名'],
      [1, '张三'],
    ];
    expect(studentsFromRows(rows).students.map((s) => s.name)).toEqual(['张三']);
  });

  it('姓名在前、学号在后也能认', () => {
    const rows = [
      ['姓名', '学号'],
      ['李四', 7],
    ];
    const r = studentsFromRows(rows);
    expect(r.students).toHaveLength(1);
    expect(r.students[0].name).toBe('李四');
  });

  it('只有「姓名」一列', () => {
    const rows = [['姓名'], ['王五'], ['赵六']];
    expect(studentsFromRows(rows).students.map((s) => s.name)).toEqual(['王五', '赵六']);
  });

  it('完全没有表头：A 列数字 + B 列汉字 → 猜出学号/姓名', () => {
    const rows = [
      [1, '张三'],
      [2, '李四'],
      [3, '王五'],
    ];
    expect(studentsFromRows(rows).students.map((s) => s.name)).toEqual(['张三', '李四', '王五']);
  });

  it('完全没有表头、只有姓名一列', () => {
    const rows = [['张三'], ['李四'], ['王五']];
    expect(studentsFromRows(rows).students.map((s) => s.name)).toEqual(['张三', '李四', '王五']);
  });
});

describe('噪声行过滤', () => {
  it('合计/小计/备注 等汇总行不算学生', () => {
    const rows = [
      ['学号', '姓名'],
      ['1', '张三'],
      ['2', '李四'],
      ['', '合计'],
      ['', '小计 2 人'],
      ['备注：名单来源教务处'],
    ];
    const r = studentsFromRows(rows);
    expect(r.students.map((s) => s.name)).toEqual(['张三', '李四']);
  });

  it('空行、纯空白单元格跳过', () => {
    const rows = [
      ['学号', '姓名'],
      ['', ''],
      ['1', '张三'],
      ['   ', '  '],
      ['2', '李四'],
    ];
    expect(studentsFromRows(rows).students).toHaveLength(2);
  });

  it('不含汉字的英文/数字行不算姓名', () => {
    const rows = [
      ['学号', '姓名'],
      ['1', '张三'],
      ['2', 'ABC123'],
      ['3', '李四'],
    ];
    expect(studentsFromRows(rows).students.map((s) => s.name)).toEqual(['张三', '李四']);
  });
});

describe('学号重编与截断', () => {
  it('学号重复时重新连续编号并给提示', () => {
    const rows = [
      ['学号', '姓名'],
      [1, '张三'],
      [1, '李四'],
      [2, '王五'],
    ];
    const r = studentsFromRows(rows);
    expect(r.students.map((s) => s.no)).toEqual([1, 2, 3]);
    expect(r.warnings.some((w) => w.includes('重复'))).toBe(true);
  });

  it('学号只写「01」这种也认', () => {
    const rows = [
      ['学号', '姓名'],
      ['01', '张三'],
      ['02', '李四'],
    ];
    expect(studentsFromRows(rows).students.map((s) => s.no)).toEqual([1, 2]);
  });

  it('超过 120 人截断并提示', () => {
    const rows: unknown[][] = [['学号', '姓名']];
    for (let i = 1; i <= 150; i += 1) rows.push([i, `学生${i}`]);
    const r = studentsFromRows(rows);
    expect(r.students).toHaveLength(120);
    expect(r.warnings.some((w) => w.includes('120'))).toBe(true);
  });
});

describe('异常输入不炸', () => {
  it('空表 → 0 人 + 提示，不抛异常', () => {
    const r = studentsFromRows([]);
    expect(r.students).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('只有一行标题没有任何学生 → 0 人', () => {
    const r = studentsFromRows([['7年级19班作业情况登记表']]);
    expect(r.students).toHaveLength(0);
  });

  it('超长姓名截断到 20 字', () => {
    const rows = [['姓名'], ['张'.repeat(50)]];
    const r = studentsFromRows(rows);
    expect(r.students[0].name!.length).toBeLessThanOrEqual(20);
  });
});

describe('真实文件结构回归（7.19名单.xlsx）', () => {
  it('55 人、表头在第 2 行、首尾姓名正确', () => {
    // 按真实文件的行结构构造（50 人班 + 表头 + 大标题）
    const names = Array.from({ length: 55 }, (_, i) => `学生${i + 1}`);
    const rows: unknown[][] = [['7年级19班作业情况登记表', '', '']];
    rows.push(['学号', '姓名', '备注']);
    names.forEach((n, i) => rows.push([String(i + 1).padStart(2, '0'), n, '']));

    const r = studentsFromRows(rows);
    expect(r.headerRow).toBe(1);
    expect(r.students).toHaveLength(55);
    expect(r.students[0]).toEqual({ no: 1, name: '学生1' });
    expect(r.students[54]).toEqual({ no: 55, name: '学生55' });
    expect(r.warnings).toEqual([]);
  });
});
