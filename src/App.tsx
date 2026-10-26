import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
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
import { exportAllBlob, exportRawBackup, markBackupDone, readRawStateText } from './infra/backup';
import { downloadBlob } from './infra/download';
import { Header } from './components/Header';
import { ParamsBar } from './components/ParamsBar';
import { OutputBar, type OutputJob } from './components/OutputBar';
import { InputBar } from './components/InputBar';
import { StatsBar } from './components/StatsBar';
import { ChartsCard } from './components/ChartsCard';
import { HintBar } from './components/HintBar';
import { Grid } from './components/Grid';
import { MobileKeypad } from './components/MobileKeypad';
import { MobileNotices } from './components/MobileNotices';
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

/** 当前这张表（当天 + 当前模板 + 当前内容）是否已经有任何录入（U-01/U-02） */
// FR-64.4（U-02）：单条海报的目标是任意当天记录（records / history / 当前草稿），按 key 解析。
function hasAnyInSheet(st: ReturnType<typeof useStore.getState>, key: string): boolean {
  const rec = st.records[key] ?? st.history.find((h) => h.key === key) ?? st.draft;
  return hasEntries(rec.entries);
}

function hasAnyInCurrentSheet(st: ReturnType<typeof useStore.getState>): boolean {
  const rec = st.records[st.draft.key] ?? st.draft;
  return hasEntries(rec.entries);
}

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
  const storageErrorReason = useStore((s) => s.storageErrorReason);
  const readOnly = useStore((s) => s.readOnly);
  const readOnlyReason = useStore((s) => s.readOnlyReason);
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

  /** V4 FR-50.4：手机端点格子 → 底部升起数字键盘（桌面仍走物理键盘，不弹） */
  const [keypadNo, setKeypadNo] = useState<number | null>(null);
  const focusedNo = useStore((s) => s.focusedNo);

  const onRootClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const cell = (e.target as HTMLElement).closest?.('.cell') as HTMLElement | null;
    if (!cell || !cell.closest('.grid')) return;      // 只认登记网格里的格子
    const no = Number(cell.dataset.no);
    if (!Number.isInteger(no) || no < 1) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    setKeypadNo(no);
  };

  // 秒跳前移焦点时，键盘板跟着搬到新格（连续录入不用重复点）
  useEffect(() => {
    if (keypadNo === null) return;
    if (focusedNo !== null && focusedNo !== keypadNo) setKeypadNo(focusedNo);
  }, [focusedNo, keypadNo]);

  // Esc 收起键盘板
  useEffect(() => {
    if (keypadNo === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKeypadNo(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keypadNo]);

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
      const key = next.key;
      const exists = selectSheetsOfDay(st).some((x) => x.key === key);
      if (!exists) next = { mode: 'daily' };
    }
    if (next.mode === 'single' && !hasAnyInSheet(st, next.key)) {
      // U-02：空表单条海报会退化成「今日海报·全班暂未提交」，不是老师要的东西
      st.showToast('这张表还没有录入任何内容，先录几个再生成海报', 'warn');
      return;
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
    const onReport = () => {
      const st = useStore.getState();
      // U-01：空表生成报表会输出「暂未提交：1号…50号」全员，老师一键发到群里就是事故。
      // 与「当日汇总/本周汇总」对齐：先拦截，并告诉老师怎么继续。
      if (!hasAnyInCurrentSheet(st)) {
        st.showToast('这张表还没有录入任何内容，先录几个再生成报表', 'warn');
        return;
      }
      st.setModal('report');
    };
    const onPoster = () => handlePoster({ mode: 'single', key: useStore.getState().draft.key });
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

  // FR-54.2：只读横幅必须说清「到底为什么」，三种原因给三种说法与出路
  const readOnlyText =
    readOnlyReason === 'NEWER_VERSION'
      ? '⚠️ 这台设备里的数据是更新版本的系统写的，当前版本读不了。请升级到最新版再打开。原始数据没有被覆盖，可以先下载留底。'
      : readOnlyReason === 'BLOCKED_OVERWRITE'
        ? '⚠️ 检测到内存数据是空的，已阻止覆盖，避免把你的登记数据清掉。请先导出备份，再决定如何处理。'
        : '⚠️ 数据读取失败，系统暂时进入只读模式：能看，但改动不会保存。原始数据没有被覆盖。建议先下载原始数据，再点击「清空并重来」，之后用【设置 → 导入恢复】把备份导回来。';

  return (
    // data-keypad：手机端键盘板打开时，底部固定条让位（否则键盘盖住操作条，
    // 录完数据点不到「出图」——v2.3.1 修 P2-1 时暴露的真实 UX 问题）
    <div className="app" onClick={onRootClick} data-keypad={keypadNo !== null ? '1' : undefined}>
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
                markBackupDone();
                st.markExported();     // FR-51.2：导出即重置 7 天提醒
              }}
            >
              导出备份
            </button>
          </div>
        ) : null}

        {readOnly ? (
          <div className="warn-bar warn-bar--readonly" role="alert">
            <span className="warn-bar__text">{readOnlyText}</span>
            <button
              type="button"
              onClick={() => {
                // D-04：只读态往往正是「数据读不出来」的时候，此时内存里的 state 是空的，
                // 原来的「导出当前数据」会下载一份 5.7KB、records=0 的空备份 ——
                // 老师以为得救了，实际交出的是空的。只读态必须优先导出**磁盘上的原始数据**。
                const raw = readRawStateText();
                const st = useStore.getState();
                if (raw) {
                  downloadBlob(exportRawBackup(raw), `学情原始数据-${todayISO()}.json`);
                  st.showToast('已导出磁盘上的原始数据（不是空的），请保管好这个文件', 'ok');
                } else {
                  downloadBlob(exportAllBlob(st.exportState()), `学情备份-${todayISO()}.json`);
                  st.showToast('磁盘上没有读到原始数据，已导出当前内存里的内容', 'warn');
                }
                markBackupDone();
                st.markExported();
              }}
            >
              导出原始数据
            </button>
            <button
              type="button"
              onClick={() => {
                const raw = readRawStateText();
                if (!raw) {
                  useStore.getState().showToast('没有读到原始数据，可能已被清空', 'warn');
                  return;
                }
                downloadBlob(exportRawBackup(raw), `学情原始数据-${todayISO()}.json`);
              }}
            >
              下载原始数据
            </button>
            <button
              type="button"
              className="warn-bar__danger"
              onClick={() => {
                const st = useStore.getState();
                st.openConfirm({
                  title: '重来一次？',
                  message:
                    '这会清空本机浏览器里的全部数据（班级、登记、历史、积分、设置），之后系统恢复正常可写。'
                    + '如果上面已经导出过备份，可以用【设置 → 导入恢复】再导回来。确定重来吗？',
                  confirmText: '清空并重来',
                  danger: true,
                  onConfirm: () => {
                    st.resetAll();
                    st.showToast('已清空，系统恢复正常，可以重新开始了', 'ok');
                  },
                });
              }}
            >
              清空并重来
            </button>
          </div>
        ) : null}

        {storageDegraded ? (
          // D-01：写盘失败绝不能只弹一条可「知道了」的横幅 —— 老师关掉后以为没事，
          // 实际后续每次录入都没落盘，第二天打开丢一整天数据。
          // 因此这里：① 说清「具体哪些东西没存上」② 按原因给不同的自救动作 ③ 不提供关闭按钮，
          // 只有真正写成功（flush 里 res.reason 消失）才自动消失。
          <div className="warn-bar" role="alert" style={{ background: '#FDECEC', color: '#B23B3B', borderColor: '#F3B4B4' }}>
            {storageErrorReason === 'quota'
              ? '⚠️ 浏览器存储空间满了，刚才做的修改没有存上（关掉页面就会丢）。请立刻「📦 导出全部数据」，再到「设置 → 历史记录」删掉旧的，然后刷新页面。'
              : '⚠️ 浏览器存储不可用，修改没有存上（关掉页面就会丢）。请立刻导出备份，并换用 Chrome / Edge 打开本页面。'}
            <button
              type="button"
              onClick={() => {
                // 不再能一键关掉；这里只跳去导出，不改变失败状态
                useStore.setState({ modal: 'settings' });
                useStore.getState().showToast('请点「📦 导出全部数据」保存一份到本地', 'warn');
              }}
            >
              📦 去导出备份
            </button>
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
          onPoster={() => handlePoster({ mode: 'single', key: draft.key }, 'poster')}
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

      <MobileNotices />

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

      {keypadNo !== null ? <MobileKeypad no={keypadNo} onClose={() => setKeypadNo(null)} /> : null}
    </div>
  );
}
