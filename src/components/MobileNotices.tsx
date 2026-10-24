import { useMemo } from 'react';
import { useStore } from '../store';
import { hasEntries } from '../store/initial';
import { daysSinceExport, shouldRemindExport } from '../domain/remind';
import { exportAllBlob, markBackupDone } from '../infra/backup';
import { downloadBlob } from '../infra/download';
import { todayISO } from '../domain/date';

/** 已作为 PWA 安装运行时不再显示「添加到主屏幕」 */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia?.('(display-mode: standalone)');
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !!mm?.matches || iosStandalone;
}

/**
 * 移动端底部提示条（V4 FR-51.1 / FR-51.2）：
 * ① 安装提示：首次在手机打开时提示「添加到主屏幕」，可关闭（存 installHintDismissed）；
 * ② 导出提醒：距上次导出 ≥ 7 天时提醒备份（iOS 会清理站点存储，纯前端 PWA 的真实风险）。
 * 固定在底部操作条上方，仅 ≤767px 显示；桌面端仍走既有的 BR-78 Toast 提醒。
 */
export function MobileNotices() {
  const installDismissed = useStore((s) => s.settings.installHintDismissed);
  const lastExportAt = useStore((s) => s.settings.lastExportAt);
  const hasData = useStore(
    (s) => Object.values(s.records).some((r) => hasEntries(r.entries)) || s.history.length > 0,
  );
  // 挂载时取一次时钟：一天内的会话不必反复重算
  const now = useMemo(() => new Date(), []);
  const installed = useMemo(() => isStandalone(), []);
  const days = daysSinceExport(lastExportAt, now);
  const showInstall = !installed && !installDismissed;
  const showExport = hasData && shouldRemindExport(lastExportAt, now);

  if (!showInstall && !showExport) return null;

  const backup = () => {
    const st = useStore.getState();
    downloadBlob(exportAllBlob(st.exportState()), `学情备份-${todayISO()}.json`);
    markBackupDone();            // 既有 BR-78 桌面提醒同源
    st.markExported();           // FR-51.2：移动端 7 天提醒同源
  };

  return (
    <div className="mobile-notices">
      {showInstall ? (
        <div className="mobile-notice mobile-notice--install" data-testid="install-hint">
          <span>📲 添加到主屏幕，用起来更像 App</span>
          <button
            type="button"
            onClick={() => useStore.getState().updateSettings({ installHintDismissed: true })}
          >
            知道了
          </button>
        </div>
      ) : null}

      {showExport ? (
        <div className="mobile-notice mobile-notice--export" data-testid="export-remind" role="status">
          <span>
            🔒 {days === null ? '还没备份过' : `已 ${Math.floor(days)} 天没备份`}，建议导出一份（iPhone 久不用会清理网页数据）
          </span>
          <button type="button" onClick={backup}>导出备份</button>
        </div>
      ) : null}
    </div>
  );
}
