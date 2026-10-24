import type { AppState, StoreGet, StoreSet, VoiceBanner } from './store-types';

type UiSlice = Pick<
  AppState,
  | 'setFocusedNo' | 'moveFocus' | 'setSelection' | 'exitSelection' | 'toggleSelectAll'
  | 'setCurrentStamp' | 'setEditing' | 'setBuffer' | 'setSearchOpen' | 'setSearchQuery'
  | 'setModal' | 'openConfirm' | 'closeConfirm' | 'showToast' | 'clearToast'
  | 'setPoster' | 'setPosterPages' | 'setPosterLoading' | 'setPosterTarget' | 'setStorageDegraded' | 'setReadOnly'
  | 'setCellError' | 'setEnvMismatch' | 'setBlockedOverwrite' | 'setWeekParts'
  | 'markSaved' | 'setPulsingNo' | 'setFlashNo' | 'setChartsOpen' | 'setStatsOpen' | 'setCompareId'
  | 'setFilterNotPassed' | 'setVoiceListening' | 'setVoiceInterim'
  | 'pushVoiceBanner' | 'removeVoiceBanner' | 'clearVoiceBanners'
>;

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let cellTimer: ReturnType<typeof setTimeout> | null = null;
let toastSeq = 0;
let bannerSeq = 0;

export function createUiSlice(set: StoreSet, get: StoreGet): UiSlice {
  return {
    setFocusedNo(no) {
      const s = get();
      const count = s.classes.find((c) => c.id === s.activeClassId)?.count ?? 0;
      set({ focusedNo: no === null ? null : Math.min(Math.max(1, no), count) });
    },

    moveFocus(delta) {
      const s = get();
      const count = s.classes.find((c) => c.id === s.activeClassId)?.count ?? 0;
      const from = s.focusedNo ?? 1;
      const next = from + delta;
      if (next < 1 || next > count) {
        if (delta > 0 && from === count) s.showToast('已完成最后一格 ✓', 'ok');
        return;
      }
      set({ focusedNo: next, selection: new Set<number>(), selectionAnchor: null });
    },

    setSelection(nos) {
      set({ selection: nos });
    },

    exitSelection() {
      const s = get();
      set({
        selection: new Set<number>(),
        selectionAnchor: null,
        focusedNo: s.selectionAnchor ?? s.focusedNo ?? 1,
      });
    },

    toggleSelectAll() {
      const s = get();
      if (s.selection.size > 0) {
        set({
          selection: new Set<number>(),
          selectionAnchor: null,
          focusedNo: s.selectionAnchor ?? s.focusedNo ?? 1,
        });
        return;
      }
      const count = s.classes.find((c) => c.id === s.activeClassId)?.count ?? 0;
      const sel = new Set<number>();
      for (let no = 1; no <= count; no++) {
        const e = s.draft.entries[String(no)];
        if (e && (e.value !== null || e.stamp !== 'none' || e.status !== 'normal' || e.pass)) sel.add(no);
      }
      if (sel.size === 0) {
        s.showToast('还没有可选的单元格', 'warn');
        return;
      }
      set({ selection: sel, selectionAnchor: s.focusedNo ?? 1 });
    },

    setCurrentStamp(stamp) {
      set({ currentStamp: stamp });
    },

    setEditing(editing) {
      set({ editing });
    },

    setBuffer(buffer) {
      set({ buffer });
    },

    setSearchOpen(open) {
      set({ searchOpen: open, searchQuery: open ? get().searchQuery : '' });
    },

    setSearchQuery(q) {
      set({ searchQuery: q });
    },

    setModal(modal) {
      set({ modal, ...(modal ? {} : { confirmRequest: null }) });
    },

    openConfirm(req) {
      set({ confirmRequest: req });
    },

    closeConfirm() {
      set({ confirmRequest: null });
    },

    showToast(text, tone = 'ok') {
      toastSeq += 1;
      set({ toast: { id: toastSeq, text, tone } });
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set({ toast: null }), 2600);
    },

    clearToast() {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: null });
    },

    setPoster(url, blob) {
      set({ posterUrl: url, posterBlob: blob ?? null });
    },

    setPosterLoading(loading) {
      set({ posterLoading: loading });
    },

    setPosterPages(pages) {
      set({ posterPages: pages });
    },

    setPosterTarget(target) {
      set({ posterTarget: target });
    },

    setCellError(no) {
      set({ cellError: no });
      if (cellTimer) clearTimeout(cellTimer);
      if (no !== null) cellTimer = setTimeout(() => set({ cellError: null }), 1500);
    },

    setEnvMismatch(v) {
      set({ envMismatch: v });
    },

    setBlockedOverwrite(v) {
      set({ blockedOverwrite: v });
    },

    setWeekParts(parts) {
      set({ weekParts: parts });
    },

    setStorageDegraded(v) {
      set({ storageDegraded: v });
    },

    setReadOnly(v) {
      set({ readOnly: v });
    },

    markSaved(at) {
      set({ lastSavedAt: at });
    },

    setPulsingNo(no) {
      set({ pulsingNo: no });
    },

    setFlashNo(no) {
      set({ flashNo: no });
    },

    setChartsOpen(open) {
      set({ chartsOpen: open });
    },

    setStatsOpen(open) {
      set({ statsOpen: open });
    },

    setCompareId(id) {
      set({ compareId: id });
    },

    setFilterNotPassed(v) {
      set({ filterNotPassed: v });
    },

    setVoiceListening(v) {
      set({ voiceListening: v, ...(v ? {} : { voiceInterim: '' }) });
    },

    setVoiceInterim(v) {
      set({ voiceInterim: v });
    },

    pushVoiceBanner(b) {
      bannerSeq += 1;
      const banner: VoiceBanner = { ...b, id: `${b.id}-${bannerSeq}` };
      set({ voiceBanners: [...get().voiceBanners, banner].slice(-5) });
    },

    removeVoiceBanner(id) {
      set({ voiceBanners: get().voiceBanners.filter((b) => b.id !== id) });
    },

    clearVoiceBanners() {
      set({ voiceBanners: [] });
    },
  };
}
