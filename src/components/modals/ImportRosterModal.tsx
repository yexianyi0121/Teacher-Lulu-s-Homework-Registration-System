import { useMemo, useRef, useState } from 'react';
import { useStore, currentClass } from '../../store';
import {
  decodeCsv,
  looksLikeNonText,
  nonTextFileHint,
  parseRosterText,
} from '../../domain/roster-import';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export function ImportRosterModal() {
  const setModal = useStore((s) => s.setModal);
  const importRoster = useStore((s) => s.importRoster);
  const openConfirm = useStore((s) => s.openConfirm);
  const cls = currentClass();
  const [text, setText] = useState('');
  /**
   * FR-54.1：文件级拒绝原因。一旦老师拖进 xlsx 这种读不了的文件，
   * 就在这里说清楚「为什么不行、该怎么办」，而不是把乱码当名单导进去。
   */
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseRosterText(text), [text]);
  const fatal = fileError ?? parsed.fatal ?? null;
  const close = () => setModal(null);

  const apply = () => {
    if (fatal || !parsed.students.length) return;
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
          <Pill variant="save" onClick={apply} disabled={!!fatal || !parsed.students.length}>
            {fatal ? '无法导入' : `导入 ${parsed.students.length} 人`}
          </Pill>
        </>
      }
    >
      {fatal ? (
        <div className="file-error" role="alert">
          <div className="file-error__title">
            {fileName ? `「${fileName}」没法导入` : '这个文件没法导入'}
          </div>
          <div className="file-error__body">{fatal}</div>
          <div className="file-error__hint">
            正确做法：用 Excel 打开名单 → 文件 → 另存为 → 选「CSV UTF-8（逗号分隔）」→ 再回到这里导入那个 CSV。
            也可以直接把名单复制粘贴到下面的输入框里。
          </div>
        </div>
      ) : null}

      <div className="field">
        <label className="field-label" htmlFor="roster-text">粘贴名单（一行一人，可带学号）</label>
        <textarea
          id="roster-text"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileError(null);
            setFileName(null);
          }}
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
          accept=".csv,.txt,.xlsx,.xls,text/plain,text/csv"
          aria-label="选择名单文件"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const buf = await f.arrayBuffer();
            e.target.value = '';

            // 先按字节判断是不是二进制/表格文件，再谈解码
            if (looksLikeNonText(buf)) {
              setFileName(f.name);
              setFileError(nonTextFileHint(f.name));
              setText('');
              return;
            }
            setFileName(null);
            setFileError(null);
            setText(decodeCsv(buf));
          }}
        />
      </div>

      {!fatal && parsed.warnings.length ? (
        <ul className="field-hint" style={{ marginTop: 8 }}>
          {parsed.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
        </ul>
      ) : null}

      {!fatal && parsed.students.length ? (
        <div className="field-hint" style={{ marginTop: 8 }}>
          预览：{parsed.students.slice(0, 8).map((s) => `${s.no}${s.name ? s.name : ''}`).join('、')}
          {parsed.students.length > 8 ? ' …' : ''}
        </div>
      ) : null}
    </Modal>
  );
}
