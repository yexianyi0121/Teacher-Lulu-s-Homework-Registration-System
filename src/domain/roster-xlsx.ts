import { MAX_STUDENTS } from './constants';
import type { Student } from './types';
import type { ParsedRoster } from './roster-import';

/**
 * Excel 花名册解析（FR-55）—— 真实老师在微信里收到的名单几乎全是 .xlsx。
 *
 * 设计取舍：
 *   - 用 SheetJS 在浏览器本地解析，文件不出设备（虽然数据不敏感，但也没必要上传）。
 *   - 打包进主包（约 400KB gzip 后更小），不做 CDN —— 产品仍然要能双击离线用。
 *   - 老师给的表格千奇百怪，这里的目标不是「严格」而是「猜对她的意思」：
 *       表头在第几行不固定、列顺序不固定、有的只有姓名没有学号、有的是两列并联。
 *
 * 解析顺序：
 *   1. 找出哪一行是表头（含「姓名/名字/学生」等关键词）
 *   2. 定位「学号列」与「姓名列」；找不到表头就按「A 列学号 + B 列姓名」这种最常见的猜
 *   3. 逐行取值；学号缺失或重复时按行序重编号
 *   4. 过滤掉「合计/小计/备注」这类非学生行
 */

export interface ExcelParseOk {
  ok: true;
  students: Student[];
  warnings: string[];
  /** 实际用了哪个工作表，供 UI 显示「已读取工作表：Sheet1」 */
  sheetName: string;
  /** 识别到的表头行号（从 1 开始），用于给老师解释「按第 2 行做表头」 */
  headerRow: number | null;
}

export interface ExcelParseFail {
  ok: false;
  reason: string;
}

export type ExcelParseResult = ExcelParseOk | ExcelParseFail;

const NAME_HEADER = /姓名|名字|学生姓名|学生名单|^名$/;
const NO_HEADER = /学号|序号|编号|号数|^号$|^no\.?$|^id$/i;

/** 明显不是学生姓名的行 */
const NOISE = /^(合计|小计|总计|备注|说明|注[:：]|统计|平均|班级[:：]|共\s*\d+\s*人)/;

/** 整份文件/整张表的标题行（如「7年级19班作业情况登记表」）—— 绝不是学生姓名 */
const TITLE_LIKE = /(登记表|名单|花名册|情况表|统计表|总表|明细表|sheet\d*$)/i;

/** 姓名是否像人话（至少含一个汉字，且不含大段控制字符） */
function looksLikeName(v: string): boolean {
  const s = v.trim();
  // 长度上限放到 60：超过 20 字的姓名后面会截断，而不是整行丢弃 ——
  // 老师的表格里偶有「7年级19班作业情况登记表」这种长标题，靠 TITLE_LIKE 拦，
  // 但真被误合并进来的长姓名不该连人带名字一起丢。
  if (!s || s.length > 60) return false;
  if (!/[\u4e00-\u9fa5]/.test(s)) return false;
  // 排除「合计」「备注」这类
  if (NOISE.test(s)) return false;
  // 排除「XX登记表」「XX名单」这类表格标题
  if (TITLE_LIKE.test(s)) return false;
  return true;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    // 学号常被 Excel 存成数字
    return Number.isInteger(v) ? String(v) : String(v);
  }
  if (typeof v === 'boolean') return '';
  return String(v).trim();
}

/**
 * 从一张二维表里抽出学生名单。
 * 纯函数、不依赖 xlsx 库，便于单测（用数组直接构造场景）。
 */
