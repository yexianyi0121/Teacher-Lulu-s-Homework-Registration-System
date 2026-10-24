import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { hasEntries } from './store/initial';
import { selectSheetsOfDay, selectStats, selectVisibleNos } from './store/selectors';
import { SHEET_TEMPLATES, SCHEME_LABEL } from './domain/constants';
import { addDaysISO, todayISO, weekStartOf } from './domain/date';
import type { PosterTarget } from './domain/types';
import { useInputEngine } from './hooks/useInputEngine';
import { useAutoSave } from './hooks/useAutoSave';
import { useVoice } from './hooks/useVoice';
import { rasterizeWithRetry } from './infra/rasterize';
import { exportAllBlob } from './infra/backup';
import { downloadBlob } from './infra/download';
import { Header } from './components/Header';
import { ParamsBar } from './components/ParamsBar';
import { OutputBar, type OutputJob } from './components/OutputBar';
import { InputBar } from './components/InputBar';
import { StatsBar } from './components/StatsBar';
import { ChartsCard } from './components/ChartsCard';
import { HintBar } from './components/HintBar';
import { Grid } from './components/Grid';
import { PosterRaster } from './components/PosterRaster';
import { VoiceConfirm } from './components/VoiceConfirm';
import { SettingsModal } from './components/modals/SettingsModal';
import { ReportModal } from './components/modals/ReportModal';
import { PosterModal } from './components/modals/PosterModal';
import { ImportRosterModal } from './components/modals/ImportRosterModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { SchemeModal } from './components/modals/SchemeModal';
import { MakeupModal } from './components/modals/MakeupModal';
import { PointsModal } from './components/modals/PointsModal';
import { ExportModal } from './components/modals/ExportModal';
import { ManualModal } from './components/modals/ManualModal';
import { Toast } from './components/ui/Toast';

function hasAnyToday(st: ReturnType<typeof useStore.getState>): boolean {
  // 注意：records 里也会存「刚切过去还没录」的空记录，必须按内容判定，
  // 否则翻到任何一天都会生成一张空图（FR-24 / FR-43 的「今日/本周暂无登记」永不触发）。
  return Object.values(st.records).some(
    (r) => r.classId === st.activeClassId && r.date === st.draft.date && hasEntries(r.entries),
  ) || st.history.some((h) => h.classId === st.activeClassId && h.date === st.draft.date);
}

function hasAnyThisWeek(st: ReturnType<typeof useStore.getState>, weekStart: string): boolean {
  const end = addDaysISO(weekStart, 6);
  const inRange = (d: string) => d >= weekStart && d <= end;
  return Object.values(st.records).some(
    (r) => r.classId === st.activeClassId && inRange(r.date) && hasEntries(r.entries),
  ) || st.history.some((h) => h.classId === st.activeClassId && inRange(h.date));
}

