import { useMemo, useState } from 'react';
import { useStore, currentClass } from '../../store';
import { MAKEUP_NOTE_MAX } from '../../domain/constants';
import { canMakeup } from '../../domain/makeup';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

/** 补交（V3 FR-33）：候选只列缺交/请假，支持多选 + 统一说明 */
export function MakeupModal() {
  const selection = useStore((s) => s.selection);
  const focusedNo = useStore((s) => s.focusedNo);
  const entries = useStore((s) => s.draft.entries);
  const setMakeup = useStore((s) => s.setMakeup);
  const setModal = useStore((s) => s.setModal);
  const showToast = useStore((s) => s.showToast);
  const cls = currentClass();
  const count = cls?.count ?? 0;

  const [note, setNote] = useState('已补交');

  // 候选人 = 当前表里 canMakeup 为真的学号（FR-33.2）
  const candidates = useMemo(() => {
    const out: number[] = [];
    for (let no = 1; no <= count; no++) if (canMakeup(entries[String(no)])) out.push(no);
    return out;
  }, [entries, count]);

  const initial = useMemo(() => {
    const pre = selection.size ? [...selection] : (focusedNo !== null ? [focusedNo] : []);
    const valid = pre.filter((no) => candidates.includes(no));
    return new Set<number>(valid);
  }, [selection, focusedNo, candidates]);

  const [picked, setPicked] = useState<Set<number>>(initial);

  const close = () => setModal(null);
  const nameOf = (no: number) => cls?.students.find((s) => s.no === no)?.name ?? '';

  const toggle = (no: number) => {
    const next = new Set(picked);
    if (next.has(no)) next.delete(no);
    else next.add(no);
    setPicked(next);
  };

  const confirm = () => {
    if (!picked.size) {
      showToast('请先选中要标记补交的学生', 'warn');
      return;
    }
    setMakeup([...picked], note);
    close();
  };

  return (
    <Modal
      title="标记补交"
      size="lg"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>取消</Pill>
          <Pill variant="save" onClick={confirm} disabled={!picked.size}>
            确认补交 {picked.size} 人
          </Pill>
        </>
      }
    >
      <p className="field-hint">
        {candidates.length
          ? `当前有 ${candidates.length} 人缺交或请假，可补交（有分数或已过关的学生不可补交）。`
          : '当前没有缺交或请假的学生，补交只对这两种状态开放。'}
      </p>

      {candidates.length ? (
        <div className="makeup-list" role="group" aria-label="可补交学生">
          {candidates.map((no) => {
            const e = entries[String(no)];
            const tag = e?.status === 'leave' ? '假' : '缺';
            return (
              <label key={no} className="makeup-item" data-on={picked.has(no) ? '1' : '0'}>
                <input
                  type="checkbox"
                  checked={picked.has(no)}
                  onChange={() => toggle(no)}
                  aria-label={`${no}号 ${nameOf(no)}`}
                />
                <span className="makeup-no">{no}</span>
                <span className="makeup-name">{nameOf(no)}</span>
                <span className="makeup-tag" data-tag={tag}>{tag}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      <div className="field" style={{ marginTop: 12 }}>
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
