import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { useStore } from './store';
import { loadState } from './infra/storage';

async function bootstrap() {
  const root = createRoot(document.getElementById('root') as HTMLElement);

  const result = await loadState();
  if (result.state) {
    useStore.getState().replaceState(result.state);
    if (result.migrated) {
      window.setTimeout(() => useStore.getState().showToast('已把旧版数据升级到 V2（原始数据已备份）', 'ok'), 300);
    } else if (result.recovered) {
      window.setTimeout(() => useStore.getState().showToast('已从自动备份恢复', 'ok'), 300);
    }
  } else if (result.error) {
    const msg =
      result.error === 'NEWER_VERSION'
        ? '数据由更新版本创建，请升级后再打开（当前为只读）'
        : result.error === 'MIGRATE_FAILED'
          ? '数据升级失败，已备份原始数据，可下载备份后联系维护者'
          : '数据结构无法识别，已进入只读模式，建议先下载备份';
    useStore.getState().setReadOnly(true);
    window.setTimeout(() => useStore.getState().showToast(msg, 'error'), 300);
  }

  root.render(<App />);

  // PWA：只在 http(s) 下注册；双击 dist/index.html（file://）时浏览器不允许 SW，静默跳过
  if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  }
}

void bootstrap();
