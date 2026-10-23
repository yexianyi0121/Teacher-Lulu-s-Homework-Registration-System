// V2 数据模型（设计 04 §4.1，【必须】逐字照抄；两处放宽见注释）
// 与 V1 的差异：值/状态/过关/补交四维正交；等级 7 档；方案决定值域；多班级；积分账本。

// ---------- 取值 ----------
export type GradeLetter = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C' | 'D';

/** 折算百分。唯一准据，禁止在别处出现等级→百分的映射表（设计 §4.1 / ADR-13） */
export const GRADE_PERCENT: Record<GradeLetter, number> = {
  'A+': 100, 'A': 95, 'A-': 90,
  'B+': 85,  'B': 80,
  'C': 70,
  'D': 55,
};

export type CellValue =
  | { kind: 'grade'; grade: GradeLetter }
  | { kind: 'score'; score: number }   // 0..maxScore
  | { kind: 'text';  text: string }    // ≤ 12 字（显示截断见 Cell）
  | { kind: 'pass' };                  // 纯过关（无分值）

export type EntryStatus = 'normal' | 'missing' | 'leave';

export type Stamp = 'none' | 'corrected' | 'excellent';

export interface Makeup { at: number; note: string }   // note ≤ 30 字，可空串

export interface Entry {
  value: CellValue | null;
  stamp: Stamp;
  status: EntryStatus;          // 'missing' 时 value 必须为 null
  pass: boolean;                // 过关勾；check 方案下的主值，也可与 grade 共存
  makeup: Makeup | null;
  updatedAt: number;
}

export type Entries = Record<string, Entry>;   // 键 '1'..'120'

// ---------- 计分方案 ----------
export type SchemeKind = 'grade' | 'score' | 'check' | 'mixed' | 'text';

export interface ScoringScheme {
  kind: SchemeKind;
  maxScore: number | null;        // score/mixed 必填，10..1000，默认 100
  grades: GradeLetter[];          // grade/mixed 可用等级集，默认全 7 档
  allowCheck: boolean;            // 是否允许 √（仅混合/过关制）
  allowText: boolean;             // 是否允许自定义文字
  decimals: number;               // 0 | 1，分数小数位
  excellentRate: number;          // 0-1，默认 .90
  goodRate: number;               // 默认 .80
  passRate: number;               // 默认 .60
}

export type Tier = 'excellent' | 'good' | 'pass' | 'fail';

// ---------- 过关规则（V3 设计 06 §2.1 / §3.1） ----------
export type PassRuleKind = 'percent' | 'grade' | 'mixed';

export interface PassRule {
  kind: PassRuleKind;
  /** 仅 grade / mixed 生效；默认 ['A+','A'] */
  gradePass: GradeLetter[];
  /** 默认 true：听写「全对/错0」自动算过关 */
  dictationAutoPass: boolean;
}

/** 汇总目标（取代 V2 的 posterMode，V3 设计 06 §3.6） */
export type PosterTarget =
  | { mode: 'single'; sheetId: string }
  | { mode: 'daily' }
  | { mode: 'week'; weekStart: string };


// ---------- 模板 ----------
export type SheetTemplateId = 'homework' | 'dictation' | 'quality' | 'custom';

export interface SheetTemplate {
  id: SheetTemplateId;
  name: string;                  // 常规作业 / 听写默写 / 质量监测 / 自定义
  icon: string;                  // ✍️ / 📝 / 💯 / 🏷️
  showStatBar: boolean;          // quality=true
  showGraph: boolean;            // quality=true
  dictationQuickKeys: boolean;   // 错N 快捷
  defaultScheme: SchemeKind;
}

// ---------- 班级 ----------
export interface Student { no: number; name?: string }

export interface ClassDoc {
  id: string;                    // `cls_` + nanoid(8)
  name: string;                  // ≤ 20 字
  school: string;
  teacher: string;
  subject: string;
  students: Student[];           // length === count（INV-9）
  count: number;                 // 1..120
  createdAt: number;
}

