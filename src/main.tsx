import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { useStore } from './store';
import { loadPersistedState } from './infra/persistence';

async function bootstrap() {
  const root = createRoot(document.getElementById('root') as HTMLElement);

  const { state, recovered } = await loadPersistedState();
  if (state) {
    useStore.getState().replaceState(state);
    if (recovered) {
      window.setTimeout(() => useStore.getState().showToast('已从自动备份恢复', 'ok'), 300);
    }
  }

  root.render(<App />);

  // PWA：只在 http(s) 下注册；双击 dist/index.html（file://）时浏览器不允许 SW，静默跳过
  if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  }
}

void bootstrap();
