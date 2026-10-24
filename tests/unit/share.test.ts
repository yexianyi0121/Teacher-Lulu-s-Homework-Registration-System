import { afterEach, describe, expect, it, vi } from 'vitest';

// downloadBlob 在 jsdom 里会真的造 <a download> 点击，mock 掉只记录调用
vi.mock('../../src/infra/download', () => ({
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from '../../src/infra/download';
import { canShareFiles, shareImageBlob } from '../../src/infra/share';

const blob = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

type ShareData = { files?: File[]; title?: string; text?: string };

function stubShare(impl: ((d: ShareData) => Promise<void>) | null, canShare?: (d: ShareData) => boolean) {
  Object.defineProperty(navigator, 'share', { value: impl ?? undefined, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true });
}

afterEach(() => {
  stubShare(null, undefined);
  vi.mocked(downloadBlob).mockClear();
});

describe('canShareFiles（FR-51.3 / A-95）', () => {
  it('没有 navigator.share → false', () => {
    stubShare(null, undefined);
    expect(canShareFiles()).toBe(false);
  });

  it('有 share 且 canShare 认可文件 → true', () => {
    stubShare(async () => {}, () => true);
    expect(canShareFiles()).toBe(true);
  });

  it('有 share 但 canShare 拒绝文件 → false', () => {
    stubShare(async () => {}, () => false);
    expect(canShareFiles()).toBe(false);
  });

  it('有 share 没有 canShare（老实现）→ 交给 share() 自己抛', () => {
    stubShare(async () => {}, undefined);
    expect(canShareFiles()).toBe(true);
  });

  it('canShare 抛异常 → false（不崩）', () => {
    stubShare(async () => {}, () => {
      throw new Error('boom');
    });
    expect(canShareFiles()).toBe(false);
  });
});

describe('shareImageBlob', () => {
  it('不支持分享 → 回退下载', async () => {
    stubShare(null, undefined);
    const r = await shareImageBlob(blob(), 'a.png', '标题');
    expect(r).toBe('downloaded');
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });

  it('支持分享 → 调起 navigator.share 且带 File', async () => {
    const calls: ShareData[] = [];
    stubShare(async (d) => void calls.push(d), () => true);
    const r = await shareImageBlob(blob(), 'a.png', '标题', '正文');
    expect(r).toBe('shared');
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0].files?.[0]).toBeInstanceOf(File);
    expect(calls[0].files?.[0].name).toBe('a.png');
    expect(calls[0].title).toBe('标题');
    expect(calls[0].text).toBe('正文');
  });

  it('用户取消分享（AbortError）→ 不下载不提示失败', async () => {
    stubShare(async () => {
      throw new DOMException('cancelled', 'AbortError');
    }, () => true);
    const r = await shareImageBlob(blob(), 'a.png', '标题');
    expect(r).toBe('cancelled');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('share 抛普通错误 → 回退下载', async () => {
    stubShare(async () => {
      throw new Error('NotAllowedError');
    }, () => true);
    const r = await shareImageBlob(blob(), 'a.png', '标题');
    expect(r).toBe('downloaded');
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });
});
