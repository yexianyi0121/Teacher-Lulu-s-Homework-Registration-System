/**
 * 学号模糊匹配（设计 §8.3）：精确前缀优先，其余按学号升序
 */
export function matchStudents(query: string, n: number): number[] {
  const q = query.trim();
  if (!q) return [];

  const all: number[] = [];
  for (let no = 1; no <= n; no++) {
    if (String(no).includes(q)) all.push(no);
  }

  const starts = all.filter((no) => String(no).startsWith(q));
  const rest = all.filter((no) => !String(no).startsWith(q));
  return [...starts, ...rest];
}
