/**
 * 语音归一化（设计 04 §6.8.3）—— 纯函数，规则顺序敏感（先长后短）。
 * 目标：把「开放听写」的乱七八糟文本收敛成「学号 + 闭集动作」的候选串。
 */

const CN_DIGIT: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 幺: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

const CN_UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const CN_SPECIAL: Record<string, number> = { 廿: 20, 卅: 30 };

const CN_CHARS = '零〇一幺二两三四五六七八九十百千廿卅';

function cnRunToArabic(run: string): string {
  const ascii = run.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (/^\d+$/.test(ascii)) return ascii;

  // 纯「幺二三」这种逐位读法
  if ([...run].every((c) => c === '幺' || c in CN_DIGIT) && run.length > 1 && !/[十百千]/.test(run)) {
    return [...run].map((c) => CN_DIGIT[c]).join('');
  }

  let total = 0;
  let section = 0;
  let num = -1;

  for (const ch of run) {
    if (ch in CN_SPECIAL) {
      section += CN_SPECIAL[ch];
      continue;
    }
    if (ch in CN_DIGIT) {
      num = CN_DIGIT[ch];
      continue;
    }
    if (ch in CN_UNIT) {
      const unit = CN_UNIT[ch];
      section += (num < 0 ? 1 : num) * unit;
      num = -1;
    }
  }
  if (num >= 0) section += num;
  total = section;
  return String(total);
}

/** 把一串里的中文数字段替换成阿拉伯数字（支持 八十七点五） */
export function convertCNNumbers(input: string): string {
  const re = new RegExp(`[${CN_CHARS}]+(?:点[${CN_CHARS}]+)?`, 'g');
  return input.replace(re, (m) => {
    if (m.includes('点')) {
      const [intPart, decPart] = m.split('点');
      const int = cnRunToArabic(intPart || '零');
      const dec = [...decPart].map((c) => (c in CN_DIGIT ? CN_DIGIT[c] : '')).join('');
      return `${int}.${dec}`;
    }
    return cnRunToArabic(m);
  });
}

/** 同音 / 常见误识别 → 闭集动作（先长后短） */
const HOMOPHONES: Array<[RegExp, string]> = [
  [/不交|没交|没有交|未交|未做|缺教|却交/g, '缺交'],
  [/全兑|全队|全对儿|全对兑|泉对|劝对/g, '全对'],
  [/以更正|已耕正|以耕正|已更改|已更正正/g, '已更正'],
  [/过官|过光|过观|过寡/g, '过关'],
  [/不过关|没过关|未过关/g, '不过关'],
  [/请驾|请假假|请架/g, '请假'],
  [/补教|补交交|不教/g, '补交'],
  [/优绣|优修|优秀/g, '优秀'],
  [/清空|轻空|清孔/g, '清空'],
  [/撤销|撤消|扯销/g, '撤销'],
  [/错吴|错五|错务/g, '错5'],
];

/** 等级词（a加 / A佳 → A+） */
const GRADE_WORDS: Array<[RegExp, string]> = [
  [/a\s*加|a佳|a嘉|a\+/gi, 'A+'],
  [/a\s*减|a检|a-|a－/gi, 'A-'],
  [/b\s*加|b\+/gi, 'B+'],
  [/b\s*减|b-|b－/gi, 'B-'],
  [/(?<![a-z])a(?![+\-])/gi, 'A'],
  [/(?<![a-z])b(?![+\-])/gi, 'B'],
  [/(?<![a-z])c(?![+\-])/gi, 'C'],
  [/(?<![a-z])d(?![+\-])/gi, 'D'],
];

/** 主归一化：全角→半角、去空白标点、中文数字、同音词、等级词 */
export function normalize(raw: string): string {
  let s = raw;

  // 1) 全角 → 半角
  s = s.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  s = s.replace(/[\u3000]/g, ' ');

  // 2) 去空白与标点（保留 号 / 分 / 点 / 数字 / 字母 / +/-）
  s = s.replace(/[\s,，。、；;：:！!？?"'“”‘’（）()【】\[\]…·~～]/g, '');

  // 3) 中文数字 → 阿拉伯（八十七点五 → 87.5）
  s = convertCNNumbers(s);

  // 4) 同音词
  for (const [re, to] of HOMOPHONES) s = s.replace(re, to);

  // 5) 等级词（放在同音之后，避免「a加」被数字规则拆掉）
  for (const [re, to] of GRADE_WORDS) s = s.replace(re, to);

  // 6) 合并重复「号」
  s = s.replace(/号{2,}/g, '号');

  return s;
}

/** 数字串 → 学号（带范围纠正的最近邻，见 parse） */
export function toArabicNumber(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
