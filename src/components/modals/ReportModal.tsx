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

  const handleCopy = async () => {
    const ok = await copyText(report);
    showToast(ok ? '已复制，去微信群粘贴吧 ✓' : '复制失败，请手动选中复制', ok ? 'ok' : 'warn');
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
      <pre className="report-pre" data-testid="report-text">{report}</pre>
    </Modal>
  );
}
