import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * v2.6.1 静态守卫：FR-70 的四处改动必须留在代码里。
 * 这些断言读源文件文本，是为了防止后人「顺手清理」时把防线删掉。
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

describe('FR-70.1 → FR-72.2：过关规则区已搬到本表设置', () => {
  it('SettingsModal 不再管过关规则（v2.6.4 优化5 连指路牌也删了）', () => {
    const src = read('src/components/modals/SettingsModal.tsx');
    expect(src).not.toContain('id="pass-kind"');
    expect(src).not.toContain('pass-rule-moved');
  });

  it('SchemeModal 里同时有等级白名单与分数线两套口径', () => {
    const src = read('src/components/modals/SchemeModal.tsx');
    expect(src).toContain('id="scheme-pass-tier"');
    expect(src).toContain('算过关的等级');
    expect(src).toContain('等级过关');
  });
});

describe('FR-70.2：及格% 下限防线', () => {
  it('SchemeModal 里 passRate 低于 5% 会被拦下', () => {
    const src = read('src/components/modals/SchemeModal.tsx');
    expect(src).toContain('MIN_PASS = 5');
    expect(src).toContain('及格% 不能低于');
  });
});

describe('FR-70.3：GRADE_LETTERS 与 GRADE_ORDER 一致', () => {
  it('grading.ts 里含 B-', () => {
    const src = read('src/domain/grading.ts');
    expect(src).toContain("'B+'");
    expect(src).toContain("'B-'");
  });
});

describe('FR-70.4：手机键盘等级行必须换行', () => {
  it('global.css 里 .mk-row:has(.mk-key--grade) 允许 flex-wrap', () => {
    const src = read('src/styles/global.css');
    expect(src).toContain('.mk-row:has(.mk-key--grade) { flex-wrap: wrap; }');
    expect(src).toContain('.mk-key--grade { flex: 1 1 calc((100% - 28px) / 4); min-width: 40px; }');
  });
});

describe('FR-70.5：未启用等级入口', () => {
  it('HintBar 渲染 .hint-missing，且 global.css 给了样式', () => {
    const tsx = read('src/components/HintBar.tsx');
    expect(tsx).toContain('hint-missing');
    expect(tsx).toContain('setModal(\'scheme\')');
    const css = read('src/styles/global.css');
    expect(css).toContain('.hint .hint-missing');
  });
});
