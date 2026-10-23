import { describe, expect, it } from 'vitest';
import {
  CSV_BOM,
  buildDetailCsv,
  buildPointsCsv,
  buildSummaryCsv,
  recordsInRange,
  statsOfRecords,
  termRange,
} from '../../src/domain/exporter';
import { zipBytes, crc32, utf8 } from '../../src/infra/zip';
import { monthStats } from '../../src/domain/points';
import type { HistoryEntry, PointLedgerEntry, RecordDoc } from '../../src/domain/types';
import { makeScheme, e, score } from '../fixtures';

const scheme = makeScheme('score');

function rec(over: Partial<RecordDoc> = {}): RecordDoc {
  return {
    key: 'cls_default|2026-03-13|语文本|sheet_default_quality',
    classId: 'cls_default',
    date: '2026-03-13',
    content: '语文本',
    sheetId: 'sheet_default_quality',
    templateId: 'quality',
    scheme,
    entries: { '1': e(score(98)), '2': e(score(43)) },
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe('exporter：CSV 规范', () => {
  const csv = buildDetailCsv({ className: '三年二班', records: [rec()], n: 3, names: { 1: '张三' } });

  it('带 UTF-8 BOM（Excel 不乱码）', () => {
    expect(csv.startsWith(CSV_BOM)).toBe(true);
  });

  it('CRLF 行尾、全字段加引号、列顺序固定', () => {
    const lines = csv.slice(1).split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('"班级","日期","登记表","作业内容","学号","姓名","原始值","折算百分","档位","状态","过关","补交","补交说明","盖章"');
    expect(lines).toHaveLength(3); // 表头 + 2 行
    expect(lines[1]).toBe('"三年二班","2026-03-13","质量监测","语文本","1","张三","98","98","优秀","","","","",""');
  });

  it('含逗号/引号的字段会被正确转义', () => {
    const tricky = buildDetailCsv({
      className: '二班,实验',
      records: [rec({ content: '第3单元，"语文本"' })],
      n: 1,
    });
    expect(tricky).toContain('"二班,实验"');
    expect(tricky).toContain('"第3单元，""语文本"""');
  });

  it('空区间只有表头（AC-28.2）', () => {
    const empty = buildDetailCsv({ className: '三年二班', records: [], n: 50 });
    expect(empty.slice(1).split('\r\n').filter(Boolean)).toHaveLength(1);
  });

  it('汇总表按区间聚合', () => {
    const agg = statsOfRecords([rec()]);
    expect(agg.avgPercent).toBe(70.5);
    expect(agg.maxPercent).toBe(98);
    expect(agg.minPercent).toBe(43);
    expect(agg.qualifiedRate).toBe(0.5);
    const summary = buildSummaryCsv({
      className: '三年二班',
      rangeLabel: '2026-03',
      records: [rec()],
      n: 50,
      totalPoints: 10,
      qualifiedRate: agg.qualifiedRate,
      avgPercent: agg.avgPercent,
      maxPercent: agg.maxPercent,
      minPercent: agg.minPercent,
    });
    expect(summary).toContain('"三年二班","2026-03","1","1","50","10","0.2","50%"');
  });

  it('学期范围：上学期 09-01～次年 01-31，下学期 02-01～07-31', () => {
    expect(termRange(2025, 'first')).toMatchObject({ from: '2025-09-01', to: '2026-01-31' });
    expect(termRange(2025, 'second')).toMatchObject({ from: '2026-02-01', to: '2026-07-31' });
  });
});

describe('exporter：积分 CSV 与区间过滤', () => {
  it('月度积分表含明细串与名次', () => {
    const ledger: PointLedgerEntry[] = [
      { id: 'a', classId: 'c', studentNo: 1, date: '2026-03-13', ruleId: 'rule_1', delta: 5, reason: 'x', source: 'auto', dedupeKey: 'k1', createdAt: 1 },
      { id: 'b', classId: 'c', studentNo: 1, date: '2026-03-14', ruleId: 'rule_3', delta: 3, reason: 'y', source: 'auto', dedupeKey: 'k2', createdAt: 1 },
    ];
    const stats = monthStats({ history: [], ledger, classId: 'c', month: '2026-03', n: 5 });
    const csv = buildPointsCsv({ className: '三年二班', month: '2026-03', stats, ledger, names: { 1: '张三' } });
    expect(csv).toContain('"本月积分"');
    expect(csv).toContain('"+5;+3"');
  });

  it('recordsInRange 按日期闭区间过滤班级', () => {
    const h = (date: string, classId = 'c'): HistoryEntry => ({
      ...rec({ date, classId }),
      metrics: {} as never,
      metricsVersion: 2,
      savedAt: 1,
    });
    const list = [h('2026-02-28'), h('2026-03-01'), h('2026-03-31'), h('2026-04-01'), h('2026-03-15', 'other')];
    const picked = recordsInRange(list, 'c', '2026-03-01', '2026-03-31');
    expect(picked.map((r) => r.date)).toEqual(['2026-03-01', '2026-03-31']);
  });
});

describe('zip：store-only 写入', () => {
  it('CRC32 与 zlib 一致（空串与 "abc"）', () => {
    expect(crc32(new Uint8Array([]))).toBe(0);
    expect(crc32(utf8('abc'))).toBe(0x352441c2);
  });

  it('ZIP 结构：本地头、UTF-8 flag、文件名、EOCD 都对', () => {
    const bytes = zipBytes([{ name: '登记明细.csv', data: utf8('a,b\r\n"1","2"\r\n') }], new Date(2026, 2, 13, 10, 0, 0));

    // 本地文件头 0x04034b50
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    // 通用标志位 bit 11 = UTF-8（R-9：Windows 解压中文名不乱码）
    const flags = bytes[6] | (bytes[7] << 8);
    expect(flags & 0x0800).toBe(0x0800);

    // 中央目录签名 + 文件名（UTF-8 字节）
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    expect(text).toContain('登记明细.csv');
    expect(text).toContain('PK\u0001\u0002');

    // EOCD 在末尾
    const tail = bytes.slice(-22);
    expect(tail[0]).toBe(0x50);
    expect(tail[1]).toBe(0x4b);
    expect(tail[2]).toBe(0x05);
    expect(tail[3]).toBe(0x06);
  });

  it('多文件条目数写入 EOCD', () => {
    const bytes = zipBytes([
      { name: 'a.csv', data: utf8('1') },
      { name: 'b.csv', data: utf8('2') },
      { name: 'c.csv', data: utf8('3') },
    ]);
    const tail = bytes.slice(-22);
    const count = tail[8] | (tail[9] << 8);
    expect(count).toBe(3);
  });
});
