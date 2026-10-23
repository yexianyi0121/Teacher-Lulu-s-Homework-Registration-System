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

/** data: URL → Blob（不用 fetch，彻底避免任何网络栈调用） */
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * 海报 DOM → PNG Blob（设计 04 §6.6.2 / V1 §8.5）
 * pixelRatio 2、skipFonts true、backgroundColor undefined（保留渐变）；
 * 高度用 scrollHeight，支持「当日汇总」这种很高的长图。
 */
export async function nodeToPngBlob(node: HTMLElement): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await nextFrame();
  await nextFrame();

  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(Math.max(rect.height, node.scrollHeight));

  const dataUrl = await toPng(node, {
    width,
    height,
    pixelRatio: 2,
    skipFonts: true,
    cacheBust: false,
    backgroundColor: undefined,
  });

  return dataUrlToBlob(dataUrl);
}

/** 失败重试一次（设计 §11 降级矩阵） */
export async function rasterizeWithRetry(node: HTMLElement): Promise<Blob> {
  try {
    return await nodeToPngBlob(node);
  } catch {
    await nextFrame();
    return await nodeToPngBlob(node);
  }
}
