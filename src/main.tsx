import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { useStore } from './store';
import { hasUserClearedMarker, loadState, markBooted, saveState, takeSnapshot } from './infra/storage';
import { getSnapshots } from './infra/idb';
import { readEnvMark, readLastBackupAt, writeEnvMark } from './infra/backup';
import { shouldRemindExport } from './domain/remind';

async function bootstrap() {
  const root = createRoot(document.getElementById('root') as HTMLElement);

  const result = await loadState();
  if (result.state) {
    useStore.getState().replaceState(result.state);
    markBooted();
    // v2.8.2：每次成功打开都留一份「已知良好」快照，主存出问题时还能回到今天这一步
    void takeSnapshot(useStore.getState().exportState());

    // v2.8.2 自愈：主存储是空的，但本机还有快照 → 自动恢复最近一份有数据快照。
    // 用户明确清空过的（有 marker）不打扰。
    const cur = useStore.getState();
    const realRecords = Object.values(cur.records).filter((r) => Object.keys(r.entries ?? {}).length > 0).length;
    const work = realRecords + cur.history.length + cur.pointLedger.length;
    let hadEnv = false;
    try { hadEnv = !!localStorage.getItem('xq.env'); } catch { /* ignore */ }
    if (work === 0 && hadEnv && !hasUserClearedMarker()) {
      const snaps = await getSnapshots();
      for (const snap of snaps) {
        try {
          const st = JSON.parse(snap.payload);
          const n = (st.records?.length ?? 0) + (st.history?.length ?? 0) + (st.pointLedger?.length ?? 0);
          if (n > 0) {
            useStore.getState().replaceState(st);
            saveState(useStore.getState().exportState());
            window.setTimeout(() => useStore.getState().showToast('主数据为空，已自动从本机快照恢复', 'ok', 6000), 400);
            break;
          }
        } catch { /* 跳过坏快照 */ }
      }
    }

    if (result.recovered) {
      // 从快照恢复后立刻固化：主存此刻仍是坏数据，不写回的话下次刷新还得靠快照
      saveState(useStore.getState().exportState());
      window.setTimeout(() => useStore.getState().showToast('已从自动备份恢复（损坏原文已另存）', 'ok'), 300);
    }
    if (result.migrated) {
      const extra = result.notes.length ? `：${result.notes.join('；')}` : '';
      window.setTimeout(() => useStore.getState().showToast(`已把旧版数据升级到 V3（原始数据已备份）${extra}`, 'ok'), 300);
    } else if (!result.recovered && result.notes.length) {
      window.setTimeout(() => useStore.getState().showToast(result.notes.join('；'), 'ok'), 300);
    }

    // 打开方式指纹（BR-77）：origin 变了就提示，但不阻止使用
    const mark = readEnvMark();
    const origin = typeof location !== 'undefined' ? location.origin : '';
    if (mark && mark.origin && mark.origin !== origin) {
      useStore.getState().setEnvMismatch(true);
    }
    writeEnvMark();

    // 自动备份提醒：严格按【设置 → 备份提醒】的天数执行。
    // 上次导出时间取「settings.lastExportAt」与本地标记中较新的一个；
    // 从未导出过时，以第一条数据的时间为基准——数据不满 N 天不打扰老师。
    const s = useStore.getState();
    const recs = Object.values(s.records);
    const firstDataAt = recs.length
      ? Math.min(...recs.map((r) => r.createdAt))
      : (s.history.length ? Math.min(...s.history.map((h) => h.createdAt)) : null);
    const fromSettings = s.settings.lastExportAt ? Date.parse(s.settings.lastExportAt) : NaN;
    const fromLocal = readLastBackupAt();
    const lastAt = Math.max(Number.isNaN(fromSettings) ? 0 : fromSettings, fromLocal ?? 0) || null;
    if (shouldRemindExport(lastAt ? new Date(lastAt).toISOString() : null, new Date(), s.settings.autoBackupDays, firstDataAt)) {
      window.setTimeout(() => {
        useStore.getState().showToast('已有一段时间没导出备份了，建议【设置 → 数据 → 导出全部数据】', 'warn');
      }, 1200);
    }
  } else if (result.error) {
    const msg =
      result.error === 'NEWER_VERSION'
        ? '数据由更新版本创建，请升级后再打开（当前为只读）'
        : result.error === 'MIGRATE_FAILED'
          ? '数据升级失败，已备份原始数据，可下载备份后联系维护者'
          : '数据结构无法识别，已进入只读模式，建议先下载备份';
    useStore.getState().setReadOnly(true, result.error);
    window.setTimeout(() => useStore.getState().showToast(msg, 'error'), 300);
    markBooted();   // 只读态允许渲染，但 flush 会因 readOnly 直接返回
  } else {
    markBooted();
    writeEnvMark();
  }

  root.render(<App />);

  if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  }
}

void bootstrap();
// DEBUG-TMP
if (typeof window !== 'undefined') (window as any).__xq = useStore;
