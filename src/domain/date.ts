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

/** 'YYYYMMDD-HHmm'，用于备份文件名 */
export function stampForFile(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}
