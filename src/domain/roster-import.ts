import type { Student } from './types';
import { MAX_STUDENTS } from './constants';

export interface ParsedRoster {
  students: Student[];
  warnings: string[];
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
