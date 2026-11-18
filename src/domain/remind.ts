/**
 * 7 天未导出提醒（V4 FR-51.2 / A-96）——纯函数 + 可注入时钟。
 *
 * 背景：iOS 会在长期不用后清理站点存储，这是纯前端 PWA 唯一的真实数据风险，
 * 所以移动端要在「距上次导出 ≥ 7 天」时提醒备份到文件。逻辑不碰 UI，
 * 单测直接注入 now，不需要等真实 7 天。
 */

export const EXPORT_REMIND_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 距上次导出多少天（null = 从未导出或时间值不可解析） */
export function daysSinceExport(lastExportAt: string | null, now: Date): number | null {
  if (!lastExportAt) return null;
  const t = Date.parse(lastExportAt);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / DAY_MS;
}

/**
 * 是否该提醒导出备份。
 * - 从未导出（null）或坏值 → 提醒；
 * - 距上次导出 ≥ days 天 → 提醒；否则不提醒。
 * days 可注入，便于测试与将来在设置里调周期。
 */
export function shouldRemindExport(
  lastExportAt: string | null,
  now: Date,
  days: number = EXPORT_REMIND_DAYS,
  /**
   * 第一次产生数据的时间（毫秒）。用于「从未导出过」的场景：
   * 老逻辑一进来就提醒，老师每天开系统都被打扰；现在只有数据已存在 ≥ days 天才提醒。
   * 传 null/undefined 时保持旧行为（立即提醒），方便单测与特殊场景。
   */
  firstDataAt: number | null = null,
): boolean {
  if (!days || days <= 0) return false;
  const since = daysSinceExport(lastExportAt, now);
  if (since !== null) return since >= days;
  if (firstDataAt === null || firstDataAt === undefined) return true;
  return now.getTime() - firstDataAt >= days * DAY_MS;
}
