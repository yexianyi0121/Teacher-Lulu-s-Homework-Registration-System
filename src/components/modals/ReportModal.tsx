import { useStore } from '../../store';
import { useReport } from '../../hooks/useReport';
import { copyText, downloadText } from '../../infra/clipboard';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export function ReportModal() {
  const report = useReport();
  const setModal = useStore((s) => s.setModal);
  const showToast = useStore((s) => s.showToast);
  const date = useStore((s) => s.drafts[s.activeKey]?.date ?? '');

  const close = () => setModal(null);

  const handleCopy = async () => {
    const ok = await copyText(report);
    if (ok) showToast('已复制，去微信群粘贴吧 ✓', 'ok');
    else showToast('复制失败，请三击选中后按 Ctrl+C', 'warn');
  };

  return (
    <Modal
      title="报表预览"
      size="lg"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>
            关闭
          </Pill>
          <Pill variant="ghost" onClick={() => downloadText(report, `学情反馈-${date || '未命名'}.txt`)}>
            ⬇️ 下载 .txt
          </Pill>
          <Pill variant="report" onClick={handleCopy}>
            📋 复制文案
          </Pill>
        </>
      }
    >
      <pre className="report-pre" data-testid="report-text">
        {report}
      </pre>
    </Modal>
  );
}
