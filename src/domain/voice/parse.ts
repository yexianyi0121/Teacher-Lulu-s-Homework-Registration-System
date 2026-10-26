import type { CellValue, EntryStatus, ScoringScheme, Stamp } from '../types';
import { normalize } from './normalize';
import { simWord } from './phonetics';
import { schemeAllowsGrade, schemeAllowsScore } from '../scoring';
import { gradeAllowed } from '../grading';

/**
 * 语音槽位解析（设计 04 §6.8.5）—— 纯函数，闭集优先（L-4）。
 * 输入是归一化后的候选串，输出是「学号 + 动作 / 值」。
 */

export const ACTIONS = [
  '全对', '错1', '错2', '错3', '错4', '错5', '错6', '错7', '错8', '错9',
  '过关', '不过关', '缺交', '请假', '补交', '已更正', '优秀',
  'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D',
  '清空', '撤销',
] as const;

export type Action = (typeof ACTIONS)[number];

export interface VoiceCommand {
  no: number;
  action: Action | null;
  value: CellValue | null;
  status?: EntryStatus;
  pass?: boolean;
  stamp?: Stamp;
  makeup?: boolean;
  conf: 'exact' | 'fuzzy';
  /** 同号后者覆盖前者时，前者标 true */
  overwritten?: boolean;
  raw: string;
}

export interface VoiceIssue {
  no: number;
  reason: 'range' | 'scheme' | 'unknown';
  text: string;
}

export interface ParseCtx {
  n: number;
  scheme: ScoringScheme;
  focusNo?: number | null;
}

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'] as const;

function matchAction(text: string): { action: Action; conf: 'exact' | 'fuzzy' } | null {
  const t = text.trim();
  if (!t) return null;
  if ((ACTIONS as readonly string[]).includes(t)) return { action: t as Action, conf: 'exact' };

  let best: Action | null = null;
  let bestScore = 0;
  let tie = false;
  for (const a of ACTIONS) {
    if (a === t) continue;
    const s = simWord(t, a);
    if (s > bestScore) {
      bestScore = s;
      best = a;
      tie = false;
    } else if (s === bestScore) {
      tie = true;
    }
  }
  if (best && bestScore >= 0.6 && !tie) return { action: best, conf: 'fuzzy' };
  return null;
}

const CN_ERR = /^错([1-9])$/;

function buildCommand(
  no: number,
  text: string,
  ctx: ParseCtx,
): { cmd: VoiceCommand | null; issue?: VoiceIssue } {
  const t = text.trim();
  const base: VoiceCommand = {
    no,
    action: null,
    value: null,
    conf: 'exact',
    raw: t,
  };

  // 1) 分数：「98分」「87.5分」
  const scoreMatch = t.match(/^(\d{1,3}(?:\.\d)?)分?$/);
  if (scoreMatch && (t.includes('分') || ctx.scheme.kind === 'score')) {
    const v = Number(scoreMatch[1]);
    if (!schemeAllowsScore(ctx.scheme)) {
      return { cmd: null, issue: { no, reason: 'scheme', text: `本表只接受等级，已忽略「${t}」` } };
    }
    const max = ctx.scheme.maxScore ?? 100;
    if (v < 0 || v > max) {
      return { cmd: null, issue: { no, reason: 'scheme', text: `超出满分 ${max}，已忽略「${t}」` } };
    }
    return { cmd: { ...base, value: { kind: 'score', score: v } } };
  }

  // 2) 动作词
  const hit = matchAction(t);
  if (!hit) {
    // 纯数字但方案是等级制 → 提示说「X号」
    if (/^\d+$/.test(t) && !schemeAllowsScore(ctx.scheme)) {
      return { cmd: null, issue: { no, reason: 'unknown', text: '请说「X号 + 动作」' } };
    }
    return { cmd: null, issue: { no, reason: 'unknown', text: `没听懂「${t}」` } };
  }

  const { action, conf } = hit;
  const cmd: VoiceCommand = { ...base, action, conf };

  // 3) 等级
  if ((GRADES as readonly string[]).includes(action)) {
    if (!schemeAllowsGrade(ctx.scheme) || !gradeAllowed(action as (typeof GRADES)[number], ctx.scheme)) {
      return { cmd: null, issue: { no, reason: 'scheme', text: `本表不接受等级 ${action}` } };
    }
    return { cmd: { ...cmd, value: { kind: 'grade', grade: action as (typeof GRADES)[number] } } };
  }

  switch (action) {
    case '全对':
      if (ctx.scheme.kind === 'check' || ctx.scheme.allowCheck) {
        return { cmd: { ...cmd, pass: true } };
      }
      return { cmd: { ...cmd, value: { kind: 'text', text: '全对' } } };
    case '过关':
      return { cmd: { ...cmd, pass: true } };
    case '不过关':
      return { cmd: { ...cmd, pass: false } };
    case '缺交':
      return { cmd: { ...cmd, status: 'missing' } };
    case '请假':
      return { cmd: { ...cmd, status: 'leave' } };
    case '补交':
      return { cmd: { ...cmd, makeup: true } };
    case '已更正':
      return { cmd: { ...cmd, stamp: 'corrected' } };
    case '优秀':
      // 歧义表：等级制给 A+（若允许），否则只盖优秀章
      if (schemeAllowsGrade(ctx.scheme) && gradeAllowed('A+', ctx.scheme)) {
        return { cmd: { ...cmd, action: 'A+', value: { kind: 'grade', grade: 'A+' }, stamp: 'excellent' } };
      }
      return { cmd: { ...cmd, stamp: 'excellent' } };
    case '清空':
      return { cmd: { ...cmd, value: null, status: 'normal', pass: false } };
    case '撤销':
      return { cmd };
    default: {
      const m = action.match(CN_ERR);
      if (m) {
        if (!ctx.scheme.allowText && ctx.scheme.kind !== 'check') {
          return { cmd: null, issue: { no, reason: 'scheme', text: '本表不接受听写文本' } };
        }
        return { cmd: { ...cmd, value: { kind: 'text', text: `错${m[1]}` } } };
      }
      return { cmd: null, issue: { no, reason: 'unknown', text: `没听懂「${t}」` } };
    }
  }
}

