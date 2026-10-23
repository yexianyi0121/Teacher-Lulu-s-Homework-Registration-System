import type { Grade, Stamp } from './types';

export interface VoiceEdit {
  no: number;
  action:
    | { type: 'grade'; grade: Grade }
    | { type: 'score'; score: number }
    | { type: 'stamp'; stamp: Exclude<Stamp, 'none'> }
    | { type: 'text'; text: string }
    | { type: 'clear' };
}

const DIGIT: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 中文数字转阿拉伯数字（支持 0–120，PRD BR-31） */
export function toArabic(s: string): number | null {
  if (/^[0-9]+$/.test(s)) return Number(s);
  if (s === '一百') return 100;
  if (!s) return null;

  let section = 0;
  let current = 0;

  for (const ch of s) {
    if (ch === '百') {
      section += (current || 1) * 100;
      current = 0;
    } else if (ch === '十') {
      section += (current || 1) * 10;
      current = 0;
    } else if (ch in DIGIT) {
      current = DIGIT[ch];
    } else {
      return null;
    }
  }

  const result = section + current;
  return result > 0 ? result : null;
}

/** 归一化：全角→半角、去空白、加→+、减→- */
function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/\s+/g, '')
    .replace(/加/g, '+')
    .replace(/减/g, '-');
}

const CN_NUM = '零一二三四五六七八九十百两';

function parseAction(s: string): VoiceEdit['action'] | null {
  // 优先级严格按设计 §6.8.3
  if (/取消|清除|不要/.test(s)) return { type: 'clear' };
  if (/优秀|很棒|全对/.test(s)) return { type: 'stamp', stamp: 'excellent' };
  if (/已更正|更正|订正好的/.test(s)) return { type: 'stamp', stamp: 'corrected' };
  if (/A\+|甲\+/.test(s)) return { type: 'grade', grade: 'A+' };
  if (/A-/.test(s)) return { type: 'grade', grade: 'A-' };

  const scoreMatch = s.match(new RegExp(`([0-9]+(?:\\.[0-9])?|[${CN_NUM}]+)分`));
  if (scoreMatch) {
    const v = toArabic(scoreMatch[1]);
    if (v !== null) return { type: 'score', score: Math.min(100, Math.max(0, v)) };
  }

  const errMatch = s.match(new RegExp(`错\\s*([0-9]+|[${CN_NUM}]+)`));
  if (errMatch) {
    const v = toArabic(errMatch[1]);
    if (v !== null) return { type: 'text', text: `错${v}` };
  }

  return null;
}

/**
 * 语音语义解析（设计 §6.8.3，【必须】纯函数）
 * 支持一句多号；越界学号直接丢弃。
 */
export function parseUtterance(text: string, n: number): VoiceEdit[] {
  const s = normalize(text);
  const nums: number[] = [];
  const re = new RegExp(`([0-9]+|[${CN_NUM}]+)号`, 'g');

  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const v = toArabic(m[1]);
    if (v !== null) nums.push(v);
  }

  if (nums.length === 0) return [];

  const action = parseAction(s);
  if (!action) return [];

  const seen = new Set<number>();
  const edits: VoiceEdit[] = [];
  for (const no of nums) {
    if (no < 1 || no > n || seen.has(no)) continue;
    seen.add(no);
    edits.push({ no, action });
  }
  return edits;
}
