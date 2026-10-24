import { DEFAULT_PASS_RULE } from './passRule';
import type {
  GradeLetter,
  PointRule,
  ScoringScheme,
  Settings,
  SheetTemplate,
  SheetTemplateId,
  Stamp,
} from './types';

/* ---------------- 模板（设计 §4.1 SheetTemplate） ---------------- */

export const SHEET_TEMPLATES: Record<SheetTemplateId, SheetTemplate> = {
  dictation: {
    id: 'dictation',
    name: '听写默写',
    icon: '📖',
    showStatBar: false,
    showGraph: false,
    dictationQuickKeys: true,
    defaultScheme: 'check',
  },
  homework: {
    id: 'homework',
    name: '常规作业',
    icon: '📝',
    showStatBar: false,
    showGraph: false,
    dictationQuickKeys: false,
    defaultScheme: 'grade',
  },
  quality: {
    id: 'quality',
    name: '质量监测',
    icon: '📊',
    showStatBar: true,
    showGraph: true,
    dictationQuickKeys: false,
    defaultScheme: 'score',
  },
  custom: {
    id: 'custom',
    name: '自定义',
    icon: '🏷️',
    showStatBar: false,
    showGraph: false,
    dictationQuickKeys: false,
    defaultScheme: 'mixed',
  },
};

export const TEMPLATE_LIST: SheetTemplateId[] = ['dictation', 'homework', 'quality', 'custom'];

export const GRADE_ORDER: GradeLetter[] = ['A+', 'A', 'A-', 'B+', 'B', 'C', 'D'];

/** 默认等级集（PRD §2.2：常规作业默认 A+/A/A-/B/C/D；其余默认全 7 档） */
const HOMEWORK_GRADES: GradeLetter[] = ['A+', 'A', 'A-', 'B', 'C', 'D'];

/** 模板默认方案（PRD FR-17 表格） */
export const DEFAULT_SCHEMES: Record<SheetTemplateId, ScoringScheme> = {
  dictation: {
    kind: 'check',
    maxScore: null,
    grades: [...GRADE_ORDER],
    allowCheck: true,
    allowText: true,
    decimals: 0,
    excellentRate: 0.9,
    goodRate: 0.8,
    passRate: 0.6,
  },
  homework: {
    kind: 'grade',
    maxScore: null,
    grades: HOMEWORK_GRADES,
    allowCheck: true,
    allowText: true,
    decimals: 0,
    excellentRate: 0.9,
    goodRate: 0.8,
    passRate: 0.6,
  },
  quality: {
    kind: 'score',
    maxScore: 100,
    grades: [...GRADE_ORDER],
    allowCheck: false,
    allowText: true,
    decimals: 1,
    excellentRate: 0.9,
    goodRate: 0.8,
    passRate: 0.6,
  },
  custom: {
    kind: 'mixed',
    maxScore: 100,
    grades: [...GRADE_ORDER],
    allowCheck: true,
    allowText: true,
    decimals: 1,
    excellentRate: 0.9,
    goodRate: 0.8,
    passRate: 0.6,
  },
};

/** 每个模板的预设登记表 id（迁移与默认记录都用它，保证键稳定） */
export const DEFAULT_SHEET_ID: Record<SheetTemplateId, string> = {
  dictation: 'sheet_default_dictation',
  homework: 'sheet_default_homework',
  quality: 'sheet_default_quality',
  custom: 'sheet_default_custom',
};

/* ---------------- 积分默认规则（设计 §6.7.1，8 条） ---------------- */

