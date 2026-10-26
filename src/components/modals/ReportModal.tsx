import { useRef } from 'react';
import { useStore } from '../../store';
import { selectReport } from '../../store/selectors';
import { copyText } from '../../infra/clipboard';
import { downloadText } from '../../infra/download';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export function ReportModal() {
  const report = useStore(selectReport);
  const date = useStore((s) => s.draft.date);
  const setModal = useStore((s) => s.setModal);
  const showToast = useStore((s) => s.showToast);

  const close = () => setModal(null);

  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    const ok = await copyText(report);
    if (ok) {
      showToast('已复制，去微信群粘贴吧 ✓', 'ok');
      return;
    }
    // U-04：复制失败时只说「请手动选中复制」，老师还得自己拖选一大段。
    // 直接把整段文案选中，她按 Ctrl+C 就行。
    const el = preRef.current;
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    showToast('自动复制被浏览器拦住了，已帮你全选，按 Ctrl+C 即可', 'warn', 5000);
  };

  return (
    <Modal
      title="报表预览"
      size="lg"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>关闭</Pill>
          <Pill variant="ghost" onClick={() => downloadText(report, `学情报表-${date}.txt`)}>
            ⬇️ 下载 txt
          </Pill>
          <Pill variant="report" onClick={handleCopy}>📋 复制文案</Pill>
        </>
      }
    >
      <pre className="report-pre" data-testid="report-text" ref={preRef} tabIndex={-1}>{report}</pre>
    </Modal>
  );
}
