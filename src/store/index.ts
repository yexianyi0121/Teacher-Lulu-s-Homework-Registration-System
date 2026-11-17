import { create } from 'zustand';
import type { PersistedStateV4, RecordDoc } from '../domain/types';
import { normalizeScheme, type LegacyPassRule } from '../domain/scheme';
import { DEFAULT_SETTINGS } from '../domain/constants';
import type { AppState } from './store-types';
import { createEmptyState, createRecord, hasEntries } from './initial';
import { todayISO } from '../domain/date';
import { createUndoSlice } from './undoSlice';
import { createEntrySlice } from './entrySlice';
import { createSheetSlice } from './sheetSlice';
import { createClassSlice } from './classSlice';
import { createPointSlice } from './pointSlice';
import { createUiSlice } from './uiSlice';

const initial = createEmptyState();

/** 持久化根 → 运行时状态（含「当前记录」落点） */
export function fromPersisted(state: PersistedStateV4): Partial<AppState> {
  const classes = state.classes.length ? state.classes : createEmptyState().classes;
  const activeClassId = classes.some((c) => c.id === state.activeClassId)
    ? state.activeClassId
    : classes[0].id;

  // v2.6.3 FR-72.4：老备份把过关规则存在 settings.passRule，现在落到每条记录自己的方案上。
  // 载入时把这份旧字段摘掉，避免它继续在设置里"存在但没人读"。
  const rawSettings = ((state.settings ?? {}) as unknown) as Record<string, unknown>;
  const legacy = (rawSettings.passRule as LegacyPassRule | undefined) ?? null;
  const { passRule: _legacyPassRule, ...settingsRest } = rawSettings;
  void _legacyPassRule;

  const records: Record<string, RecordDoc> = {};
  for (const r of state.records) records[r.key] = { ...r, scheme: normalizeScheme(r.scheme, legacy) };
  const history = state.history.map((h) => ({ ...h, scheme: normalizeScheme(h.scheme, legacy) }));

  // 「打开后该显示哪张表」：
  // 新的一天 → 自动创建新的空登记表，日期跟随本地时间。
  // 今天有记录 → 显示今天最新那条；今天没有 → 新建空表。
  // 这样每天打开都是干净的，不会把昨天的内容误当成今天的继续录。
  const today = todayISO();
  const ofClass = Object.values(records).filter((r) => r.classId === activeClassId);
  const todayRec = ofClass
    .filter((r) => r.date === today && hasEntries(r.entries))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const draft = todayRec ?? createRecord({ classId: activeClassId, templateId: 'homework', date: today });
  records[draft.key] = draft;

  return {
    classes,
    activeClassId,
    records,
    history,
    pointRules: state.pointRules,
    pointLedger: state.pointLedger,
    settings: { ...DEFAULT_SETTINGS, ...settingsRest } as typeof DEFAULT_SETTINGS,
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
  storageErrorReason: null,
  readOnly: false,
  readOnlyReason: null,
  lastSavedAt: null,
  pulsingNo: null,
  flashNo: null,
  // V4 FR-49.6：统计条与图表默认收起（1366×768 高度预算），老师要看点一下展开。
  // 注：V2 评审 F7 曾要求图表默认展开；V4 高度闸门优先，展开仍是一键。
  chartsOpen: false,
  statsOpen: false,
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
    // ⚠️ 必须把「当前正在编辑的这张表」(draft) 并进 records。
    // 原来只导 s.records，而草稿只有在「切模式/切日期/切内容/切班级」时才会被固化进 records，
    // 于是老师录了一整天、不切表就关浏览器 —— 磁盘上根本没有今天的数据（v2.5.7 事故，
    // 也是「关浏览器重开数据全丢」迟迟没断根的原因）。
    const recs: Record<string, RecordDoc> = { ...s.records };
    if (s.draft && hasEntries(s.draft.entries)) recs[s.draft.key] = s.draft;
    return {
      version: 4,
      activeClassId: s.activeClassId,
      classes: s.classes,
      records: Object.values(recs).filter((r) => hasEntries(r.entries)),
      history: s.history,
      pointRules: s.pointRules,
      pointLedger: s.pointLedger,
      settings: s.settings,
      lastSavedAt: Date.now(),
    };
  },

  
  /** 
   * 合并导入（而非覆盖）：导入的 records/history 按 key 合并，
   * 同 key 保留更新时间更晚的那份；当前独有的记录保留。
   * 班级、积分规则、账本、设置以导入的为准。
   */
  mergeImport(next: PersistedStateV4) {
    const s = get();
    
    // 合并 records：导入的覆盖同 key，保留当前独有的
    const mergedRecords: Record<string, RecordDoc> = { ...s.records };
    for (const r of next.records) {
      const existing = mergedRecords[r.key];
      if (!existing || r.updatedAt >= existing.updatedAt) {
        mergedRecords[r.key] = r;
      }
    }
    
    // 合并 history：导入的覆盖同 key，保留当前独有的
    const existingHistoryKeys = new Set(s.history.map((h) => h.key));
    const mergedHistory = [...s.history];
    for (const h of next.history) {
      if (!existingHistoryKeys.has(h.key)) {
        mergedHistory.push(h);
      }
    }
    
    // 去重并排序
    const historyMap = new Map<string, typeof next.history[number]>();
    for (const h of mergedHistory) {
      const existing = historyMap.get(h.key);
      if (!existing || h.savedAt >= existing.savedAt) {
        historyMap.set(h.key, h);
      }
    }
    const sortedHistory = [...historyMap.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, 200);
    
    const merged: PersistedStateV4 = {
      ...next,
      records: Object.values(mergedRecords),
      history: sortedHistory,
    };
    
    // 预导入快照
    try {
      localStorage.setItem(`xq.preimport.${Date.now()}`, JSON.stringify(s.exportState()));
    } catch { /* 空间不足时仍允许导入 */ }
    
    set({
      ...fromPersisted(merged),
      history: merged.history,
      pointRules: merged.pointRules,
      pointLedger: merged.pointLedger,
      settings: merged.settings,
      focusedNo: 1,
      selection: new Set<number>(),
      selectionAnchor: null,
      editing: null,
      buffer: null,
      undoStack: [],
      redoStack: [],
      filterNotPassed: false,
      readOnly: false,
      readOnlyReason: null,
      blockedOverwrite: false,
      modal: null,
      confirmRequest: null,
    });
    
    const importedRecs = next.records.length;
    const importedHist = next.history.length;
    const keptRecs = Object.keys(mergedRecords).length;
    const keptHist = sortedHistory.length;
    get().showToast(
      `已合并导入：${importedRecs} 条记录 + ${importedHist} 条历史 → 合并后共 ${keptRecs} 条记录 + ${keptHist} 条历史`,
      'ok',
    );
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
      readOnly: false,
      readOnlyReason: null,
      blockedOverwrite: false,
      modal: null,
      confirmRequest: null,
    });
  },

  resetAll() {
    get().replaceState(createEmptyState(Date.now()));
    // 「清空并重来」的唯一目的是**让老师重新可写**。
    // 原来只换 state、不清这两个标志，结果：拦截横幅还在、只读横幅还在，
    // 老师点了按钮却什么也没变（v2.5.7 事故）。
    get().setBlockedOverwrite(false);
    get().showToast('已清空全部数据', 'ok');
  },
}));

/** 当前班级（唯一人数来源） */
export function currentClass(s: AppState = useStore.getState()) {
  return s.classes.find((c) => c.id === s.activeClassId);
}
