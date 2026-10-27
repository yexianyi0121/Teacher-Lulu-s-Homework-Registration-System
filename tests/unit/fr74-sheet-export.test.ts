import { describe, expect, it } from 'vitest';
import { buildSheetTableCsv } from '../../src/domain/exporter';
import type { RecordDoc, ScoringScheme } from '../../src/domain/types';

const scheme: ScoringScheme = {
  kind: 'grade', maxScore: null,
  grades: ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D'],
  allowCheck: true, allowText: true, decimals: 0,
  excellentRate: 0.9, goodRate: 0.8, passRate: 0.6,
  gradePass: ['A+', 'A'],
};

function rec(over: Partial<RecordDoc> = {}): RecordDoc {
  return {
    key: 'cls_1|2026-10-27|默写|sheet_default_homework',
    classId: 'cls_1',
    date: '2026-10-27',
    content: '默写',
    sheetId: 'sheet_default_homework',
    templateId: 'homework',
    scheme,
    entries: {
      '1': { value: { kind: 'grade', grade: 'A' }, stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 0 },
      '2': { value: { kind: 'grade', grade: 'C' }, stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 0 },
      '3': { value: null, stamp: 'none', status: 'missing', pass: false, makeup: null, updatedAt: 0 },
    },
    createdAt: 1,
    updatedAt: 1,
    ...over,
  } as RecordDoc;
}

const names = { 1: '张三', 2: '李四', 3: '王五' };

describe('buildSheetTableCsv：按登记表导出表格（v2.6.4 需求1）', () => {
  it('表头信息齐全：班级 / 日期 / 登记表 / 作业内容 / 评价语', () => {
    const csv = buildSheetTableCsv({
      className: '2025级19班',
      records: [rec({ comment: '整体不错' })],
      n: 3,
      names,
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"班级","2025级19班"');
    expect(csv).toContain('"日期","2026-10-27"');
    expect(csv).toContain('"登记表","常规作业"');
    expect(csv).toContain('"作业内容","默写"');
    expect(csv).toContain('"评价语","整体不错"');
    expect(csv).toContain('"序号","学号","姓名","登记值","状态","是否过关","盖章"');
  });

  it('每生一行：值 / 状态 / 过关 / 盖章', () => {
    const csv = buildSheetTableCsv({ className: 'c', records: [rec()], n: 3, names });
    expect(csv).toContain('"1","1","张三","A","","是",""');
    expect(csv).toContain('"2","2","李四","C","","",""');
    expect(csv).toContain('"3","3","王五","","缺交","",""');
  });

  it('多张表：一表一块，块之间空一行；无评价语时不输出评价语行', () => {
    const csv = buildSheetTableCsv({
      className: 'c',
      records: [rec(), rec({ key: 'k2', content: '第二张', templateId: 'quality', scheme: { ...scheme, kind: 'score', maxScore: 100 } })],
      n: 1,
      names,
    });
    const blocks = csv.split('\r\n\r\n');
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(csv).toContain('"作业内容","第二张"');
    expect(csv).not.toContain('"评价语"');
  });

  it('表内没有的学号照样留一行（打印时名单是完整的）', () => {
    const csv = buildSheetTableCsv({ className: 'c', records: [rec()], n: 5, names });
    const lines = csv.split('\r\n').filter((x) => x.startsWith('"5"'));
    expect(lines.length).toBe(1);
  });
});
