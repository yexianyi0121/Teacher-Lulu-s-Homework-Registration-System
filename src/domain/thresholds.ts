/**
 * 阈值夹取（PRD §6.1.2 / 设计 §4.3）
 * 恒有 0 ≤ 及格线 ≤ 80 ≤ 优秀线 ≤ 100
 */
export interface Thresholds {
  passLine: number;
  excellentLine: number;
  adjusted: boolean;
}

export function clampThresholds(passLine: number, excellentLine: number): Thresholds {
  const p = Number.isFinite(passLine) ? passLine : 60;
  const e = Number.isFinite(excellentLine) ? excellentLine : 90;
  const clampedPass = Math.min(80, Math.max(0, p));
  const clampedExcellent = Math.min(100, Math.max(80, e));
  return {
    passLine: clampedPass,
    excellentLine: clampedExcellent,
    adjusted: clampedPass !== passLine || clampedExcellent !== excellentLine,
  };
}
