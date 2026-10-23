import type {
  Entry,
  HistoryEntry,
  PassRule,
  PointLedgerEntry,
  PointRule,
  RecordDoc,
  RuleCondition,
  SheetTemplateId,
  Tier,
} from './types';
import { tierOf } from './scoring';
import { DEFAULT_PASS_RULE, isPassed } from './passRule';
import { uid } from '../utils/id';

/**
 * 积分引擎（设计 04 §6.7）—— 纯函数。
 * 账本只追加（INV-10）；自动规则用 dedupeKey 幂等（INV-4）。
 */

const TIER_ORDER: Record<Tier, number> = { fail: 0, pass: 1, good: 2, excellent: 3 };

/** ISO 周（`YYYY-Www`），手写，不引 dayjs */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  const day = d.getUTCDay() || 7;              // 周一=1..周日=7
  d.setUTCDate(d.getUTCDate() + 4 - day);      // 移到本周四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function dedupeKeyOf(
  rule: PointRule,
  classId: string,
  studentNo: number,
  recordKey: string,
  date: string,
): string {
  const scope =
    rule.freq === 'perEntry' ? recordKey
      : rule.freq === 'perDay' ? date
        : rule.freq === 'perWeek' ? isoWeek(date)
          : 'once';
  // 档位类规则（训练优秀 / 错题再练 / 质量差）互斥：一条登记只认第一次命中的档位
  const bucket = rule.condition.kind === 'tierAtLeast' ? 'tier' : rule.id;
  return `${classId}|${studentNo}|${bucket}|${scope}`;
}

export interface EvaluateInput {
  entry: Entry;
  passRule?: PassRule;
  studentNo: number;
  record: Pick<RecordDoc, 'key' | 'classId' | 'date' | 'content' | 'templateId' | 'scheme'>;
  /** 同班同模板的历史，按日期降序（不含本次） */
  prevRecords: HistoryEntry[];
  rules: PointRule[];
  ledger: PointLedgerEntry[];
  date: string;
  now?: number;
}

function streakHit(input: EvaluateInput, times: number, templateId: SheetTemplateId): boolean {
  const { record, studentNo, prevRecords } = input;
  const rule = input.passRule ?? DEFAULT_PASS_RULE;
  if (record.templateId !== templateId) return false;
  if (!isPassed(input.entry, record.scheme, rule)) return false;

  const prev = prevRecords
    .filter((h) => h.templateId === templateId && h.date < record.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, Math.max(0, times - 1));

  if (prev.length < times - 1) return false;
  return prev.every((h) => {
    const e = h.entries[String(studentNo)];
    if (!e) return false;
    // 用历史记录自己的方案判定（方案是快照，§16-7）
    return isPassed(e, h.scheme, rule);
  });
}

function hitRule(input: EvaluateInput, rule: PointRule): boolean {
  const { entry, record } = input;
  const c = rule.condition;

  switch (c.kind) {
    case 'tierAtLeast': {
      if (rule.nameMatch === '=fail') {
        return tierOf(entry, record.scheme) === 'fail';
      }
      if (rule.nameMatch && !record.content.includes(rule.nameMatch)) return false;
      const t = tierOf(entry, record.scheme);
      if (!t) return false;
      return TIER_ORDER[t] >= TIER_ORDER[c.tier];
    }
    case 'status':
      return entry.status === c.status;
    case 'makeup':
      return entry.makeup !== null;
    case 'streak':
      return streakHit(input, c.times, c.templateId);
    case 'weeklyDone':
    case 'manual':
      return false;   // 手动规则不自动评估
  }
}

