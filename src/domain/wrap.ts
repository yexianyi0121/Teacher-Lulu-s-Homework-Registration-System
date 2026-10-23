/**
 * 名单折行（设计 §8.2）★ 按「显示宽度」折行，不是按学号个数
 */

/** 中日韩字符宽度 2，半角 1 */
export function charWidth(ch: string): number {
  return /[\u4e00-\u9fa5\u3000-\u303f]/.test(ch) ? 2 : 1;
}

/** 字符串显示宽度（半角单位） */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch);
  return w;
}

/**
 * 把 token 数组折成多行，每行显示宽度不超过 maxWidth
 * @param tokens 形如 ['1号、','2号、',...]（除最后一个外都带分隔符）
 */
export function wrapTokens(tokens: string[], maxWidth: number, sep = '、'): string[] {
  const lines: string[] = [];
  let cur = '';
  let curWidth = 0;

  const stripSep = (line: string): string => (line.endsWith(sep) ? line.slice(0, -sep.length) : line);

  for (const token of tokens) {
    const w = displayWidth(token);
    if (curWidth > 0 && curWidth + w > maxWidth) {
      lines.push(stripSep(cur));
      cur = '';
      curWidth = 0;
    }
    cur += token;
    curWidth += w;
  }
  if (cur) lines.push(stripSep(cur));
  return lines;
}
