/** 'YYYY-MM-DD' -> '3月13日'（不补零，PRD BR-20） */
export function formatDateCN(date: string): string {
  const parts = date.split('-');
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!m || !d) return date;
  return `${m}月${d}日`;
}

/** 'YYYY-MM-DD' -> '2026年10月23日' */
export function formatDateFullCN(date: string): string {
  const parts = date.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return date;
  return `${y}年${m}月${d}日`;
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

/** 'YYYY-MM-DD' -> '星期五' */
export function weekdayCN(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `星期${WEEKDAY[d.getDay()]}`;
}

/** 本地时区的今天，'YYYY-MM-DD' */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM' */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/**
 * 'YYYYMMDD-HHmmss'，用于备份文件名。
 * 精确到秒（D-07）：只到分钟时，老师一分钟内连导两次会得到同名文件，
 * 系统下载目录里后一份直接把前一份顶掉，等于「备份被备份弄丢了」。
 */
export function stampForFile(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/** 'YYYY-MM-DD' + n 天（本地时区安全） */
export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 该日期所在 ISO 周的周一（周一为一周第一天，V3 BR-71） */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const day = d.getDay();                 // 0=周日
  const diff = day === 0 ? -6 : 1 - day;  // 回到周一
  return addDaysISO(date, diff);
}

/** '10月20日 周一'（周汇总日期头） */
export function dayHeading(date: string): string {
  return `${formatDateCN(date)} ${weekdayCN(date).replace('星期', '周')}`;
}

/** '2026-10-20 ~ 2026-10-26' */
export function weekRange(weekStart: string): string {
  return `${weekStart} ~ ${addDaysISO(weekStart, 6)}`;
}
