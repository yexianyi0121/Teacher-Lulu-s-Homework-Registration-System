import { useState } from 'react';
import { useStore } from '../../store';
import { currentClass } from '../../store';
import { MAKEUP_NOTE_MAX } from '../../domain/constants';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

/** 补交（设计 04 §7.3 / PRD FR-23）：批量 + 说明 ≤30 字 */
export function MakeupModal() {
  const selection = useStore((s) => s.selection);
  const focusedNo = useStore((s) => s.focusedNo);
  const entries = useStore((s) => s.draft.entries);
  const setMakeup = useStore((s) => s.setMakeup);
  const setModal = useStore((s) => s.setModal);
  const showToast = useStore((s) => s.showToast);
  const count = currentClass()?.count ?? 0;

  const [note, setNote] = useState('已补交');

  const targets = selection.size
    ? [...selection]
    : focusedNo !== null
      ? [focusedNo]
      : [];

  const valid = targets.filter((no) => {
    const e = entries[String(no)];
    return e?.status === 'missing' || e !== undefined;
  });

  const close = () => setModal(null);

  const confirm = () => {
    if (!valid.length) {
      showToast('请先选中要标记补交的学生', 'warn');
      return;
    }
    setMakeup(valid, note);
    close();
  };

  return (
    <Modal
      title="标记补交"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>取消</Pill>
          <Pill variant="save" onClick={confirm}>确认</Pill>
        </>
      }
    >
      <p className="field-hint">
        将对 <strong>{valid.length || 0}</strong> 人标记补交
        {targets.length > 1 ? `（仅针对选中的 ${targets.length} 人，共 ${count} 人）` : ''}
      </p>
      <div className="field">
        <label className="field-label" htmlFor="makeup-note">补交说明（≤30 字）</label>
        <input
          id="makeup-note"
          type="text"
          maxLength={MAKEUP_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="如：10/24 课后补交，全对"
        />
        <div className="field-hint">说明会写进报表的【已补交】段，可为空。</div>
      </div>
    </Modal>
  );
}
