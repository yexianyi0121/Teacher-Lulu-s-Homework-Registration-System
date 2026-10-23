import { useEffect } from 'react';
import { useStore } from '../store';
import { isBooted, saveState, takeSnapshot } from '../infra/storage';
import { SNAPSHOT_INTERVAL } from '../domain/constants';

/** 自动保存（V3 §3.8）：300ms 防抖 + 30s 快照 + 离开页面前 flush + 覆盖保护 */
export function useAutoSave() {
  useEffect(() => {
    let timer: number | null = null;
    let lastSnapshot = Date.now();

    const flush = () => {
      // 启动闸门：replaceState 之前一律不写盘，避免「空态覆盖」（FR-44 的首要嫌疑）
      if (!isBooted()) return;
      const s = useStore.getState();
      if (s.readOnly) return;

      const result = saveState(s.exportState());
      if (result.ok) {
        useStore.getState().markSaved(Date.now());
        if (useStore.getState().storageDegraded) useStore.getState().setStorageDegraded(false);
        return;
      }
      if (result.blocked) {
        useStore.getState().setBlockedOverwrite(true);
        useStore.getState().setReadOnly(true);
        useStore.getState().showToast('检测到数据为空，已阻止覆盖', 'error');
        return;
      }
      useStore.getState().setStorageDegraded(true);
    };

    const unsubscribe = useStore.subscribe((s, prev) => {
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