// ---------- 记录 ----------
export interface RecordDoc {
  key: string;                   // `${classId}|${date}|${content}|${sheetId}`
  classId: string;
  date: string;                  // 'YYYY-MM-DD'
  content: string;
  sheetId: string;               // `sheet_` + id，或模板预设 id
  templateId: SheetTemplateId;
  scheme: ScoringScheme;         // ★ 方案快照：改方案不影响历史
  entries: Entries;
  /** 本表评价语（≤ 60 字，V3 FR-35；空串表示沿用默认） */
  comment?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry extends RecordDoc {
  metrics: SessionMetrics;
  // 设计 §4.1 写作字面量 2；§4.6.5 要求旧历史可标记为 1，故放宽为 1 | 2
  metricsVersion: 1 | 2;
  savedAt: number;
}

export interface SessionMetrics {
  n: number; entered: number;
  excellent: number; good: number; pass: number; fail: number;
  missing: number; leave: number; madeUp: number; notSubmitted: number;
  avgPercent: number | null; avgScore: number | null;
  excellentRate: number | null; qualifiedRate: number | null;
  passCount: number;
  max: number | null; min: number | null;
}

export interface RosterGroups {
  honor: number[];        // 光荣榜（等级秩≥A，或分数 percent≥优秀线）
  needsFix: number[];     // 需更正（含子集 corrected）
  corrected: number[];    // needsFix 中已盖「已更正」的子集
  notSubmitted: number[]; // 空白 + 缺交（无补交）
  leave: number[];        // 请假
  passed: number[];       // pass=true（过关制）
  madeUp: number[];       // 有补交记录的人（可与 honor/needsFix 重叠）
}

// ---------- 积分 ----------
export interface PointRule {
  id: string;                     // `rule_` + n
  name: string;                   // ≤ 16 字
  source: 'auto' | 'manual';
  condition: RuleCondition;
  delta: number;                  // -10..+10，非 0
  freq: 'perEntry' | 'perDay' | 'perWeek' | 'once';
  enabled: boolean;
  builtin: boolean;               // 内置 8 条不可删除，只能停用/改分
  nameMatch?: string;             // 规则 4 的「内容含错题」补充条件
}

export type RuleCondition =
  | { kind: 'tierAtLeast'; tier: Tier }              // 本次登记 ≥ 某档
  | { kind: 'streak'; times: number; templateId: SheetTemplateId }  // 连续 N 次达标
  | { kind: 'status'; status: EntryStatus }
  | { kind: 'makeup' }                               // 触发一次补交
  | { kind: 'weeklyDone'; templateId: SheetTemplateId }
  | { kind: 'manual' };

export interface PointLedgerEntry {
  id: string;
  classId: string;
  studentNo: number;
  date: string;                   // 归属日期（= 登记日期）
  ruleId: string | null;
  delta: number;
  reason: string;                 // ≤ 24 字，展示用
  source: 'auto' | 'manual' | 'revert';
  dedupeKey: string;              // 见 §6.7.3
  revertedId?: string;
  createdAt: number;
}

// ---------- 设置 ----------
export interface Settings {
  secondsJump: boolean;
  showName: boolean;
  honorIncludesA: boolean;
  voiceEnabled: boolean;
  voiceAutoConfirmMs: number;     // 回显自动确认延时，默认 1500
  theme: 'auto' | 'light';
  // ---- V3 新增 ----
  passRule: PassRule;
  gradeEmoji: Record<GradeLetter, string>;
  showEmoji: boolean;
  defaultComment: string;         // 默认评价语，≤ 60 字
  showSchoolInPoster: boolean;    // 默认 false（替代原 Designed by）
  autoBackupDays: number;         // 0 = 关闭；默认 7（仅提醒）
}

// ---------- 持久化根 ----------
export interface PersistedStateV2 {
  version: 2;
  activeClassId: string;
  classes: ClassDoc[];
  records: RecordDoc[];
  history: HistoryEntry[];
  pointRules: PointRule[];
  pointLedger: PointLedgerEntry[];
  settings: Settings;
  lastSavedAt: number;
}

/** V3 持久化根（设计 06 §2.1；history 保留 HistoryEntry 以保住指标快照） */
export interface PersistedStateV3 {
  version: 3;
  activeClassId: string;
  classes: ClassDoc[];
  records: RecordDoc[];
  history: HistoryEntry[];
  pointRules: PointRule[];
  pointLedger: PointLedgerEntry[];
  settings: Settings;
  lastSavedAt: number;
}

/** 单元格视觉色调（沿用 V1 语义，供 CSS 的 data-tone 使用） */
export type CellTone = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'empty';

/** V1 持久化结构（仅迁移用，不参与运行时） */
export interface V1CellValue {
  kind: string;
  grade?: string;
  score?: number;
  text?: string;
}

export interface V1Entry {
  value: V1CellValue | null;
  stamp: Stamp;
  updatedAt: number;
}

export interface V1Record {
  id: string;
  date: string;
  content: string;
  mode: 'homework' | 'quiz' | 'dictation';
  entries: Record<string, V1Entry>;
  createdAt: number;
  updatedAt: number;
}

export interface V1Metrics {
  entered: number; avg: number | null; excellent: number; good: number;
  pass: number; fail: number; excellentRate: number | null;
  corrected: number; notSubmitted: number; max: number | null; min: number | null;
}

export interface PersistedStateV1 {
  version: 1;
  classInfo: {
    id?: string; name: string; school: string; teacher: string; subject: string;
    students: Student[]; count: number;
  };
  drafts: Record<string, V1Record>;
  activeKey: string;
  history: Array<V1Record & { metrics: V1Metrics; savedAt: number }>;
  settings: {
    count: number; secondsJump: boolean; showName: boolean;
    excellentLine: number; passLine: number; honorIncludesA?: boolean;
  };
}
