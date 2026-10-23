/** 响应式网格列数（PRD §4.8） */
export function gridColumns(width: number): number {
  if (width >= 1280) return 10;
  if (width >= 1024) return 8;
  if (width >= 768) return 6;
  return 4;
}
