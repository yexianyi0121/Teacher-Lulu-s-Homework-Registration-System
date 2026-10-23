import type { Mode } from '../domain/types';

/**
 * recordKey（设计 §4.4）：同日期 + 同内容 + 同模式 = 同一条记录（PRD BR-36）
 */
export function recordKey(date: string, content: string, mode: Mode): string {
  return `${date}||${encodeURIComponent(content)}||${mode}`;
}

let counter = 0;

/** 唯一 id（不依赖 crypto，便于测试） */
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}