/** 学号范围纠正：越界时尝试 ±1 最近邻（唯一才接受） */
function fixNo(no: number, ctx: ParseCtx): { no: number | null; fuzzy: boolean } {
  if (no >= 1 && no <= ctx.n) return { no, fuzzy: false };
  const candidates = [no - 1, no + 1].filter((x) => x >= 1 && x <= ctx.n);
  if (candidates.length === 1) return { no: candidates[0], fuzzy: true };
  return { no: null, fuzzy: false };
}

export function parseVoiceReport(text: string, ctx: ParseCtx): { commands: VoiceCommand[]; issues: VoiceIssue[] } {
  const normalized = normalize(text);
  const commands: VoiceCommand[] = [];
  const issues: VoiceIssue[] = [];

  const re = /(\d{1,3})号/g;
  const matches = [...normalized.matchAll(re)];

  if (matches.length === 0) {
    const no = ctx.focusNo ?? null;
    if (no === null) {
      issues.push({ no: 0, reason: 'unknown', text: '请说「学号 + 动作」，例如「12号优秀」' });
      return { commands, issues };
    }
    const { cmd, issue } = buildCommand(no, normalized, ctx);
    if (cmd) commands.push(cmd);
    if (issue) issues.push(issue);
    return { commands, issues };
  }

  matches.forEach((m, i) => {
    const rawNo = Number(m[1]);
    const { no, fuzzy } = fixNo(rawNo, ctx);
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
    const chunk = normalized.slice(start, end);

    if (no === null) {
      issues.push({ no: rawNo, reason: 'range', text: `超出学号范围（1–${ctx.n}）` });
      return;
    }
    const { cmd, issue } = buildCommand(no, chunk, ctx);
    if (cmd) {
      commands.push({ ...cmd, conf: fuzzy ? 'fuzzy' : cmd.conf });
    }
    if (issue) issues.push({ ...issue, no });
  });

  // 同号去重：后者覆盖前者（并在 UI 标「覆盖」）
  const lastIndex = new Map<number, number>();
  commands.forEach((c, i) => lastIndex.set(c.no, i));
  const deduped = commands.filter((c, i) => {
    const keep = lastIndex.get(c.no) === i;
    if (!keep) c.overwritten = true;
    return keep;
  });

  deduped.sort((a, b) => a.no - b.no);
  return { commands: deduped, issues };
}

export function parseVoice(text: string, ctx: ParseCtx): VoiceCommand[] {
  return parseVoiceReport(text, ctx).commands;
}
