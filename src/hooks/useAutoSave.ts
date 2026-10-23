import { useEffect } from 'react';
import { useStore } from '../store';
import { savePersistedState, takeSnapshot } from '../infra/persistence';
import { SNAPSHOT_INTERVAL, STORAGE_KEY } from '../domain/constants';

/**
 * 自动保存（设计 §6.7 / PRD FR-10）
 * 300ms 防抖写 localStorage；visibilitychange / pagehide / beforeunload 强制落盘；每 30s 一份 IDB 快照。
 */
export function useAutoSave() {
  useEffect(() => {
    let timer: number | null = null;
    let lastSnapshot = Date.now();

    const flush = () => {
      const st = useStore.getState();
      const data = st.exportState();
      const ok = savePersistedState(data);
      if (!ok) {
        if (!st.storageDegraded) st.setStorageDegraded(true);
        return;
      }
      if (st.storageDegraded) st.setStorageDegraded(false);
      st.markSaved(Date.now());

      if (Date.now() - lastSnapshot > SNAPSHOT_INTERVAL) {
        lastSnapshot = Date.now();
        void takeSnapshot(data);
      }
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        flush();
      }, 300);
    };

    const unsubscribe = useStore.subscribe((s, prev) => {
      if (
        s.drafts !== prev.drafts ||
        s.settings !== prev.settings ||
        s.classInfo !== prev.classInfo ||
        s.history !== prev.history ||
        s.activeKey !== prev.activeKey
      ) {
        schedule();
      }
    });

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onPageHide = () => flush();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      useStore.getState().showToast('另一个标签页修改了数据，点击刷新以载入', 'warn');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    window.addEventListener('storage', onStorage);

    return () => {
      if (timer) window.clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
