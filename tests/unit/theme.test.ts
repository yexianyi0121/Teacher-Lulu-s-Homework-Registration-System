import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEMES, isThemeKey, themeMeta, themeOf, type ThemeKey } from '../../src/domain/theme';

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('THEMES：6 套预设元数据（FR-48.1）', () => {
  it('恰好 6 套', () => {
    expect(THEMES).toHaveLength(6);
  });

  it('key 唯一', () => {
    expect(new Set(THEMES.map((t) => t.key)).size).toBe(6);
  });

  it('名称非空且不重复', () => {
    const names = THEMES.map((t) => t.name);
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(6);
  });

  it('色值都是合法 #RRGGBB', () => {
    for (const t of THEMES) {
      expect(t.bg, t.key).toMatch(HEX);
      expect(t.brand, t.key).toMatch(HEX);
    }
  });

  it('默认主题是 plain（纯白，v2.6.3 改进1）', () => {
    expect(DEFAULT_THEME).toBe('plain');
    expect(THEMES.find((t) => t.key === 'plain')?.name).toContain('默认');
    expect(THEMES[0].key).toBe('pink');
  });

  it('night 与 plain 存在（FR-48.4 / 纯白）', () => {
    const keys = THEMES.map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining<ThemeKey>(['night', 'plain']));
  });

  it('plain 主色是中性石墨 #4A4A57，不是粉色（v2.3.1 用户意见 2：纯白不能还是樱粉）', () => {
    expect(themeMeta('plain').bg).toBe('#FFFFFF');
    expect(themeMeta('plain').brand).toBe('#4A4A57');
    // 与 pink 的主色必须不同——否则 6 套主题只有 5 种主色，「纯白」名不副实
    expect(themeMeta('plain').brand).not.toBe(themeMeta('pink').brand);
  });

  it('6 套主色互不相同（plain 中性化后不再与 pink 撞色）', () => {
    expect(new Set(THEMES.map((t) => t.brand)).size).toBe(6);
  });
});

describe('isThemeKey / themeOf', () => {
  it('合法 key 通过', () => {
    for (const t of THEMES) expect(isThemeKey(t.key)).toBe(true);
  });

  it('未知值与旧值回落 plain（B-4：v3 的 auto/light 不是主题 key）', () => {
    expect(themeOf('auto')).toBe('plain');
    expect(themeOf('light')).toBe('plain');
    expect(themeOf('dark')).toBe('plain');
    expect(themeOf('')).toBe('plain');
    expect(themeOf(undefined)).toBe('plain');
    expect(themeOf(null)).toBe('plain');
    expect(themeOf(42)).toBe('plain');
  });

  it('合法 key 原样返回', () => {
    expect(themeOf('mint')).toBe('mint');
    expect(themeOf('night')).toBe('night');
  });
});

describe('themeMeta', () => {
  it('按 key 取元数据', () => {
    expect(themeMeta('sky').name).toBe('天青');
    expect(themeMeta('sky').brand).toBe('#4A7BC8');
  });

  it('查不到时给第一套（pink），不抛错', () => {
    expect(themeMeta('nope' as ThemeKey).key).toBe('pink');
  });
});
