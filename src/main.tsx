import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { useStore } from './store';
import { loadState, markBooted, saveState } from './infra/storage';
import { readEnvMark, shouldRemindBackup, writeEnvMark } from './infra/backup';

async function bootstrap() {
  const root = createRoot(document.getElementById('root') as HTMLElement);

  const result = await loadState();
  if (result.state) {
    useStore.getState().replaceState(result.state);
    markBooted();

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

    // 自动备份提醒（BR-78）：只提醒，不自动下载
    const s = useStore.getState();
    if (shouldRemindBackup(s.settings.autoBackupDays)) {
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
