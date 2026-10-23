import { create } from 'zustand';
import type { PersistedStateV3, RecordDoc } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/constants';
import type { AppState } from './store-types';
import { createEmptyState, createRecord, hasEntries } from './initial';
import { createUndoSlice } from './undoSlice';
import { createEntrySlice } from './entrySlice';
import { createSheetSlice } from './sheetSlice';
import { createClassSlice } from './classSlice';
import { createPointSlice } from './pointSlice';
import { createUiSlice } from './uiSlice';

const initial = createEmptyState();

/** 持久化根 → 运行时状态（含「当前记录」落点） */
export function fromPersisted(state: PersistedStateV3): Partial<AppState> {
  const classes = state.classes.length ? state.classes : createEmptyState().classes;
  const activeClassId = classes.some((c) => c.id === state.activeClassId)
    ? state.activeClassId
    : classes[0].id;

  const records: Record<string, RecordDoc> = {};
  for (const r of state.records) records[r.key] = r;

  const candidates = Object.values(records)
    .filter((r) => r.classId === activeClassId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const draft = candidates[0] ?? createRecord({ classId: activeClassId, templateId: 'homework' });
  records[draft.key] = draft;

  return {
    classes,
    activeClassId,
    records,
    history: state.history,
    pointRules: state.pointRules,
    pointLedger: state.pointLedger,
    settings: state.settings ?? DEFAULT_SETTINGS,
    activeKey: draft.key,
    draft,
  };
}

export const useStore = create<AppState>()((set, get) => ({
  classes: initial.classes,
  activeClassId: initial.activeClassId,
  records: Object.fromEntries(initial.records.map((r) => [r.key, r])),
  history: initial.history,
  pointRules: initial.pointRules,
  pointLedger: initial.pointLedger,
  settings: initial.settings,

  activeKey: initial.records[0].key,
  draft: initial.records[0],

  focusedNo: 1,
  selection: new Set<number>(),
  selectionAnchor: null,
  currentStamp: 'corrected',
  editing: null,
  buffer: null,
  searchOpen: false,
  searchQuery: '',
  modal: null,
  confirmRequest: null,
  toast: null,
  posterUrl: null,
  posterBlob: null,
  posterPages: [],
  posterLoading: false,
  posterTarget: { mode: 'daily' },
  cellError: null,
  envMismatch: false,
  blockedOverwrite: false,
  weekParts: null,
  storageDegraded: false,
  readOnly: false,
  lastSavedAt: null,
  pulsingNo: null,
  flashNo: null,
  chartsOpen: true,   // 恢复 V1 的默认展开：老师习惯「切到质量监测就有三张图」（评审 F7）
  compareId: null,
  filterNotPassed: false,
  voiceListening: false,
  voiceInterim: '',
  voiceBanners: [],
  undoStack: [],
  redoStack: [],

  ...createUndoSlice(set, get),
  ...createEntrySlice(set, get),
  ...createSheetSlice(set, get),
  ...createClassSlice(set, get),
  ...createPointSlice(set, get),
  ...createUiSlice(set, get),

  exportState() {
    const s = get();
    return {
      version: 3,
      activeClassId: s.activeClassId,
      classes: s.classes,
      records: Object.values(s.records).filter((r) => hasEntries(r.entries)),
      history: s.history,
      pointRules: s.pointRules,
      pointLedger: s.pointLedger,
      settings: s.settings,
      lastSavedAt: Date.now(),
    };
  },

  replaceState(next) {
    set({
      ...fromPersisted(next),
      history: next.history,
      pointRules: next.pointRules,
      pointLedger: next.pointLedger,
      settings: next.settings,
      focusedNo: 1,
      selection: new Set<number>(),
      selectionAnchor: null,
      editing: null,
      buffer: null,
      undoStack: [],
      redoStack: [],
      filterNotPassed: false,
      modal: null,
      confirmRequest: null,
    });
  },

  resetAll() {
    get().replaceState(createEmptyState(Date.now()));
    get().showToast('已清空全部数据', 'ok');
  },
}));

/** 当前班级（唯一人数来源） */
export function currentClass(s: AppState = useStore.getState()) {
  return s.classes.find((c) => c.id === s.activeClassId);
}
