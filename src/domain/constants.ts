import type { Mode, Settings, Stamp } from './types';

/** 模式元数据（PRD §6.2 / 设计 §6.5） */
export const MODE_META: Record<Mode, { emoji: string; name: string }> = {
  homework: { emoji: '📝', name: '常规作业' },
  quiz: { emoji: '💯', name: '单元测试' },
  dictation: { emoji: '✍️', name: '听写默写' },
};

export const MODE_LABEL: Record<Mode, string> = {
  homework: '常规作业',
  quiz: '单元测试',
  dictation: '听写默写',
};

export const MODE_EMOJI: Record<Mode, string> = {
  homework: '📝',
  quiz: '💯',
  dictation: '✍️',
};

export const MODE_LIST: Mode[] = ['homework', 'quiz', 'dictation'];

export const STAMP_LABEL: Record<Exclude<Stamp, 'none'>, string> = {
  corrected: '已更正',
  excellent: '优秀',
};

export const STAMP_ICON: Record<Exclude<Stamp, 'none'>, string> = {
  corrected: '✅',
  excellent: '⭐',
};

/** 学科下拉项（PRD FR-13） */
export const SUBJECTS = ['语文', '数学', '英语', '科学', '道法', '音乐', '美术', '体育', '其他'];

export const MIN_STUDENTS = 1;
export const MAX_STUDENTS = 120;
export const DEFAULT_COUNT = 50;
export const HISTORY_LIMIT = 200;
export const HISTORY_WINDOW = 8;
export const UNDO_DEPTH = 50;
export const TEXT_MAX = 20;
export const CONTENT_MAX = 20;
export const NAME_MAX = 20;
export const WRAP_WIDTH = 70;
export const GOOD_LINE = 80;
export const MAX_DRAFTS = 90;
export const PRUNE_DRAFTS_TO = 60;
export const STORAGE_KEY = 'xq.state.v1';
export const SNAPSHOT_INTERVAL = 30_000;

export const DEFAULT_SETTINGS: Settings = {
  count: DEFAULT_COUNT,
  secondsJump: true,
  showName: false,
  excellentLine: 90,
  passLine: 60,
  honorIncludesA: false,
};

/** 提示条文案（PRD §4.6.4，逐字） */
export const HINT_TEXT: Record<Mode, string> = {
  homework: '💡 左键选中格子 / 按【空格】盖章 / 1 A+　2 A　3 A-　4 ×　5 √',
  quiz: '💡 输入分数后按【Enter】跳到下一格 / 选中小格按【空格】盖章',
  dictation: '💡 直接输入「错2」「全对」「缺交」/ 选中小格按【空格】盖章',
};

/** 报表分隔线（恰好 25 个半角连字符） */
export const REPORT_SEP = '-'.repeat(25);
