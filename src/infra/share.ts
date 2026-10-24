import { downloadBlob } from './download';

/**
 * 系统分享优先、下载兜底（V4 FR-51.3 / A-95）。
 *
 * 手机端海报/汇总生成后，优先调起 navigator.share（能直接进微信/QQ）；
 * 桌面浏览器或旧环境没有 share 时，回退成下载 PNG——行为与 E2E-40 对齐。
 */

export type ShareOutcome =
  | 'shared'      // 已调起系统分享
  | 'cancelled'   // 用户取消了分享面板
  | 'downloaded'  // 不支持分享（或分享失败），已回退下载
  | 'failed';     // 下载也失败（极少见：存储满/被拦截）

interface ShareNavigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

function nav(): ShareNavigator | undefined {
  return typeof navigator !== 'undefined' ? (navigator as unknown as ShareNavigator) : undefined;
}

/** 当前环境能否分享文件（navigator.share 存在且自称能分享文件） */
export function canShareFiles(): boolean {
  const n = nav();
  if (!n || typeof n.share !== 'function') return false;
  if (typeof n.canShare !== 'function') return true; // 老实现没有 canShare，交给 share() 自己抛
  try {
    // 探测用一个空文件；类型不符时 canShare 返回 false 而不抛
    const probe = new File([new Uint8Array(0)], 'probe.png', { type: 'image/png' });
    return n.canShare({ files: [probe], title: 'probe', text: 'probe' });
  } catch {
    return false;
  }
}

/** 分享图片 blob；不支持或失败时回退下载。返回最终结果供 UI 提示。 */
export async function shareImageBlob(
  blob: Blob,
  filename: string,
  title: string,
  text?: string,
): Promise<ShareOutcome> {
  if (!canShareFiles()) {
    try {
      downloadBlob(blob, filename);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }
  try {
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    await nav()!.share!({ files: [file], title, text });
    return 'shared';
  } catch (err) {
    // 用户主动关闭分享面板：不是错误，不打扰
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    try {
      downloadBlob(blob, filename);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }
}
