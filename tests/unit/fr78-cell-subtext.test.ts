import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * v2.6.8 静态守卫：格子里「主值下方的小字」不能再跟学生姓名抢同一条基线。
 *
 * 事故形态：`.cell-sub`（补交 / 补 / 缺）与 `.cell-name`（学生姓名）
 * 都写成 `position: absolute; bottom: 2px`，于是副文本直接压在名字上。
 * 现在副文本走 `.cell-value` 的 column flex，与主值、表情、`（错22）` 一起从上往下排，
 * 底部只留给学生姓名。
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

describe('FR-78.4：副文本不再绝对定位在学生姓名上', () => {
  it('.cell-sub 不是绝对定位，也不再用 bottom 贴底', () => {
    const css = read('src/styles/global.css');
    const start = css.indexOf('.cell-sub {');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).not.toContain('position: absolute');
    expect(block).not.toContain('bottom:');
    expect(block).not.toContain('translateX');
  });

  it('.cell-name 仍然是格底那一行（副文本让位后它才看得见）', () => {
    const css = read('src/styles/global.css');
    const start = css.indexOf('.cell-name {');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toContain('position: absolute');
    expect(block).toContain('bottom: 2px');
  });

  it('CellView 把副文本渲染在主值容器里，而不是格子根节点上', () => {
    const src = read('src/components/CellView.tsx');
    const valueStart = src.indexOf('<span className="cell-value">');
    expect(valueStart).toBeGreaterThan(-1);
    // cell-value 开标签自己的 `>` 之后到 `{badge ?` 之前就是主值容器的内容
    const badgeAt = src.indexOf('{badge ?', valueStart);
    expect(badgeAt).toBeGreaterThan(valueStart);
    const valueBlock = src.slice(valueStart, badgeAt);
    expect(valueBlock).toContain('className="cell-sub"');
  });
});
