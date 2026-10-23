import { useStore } from '../../store';
import { copyPngBlob, downloadBlob } from '../../infra/clipboard';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export interface PosterModalProps {
  onRegenerate: () => void;
}

export function PosterModal({ onRegenerate }: PosterModalProps) {
  const url = useStore((s) => s.posterUrl);
  const blob = useStore((s) => s.posterBlob);
  const loading = useStore((s) => s.posterLoading);
  const setModal = useStore((s) => s.setModal);
  const showToast = useStore((s) => s.showToast);
  const date = useStore((s) => s.drafts[s.activeKey]?.date ?? '');

  const close = () => setModal(null);

  const handleCopy = async () => {
    if (!blob) return;
    const ok = await copyPngBlob(blob);
    if (ok) {
      showToast('已复制图片，去微信群粘贴吧 ✓', 'ok');
      return;
    }
    downloadBlob(blob, `学情海报-${date || '未命名'}.png`);
    showToast('当前浏览器不支持复制图片，已下载 PNG，可手动粘贴', 'warn');
  };

  return (
    <Modal
      title="海报预览"
      size="xl"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>
            关闭
          </Pill>
          <Pill variant="ghost" onClick={onRegenerate} disabled={loading}>
            {loading ? '生成中…' : '🔄 重新生成'}
          </Pill>
          <Pill
            variant="ghost"
            onClick={() => {
              if (blob) downloadBlob(blob, `学情海报-${date || '未命名'}.png`);
            }}
            disabled={!blob}
          >
            ⬇️ 下载 PNG
          </Pill>
          <Pill variant="poster" onClick={handleCopy} disabled={!blob}>
            📋 复制图片
          </Pill>
        </>
      }
    >
      {url ? (
        <img className="poster-preview" src={url} alt="学情海报预览" />
      ) : (
        <div className="chart-empty">海报生成中…</div>
      )}
    </Modal>
  );
}
