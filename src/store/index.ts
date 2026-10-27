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

  // ⚠️ 「打开后该显示哪张表」（v2.5.7 两次修正，别改回去）：
  //
  // 旧实现取 updatedAt 最大的记录当 draft → 昨天录完关掉，今天打开看到的还是**昨天那张表**，
  // 老师以为是新表照录，今天的成绩全写进昨天那条记录，把昨天的数据覆盖掉（事故根因）。
  //
  // 第一版修法「只认今天、否则新建空表」又踩了另一边：v1 迁移上来的老数据
  // 日期不是今天，于是老师升级后打开第一眼看到空表，以为数据丢了（persistence 用例现场）。
  //
  // 现在取**今天有内容 → 今天；否则库里最近的记录**（让迁移/回看场景看得到数据）。
  // 关键是：draft 只是**指向**那条记录做展示，老师一按键编辑，entrySlice 会写 draft.entries，
  // 而此时 draft 的 key 就是那条记录自身的 key —— 所以不存在「写到别人记录上」的问题；
  // 真正要避免的是「把旧表当成今天的新表静默继续录」，那由下面的 switchRecord/新表按钮保证。
  const today = todayISO();
  const ofClass = Object.values(records).filter((r) => r.classId === activeClassId);
  const todayRec = ofClass
    .filter((r) => r.date === today)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const latestWithData = ofClass
    .filter((r) => hasEntries(r.entries))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const draft = todayRec ?? latestWithData ?? createRecord({ classId: activeClassId, templateId: 'homework' });
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
