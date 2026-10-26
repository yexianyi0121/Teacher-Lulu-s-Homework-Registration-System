import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export function ConfirmModal() {
  const req = useStore((s) => s.confirmRequest);
  const close = useStore((s) => s.closeConfirm);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    setTyped('');
  }, [req]);

  if (!req) return null;

  const canConfirm = !req.requireText || typed === req.requireText;

  return (
    <Modal
      title={req.title}
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>
            取消
          </Pill>
          <Pill
            variant={req.danger ? 'report' : 'save'}
            disabled={!canConfirm}
            onClick={() => {
              close();
              req.onConfirm();
            }}
          >
            {req.confirmText ?? '确定'}
          </Pill>
        </>
      }
    >
      <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
        {req.message}
      </div>
      {req.requireText ? (
        <div className="field" style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="confirm-typed">
            请输入「{req.requireText}」以确认
          </label>
          <input
            id="confirm-typed"
            type="text"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      ) : null}
    </Modal>
  );
}