/** 评估一名学生一次登记应产生的账本行（0..n 行，确定性顺序） */
export function evaluatePoints(input: EvaluateInput): PointLedgerEntry[] {
  const { rules, ledger, record, studentNo, date } = input;
  const now = input.now ?? 0;
  const out: PointLedgerEntry[] = [];
  const seen = new Set(ledger.map((x) => x.dedupeKey));

  for (const rule of [...rules].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!rule.enabled || rule.source !== 'auto' || rule.delta === 0) continue;
    if (!hitRule(input, rule)) continue;

    const key = dedupeKeyOf(rule, record.classId, studentNo, record.key, date);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: uid('pt'),
      classId: record.classId,
      studentNo,
      date,
      ruleId: rule.id,
      delta: rule.delta,
      reason: rule.name,
      source: 'auto',
      dedupeKey: key,
      createdAt: now,
    });
  }
  return out;
}

/** 撤销一条积分：追加反向行（不删原行，INV-10） */
export function revokePoint(
  ledger: PointLedgerEntry[],
  id: string,
  now: number,
): PointLedgerEntry[] {
  const src = ledger.find((x) => x.id === id);
  if (!src || src.source === 'revert') return ledger;
  if (ledger.some((x) => x.revertedId === id)) return ledger;   // 已撤销过，不重复
  return [
    ...ledger,
    {
      ...src,
      id: uid('pt'),
      delta: -src.delta,
      source: 'revert',
      revertedId: src.id,
      reason: `撤销：${src.reason}`,
      createdAt: now,
      dedupeKey: `${src.dedupeKey}#rev#${now}`,
    },
  ];
}

/** 手动给分（必填理由） */
export function manualAward(args: {
  classId: string;
  studentNo: number;
  date: string;
  delta: number;
  reason: string;
  ruleId?: string | null;
  now: number;
}): PointLedgerEntry {
  return {
    id: uid('pt'),
    classId: args.classId,
    studentNo: args.studentNo,
    date: args.date,
    ruleId: args.ruleId ?? null,
    delta: Math.max(-10, Math.min(10, Math.round(args.delta))) || 0,
    reason: args.reason.slice(0, 24),
    source: 'manual',
    dedupeKey: `manual|${args.classId}|${args.studentNo}|${args.now}|${uid('k')}`,
    createdAt: args.now,
  };
}

/* ---------------- 月度统计（§6.7.5） ---------------- */

export interface MonthRow {
  no: number;
  name?: string;
  sessions: number;
  qualified: number;
  missing: number;
  leave: number;
  madeUp: number;
  points: number;
  rank: number;
}

export interface MonthStats {
  rows: MonthRow[];
  total: number;
  avg: number;
  top: number;
  qualifiedRate: number;
}

export function monthStats(args: {
  history: HistoryEntry[];
  ledger: PointLedgerEntry[];
  classId: string;
  month: string;                  // 'YYYY-MM'
  n: number;
  names?: Record<number, string | undefined>;
  passRule?: PassRule;
}): MonthStats {
  const { history, ledger, classId, month, n, names } = args;
  const passRule = args.passRule ?? DEFAULT_PASS_RULE;
  const inMonth = history.filter((h) => h.classId === classId && h.date.startsWith(month));

  const rows: MonthRow[] = [];
  for (let no = 1; no <= n; no++) {
    let sessions = 0;
    let qualified = 0;
    let missing = 0;
    let leave = 0;
    let madeUp = 0;

    for (const h of inMonth) {
      const e = h.entries[String(no)];
      if (!e) continue;
      if (e.status === 'leave') { leave++; continue; }
      sessions++;
      if (e.status === 'missing') missing++;
      if (e.makeup) madeUp++;
      if (isPassed(e, h.scheme, passRule)) qualified++;
    }

    const points = ledger
      .filter((x) => x.classId === classId && x.studentNo === no && x.date.startsWith(month))
      .reduce((sum, x) => sum + x.delta, 0);

    rows.push({ no, name: names?.[no], sessions, qualified, missing, leave, madeUp, points, rank: 0 });
  }

  // 稳定排序：积分降序，同分按学号升序（显式比较，不依赖 sort 稳定性）
  const sorted = [...rows].sort((a, b) => (b.points - a.points) || (a.no - b.no));
  sorted.forEach((r, i) => { r.rank = i + 1; });
  // 让调用方拿到「有活动或有点数」的行
  const meaningful = sorted.filter((r) => r.sessions > 0 || Math.abs(r.points) > 0.0001);

  const total = meaningful.reduce((s, r) => s + r.points, 0);
  const qualifiedTotal = meaningful.reduce((s, r) => s + r.qualified, 0);
  const sessionsTotal = meaningful.reduce((s, r) => s + r.sessions, 0);
  const top = meaningful.length ? Math.max(...meaningful.map((r) => r.points)) : 0;

  return {
    rows: sorted,
    total,
    avg: meaningful.length ? Math.round((total / meaningful.length) * 10) / 10 : 0,
    top,
    qualifiedRate: sessionsTotal ? Math.round((qualifiedTotal / sessionsTotal) * 1000) / 1000 : 0,
  };
}

