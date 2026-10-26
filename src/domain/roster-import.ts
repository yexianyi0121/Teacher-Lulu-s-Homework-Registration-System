import type { Student } from './types';
import { MAX_STUDENTS } from './constants';

export interface ParsedRoster {
  students: Student[];
  warnings: string[];
  /** 致命错误：整个文件不能当名单用（例如把 xlsx 拖进来了）。有值时 students 恒为空 */
  fatal?: string;
}

const HEADER_RE = /(学号|序号|姓名|名字)/;

/**
 * 花名册文本解析（设计 §6.9，纯函数）
 * - 行首 `编号 + 分隔符 + 姓名` → 采用原编号
 * - 纯姓名 → 按出现顺序编号
 * - 编号重复/跳跃 → 重新连续编号并记录 warning
 * - 首行表头（含「学号/姓名」等）跳过
 */
export function parseRosterText(text: string): ParsedRoster {
  const warnings: string[] = [];

  // 兜底（FR-54.1）：即使文件类型判断漏了，只要文本里大量出现替换符 U+FFFD，
  // 就说明这段内容本来就不是可读文本，绝不能把乱码当姓名收进来。
  const replacement = (text.match(/\uFFFD/g) ?? []).length;
  if (replacement > 0 && replacement / Math.max(text.length, 1) > 0.01) {
    return {
      students: [],
      warnings: [],
      fatal: '内容里有大量乱码，这不是可读的文本名单。如果是 Excel 文件，请先另存为 CSV 再导入。',
    };
  }

  const rawLines = text.split(/\r?\n/);
  const rows: { no: number | null; name: string; raw: string }[] = [];

  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (idx === 0 && HEADER_RE.test(trimmed) && !/^\d/.test(trimmed)) return;

    const m = trimmed.match(/^(\d+)[\s,，、.\t]+(.+)$/);
    if (m) {
      rows.push({ no: Number(m[1]), name: m[2].trim(), raw: trimmed });
    } else {
      rows.push({ no: null, name: trimmed.replace(/^["']|["']$/g, ''), raw: trimmed });
    }
  });

  if (rows.length === 0) {
    return { students: [], warnings: ['没有解析到任何学生'] };
  }

  const numbered = rows.filter((r) => r.no !== null);
  const isSequential =
    numbered.length === rows.length &&
    numbered.every((r, i) => r.no === i + 1);

  if (!isSequential && numbered.length > 0) {
    const seen = new Set<number>();
    for (const r of numbered) {
      if (seen.has(r.no as number)) warnings.push(`学号重复，已重新编号：${r.raw}`);
      seen.add(r.no as number);
    }
    if (numbered.some((r, i) => r.no !== i + 1) && warnings.length === 0) {
      warnings.push('学号不连续，已按行序重新连续编号');
    }
  }

  const limited = rows.slice(0, MAX_STUDENTS);
  if (rows.length > MAX_STUDENTS) {
    warnings.push(`超过 ${MAX_STUDENTS} 人上限，已截断`);
  }

  const students: Student[] = limited.map((r, i) => {
    const name = r.name.slice(0, 20);
    return name ? { no: i + 1, name } : { no: i + 1 };
  });

  return { students, warnings };
}

/**
 * 二进制/表格文件的「这不是名单」判定（FR-54.1）。
 *
 * 背景（真实事故）：老师把 .xlsx 拖进【导入花名册】。xlsx 本质是 ZIP，
 * 二进制被当文本解码后得到 66 行乱码，解析器逐行当成学生姓名全收了，
 * 班级从 55 人变成 66 个 `PK`，而且没有任何提示。
 *
 * 规则：只要出现控制字符 / 替换符 / ZIP 魔数，就判定「不是文本名单」，直接拒绝，
 * 绝不把乱码当姓名导入。
 */
export function looksLikeNonText(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  const len = Math.min(bytes.length, 4096);
  if (len === 0) return false;

  // ZIP 魔数（xlsx / docx / zip）
  if (len >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return true;
  // OLE 复合文档（xls / doc）
  if (len >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true;

  let control = 0;
  for (let i = 0; i < len; i += 1) {
    const b = bytes[i];
    // 允许 	 
 
    // 允许 TAB、LF、CR 三种，其余控制字符视为二进制
    if (b === 0x09 || b === 0x0a || b === 0x0d) continue;
    if (b < 0x20 || b === 0x7f) control += 1;
  }
  return control / len > 0.02;
}

/** 文件类型 → 给老师的一句人话（用于 fatal 文案） */
export function nonTextFileHint(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'xlsx' || ext === 'xls') {
    return '这是 Excel 文件，系统读不了。请用 Excel 打开后「另存为 → CSV」，再导入那个 CSV。';
  }
  if (ext === 'zip' || ext === 'docx' || ext === 'doc' || ext === 'pdf') {
    return `系统只认纯文本名单（.csv / .txt），读不了 .${ext} 文件。`;
  }
  return '这个文件看起来不是纯文本名单，系统读不了。请改用 .csv 或 .txt。';
}

/** CSV 文本解码：先 UTF-8（fatal），失败回退 GBK（Chrome 支持） */
export function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
}
