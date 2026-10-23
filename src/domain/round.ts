/**
 * 数值工具（设计 04 §8.1）★ 浮点陷阱
 */

/** 保留 1 位小数，四舍五入（half-up）。禁止 toFixed（二进制误差 + 返回字符串） */
export function round1(x: number): number {
  return Math.round((x + Number.EPSILON) * 10) / 10;
}

/** 转成「十分位整数」，用于分段比较，彻底消除浮点比较（V1 沿用） */
export function toTenthInt(x: number): number {
  return Math.round(x * 10 + Number.EPSILON); // 90.5 -> 905
}

/**
 * 比例（0-1）→ 百分比整数标尺（.90 → 90）。
 * 用于阈值比较：**不得**写 `p >= rate * 100`——`0.9 * 100 = 90.00000000000001`，
 * 会让恰好 90% 的 `A-` 被判成「良好」（设计 §8.1 / §16-1）。
 */
export function toPct(rate: number): number {
  return Math.round(rate * 1000) / 10;
}

/**
 * 百分比与阈值比较（两侧同时放大 10 倍后比较整数）。
 * `p * 10 + EPS >= Math.round(rate * 1000)` 等价于 `p >= toPct(rate)`，且对 83.333… 这类
 * 无限小数安全（用 EPS 吸收 899.9999999 的浮点表示误差）。
 */
export function gtePct(p: number, rate: number): boolean {
  return p * 10 + 1e-9 >= Math.round(rate * 1000);
}

/** 百分比转 0-100 展示（1 位小数，整数不带 .0） */
export function formatPercent(p: number): string {
  const r = round1(p);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
