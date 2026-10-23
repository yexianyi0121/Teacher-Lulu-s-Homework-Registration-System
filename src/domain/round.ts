/**
 * 四舍五入（设计 §8.1）★ 浮点陷阱
 */

/** 保留 1 位小数，四舍五入（half-up），规避 87.65*10 = 876.4999 的浮点误差 */
export function round1(x: number): number {
  return Math.round((x + Number.EPSILON) * 10) / 10;
}

/** 转成「十分位整数」，用于分段比较，彻底消除浮点比较 */
export function toTenthInt(x: number): number {
  return Math.round(x * 10 + Number.EPSILON); // 90.5 -> 905
}
