import { useRef, useState } from 'react';
import { useStore } from './store';
import { selectStats } from './store/selectors';
import { useAutoSave } from './hooks/useAutoSave';
import { useVoice } from './hooks/useVoice';
import { rasterizeWithRetry } from './infra/rasterize';
import { Header } from './components/Header';
import { ParamsBar } from './components/ParamsBar';
import { ActionsBar } from './components/ActionsBar';
import { StatsBar } from './components/StatsBar';
import { ChartsCard } from './components/ChartsCard';
import { HintBar } from './components/HintBar';
import { Grid } from './components/Grid';
import { PosterRaster } from './components/PosterRaster';
import { SettingsModal } from './components/modals/SettingsModal';
import { ReportModal } from './components/modals/ReportModal';
import { PosterModal } from './components/modals/PosterModal';
import { ImportRosterModal } from './components/modals/ImportRosterModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { Toast } from './components/ui/Toast';

export function App() {
  useAutoSave();
  const { toggle: toggleVoice, listening } = useVoice();

  const rec = useStore((s) => s.drafts[s.activeKey]);
  const classInfo = useStore((s) => s.classInfo);
  const settings = useStore((s) => s.settings);
  const stats = useStore(selectStats);
  const modal = useStore((s) => s.modal);
  const setModal = useStore((s) => s.setModal);
  const storageDegraded = useStore((s) => s.storageDegraded);
  const setStorageDegraded = useStore((s) => s.setStorageDegraded);
  const voiceInterim = useStore((s) => s.voiceInterim);

  const [stage, setStage] = useState(false);
  const generatingRef = useRef(false);

  const mode = rec?.mode ?? 'homework';

  const handleClear = () => {
    const st = useStore.getState();
    const count = Object.keys(st.drafts[st.activeKey]?.entries ?? {}).length;
    if (count === 0) return;
    st.openConfirm({
      title: '清空当前记录',
      message: `确定清空本条记录的全部录入（${count} 个单元格）？可撤销。`,
      confirmText: '清空',
      danger: true,
      onConfirm: () => st.clearCurrentRecord(),
    });
  };

  const handleGeneratePoster = () => {
    const st = useStore.getState();
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
      useStore.getState().showToast('海报生成失败，请重试', 'error');
    } finally {
      useStore.getState().setPosterLoading(false);
      setStage(false);
    }
  };

  return (
    <div className="app">
      <div className="app-inner">
        {storageDegraded ? (
          <div className="warn-bar" role="alert">
            ⚠️ 浏览器存储不可用，刷新后数据会丢失，建议先导出备份
            <button type="button" onClick={() => setStorageDegraded(false)}>
              知道了
            </button>
          </div>
        ) : null}

        <Header onImport={() => setModal('import')} onSettings={() => setModal('settings')} />
        <ParamsBar />
        <ActionsBar
          onVoice={toggleVoice}
          onReport={() => setModal('report')}
          onPoster={handleGeneratePoster}
          onClear={handleClear}
          onSave={() => useStore.getState().commitToHistory()}
        />

        {mode === 'quiz' ? (
          <div className="stats-slot">
            <StatsBar
              mode={mode}
              metrics={stats}
              excellentLine={settings.excellentLine}
              passLine={settings.passLine}
            />
          </div>
        ) : null}

        {mode === 'quiz' ? (
          <div className="charts-slot">
            <ChartsCard />
          </div>
        ) : null}

        <HintBar mode={mode} />
        <Grid mode={mode} />
      </div>

      {modal === 'settings' ? <SettingsModal /> : null}
      {modal === 'report' ? <ReportModal /> : null}
      {modal === 'poster' ? <PosterModal onRegenerate={handleGeneratePoster} /> : null}
      {modal === 'import' ? <ImportRosterModal /> : null}
      <ConfirmModal />
      <Toast />

      {stage && rec ? (
        <PosterRaster
          classInfo={classInfo}
          date={rec.date}
          content={rec.content}
          mode={rec.mode}
          entries={rec.entries}
          n={settings.count}
          settings={settings}
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
