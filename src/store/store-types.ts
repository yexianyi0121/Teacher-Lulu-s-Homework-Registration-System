import type {
  ClassInfo,
  Entries,
  HistoryEntry,
  Mode,
  RecordDoc,
  Settings,
  Stamp,
  Student,
} from '../domain/types';
import type { VoiceEdit } from '../domain/voice-parse';

export interface UndoPatch {
  key: string;              // recordKey
  entries: Entries;         // 变更前的完整快照（浅拷贝 + 被改 Entry 深拷贝）
  count: number;            // 变更前人数
  focus: number | null;
  label: string;            // '录入' | '盖章' | '清空' | '批量盖章' | '语音' | '人数'
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
export type ModalKind = 'settings' | 'report' | 'poster' | 'import';

export interface AppState {
  // 数据
  classInfo: ClassInfo;
  drafts: Record<string, RecordDoc>;
  activeKey: string;
  history: HistoryEntry[];
  settings: Settings;

  // UI（不持久化）
  focusedNo: number | null;
  selection: Set<number>;
  currentStamp: Exclude<Stamp, 'none'>;
  editing: { no: number; draft: string } | null;
  buffer: { no: number; text: string } | null;
  searchOpen: boolean;
  searchQuery: string;
  modal: ModalKind | null;
  confirmRequest: ConfirmRequest | null;
  toast: { id: number; text: string; tone: ToastTone } | null;
  posterUrl: string | null;
  posterLoading: boolean;
  posterBlob: Blob | null;
  storageDegraded: boolean;
  lastSavedAt: number | null;
  pulsingNo: number | null;
  flashNo: number | null;
  chartsOpen: boolean;
  compareId: string | null;
  voiceListening: boolean;
  voiceInterim: string;
  selectionAnchor: number | null;

  // 撤销
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
  setStorageDegraded: (v: boolean) => void;
  markSaved: (at: number) => void;
  setPulsingNo: (no: number | null) => void;
  setFlashNo: (no: number | null) => void;
  setChartsOpen: (open: boolean) => void;
  setCompareId: (id: string | null) => void;
  setVoiceListening: (v: boolean) => void;
  setVoiceInterim: (v: string) => void;

  setValue: (no: number, value: import('../domain/types').CellValue | null) => void;
  clearCell: (no: number) => void;
  toggleStamp: (no: number) => void;
  batchStamp: (nos: number[]) => void;
  batchClear: (nos: number[]) => void;
  switchMode: (mode: Mode) => void;
  setDate: (v: string) => void;
  setContent: (v: string) => void;
  switchRecord: (patch: { date?: string; content?: string; mode?: Mode }) => void;
  setStudentCount: (n: number) => void;
  commitToHistory: () => void;
  clearCurrentRecord: () => void;
  applyVoiceEdits: (edits: VoiceEdit[]) => void;

  pushUndo: (label: string) => void;
  undo: () => void;
  redo: () => void;

  updateSettings: (patch: Partial<Settings>) => void;
  updateClassInfo: (patch: Partial<Pick<ClassInfo, 'name' | 'school' | 'teacher' | 'subject'>>) => void;
  importRoster: (students: Student[]) => void;

  exportState: () => import('../infra/persistence').PersistedState;
  replaceState: (next: import('../infra/persistence').PersistedState) => void;
  resetAll: () => void;
  deleteHistory: (id: string) => void;
  clearHistory: () => void;
}

export type StoreSet = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
export type StoreGet = () => AppState;