export function studentsFromRows(rows: unknown[][]): { students: Student[]; warnings: string[]; headerRow: number | null } {
  const warnings: string[] = [];
  const grid = rows.map((r) => r.map(cellText));

  // 1) 找表头：前 10 行里，同时/分别出现「姓名」「学号」关键词的行
  let headerRow: number | null = null;
  let nameCol = -1;
  let noCol = -1;

  for (let i = 0; i < Math.min(grid.length, 10); i += 1) {
    const r = grid[i];
    // 表头单元格一定是「短标签」（姓名/学号/序号/学生姓名…）。
    // 「2026级19班 学生姓名 登记表」这种整句标题也含「学生姓名」，
    // 但它不是表头 —— 否则整张表会塌成 1 人（R-03）。
    const isHeaderCell = (c: string) => c.length <= 8 && !TITLE_LIKE.test(c);
    const nameIdx = r.findIndex((c) => isHeaderCell(c) && NAME_HEADER.test(c));
    const noIdx = r.findIndex((c) => isHeaderCell(c) && NO_HEADER.test(c));
    if (nameIdx >= 0 || noIdx >= 0) {
      headerRow = i;
      nameCol = nameIdx;
      noCol = noIdx;
      // 只认第一个命中的行，避免把数据行里的「张三」当表头
      break;
    }
  }

  // 2) 没有表头：按「有一半以上行是纯数字 + 有汉字」的最常见布局猜
  if (headerRow === null) {
    // 如果 A 列大量是数字、B 列是汉字 → 学号+姓名
    const numericFirstCol = grid.filter((r) => /^\d+$/.test(r[0] ?? '')).length;
    const hanSecondCol = grid.filter((r) => /[\u4e00-\u9fa5]/.test(r[1] ?? '')).length;
    if (numericFirstCol >= 2 && hanSecondCol >= 2) {
      noCol = 0;
      nameCol = 1;
    } else {
      // 否则取「含汉字最多的那一列」当姓名列
      nameCol = hanColumnIndex(grid);
      noCol = -1;
      if (nameCol < 0) {
        return { students: [], warnings: ['这张表里没有找到姓名列'], headerRow: null };
      }
      warnings.push('没找到表头，已按含姓名最多的那一列读取');
      // 无表头 = 第 0 行就是数据，headerRow 保持 null → dataStart 为 0，首行不会丢
    }
  }

  const dataStart = headerRow === null ? 0 : headerRow + 1;
  const students: Student[] = [];
  const seenNo = new Set<number>();

  for (let i = dataStart; i < grid.length; i += 1) {
    const r = grid[i];
    const rawName = nameCol >= 0 ? (r[nameCol] ?? '') : '';
    const rawNo = noCol >= 0 ? (r[noCol] ?? '') : '';

    // 一行里一个字都没有 → 空行
    if (!rawName && !rawNo) continue;

    // 姓名列不是人话就跳过（跳过会记录，避免老师以为「少了人」）
    if (!looksLikeName(rawName)) {
      if (rawName) warnings.push(`第 ${i + 1} 行「${rawName.slice(0, 12)}」不像姓名，已跳过`);
      continue;
    }

    let no = Number(rawNo.replace(/\D/g, ''));
    if (!Number.isFinite(no) || no <= 0) no = students.length + 1;

    // 学号重复 → 重编
    if (seenNo.has(no)) {
      warnings.push(`第 ${i + 1} 行学号 ${no} 重复，已重新编号`);
      no = students.length + 1;
    }
    seenNo.add(no);

    students.push({ no: students.length + 1, name: rawName.slice(0, 20) });
  }

  if (!students.length) {
    return { students: [], warnings: [...warnings, '这张表里没有读到任何学生'], headerRow };
  }

  if (students.length > MAX_STUDENTS) {
    warnings.push(`超过 ${MAX_STUDENTS} 人上限，已截断`);
    return { students: students.slice(0, MAX_STUDENTS), warnings, headerRow };
  }

  return { students, warnings, headerRow };
}

function hanColumnIndex(grid: string[][]): number {
  let best = -1;
  let bestCount = 0;
  const width = Math.max(...grid.map((r) => r.length), 0);
  for (let c = 0; c < width; c += 1) {
    const count = grid.filter((r) => /[\u4e00-\u9fa5]/.test(r[c] ?? '')).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return bestCount >= 1 ? best : -1;
}

/** 把 Excel 解析结果转成 UI 统一的 ParsedRoster */
export function toParsedRoster(ok: ExcelParseOk): ParsedRoster {
  return { students: ok.students, warnings: ok.warnings };
}
