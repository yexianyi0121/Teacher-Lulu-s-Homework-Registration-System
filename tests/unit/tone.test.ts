import { describe, expect, it } from 'vitest';
import { GRADE_TONE, cellDisplay } from '../../src/domain/tone';
import { GRADE_ORDER, DEFAULT_GRADE_EMOJI } from '../../src/domain/constants';
import type { ScoringScheme } from '../../src/domain/types';
import { e, g, makeScheme, score, text } from '../fixtures';

/** V3 显示：两套色系（等级八档，v2.5.9 新增 B- / 分数四档）+ 三态角标 + 表情 */

const check = makeScheme('check');
const grade = makeScheme('grade');
const scoreScheme = makeScheme('score');
const opts = { showEmoji: true, gradeEmoji: DEFAULT_GRADE_EMOJI };

describe('GRADE_TONE：八档两两可辨（AC-37.1 / INV-17 / v2.5.9 B-）', () => {
  it('底色 + 边框色 + 边框样式 组合唯一', () => {
    const keys = GRADE_ORDER.map((x) => `${GRADE_TONE[x].bg}|${GRADE_TONE[x].line}|${GRADE_TONE[x].borderStyle}`);
    expect(new Set(keys).size).toBe(8);
  });

  it('A- 是黄绿（#8FBF6F），不再是 V2 的琥珀', () => {
    expect(GRADE_TONE['A-'].line).toBe('#8FBF6F');
  });
});

describe('cellDisplay：状态位与角标', () => {
  it('请假 → 假 / leave 角标 / 灰', () => {
    const d = cellDisplay(e(null, { status: 'leave' }), check, opts);
    expect(d).toMatchObject({ text: '假', kind: 'leave', tone: 'gray', badge: 'leave' });
  });

  it('缺交 → × / missing 角标', () => {
    const d = cellDisplay(e(null, { status: 'missing' }), check, opts);
    expect(d).toMatchObject({ text: '×', kind: 'missing', badge: 'missing' });
  });

  it('缺交 + 补交 → 仍显示 ×，角标改为「补」并带辅助文字（FR-31.3）', () => {
    const d = cellDisplay(e(null, { status: 'missing', makeup: { at: 1, note: '' } }), check, opts);
    expect(d).toMatchObject({ text: '×', kind: 'missing', badge: 'madeup', subText: '补交' });
  });

  it('手工过关 → 主值 ✓（不是自动 ✅；FR-65：U+2713）', () => {
    const d = cellDisplay(e(null, { pass: true }), check, opts);
    expect(d).toMatchObject({ text: '✓', kind: 'pass', tone: 'green' });
    expect(d.badge).toBeUndefined();
  });

  it('手工过关但已登记值 → 主值 ✓ + keptValue 挂下方（v2.6.8）', () => {
    const d = cellDisplay(e(text('错22'), { pass: true }), check, opts);
    expect(d.text).toBe('✓');
    expect(d.kind).toBe('pass');
    // 原值走 keptValue（渲染成主值下方的「（错22）」），不占底部副文本位——那是学生姓名
    expect(d.keptValue).toBe('错22');
    expect(d.subText).toBeUndefined();
    expect(d.full).toBe('已过关 · 错22');
  });

  it('手工过关 + 补交 → keptValue 与补交副文本互不干扰（v2.6.8）', () => {
    const d = cellDisplay(e(g('A'), { pass: true, makeup: { at: 0, note: '' } }), grade, opts);
    expect(d.keptValue).toBe('A');
    expect(d.subText).toBe('补交');
    expect(d.badge).toBe('madeup');
  });
});

describe('cellDisplay：听写「全对」不重复显示 √（AC-32.1）', () => {
  it('全对 → 主值「全对」+ ✅ 角标（自动过关），显示层无 √ 字符（输入仍接受 √）', () => {
    const d = cellDisplay(e(text('全对')), check, opts);
    expect(d.text).toBe('全对');
    expect(d.text).not.toContain('√');
    expect(d.badge).toBe('passed');
    expect(d.tone).toBe('green');
  });

  it('错1–3 琥珀、错≥4 红', () => {
    expect(cellDisplay(e(text('错1')), check, opts).tone).toBe('amber');
    expect(cellDisplay(e(text('错4')), check, opts).tone).toBe('red');
  });
});

describe('cellDisplay：等级色与表情', () => {
  it('返回 grade 字段供 CSS 选色；A+ 与 A- 的 grade 不同', () => {
    expect(cellDisplay(e(g('A+')), grade, opts).grade).toBe('A+');
    expect(cellDisplay(e(g('A-')), grade, opts).grade).toBe('A-');
  });

  it('本表白名单只认 A/A+：A- 没有 ✅ 角标（AC-32.2 / v2.6.3 口径）', () => {
    expect(cellDisplay(e(g('A-')), grade, opts).badge).toBeUndefined();
  });

  it('本表勾上 A- 后，A- 拿到 ✅ 角标', () => {
    const s2: ScoringScheme = { ...grade, gradePass: ['A+', 'A', 'A-'] };
    const d = cellDisplay(e(g('A-')), s2, opts);
    expect(d.badge).toBe('passed');
  });

  it('showEmoji=true 时 A+ 带 😄；false 时不带（AC-38.1）', () => {
    expect(cellDisplay(e(g('A+')), grade, opts).emoji).toBe('😄');
    expect(cellDisplay(e(g('A+')), grade, { ...opts, showEmoji: false }).emoji).toBeUndefined();
  });

  it('某等级表情设为空串（「不显示」）→ 该等级不输出 emoji，其余等级不受影响（v2.3.1 用户意见 3）', () => {
    const custom = { ...opts, gradeEmoji: { ...DEFAULT_GRADE_EMOJI, 'C': '', 'D': '' } };
    expect(cellDisplay(e(g('C')), grade, custom).emoji).toBeUndefined();
    expect(cellDisplay(e(g('D')), grade, custom).emoji).toBeUndefined();
    expect(cellDisplay(e(g('A+')), grade, custom).emoji).toBe('😄');   // 高等级表情保留
    expect(cellDisplay(e(g('A')), grade, custom).emoji).toBe('🙂');
  });
});

describe('cellDisplay：分数四档色（AC-37.2）', () => {
  it('95 绿 / 85 蓝 / 65 琥珀 / 30 红，绝不 gray', () => {
    const tones = [95, 85, 65, 30].map((x) => cellDisplay(e(score(x)), scoreScheme, opts).tone);
    expect(tones).toEqual(['green', 'blue', 'amber', 'red']);
    expect(tones).not.toContain('gray');
  });

  it('mixed 方案 maxScore 缺失时按 100 折算（INV-21，不再全灰）', () => {
    const broken = makeScheme('mixed', { maxScore: null });
    expect(cellDisplay(e(score(95)), broken, opts).tone).toBe('green');
  });
});