export const DEFAULT_RULES: PointRule[] = [
  {
    id: 'rule_1',
    name: '连续3次听写全对',
    source: 'auto',
    condition: { kind: 'streak', times: 3, templateId: 'dictation' },
    delta: 5,
    freq: 'perEntry',
    enabled: true,
    builtin: true,
  },
  {
    id: 'rule_2',
    name: '课堂积极回答',
    source: 'manual',
    condition: { kind: 'manual' },
    delta: 2,
    freq: 'perEntry',
    enabled: true,
    builtin: true,
  },
  {
    id: 'rule_3',
    name: '训练优秀',
    source: 'auto',
    condition: { kind: 'tierAtLeast', tier: 'excellent' },
    delta: 3,
    freq: 'perEntry',
    enabled: true,
    builtin: true,
  },
  {
    id: 'rule_4',
    name: '错题再练全对',
    source: 'auto',
    condition: { kind: 'tierAtLeast', tier: 'pass' },
    delta: 3,
    freq: 'perEntry',
    enabled: true,
    builtin: true,
    nameMatch: '错题',
  },
  {
    id: 'rule_5',
    name: '每周拓展完成',
    source: 'manual',
    condition: { kind: 'weeklyDone', templateId: 'homework' },
    delta: 5,
    freq: 'perWeek',
    enabled: true,
    builtin: true,
  },
  {
    id: 'rule_6',
    name: '作业未完成',
    source: 'auto',
    condition: { kind: 'status', status: 'missing' },
    delta: -3,
    freq: 'perEntry',
    enabled: true,
    builtin: true,
  },
  {
    id: 'rule_7',
    name: '作业质量差',
    source: 'auto',
    condition: { kind: 'tierAtLeast', tier: 'fail' },
    delta: -1,
    freq: 'perEntry',
    enabled: true,
    builtin: true,
    // 特殊语义：仅当档位恰为 fail 时触发（见 points.ts）
    nameMatch: '=fail',
  },
  {
    id: 'rule_8',
    name: '补交',
    source: 'auto',
    condition: { kind: 'makeup' },
    delta: -2,
    freq: 'perEntry',
    enabled: true,
    builtin: true,
  },
];

/* ---------------- 常量 ---------------- */

export const STAMP_LABEL: Record<Exclude<Stamp, 'none'>, string> = {
  corrected: '已更正',
  excellent: '优秀',
};

export const STAMP_ICON: Record<Exclude<Stamp, 'none'>, string> = {
  corrected: '✅',
  excellent: '⭐',
};

export const SUBJECTS = ['语文', '数学', '英语', '科学', '道法', '音乐', '美术', '体育', '其他'];

export const MIN_STUDENTS = 1;
export const MAX_STUDENTS = 120;
export const DEFAULT_COUNT = 50;
export const HISTORY_LIMIT = 200;
export const HISTORY_WINDOW = 8;
export const UNDO_DEPTH = 30;
/** 存储上限：显示 10 字，存储 20 字（PRD FR-20） */
export const TEXT_DISPLAY = 10;
export const TEXT_MAX = 20;
export const CONTENT_MAX = 20;
export const NAME_MAX = 20;
export const MAKEUP_NOTE_MAX = 30;
export const WRAP_WIDTH = 70;
export const SCORE_MIN = 0;
export const SCORE_MAX_LIMIT = 1000;
export const STORAGE_KEY = 'xq.state.v3';
/** V2 存储键：v3 不存在时读取并迁移（不得直接删） */
export const STORAGE_KEY_V2 = 'xq.state.v2';
/** V1 存储键：最老的一代，读取时最后回落 */
export const STORAGE_KEY_V1 = 'xq.state.v1';
export const BACKUP_V1_KEY = 'xq.backup.v1';
export const BACKUP_V2_KEY = 'xq.backup.v2';
export const ENV_MARK_KEY = 'xq.env';
export const SNAPSHOT_INTERVAL = 30_000;

/** 评价语上限（V3 FR-35） */
export const COMMENT_MAX = 60;

/** 七档默认表情（V3 D-8） */
export const DEFAULT_GRADE_EMOJI: Record<GradeLetter, string> = {
  'A+': '😄',
  'A': '🙂',
  'A-': '🙂',
  'B+': '😐',
  'B': '😐',
  'C': '🙁',
  'D': '😟',
};

/** 设置里可选的表情（闭集，12 个） */
export const EMOJI_CHOICES = ['😄', '🙂', '😐', '🙁', '😟', '😢', '😮', '😎', '🏆', '🌟', '👍', '💪'];

export const DEFAULT_SETTINGS: Settings = {
  secondsJump: true,
  showName: false,
  honorIncludesA: false,
  voiceEnabled: true,
  voiceAutoConfirmMs: 1500,
  theme: 'auto',
  passRule: DEFAULT_PASS_RULE,
  gradeEmoji: DEFAULT_GRADE_EMOJI,
  showEmoji: true,
  defaultComment: '',
  showSchoolInPoster: false,
  autoBackupDays: 7,
  digitKey: 'auto',
};

/** 报表分隔线（恰好 25 个半角连字符） */
export const REPORT_SEP = '-'.repeat(25);

/** 方案类型显示名 */
export const SCHEME_LABEL: Record<ScoringScheme['kind'], string> = {
  grade: '等级制',
  score: '分数制',
  check: '过关制',
  mixed: '混合制',
  text: '纯文本',
};

export const TIER_LABEL = {
  excellent: '优秀',
  good: '良好',
  pass: '及格',
  fail: '不及格',
} as const;
