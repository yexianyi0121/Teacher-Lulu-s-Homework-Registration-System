/**
 * 背景主题（V4 FR-48 / ADR-24）：6 套预设，只换 --bg-gradient / --brand / --brand-soft 三组变量。
 * 不改 --surface / --text-* / 语义色 → 卡片仍是白底，对比度天然满足 FR-48.6；
 * night 主题也只换页面背景与主色，不做全暗色（FR-48.4）。
 */

export type ThemeKey = 'pink' | 'mint' | 'sky' | 'sand' | 'night' | 'plain';

export interface ThemeMeta {
  key: ThemeKey;
  name: string;
  /** 设置面板里的色板示意（与 CSS 变量同值，测试用） */
  bg: string;
  brand: string;
}

export const THEMES: ThemeMeta[] = [
  { key: 'pink', name: '樱粉（默认）', bg: '#FDEBF3', brand: '#FF6FA5' },
  { key: 'mint', name: '薄荷', bg: '#EAF7F0', brand: '#3FA97A' },
  { key: 'sky', name: '天青', bg: '#EAF3FD', brand: '#4A7BC8' },
  { key: 'sand', name: '米杏', bg: '#FDF7EC', brand: '#C08A3E' },
  { key: 'night', name: '夜空', bg: '#2A2340', brand: '#8E7CD8' },
  { key: 'plain', name: '纯白', bg: '#FFFFFF', brand: '#FF6FA5' },
];

export const DEFAULT_THEME: ThemeKey = 'pink';

const KEYS = new Set<ThemeKey>(THEMES.map((t) => t.key));

export function isThemeKey(v: unknown): v is ThemeKey {
  return typeof v === 'string' && KEYS.has(v as ThemeKey);
}

/** 未知 / 旧值（v3 的 'auto' | 'light'）一律回落默认（B-4） */
export function themeOf(v: unknown): ThemeKey {
  return isThemeKey(v) ? v : DEFAULT_THEME;
}

export function themeMeta(key: ThemeKey): ThemeMeta {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
