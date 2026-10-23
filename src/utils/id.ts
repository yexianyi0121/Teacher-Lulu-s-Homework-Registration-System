/**
 * recordKey（设计 04 §4.3）：`classId|date|content|sheetId`
 * 键含 sheetId：同日同内容不同登记表互不覆盖（FR-24 的前提）。
 */
export function recordKey(r: {
  classId: string;
  date: string;
  content: string;
  sheetId: string;
}): string {
  return `${r.classId}|${r.date}|${r.content.trim()}|${r.sheetId}`;
}

let counter = 0;

/** 唯一 id（不依赖 crypto，便于测试） */
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}
