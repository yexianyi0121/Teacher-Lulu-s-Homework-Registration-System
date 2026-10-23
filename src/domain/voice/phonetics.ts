/**
 * 拼音近似表（设计 04 §8.4 / ADR-17）—— 手写，不引 pinyin-pro。
 * 只覆盖闭集词表里出现的字 + 常见同音字，约 200 字（< 4KB）。
 */

export interface Py { sm: string; ym: string }

const TABLE: Record<string, Py> = {
  全: { sm: 'q', ym: 'uan' }, 对: { sm: 'd', ym: 'ui' }, 兑: { sm: 'd', ym: 'ui' },
  队: { sm: 'd', ym: 'ui' }, 劝: { sm: 'q', ym: 'uan' }, 泉: { sm: 'q', ym: 'uan' },
  错: { sm: 'c', ym: 'uo' }, 措: { sm: 'c', ym: 'uo' },
  过: { sm: 'g', ym: 'uo' }, 关: { sm: 'g', ym: 'uan' }, 官: { sm: 'g', ym: 'uan' },
  光: { sm: 'g', ym: 'uang' }, 果: { sm: 'g', ym: 'uo' },
  缺: { sm: 'q', ym: 'ue' }, 交: { sm: 'j', ym: 'iao' }, 教: { sm: 'j', ym: 'iao' },
  补: { sm: 'b', ym: 'u' }, 不: { sm: 'b', ym: 'u' }, 步: { sm: 'b', ym: 'u' },
  请: { sm: 'q', ym: 'ing' }, 假: { sm: 'j', ym: 'ia' }, 驾: { sm: 'j', ym: 'ia' },
  架: { sm: 'j', ym: 'ia' }, 清: { sm: 'q', ym: 'ing' }, 空: { sm: 'k', ym: 'ong' },
  优: { sm: 'y', ym: 'ou' }, 秀: { sm: 'x', ym: 'iu' }, 绣: { sm: 'x', ym: 'iu' },
  修: { sm: 'x', ym: 'iu' }, 已: { sm: 'y', ym: 'i' }, 以: { sm: 'y', ym: 'i' },
  衣: { sm: 'y', ym: 'i' }, 更: { sm: 'g', ym: 'eng' }, 耕: { sm: 'g', ym: 'eng' },
  正: { sm: 'zh', ym: 'eng' }, 整: { sm: 'zh', ym: 'eng' }, 政: { sm: 'zh', ym: 'eng' },
  满: { sm: 'm', ym: 'an' }, 分: { sm: 'f', ym: 'en' }, 份: { sm: 'f', ym: 'en' },
  号: { sm: 'h', ym: 'ao' }, 好: { sm: 'h', ym: 'ao' }, 浩: { sm: 'h', ym: 'ao' },
  撤: { sm: 'ch', ym: 'e' }, 销: { sm: 'x', ym: 'iao' }, 消: { sm: 'x', ym: 'iao' },
  等: { sm: 'd', ym: 'eng' }, 级: { sm: 'j', ym: 'i' }, 加: { sm: 'j', ym: 'ia' },
  佳: { sm: 'j', ym: 'ia' }, 嘉: { sm: 'j', ym: 'ia' }, 减: { sm: 'j', ym: 'ian' },
  检: { sm: 'j', ym: 'ian' }, 未: { sm: 'w', ym: 'ei' }, 为: { sm: 'w', ym: 'ei' },
  无: { sm: 'w', ym: 'u' }, 五: { sm: 'w', ym: 'u' },
};

export function pyOf(ch: string): Py | null {
  return TABLE[ch] ?? null;
}

/** 单字相似度：声母+韵母全同 1.0；其一相同 0.5；都不同 0（非表内字只比字形） */
export function simChar(a: string, b: string): number {
  if (a === b) return 1;
  const pa = pyOf(a);
  const pb = pyOf(b);
  if (!pa || !pb) return 0;
  const smSame = pa.sm === pb.sm;
  const ymSame = pa.ym === pb.ym;
  if (smSame && ymSame) return 1;
  if (smSame || ymSame) return 0.5;
  return 0;
}

/**
 * 词相似度：编辑距离变体（替换代价 = 1 - simChar，插入/删除 0.8），
 * 归一化后 1 - dist / max(len)。≥ 0.6 才视为候选（保守阈值，L-4 闭集优先）。
 */
export function simWord(a: string, b: string): number {
  const s = a.trim();
  const t = b.trim();
  if (!s || !t) return 0;
  if (s === t) return 1;

  const A = [...s];
  const B = [...t];
  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = 0; i <= A.length; i++) dp[i][0] = i * 0.8;
  for (let j = 0; j <= B.length; j++) dp[0][j] = j * 0.8;

  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      const sub = dp[i - 1][j - 1] + (1 - simChar(A[i - 1], B[j - 1]));
      const del = dp[i - 1][j] + 0.8;
      const ins = dp[i][j - 1] + 0.8;
      dp[i][j] = Math.min(sub, del, ins);
    }
  }

  const dist = dp[A.length][B.length];
  const maxLen = Math.max(A.length, B.length);
  return Math.max(0, 1 - dist / maxLen);
}