/** 某学生某月的积分合计（网格角标/详情用） */
export function pointsOf(
  ledger: PointLedgerEntry[],
  classId: string,
  no: number,
  month?: string,
): number {
  return ledger
    .filter((x) => x.classId === classId && x.studentNo === no && (!month || x.date.startsWith(month)))
    .reduce((s, x) => s + x.delta, 0);
}


/* ---------------- 自定义规则（V3 FR-41） ---------------- */

/** 条件的稳定签名：用于「同条件 + 同频率」去重 */
export function conditionKey(c: RuleCondition): string {
  switch (c.kind) {
    case 'tierAtLeast': return `tier:${c.tier}`;
    case 'streak': return `streak:${c.times}:${c.templateId}`;
    case 'status': return `status:${c.status}`;
    case 'makeup': return 'makeup';
    case 'weeklyDone': return `weekly:${c.templateId}`;
    case 'manual': return 'manual';
  }
}

/** 新建/编辑规则校验；返回 null 表示合法 */
export function validateRule(rule: PointRule, existing: PointRule[]): string | null {
  const name = rule.name.trim();
  if (!name) return '规则名不能为空';
  if (name.length > 16) return '规则名最多 16 字';
  if (!Number.isInteger(rule.delta) || rule.delta === 0) return '分值必须是非 0 整数';
  if (rule.delta < -10 || rule.delta > 10) return '分值需在 −10 ~ +10 之间';
  if (existing.some((r) => r.id !== rule.id && r.name.trim() === name)) return '规则名重复';
  const key = conditionKey(rule.condition);
  if (existing.some((r) => r.id !== rule.id && r.freq === rule.freq && conditionKey(r.condition) === key)) {
    return '相同条件与频率的规则已存在';
  }
  return null;
}

/**
 * 删除自定义规则：不改历史账本，只追加冲正行（INV-10 / BR-73）。
 * 每个受影响的学号一条，dedupeKey 带学号，保证可重复调用而不重复冲正。
 */
export function revertRuleLedger(
  ledger: PointLedgerEntry[],
  ruleId: string,
  now: number,
): PointLedgerEntry[] {
  const sums = new Map<number, number>();
  for (const x of ledger) {
    if (x.ruleId !== ruleId || x.source === 'revert') continue;
    sums.set(x.studentNo, (sums.get(x.studentNo) ?? 0) + x.delta);
  }
  const out: PointLedgerEntry[] = [];
  for (const [studentNo, sum] of sums) {
    if (sum === 0) continue;
    const any = ledger.find((x) => x.ruleId === ruleId && x.studentNo === studentNo);
    if (!any) continue;
    const dedupeKey = `revert|${ruleId}|${studentNo}`;
    if (ledger.some((x) => x.dedupeKey === dedupeKey)) continue;
    out.push({
      id: uid('pt'),
      classId: any.classId,
      studentNo,
      date: any.date,
      ruleId,
      delta: -sum,
      reason: '规则删除冲正',
      source: 'revert',
      dedupeKey,
      createdAt: now,
    });
  }
  return [...ledger, ...out];
}
