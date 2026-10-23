import type { HistoryEntry, PointLedgerEntry, RecordDoc } from './types';
import { SHEET_TEMPLATES } from './constants';
import { formatValue } from './grading';
import { percentOf, tierOf } from './scoring';
import { TIER_LABEL } from './constants';
import { round1 } from './round';
import type { MonthStats } from './points';

/**
 * 导出（设计 04 §6.11）—— 纯函数：只产出字符串，不碰 Blob / DOM。
 * CSV 规范：UTF-8 BOM、全字段加双引号、CRLF 行尾（Excel 双击不乱码）。
 */

export const CSV_BOM = '\uFEFF';

function q(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function csv(rows: Array<Array<string | number | null | undefined>>): string {
  return CSV_BOM + rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}

const STATUS_LABEL = { normal: '', missing: '缺交', leave: '请假' } as const;

export interface DetailArgs {
  className: string;
  records: RecordDoc[];
  n: number;
  names?: Record<number, string | undefined>;
}

/** 登记明细.csv：每生每登记一行 */
export function buildDetailCsv(args: DetailArgs): string {
  const { className, records, n, names } = args;
  const rows: Array<Array<string | number>> = [[
    '班级', '日期', '登记表', '作业内容', '学号', '姓名', '原始值', '折算百分',
    '档位', '状态', '过关', '补交', '补交说明', '盖章',
  ]];

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  for (const r of sorted) {
    const tplName = SHEET_TEMPLATES[r.templateId].name;
    for (let no = 1; no <= n; no++) {
      const e = r.entries[String(no)];
      if (!e) continue;
      const p = percentOf(e, r.scheme);
      const t = tierOf(e, r.scheme);
      rows.push([
        className,
        r.date,
        tplName,
        r.content,
        no,
        names?.[no] ?? '',
        formatValue(e.value, r.scheme),
        p === null ? '' : String(round1(p)),
        t ? TIER_LABEL[t] : '',
        STATUS_LABEL[e.status] ?? '',
        e.pass ? '是' : '',
        e.makeup ? '是' : '',
        e.makeup?.note ?? '',
        e.stamp === 'corrected' ? '已更正' : e.stamp === 'excellent' ? '优秀' : '',
      ]);
    }
  }
  return csv(rows);
}

export interface PointsArgs {
  className: string;
  month: string;
  stats: MonthStats;
  ledger: PointLedgerEntry[];
  names?: Record<number, string | undefined>;
}

/** 月度积分.csv */
export function buildPointsCsv(args: PointsArgs): string {
  const { className, month, stats, ledger, names } = args;
  const rows: Array<Array<string | number>> = [[
    '班级', '月份', '学号', '姓名', '登记次数', '达标次数', '缺交', '请假', '补交',
    '本月积分', '名次', '积分明细',
  ]];

  for (const row of stats.rows) {
    if (row.sessions === 0 && row.points === 0) continue;
    const detail = ledger
      .filter((x) => x.studentNo === row.no && x.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => (x.delta > 0 ? `+${x.delta}` : String(x.delta)))
      .join(';');
    rows.push([
      className, month, row.no, names?.[row.no] ?? '', row.sessions, row.qualified,
      row.missing, row.leave, row.madeUp, row.points, row.rank, detail,
    ]);
  }
  return csv(rows);
}

export interface SummaryArgs {
  className: string;
  rangeLabel: string;
  records: RecordDoc[];
  n: number;
  totalPoints: number;
  qualifiedRate: number;
  avgPercent: number | null;
  maxPercent: number | null;
  minPercent: number | null;
}

/** 汇总.csv：一行描述整个区间 */
export function buildSummaryCsv(args: SummaryArgs): string {
  const header = [
    '班级', '范围', '登记表数', '记录数', '学生数', '总积分', '人均积分',
    '达标率', '最高分', '最低分', '平均分',
  ];
  const avg = args.avgPercent;
  const row = [
    args.className,
    args.rangeLabel,
    new Set(args.records.map((r) => r.sheetId)).size,
    args.records.length,
    args.n,
    args.totalPoints,
    args.n ? round1(args.totalPoints / args.n) : 0,
    `${round1(args.qualifiedRate * 100)}%`,
    args.maxPercent === null ? '' : round1(args.maxPercent),
    args.minPercent === null ? '' : round1(args.minPercent),
    avg === null ? '' : round1(avg),
  ];
  return csv([header, row]);
}

/** 区间聚合（供汇总表使用） */
export function statsOfRecords(records: RecordDoc[]) {
  let sum = 0;
  let count = 0;
  let max: number | null = null;
  let min: number | null = null;
  let qualified = 0;

  for (const r of records) {
    for (const e of Object.values(r.entries)) {
      const p = percentOf(e, r.scheme);
      if (p === null) continue;
      sum += p;
      count++;
      max = max === null ? p : Math.max(max, p);
      min = min === null ? p : Math.min(min, p);
      const t = tierOf(e, r.scheme);
      if (t && t !== 'fail') qualified++;
    }
  }
  return {
    avgPercent: count ? sum / count : null,
    maxPercent: max,
    minPercent: min,
    qualifiedRate: count ? qualified / count : 0,
  };
}

/** 从历史挑选出区间内的记录（导出以历史为准，历史才是「已定稿」的登记） */
export function recordsInRange(
  history: HistoryEntry[],
  classId: string,
  from: string,
  to: string,
): RecordDoc[] {
  return history.filter((h) => h.classId === classId && h.date >= from && h.date <= to);
}

/** 学期范围（默认：上学期 09-01～次年 01-31；下学期 02-01～07-31） */
export function termRange(year: number, term: 'first' | 'second'): { from: string; to: string; label: string } {
  if (term === 'first') {
    return { from: `${year}-09-01`, to: `${year + 1}-01-31`, label: `${year}学年 上学期` };
  }
  return { from: `${year + 1}-02-01`, to: `${year + 1}-07-31`, label: `${year}学年 下学期` };
}
