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
      const next = no === null ? null : Math.min(Math.max(1, no), count);
      // 焦点离开时，旧格子上未提交的分数缓冲必须清掉：
      // 否则老师看到「1 号格显示 8」，实际那只是半截输入、并未录入（FR-39 补充）。
      const staleBuffer = s.buffer && (next === null || s.buffer.no !== next);
      // I-02：老师「全选 3 格 → 点 5 号 → 按 1」期望只改 5 号，
      // 但原来点格子不清选区：1/2/3 的高亮还亮着，老师会以为「批量没生效」。
      // 点某一格 = 明确「我只改这一格」，所以选区必须同时退出。
      const hadSelection = s.selection.size > 0;
      set({
        focusedNo: next,
        selection: hadSelection ? new Set<number>() : s.selection,
        selectionAnchor: hadSelection ? null : s.selectionAnchor,
        ...(staleBuffer ? { buffer: null, cellError: null } : {}),
      });
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
      // 同上：方向键挪走时也丢弃旧格的半截输入
      const staleBuffer = s.buffer && s.buffer.no !== next;
      set({
        focusedNo: next,
        selection: new Set<number>(),
        selectionAnchor: null,
        ...(staleBuffer ? { buffer: null, cellError: null } : {}),
      });
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

    showToast(text, tone = 'ok', ms) {
      // U-05：固定 2600ms 且谁都能顶掉谁 —— 实测「已清空本条记录，可 Ctrl+Z 恢复」
      // 会被 3 秒后的「该备份了」提醒直接顶掉，老师根本没看见「可以撤销」。
      // 规则：① 带「可撤销/可继续操作」的信息给更长寿命（见调用方传 ms）；
      //       ② **新操作产生的提示一律顶掉旧的**，除了两种例外。
      //
      // v2.5.7 修正（两次）：曾经写成「低优先级不能覆盖仍在显示的高优先级提示」，
      // 结果先敲了 9（warn「本表没有该等级键」）再按 ` 切分数（ok「数字键已切到」），
      // 新提示被 4 秒前那条 warn 吞掉 —— chip 明明变了，老师却以为「按了没反应」。
      // 提示是「刚刚发生了什么」的反馈，过时的那条不该继续占着位置。
      // 唯一例外：error（数据没存上这类）不被 ok 顶掉，免得老师错过事故提示。
      toastSeq += 1;
      const cur = get().toast;
      if (cur && cur.tone === 'error' && tone !== 'error') return;
      const life = ms ?? (tone === 'error' ? 5000 : tone === 'warn' ? 4000 : 2600);
      set({ toast: { id: toastSeq, text, tone } });
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set({ toast: null }), life);
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

    setStorageDegraded(v, reason = null) {
      // 恢复也需要带上原因：成功写盘时调用方传 null，横幅随之消失
      set({ storageDegraded: v, storageErrorReason: v ? (reason ?? 'unavailable') : null });
    },

    setReadOnly(v, reason = null) {
      set({ readOnly: v, readOnlyReason: v ? reason : null });
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