export function App() {
  useInputEngine();
  useAutoSave();
  const { toggle: toggleVoice, listening, supported } = useVoice();

  const draft = useStore((s) => s.draft);
  const theme = useStore((s) => s.settings.theme);
  const stats = useStore(selectStats);
  const visibleNos = useStore(selectVisibleNos);
  const modal = useStore((s) => s.modal);
  const setModal = useStore((s) => s.setModal);
  const storageDegraded = useStore((s) => s.storageDegraded);
  const setStorageDegraded = useStore((s) => s.setStorageDegraded);
  const readOnly = useStore((s) => s.readOnly);
  const voiceInterim = useStore((s) => s.voiceInterim);
  const filterNotPassed = useStore((s) => s.filterNotPassed);
  const posterTarget = useStore((s) => s.posterTarget);
  const envMismatch = useStore((s) => s.envMismatch);
  const setEnvMismatch = useStore((s) => s.setEnvMismatch);
  const blockedOverwrite = useStore((s) => s.blockedOverwrite);

  const [stage, setStage] = useState(false);
  const [busy, setBusy] = useState<OutputJob>(null);
  const generatingRef = useRef(false);
  const targetRef = useRef<PosterTarget>(posterTarget);
  targetRef.current = posterTarget;

  /** FR-49.7b：弹窗关闭后焦点回到原格（连续录入不用重新点格子） */
  const focusBackRef = useRef<number | null>(null);
  const prevModalRef = useRef<string | null>(modal);
  useEffect(() => {
    const prev = prevModalRef.current;
    prevModalRef.current = modal;
    if (modal && !prev) {
      focusBackRef.current = useStore.getState().focusedNo;
    } else if (!modal && prev) {
      const back = focusBackRef.current;
      focusBackRef.current = null;
      if (back !== null) useStore.getState().setFocusedNo(back);
    }
  }, [modal]);

  const tpl = SHEET_TEMPLATES[draft.templateId];
  const total = useStore((s) => s.classes.find((c) => c.id === s.activeClassId)?.count ?? 0);

  const handleClear = () => {
    const st = useStore.getState();
    const count = Object.keys(st.draft.entries).length;
    if (count === 0) return;
    st.openConfirm({
      title: '清空当前记录',
      message: `将清空 ${count} 格（本条登记的全部录入）。可 Ctrl+Z 撤销。`,
      confirmText: '清空',
      danger: true,
      onConfirm: () => st.clearCurrentRecord(),
    });
  };

  /** 汇总状态机（V3 §3.6）：只接收目标值，不读闭包里的旧值 */
  const handlePoster = (target: PosterTarget, job?: OutputJob) => {
    const st = useStore.getState();
    let next = target;

    // INV-23：单条目标必须存在且属于当天，否则回退当日汇总
    if (next.mode === 'single') {
      const sheetId = next.sheetId;
      const exists = selectSheetsOfDay(st).some((x) => x.sheetId === sheetId);
      if (!exists) next = { mode: 'daily' };
    }
    if (next.mode === 'daily' && !hasAnyToday(st)) {
      st.showToast('今日暂无登记', 'warn');
      return;
    }
    if (next.mode === 'week' && !hasAnyThisWeek(st, next.weekStart)) {
      st.showToast('本周暂无登记', 'warn');
      return;
    }

    st.setPosterTarget(next);
    if (st.posterUrl) URL.revokeObjectURL(st.posterUrl);
    for (const p of st.posterPages) URL.revokeObjectURL(p.url);
    st.setPoster(null, null);
    st.setPosterPages([]);
    st.setPosterLoading(true);
    st.setModal('poster');       // 立即打开，显示「生成中…」
    generatingRef.current = true;
    setBusy(job ?? null);        // FR-49.7a：对应按钮转 spinner，其余不灰
    setStage(true);
  };

  const handlePosterReady = async (nodes: HTMLElement[]) => {
    if (!generatingRef.current) return;
    generatingRef.current = false;
    try {
      const pages: Array<{ url: string; blob: Blob }> = [];
      for (const node of nodes) {
        const blob = await rasterizeWithRetry(node);
        pages.push({ url: URL.createObjectURL(blob), blob });
      }
      if (!pages.length) throw new Error('EMPTY_POSTER');
      const st = useStore.getState();
      if (st.posterUrl) URL.revokeObjectURL(st.posterUrl);
      for (const p of st.posterPages) URL.revokeObjectURL(p.url);
      st.setPosterPages(pages);
      st.setPoster(pages[0].url, pages[0].blob);
      st.setModal('poster');
    } catch {
      useStore.getState().showToast('图片生成失败，请重试', 'error');
      useStore.getState().setModal(null);
    } finally {
      useStore.getState().setPosterLoading(false);
      setBusy(null);
      setStage(false);
    }
  };

  // 快捷键事件（Ctrl+Enter / Ctrl+J）
  useEffect(() => {
    const onReport = () => useStore.getState().setModal('report');
    const onPoster = () => handlePoster({ mode: 'single', sheetId: useStore.getState().draft.sheetId });
    window.addEventListener('xq:report', onReport);
    window.addEventListener('xq:poster', onPoster);
    return () => {
      window.removeEventListener('xq:report', onReport);
      window.removeEventListener('xq:poster', onPoster);
    };
  });

  // V4 FR-48.2：主题挂在 documentElement，模态层/弹窗也能继承；切换即时生效
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <div className="app-inner">
        {envMismatch ? (
          <div className="warn-bar warn-bar--env" role="alert">
            ⚠️ 你正在用另一种方式打开（数据存在各自空间；上次不是这个地址）。想找回旧数据请用【设置 → 数据 → 导入恢复】。
            <button type="button" onClick={() => setEnvMismatch(false)}>知道了</button>
          </div>
        ) : null}

        {blockedOverwrite ? (
          <div className="warn-bar" role="alert">
            ⚠️ 检测到数据为空，已阻止覆盖（原数据仍在）。请用【设置 → 数据】导出后再操作。
            <button
              type="button"
              onClick={() => {
                const st = useStore.getState();
                downloadBlob(exportAllBlob(st.exportState()), `学情备份-${todayISO()}.json`);
              }}
            >
              导出备份
            </button>
          </div>
        ) : null}

        {readOnly ? (
          <div className="warn-bar" role="alert">
            ⚠️ 数据升级失败，当前为只读模式（不会覆盖你的原始数据）
            <button
              type="button"
              onClick={() => {
                const st = useStore.getState();
                downloadBlob(exportAllBlob(st.exportState()), `学情备份-${todayISO()}.json`);
              }}
            >
              导出备份
            </button>
          </div>
        ) : null}

        {storageDegraded ? (
          <div className="warn-bar" role="alert">
            ⚠️ 浏览器存储不可用，刷新后数据会丢失，建议先导出备份
            <button type="button" onClick={() => setStorageDegraded(false)}>知道了</button>
          </div>
        ) : null}

        <Header
          onImport={() => setModal('import')}
          onSettings={() => setModal('settings')}
          onManual={() => setModal('manual')}
        />
        <ParamsBar />
        <OutputBar
          busy={busy}
          onReport={() => setModal('report')}
          onPoster={() => handlePoster({ mode: 'single', sheetId: draft.sheetId }, 'poster')}
          onSummary={() => handlePoster({ mode: 'daily' }, 'daily')}
          onWeek={() => handlePoster({ mode: 'week', weekStart: weekStartOf(draft.date) }, 'week')}
        />
        <InputBar
          onVoice={toggleVoice}
          voiceListening={listening}
          voiceSupported={supported}
          onClear={handleClear}
          onSave={() => useStore.getState().commitToHistory()}
        />

        {tpl.showStatBar ? (
          <div className="stats-slot">
            <StatsBar metrics={stats} schemeLabel={SCHEME_LABEL[draft.scheme.kind]} />
          </div>
        ) : null}

        {tpl.showGraph ? (
          <div className="charts-slot">
            <ChartsCard />
          </div>
        ) : null}

        <HintBar
          templateId={draft.templateId}
          scheme={draft.scheme}
          filterNotPassed={filterNotPassed}
          notPassedCount={visibleNos.length}
          total={total}
        />
        <Grid />
      </div>

      {modal === 'settings' ? <SettingsModal /> : null}
      {modal === 'report' ? <ReportModal /> : null}
      {modal === 'poster' ? (
        <PosterModal
          target={posterTarget}
          onSwitch={handlePoster}
          onRegenerate={() => handlePoster(useStore.getState().posterTarget)}
        />
      ) : null}
      {modal === 'import' ? <ImportRosterModal /> : null}
      {modal === 'scheme' ? <SchemeModal /> : null}
      {modal === 'makeup' ? <MakeupModal /> : null}
      {modal === 'points' ? <PointsModal /> : null}
      {modal === 'export' ? <ExportModal /> : null}
      {modal === 'manual' ? <ManualModal /> : null}
      <ConfirmModal />
      <Toast />
      <VoiceConfirm />

      {stage ? (
        <PosterRaster
          target={posterTarget}
          onReady={(nodes) => {
            void handlePosterReady(nodes);
          }}
        />
      ) : null}

      {listening ? (
        <div className="voice-caption" role="status" aria-live="polite">
          🎤 {voiceInterim || '聆听中…'}
        </div>
      ) : null}
    </div>
  );
}
