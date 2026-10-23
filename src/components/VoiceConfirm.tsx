import { useEffect } from 'react';
import { useStore } from '../store';

/** 语音回显确认条（设计 04 §6.8.6）：闪示 + 可撤销，不阻塞后续命令 */
export function VoiceConfirm() {
  const banners = useStore((s) => s.voiceBanners);
  const remove = useStore((s) => s.removeVoiceBanner);
  const undo = useStore((s) => s.undo);

  useEffect(() => {
    if (!banners.length) return;
    const timer = window.setTimeout(() => {
      const s = useStore.getState();
      for (const b of s.voiceBanners) s.removeVoiceBanner(b.id);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [banners]);

  if (!banners.length) return null;

  return (
    <div className="voice-banners" role="status" aria-live="polite">
      {banners.map((b) => (
        <div className="voice-banner" key={b.id} data-tone={b.tone}>
          <span>{b.text}</span>
          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              undo();
              remove(b.id);
            }}
          >
            撤销
          </button>
          <button type="button" className="btn-sm" aria-label="关闭提示" onClick={() => remove(b.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
