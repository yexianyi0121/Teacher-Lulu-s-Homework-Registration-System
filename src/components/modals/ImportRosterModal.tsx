import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { decodeCsv, parseRosterText } from '../../domain/roster-import';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export function ImportRosterModal() {
  const settings = useStore((s) => s.settings);
  const rec = useStore((s) => s.drafts[s.activeKey]);
  const setModal = useStore((s) => s.setModal);
  const importRoster = useStore((s) => s.importRoster);
  const openConfirm = useStore((s) => s.openConfirm);
  const showToast = useStore((s) => s.showToast);

  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (text.trim() ? parseRosterText(text) : null), [text]);
  const hiddenCount = useMemo(() => {
    if (!rec) return 0;
    const target = parsed?.students.length ?? settings.count;
    return Object.keys(rec.entries).filter((k) => Number(k) > target).length;
  }, [rec, parsed, settings.count]);

  const close = () => setModal(null);

  const apply = () => {
    if (!parsed || parsed.students.length === 0) return;
    const next = parsed.students.length;
    const doImport = () => {
      importRoster(parsed.students);
      if (hiddenCount > 0) {
        showToast(`有 ${hiddenCount} 条历史数据超出当前人数，已隐藏`, 'warn');
      }
      setModal(null);
    };
    if (next !== settings.count) {
      openConfirm({
        title: '导入花名册',
        message: `将把学生人数从 ${settings.count} 调整为 ${next}。超出人数的已录数据会保留但不在网格显示，人数调回后自动恢复。`,
        confirmText: '确认导入',
        onConfirm: doImport,
      });
    } else {
      doImport();
    }
  };

  const readFile = async (file: File) => {
    try {
      const isCsv = /\.csv$/i.test(file.name);
      const content = isCsv ? decodeCsv(await file.arrayBuffer()) : await file.text();
      setText(content);
      setFileName(file.name);
    } catch {
      showToast('文件解析失败，请检查是否为 CSV 或纯文本', 'error');
    }
  };

  return (
    <Modal
      title="导入花名册"
      size="lg"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>
            取消
          </Pill>
          <Pill variant="save" onClick={apply} disabled={!parsed || parsed.students.length === 0}>
            确认导入
          </Pill>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="roster-text">
          粘贴文本：每行一条，支持 <code>1 张三</code>、<code>1,张三</code>、<code>张三</code>
        </label>
        <textarea
          id="roster-text"
          rows={8}
          value={text}
          placeholder={'1 张三\n2 李四\n3 王五'}
          style={{
            borderRadius: 10,
            border: '1px solid var(--line)',
            padding: 10,
            fontSize: 13,
            lineHeight: 1.7,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
          onChange={(e) => {
            setText(e.target.value);
            setFileName('');
          }}
        />
      </div>

      <div className="settings-actions">
        <Pill variant="ghost" onClick={() => fileRef.current?.click()}>
          📄 上传 CSV / TXT
        </Pill>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = '';
          }}
        />
        {fileName ? <span className="field-hint">已读取：{fileName}</span> : null}
      </div>

      {parsed ? (
        <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8 }}>
          <div>
            解析到 <strong>{parsed.students.length}</strong> 名学生
            {parsed.students.length > 0 ? `（1–${parsed.students.length} 号）` : ''}
          </div>
          {parsed.students.slice(0, 5).map((s) => (
            <div key={s.no} className="field-hint">
              {s.no} {s.name ?? ''}
            </div>
          ))}
          {parsed.warnings.length > 0 ? (
            <div className="field-error" style={{ marginTop: 6 }}>
              {parsed.warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
