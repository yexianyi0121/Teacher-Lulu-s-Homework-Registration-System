import { create } from 'zustand';
import type { AppState, StoreGet, StoreSet } from './store-types';
import { createInitialData } from './initial';
import { createUndoSlice } from './undoSlice';
import { createRecordSlice } from './recordSlice';
import { createClassSlice, createHistorySlice, createSettingsSlice } from './classSlice';
import { createUiSlice } from './uiSlice';
import { MAX_DRAFTS, PRUNE_DRAFTS_TO } from '../domain/constants';
import type { PersistedState } from '../infra/persistence';
import type { RecordDoc } from '../domain/types';

export const useStore = create<AppState>()((set, get) => {
  const s = set as unknown as StoreSet;
  const g = get as StoreGet;
  const init = createInitialData();

  return {
    classInfo: init.classInfo,
    drafts: init.drafts,
    activeKey: init.activeKey,
    history: [],
    settings: init.settings,

    focusedNo: 1,
    selection: new Set<number>(),
    currentStamp: 'corrected',
    editing: null,
    buffer: null,
    searchOpen: false,
    searchQuery: '',
    modal: null,
    confirmRequest: null,
    toast: null,
    posterUrl: null,
    posterLoading: false,
    posterBlob: null,
    storageDegraded: false,
    lastSavedAt: null,
    pulsingNo: null,
    flashNo: null,
    chartsOpen: true,
    compareId: null,
    voiceListening: false,
    voiceInterim: '',
    selectionAnchor: null,

    undoStack: [],
    redoStack: [],

    ...createUndoSlice(s, g),
    ...createRecordSlice(s, g),
    ...createClassSlice(s, g),
    ...createSettingsSlice(s, g),
    ...createHistorySlice(s, g),
    ...createUiSlice(s, g),

    exportState(): PersistedState {
      const state = get();
      let drafts = state.drafts;
      const ids = Object.keys(drafts);
      if (ids.length > MAX_DRAFTS) {
        const keep = ids
          .map((id) => drafts[id])
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, PRUNE_DRAFTS_TO)
          .map((d) => d.id);
        const keepSet = new Set(keep);
        keepSet.add(state.activeKey);
        const next: Record<string, RecordDoc> = {};
        for (const id of keepSet) if (drafts[id]) next[id] = drafts[id];
        drafts = next;
      }
      return {
        version: 1,
        classInfo: state.classInfo,
        drafts,
        activeKey: state.activeKey,
        history: state.history,
        settings: state.settings,
        savedAt: Date.now(),
      };
    },

    replaceState(next) {
      set({
        classInfo: next.classInfo,
        drafts: next.drafts,
        activeKey: next.activeKey,
        history: next.history,
        settings: next.settings,
        focusedNo: 1,
        selection: new Set<number>(),
        selectionAnchor: null,
        editing: null,
        buffer: null,
        modal: null,
        confirmRequest: null,
        compareId: null,
        undoStack: [],
        redoStack: [],
        lastSavedAt: next.savedAt,
      });
    },

    resetAll() {
      const fresh = createInitialData();
      set({
        classInfo: fresh.classInfo,
        drafts: fresh.drafts,
        activeKey: fresh.activeKey,
        history: [],
        settings: fresh.settings,
        focusedNo: 1,
        currentStamp: 'corrected',
        selection: new Set<number>(),
        selectionAnchor: null,
        editing: null,
        buffer: null,
        modal: null,
        confirmRequest: null,
        compareId: null,
        chartsOpen: true,
        posterUrl: null,
        posterBlob: null,
        posterLoading: false,
        storageDegraded: false,
        lastSavedAt: null,
        pulsingNo: null,
        flashNo: null,
        searchOpen: false,
        searchQuery: '',
        voiceListening: false,
        voiceInterim: '',
        toast: null,
        undoStack: [],
        redoStack: [],
      });
    },
  };
});
