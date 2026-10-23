import { toPng } from 'html-to-image';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve, 16);
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}

/**
 * 海报 DOM → PNG Blob（设计 §6.6.2 / §8.5，【必须】参数）
 * pixelRatio 2、skipFonts true、backgroundColor undefined（保留渐变）
 */
export async function nodeToPngBlob(node: HTMLElement): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await nextFrame();
  await nextFrame();

  const rect = node.getBoundingClientRect();
  const dataUrl = await toPng(node, {
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
    pixelRatio: 2,
    skipFonts: true,
    cacheBust: false,
    backgroundColor: undefined,
  });

  // data: URL 为本地数据，不产生网络请求
  const res = await fetch(dataUrl);
  return res.blob();
}

/** 失败重试一次（设计 §11） */
export async function rasterizeWithRetry(node: HTMLElement): Promise<Blob> {
  try {
    return await nodeToPngBlob(node);
  } catch {
    await nextFrame();
    return await nodeToPngBlob(node);
  }
}
