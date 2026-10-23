import { createPortal } from 'react-dom';
import { useStore } from '../../store';

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return createPortal(
    <div className="toast" data-tone={toast.tone} role="status" aria-live="polite">
      {toast.text}
    </div>,
    document.body,
  );
}
