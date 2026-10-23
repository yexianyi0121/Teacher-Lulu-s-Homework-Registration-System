import { useEffect } from 'react';
import { useStore } from '../store';
import { saveState, takeSnapshot } from '../infra/storage';
import { SNAPSHOT_INTERVAL } from '../domain/constants';

/** 自动保存（设计 04 §4.6 / V1 §6.7）：300ms 防抖 + 30s 快照 + 离开页面前 flush */
export function useAutoSave() {
  useEffect(() => {
    let timer: number | null = null;
    let lastSnapshot = Date.now();

    const flush = () => {
      const s = useStore.getState();
      if (s.readOnly) return;
      const ok = saveState(s.exportState());
      if (ok) {
        useStore.getState().markSaved(Date.now());
        if (useStore.getState().storageDegraded) useStore.getState().setStorageDegraded(false);
      } else {
        useStore.getState().setStorageDegraded(true);
      }
    };

    const unsubscribe = useStore.subscribe((s, prev) => {
      // 只关心数据变化，不因 toast / 焦点等 UI 变化触发写盘
      const dataChanged =
        s.draft !== prev.draft ||
        s.records !== prev.records ||
        s.history !== prev.history ||
        s.classes !== prev.classes ||
        s.settings !== prev.settings ||
        s.pointLedger !== prev.pointLedger ||
        s.pointRules !== prev.pointRules;
      if (!dataChanged) return;

      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        flush();
        if (Date.now() - lastSnapshot > SNAPSHOT_INTERVAL) {
          lastSnapshot = Date.now();
          void takeSnapshot(useStore.getState().exportState());
        }
      }, 300);
    });

    const onHide = () => {
      if (timer) window.clearTimeout(timer);
      flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('xq.')) {
        useStore.getState().showToast('检测到另一个标签页修改了数据，建议刷新避免覆盖', 'warn');
      }
    };

    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
