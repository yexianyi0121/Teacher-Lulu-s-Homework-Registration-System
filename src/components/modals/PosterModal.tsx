import { useStore } from '../../store';
import { copyPngBlob } from '../../infra/clipboard';
import { downloadBlob } from '../../infra/download';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export function PosterModal({ onRegenerate }: { onRegenerate: () => void }) {
  const url = useStore((s) => s.posterUrl);
  const blob = useStore((s) => s.posterBlob);
  const loading = useStore((s) => s.posterLoading);
  const mode = useStore((s) => s.posterMode);
  const setMode = useStore((s) => s.setPosterMode);
  const setModal = useStore((s) => s.setModal);
  const showToast = useStore((s) => s.showToast);
  const date = useStore((s) => s.draft.date);

  const close = () => setModal(null);

  const handleCopy = async () => {
    if (!blob) return;
    const ok = await copyPngBlob(blob);
    if (ok) {
      showToast('已复制图片，去微信群粘贴吧 ✓', 'ok');
      return;
    }
    downloadBlob(blob, `${mode === 'daily' ? '当日汇总' : '学情海报'}-${date}.png`);
    showToast('当前浏览器不支持复制图片，已下载 PNG，可手动粘贴', 'warn');
  };

  return (
    <Modal
      title={mode === 'daily' ? '当日汇总预览' : '海报预览'}
      size="xl"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>关闭</Pill>
          <Pill variant="ghost" onClick={() => { setMode(mode === 'daily' ? 'single' : 'daily'); onRegenerate(); }}>
            {mode === 'daily' ? '切换为单条' : '切换为当日汇总'}
          </Pill>
          <Pill variant="ghost" onClick={onRegenerate} disabled={loading}>
            {loading ? '生成中…' : '🔄 重新生成'}
          </Pill>
          <Pill variant="ghost" onClick={() => blob && downloadBlob(blob, `${mode === 'daily' ? '当日汇总' : '学情海报'}-${date}.png`)} disabled={!blob}>
            ⬇️ 下载 PNG
          </Pill>
          <Pill variant="poster" onClick={handleCopy} disabled={!blob}>📋 复制图片</Pill>
        </>
      }
    >
      {url ? (
        <img className="poster-preview" src={url} alt={mode === 'daily' ? '当日汇总预览' : '学情海报预览'} />
      ) : (
        <div className="chart-empty">生成中…</div>
      )}
    </Modal>
  );
}
