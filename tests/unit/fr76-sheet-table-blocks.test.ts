import { describe, expect, it } from 'vitest';
import { buildSheetTableBlocks, buildSheetTableCsv } from '../../src/domain/exporter';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { studentsOf } from '../fixtures';
import { todayISO } from '../../src/domain/date';
import type { RecordDoc, ScoringScheme } from '../../src/domain/types';

/**
 * v2.6.5 需求1/2：导出表格（Excel 优先）。
 * - 日期必须是**文本**，否则 Excel 会按日期格式解释并显示 `#####`；
 * - 一张表一个工作表，工作表名有 31 字符上限且不能带 \ / ? * [ ] :
 */
const date = todayISO();

const scheme: ScoringScheme = {
  kind: 'grade', maxScore: null,
  grades: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'],
  allowCheck: true, allowText: true, decimals: 0,
  excellentRate: 0.9, goodRate: 0.8, passRate: 0.6,
  gradePass: ['A+', 'A'],
};

function rec(content: string, templateId: RecordDoc['templateId'] = 'homework'): RecordDoc {
  return {
    key: `cls_1|${date}|${content}|sheet_default_${templateId}`,
    classId: 'cls_1', date, content, sheetId: `sheet_default_${templateId}`, templateId, scheme,
    entries: {
      1: { value: { kind: 'grade', grade: 'A' }, stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 1 },
      2: { value: null, stamp: 'none', status: 'leave', pass: false, makeup: null, updatedAt: 1 },
    },
    comment: '继续加油',
    createdAt: 1, updatedAt: 1,
  } as unknown as RecordDoc;
}

const names = studentsOf(3).reduce<Record<number, string | undefined>>((acc, s) => {
  acc[s.no] = s.name;
  return acc;
}, {});

describe('FR-76.2：导出的表格数据', () => {
  it('日期按文本给出，避免 Excel 显示成 #####', () => {
    const [block] = buildSheetTableBlocks({ className: '2025级19班', records: [rec('默写')], n: 3, names });
    const dateRow = block.rows.find((r) => r[0] === '日期');
    expect(dateRow?.[1]).toBe(date);
    expect(typeof dateRow?.[1]).toBe('string');
  });

  it('一块一张表：表头 + 每生一行，人数按名单补齐', () => {
    const blocks = buildSheetTableBlocks({ className: '2025级19班', records: [rec('默写'), rec('第二次', 'homework')], n: 3, names });
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      expect(b.rows.some((r) => r[0] === '序号' && r[1] === '学号')).toBe(true);
    }
    // 表头 + 3 名学生
    const firstHeader = blocks[0].rows.findIndex((r) => r[0] === '序号');
    expect(blocks[0].rows.length).toBe(firstHeader + 1 + 3);
  });

  it('工作表名 ≤31 字符并替换 Excel 非法字符', () => {
    const blocks = buildSheetTableBlocks({
      className: '2025级19班',
      records: [rec('10月27日/默写[第2单元]：词语*听写?（含标点）')],
      n: 3,
      names,
    });
    expect(blocks[0].name.length).toBeLessThanOrEqual(31);
    expect(blocks[0].name).not.toMatch(/[\\/?*[\]:]/);
  });

  it('作业内容与评价语写进表头区', () => {
    const [block] = buildSheetTableBlocks({ className: '2025级19班', records: [rec('默写')], n: 3, names });
    expect(block.rows.some((r) => r[0] === '作业内容' && r[1] === '默写')).toBe(true);
    expect(block.rows.some((r) => r[0] === '评价语' && r[1] === '继续加油')).toBe(true);
  });

  it('CSV 仍是 CSV：多张表之间空一行', () => {
    const csv = buildSheetTableCsv({ className: '2025级19班', records: [rec('默写'), rec('第二次')], n: 3, names });
    expect(csv).toContain('2025级19班');
    expect(csv).toMatch(/\r?\n\r?\n"班级"/);
  });

  it('默认设置下导出同样可用（不依赖某个班级配置）', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('plain');
    const blocks = buildSheetTableBlocks({ className: '某班', records: [rec('默写')], n: 2, names });
    expect(blocks[0].rows[0][0]).toBe('班级');
  });
});
