import { useEffect } from 'react';
import { useStore } from '../store';
import { diskStamp, isBooted, saveState, takeSnapshot } from '../infra/storage';
import { SNAPSHOT_INTERVAL } from '../domain/constants';

/** 自动保存（V3 §3.8）：300ms 防抖 + 30s 快照 + 离开页面前 flush + 覆盖保护 */
export function useAutoSave() {
  useEffect(() => {
    // 基线：把「我启动时磁盘的样子」当作自己写过的样子（本窗口还没写过盘）
    const bootStamp = diskStamp();
    let timer: number | null = null;
    let lastSnapshot = Date.now();
    // 我上一次成功写盘时磁盘长什么样（null = 还没写过，此刻不比对）
    let myStamp: string | null = bootStamp;
    // 已向老师报告过冲突，避免每次自动保存都重复弹
    let conflictReported = false;

    const flush = () => {
      // 启动闸门：replaceState 之前一律不写盘，避免「空态覆盖」（FR-44 的首要嫌疑）
      if (!isBooted()) return;
      const s = useStore.getState();
      if (s.readOnly) return;

      const result = saveState(s.exportState(), myStamp);
      if (result.ok) {
        myStamp = result.stamp ?? null;
        conflictReported = false;
        useStore.getState().markSaved(Date.now());
        if (useStore.getState().storageDegraded) useStore.getState().setStorageDegraded(false);
        return;
      }
      if (result.conflict) {
        // D-02/D-03：磁盘被别的窗口改过。绝不静默覆盖——先让老师知道，再让她选。
        if (!conflictReported) {
          conflictReported = true;
          useStore.getState().showToast(
            '另一个窗口也在改这份数据，为避免覆盖，这个窗口已停止保存。请先关闭其他窗口后刷新本页',
            'error',
            12000,
          );
        }
        return;
      }
      if (result.blocked) {
        useStore.getState().setBlockedOverwrite(true);
        useStore.getState().setReadOnly(true, 'BLOCKED_OVERWRITE');
        useStore.getState().showToast('检测到数据为空，已阻止覆盖', 'error');
        return;
      }
      useStore.getState().setStorageDegraded(true, result.reason ?? 'unavailable');
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
      if (!e.key || !e.key.startsWith('xq.')) return;
      // 别的窗口刚写完：把本窗口的基线更新为那个值，这样后续保存能检测到「磁盘变了」
      myStamp = diskStamp();
      if (!conflictReported) {
        conflictReported = true;
        useStore.getState().showToast(
          '检测到另一个窗口修改了数据。为避免互相覆盖，本窗口已停止保存，请刷新后继续',
          'error',
          12000,
        );
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
