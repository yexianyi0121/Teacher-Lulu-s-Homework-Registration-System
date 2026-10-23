import { useMemo, useRef, useState } from 'react';
import { useStore, currentClass } from '../../store';
import { decodeCsv, parseRosterText } from '../../domain/roster-import';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export function ImportRosterModal() {
  const setModal = useStore((s) => s.setModal);
  const importRoster = useStore((s) => s.importRoster);
  const openConfirm = useStore((s) => s.openConfirm);
  const cls = currentClass();
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseRosterText(text), [text]);
  const close = () => setModal(null);

  const apply = () => {
    if (!parsed.students.length) return;
    const next = parsed.students.length;
    if (cls && next !== cls.count) {
      openConfirm({
        title: '导入名单会改变人数',
        message: `当前 ${cls.count} 人，导入后 ${next} 人。少出的学号数据不会被删除（只是隐藏），确定继续？`,
        confirmText: '导入',
        onConfirm: () => {
          importRoster(parsed.students);
          close();
        },
      });
      return;
    }
    importRoster(parsed.students);
    close();
  };

  return (
    <Modal
      title="导入花名册"
      size="lg"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>取消</Pill>
          <Pill variant="save" onClick={apply} disabled={!parsed.students.length}>
            导入 {parsed.students.length} 人
          </Pill>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="roster-text">粘贴名单（一行一人，可带学号）</label>
        <textarea
          id="roster-text"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'1 张三\n2 李四\n王五'}
        />
        <div className="field-hint">
          支持「1 张三」「1,张三」「纯姓名」三种写法；超过 120 人会截断。
        </div>
      </div>

      <div className="settings-actions">
        <Pill variant="ghost" onClick={() => fileRef.current?.click()}>📂 选择 CSV / TXT</Pill>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/plain,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const buf = await f.arrayBuffer();
            setText(decodeCsv(buf));
            e.target.value = '';
          }}
        />
      </div>

      {parsed.warnings.length ? (
        <ul className="field-hint" style={{ marginTop: 8 }}>
          {parsed.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
        </ul>
      ) : null}

      {parsed.students.length ? (
        <div className="field-hint" style={{ marginTop: 8 }}>
          预览：{parsed.students.slice(0, 8).map((s) => `${s.no}${s.name ? s.name : ''}`).join('、')}
          {parsed.students.length > 8 ? ' …' : ''}
        </div>
      ) : null}
    </Modal>
  );
}
