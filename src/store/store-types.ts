import type {
  ClassDoc,
  Entries,
  Entry,
  EntryStatus,
  HistoryEntry,
  PointLedgerEntry,
  PointRule,
  RecordDoc,
  ScoringScheme,
  Settings,
  SheetTemplateId,
  Stamp,
  Student,
} from '../domain/types';
import type { PersistedStateV2 } from '../domain/types';
import type { VoiceCommand, VoiceIssue } from '../domain/voice/parse';

export interface UndoPatch {
  label: string;
  recordKey: string;
  before: Entries;
  after: Entries;
  /** 动到积分时带上账本长度，撤销时截断回快照（§5.2） */
  pointsBefore?: number;
  focusBefore?: number | null;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmText?: string;
  requireText?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export type ToastTone = 'ok' | 'warn' | 'error';
export type ModalKind =
  | 'settings' | 'report' | 'poster' | 'import' | 'scheme' | 'makeup'
  | 'points' | 'export' | 'manual' | 'summary';

export interface VoiceBanner {
  id: string;
  text: string;
  tone: 'ok' | 'warn';
  command?: VoiceCommand;
}

export interface AppState {
  // ---- 数据（持久化） ----
  classes: ClassDoc[];
  activeClassId: string;
  records: Record<string, RecordDoc>;
  history: HistoryEntry[];
  pointRules: PointRule[];
  pointLedger: PointLedgerEntry[];
  settings: Settings;

  // ---- 当前编辑位置 ----
  activeKey: string;
  draft: RecordDoc;

  // ---- UI（不持久化） ----
  focusedNo: number | null;
  selection: Set<number>;
  selectionAnchor: number | null;
  currentStamp: Exclude<Stamp, 'none'>;
  editing: { no: number; draft: string } | null;
  buffer: { no: number; text: string } | null;
  searchOpen: boolean;
  searchQuery: string;
  modal: ModalKind | null;
  confirmRequest: ConfirmRequest | null;
  toast: { id: number; text: string; tone: ToastTone } | null;
  posterUrl: string | null;
  posterBlob: Blob | null;
  posterLoading: boolean;
  posterMode: 'single' | 'daily';
  storageDegraded: boolean;
  readOnly: boolean;
  lastSavedAt: number | null;
  pulsingNo: number | null;
  flashNo: number | null;
  chartsOpen: boolean;
  compareId: string | null;
  filterNotPassed: boolean;
  voiceListening: boolean;
  voiceInterim: string;
  voiceBanners: VoiceBanner[];

  undoStack: UndoPatch[];
  redoStack: UndoPatch[];

  // ---- actions ----
  setFocusedNo: (no: number | null) => void;
  moveFocus: (delta: number) => void;
  setSelection: (nos: Set<number>) => void;
  exitSelection: () => void;
  toggleSelectAll: () => void;
  setCurrentStamp: (stamp: Exclude<Stamp, 'none'>) => void;
  setEditing: (editing: { no: number; draft: string } | null) => void;
  setBuffer: (buffer: { no: number; text: string } | null) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setModal: (modal: ModalKind | null) => void;
  openConfirm: (req: ConfirmRequest) => void;
  closeConfirm: () => void;
  showToast: (text: string, tone?: ToastTone) => void;
  clearToast: () => void;
  setPoster: (url: string | null, blob?: Blob | null) => void;
  setPosterLoading: (loading: boolean) => void;
  setPosterMode: (mode: 'single' | 'daily') => void;
  setStorageDegraded: (v: boolean) => void;
  setReadOnly: (v: boolean) => void;
  markSaved: (at: number) => void;
  setPulsingNo: (no: number | null) => void;
  setFlashNo: (no: number | null) => void;
  setChartsOpen: (open: boolean) => void;
  setCompareId: (id: string | null) => void;
  setFilterNotPassed: (v: boolean) => void;
  setVoiceListening: (v: boolean) => void;
  setVoiceInterim: (v: string) => void;
  pushVoiceBanner: (b: VoiceBanner) => void;
  removeVoiceBanner: (id: string) => void;
  clearVoiceBanners: () => void;

  // 录入
  commitValue: (no: number, value: Entry['value']) => void;
  commitText: (no: number, text: string) => void;
  clearCell: (no: number) => void;
  toggleStamp: (no: number) => void;
  batchStamp: (nos: number[]) => void;
  batchClear: (nos: number[]) => void;
  togglePass: (no: number) => void;
  setStatus: (no: number, status: EntryStatus) => void;
  setMakeup: (nos: number[], note: string) => void;
  clearMakeup: (nos: number[]) => void;

  // 登记表 / 记录
  switchTemplate: (templateId: SheetTemplateId) => void;
  switchSheet: (sheetId: string, templateId: SheetTemplateId) => void;
  setDate: (v: string) => void;
  setContent: (v: string) => void;
  switchRecord: (patch: { date?: string; content?: string; sheetId?: string; templateId?: SheetTemplateId }) => void;
  setScheme: (patch: Partial<ScoringScheme>) => void;
  resetScheme: () => void;
  commitToHistory: () => void;
  clearCurrentRecord: () => void;
  applyVoiceCommands: (commands: VoiceCommand[]) => void;

  // 撤销
  pushUndo: (label: string, before: Entries, after: Entries, pointsBefore?: number) => void;
  undo: () => void;
  redo: () => void;

  // 班级 / 设置
  addClass: (name: string) => void;
  renameClass: (id: string, name: string) => void;
  deleteClass: (id: string) => void;
  switchClass: (id: string) => void;
  setCount: (n: number) => void;
  updateClassInfo: (patch: Partial<Pick<ClassDoc, 'name' | 'school' | 'teacher' | 'subject'>>) => void;
  importRoster: (students: Student[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  // 积分
  manualAward: (nos: number[], delta: number, reason: string, ruleId?: string | null) => void;
  revokePoint: (id: string) => void;
  setRules: (rules: PointRule[]) => void;

  // 历史 / 存档
  deleteHistory: (key: string) => void;
  clearHistory: () => void;
  exportState: () => PersistedStateV2;
  replaceState: (next: PersistedStateV2) => void;
  resetAll: () => void;
}

export type StoreSet = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
export type StoreGet = () => AppState;

export type { VoiceIssue };
