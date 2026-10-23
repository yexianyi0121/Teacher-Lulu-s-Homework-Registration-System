import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { selectStats, selectVisibleNos } from './store/selectors';
import { SHEET_TEMPLATES, SCHEME_LABEL } from './domain/constants';
import { useInputEngine } from './hooks/useInputEngine';
import { useAutoSave } from './hooks/useAutoSave';
import { useVoice } from './hooks/useVoice';
import { rasterizeWithRetry } from './infra/rasterize';
import { downloadText } from './infra/download';
import { readV1Backup } from './infra/storage';
import { Header } from './components/Header';
import { ParamsBar } from './components/ParamsBar';
import { ActionsBar } from './components/ActionsBar';
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

export function App() {
  useInputEngine();
  useAutoSave();
  const { toggle: toggleVoice, listening, supported } = useVoice();

  const draft = useStore((s) => s.draft);
  const stats = useStore(selectStats);
  const visibleNos = useStore(selectVisibleNos);
  const modal = useStore((s) => s.modal);
  const setModal = useStore((s) => s.setModal);
  const storageDegraded = useStore((s) => s.storageDegraded);
  const setStorageDegraded = useStore((s) => s.setStorageDegraded);
  const readOnly = useStore((s) => s.readOnly);
  const voiceInterim = useStore((s) => s.voiceInterim);
  const filterNotPassed = useStore((s) => s.filterNotPassed);
  const posterMode = useStore((s) => s.posterMode);

  const [stage, setStage] = useState(false);
  const generatingRef = useRef(false);

  const tpl = SHEET_TEMPLATES[draft.templateId];

  const handleClear = () => {
    const st = useStore.getState();
    const count = Object.keys(st.draft.entries).length;
    if (count === 0) return;
    st.openConfirm({
      title: '清空当前记录',
      message: `确定清空本条登记的全部录入（${count} 个单元格）？可 Ctrl+Z 撤销。`,
      confirmText: '清空',
      danger: true,
      onConfirm: () => st.clearCurrentRecord(),
    });
  };

  const handlePoster = (mode: 'single' | 'daily') => {
    const st = useStore.getState();
    st.setPosterMode(mode);
    if (mode === 'daily') {
      const hasAny = Object.values(st.records).some((r) => r.classId === st.activeClassId && r.date === st.draft.date)
        || st.history.some((h) => h.classId === st.activeClassId && h.date === st.draft.date);
      if (!hasAny) {
        st.showToast('今日暂无登记', 'warn');
        return;
      }
    }
    if (st.posterUrl) URL.revokeObjectURL(st.posterUrl);
    st.setPoster(null, null);
    st.setPosterLoading(true);
    generatingRef.current = true;
    setStage(true);
  };

  const handlePosterReady = async (node: HTMLElement) => {
    if (!generatingRef.current) return;
    generatingRef.current = false;
    try {
      const blob = await rasterizeWithRetry(node);
      const url = URL.createObjectURL(blob);
      const st = useStore.getState();
      if (st.posterUrl) URL.revokeObjectURL(st.posterUrl);
      st.setPoster(url, blob);
      st.setModal('poster');
    } catch {
      useStore.getState().showToast('图片生成失败，请重试', 'error');
    } finally {
      useStore.getState().setPosterLoading(false);
      setStage(false);
    }
  };

  // 快捷键事件（Ctrl+Enter / Ctrl+J）
  useEffect(() => {
    const onReport = () => useStore.getState().setModal('report');
    const onPoster = () => handlePoster('single');
    window.addEventListener('xq:report', onReport);
    window.addEventListener('xq:poster', onPoster);
    return () => {
      window.removeEventListener('xq:report', onReport);
      window.removeEventListener('xq:poster', onPoster);
    };
  });

  return (
    <div className="app">
      <div className="app-inner">
        {readOnly ? (
          <div className="warn-bar" role="alert">
            ⚠️ 数据升级失败，当前为只读模式（不会覆盖你的原始数据）
            <button
              type="button"
              onClick={() => {
                const raw = readV1Backup();
                if (raw) downloadText(raw, '学情登记-原始备份.json', 'application/json');
                else useStore.getState().showToast('没有找到原始备份文件', 'warn');
              }}
            >
              下载原始备份
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
        <ActionsBar
          onVoice={toggleVoice}
          voiceListening={listening}
          voiceSupported={supported}
          onReport={() => setModal('report')}
          onPoster={() => handlePoster('single')}
          onSummary={() => handlePoster('daily')}
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
          filterNotPassed={filterNotPassed}
          notPassedCount={visibleNos.length}
          total={useStore.getState().classes.find((c) => c.id === useStore.getState().activeClassId)?.count ?? 0}
        />
        <Grid />
      </div>

      {modal === 'settings' ? <SettingsModal /> : null}
      {modal === 'report' ? <ReportModal /> : null}
      {modal === 'poster' ? <PosterModal onRegenerate={() => handlePoster(posterMode)} /> : null}
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
          onReady={(node) => {
            void handlePosterReady(node);
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
