import { useMemo, useRef, useState } from 'react';
import { useStore, currentClass } from '../../store';
import { decodeCsv, looksLikeNonText, nonTextFileHint, parseRosterText } from '../../domain/roster-import';
import { studentsFromRows } from '../../domain/roster-xlsx';
import * as XLSX from 'xlsx';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

/**
 * 导入花名册（FR-54/55）。
 *
 * 三条导入通道，老师怎么方便怎么来：
 *   1. 直接选 .xlsx / .xls  —— 最常见（微信里收到的就是它）
 *   2. 选 .csv / .txt       —— Excel「另存为」的产物
 *   3. 直接粘贴文本          —— 从微信聊天记录复制
 *
 * 异常处理原则：任何一步失败都必须**说清楚原因 + 给出下一步怎么做**，
 * 并且绝不把乱码当姓名导进去（FR-54 事故的教训）。
 */

type Source = 'paste' | 'csv' | 'xlsx';

export function ImportRosterModal() {
  const setModal = useStore((s) => s.setModal);
  const importRoster = useStore((s) => s.importRoster);
  const openConfirm = useStore((s) => s.openConfirm);
  const cls = currentClass();
  const [text, setText] = useState('');
  /** 文件级错误（xlsx 结构坏、加密、无表等）——优先于文本解析结果 */
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [source, setSource] = useState<Source>('paste');
  /** xlsx 专用：来自文件解析的学生（不经过 textarea） */
  const [xlsx, setXlsx] = useState<{
    students: { no: number; name?: string }[];
    warnings: string[];
    sheetName: string;
    headerRow: number | null;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pasted = useMemo(() => parseRosterText(text), [text]);

  const students = xlsx ? xlsx.students : pasted.students;
  const warnings = xlsx ? xlsx.warnings : pasted.warnings;
  const fatal = fileError ?? (xlsx ? null : pasted.fatal ?? null);

  const close = () => setModal(null);

  const reset = () => {
    setXlsx(null);
    setFileError(null);
    setFileName(null);
  };

  const apply = () => {
    if (fatal || !students.length) return;
    const next = students.length;
    if (cls && next !== cls.count) {
      openConfirm({
        title: '导入名单会改变人数',
        message: `当前 ${cls.count} 人，导入后 ${next} 人。少出的学号数据不会被删除（只是隐藏），确定继续？`,
        confirmText: '导入',
        onConfirm: () => {
          importRoster(students);
          close();
        },
      });
      return;
    }
    importRoster(students);
    close();
  };

  const onFile = async (f: File) => {
    const ext = f.name.toLowerCase().split('.').pop() ?? '';
    reset();
    setFileName(f.name);

    // ---- Excel ----
    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const buf = await f.arrayBuffer();
        // 静态打包（不走动态 import）：dist 的入口脚本会被 inline-dist 内联进 HTML，
        // 而动态 import 产生的 xlsx-*.js 不会再被内联，file:// 下会 404。
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

        if (!wb.SheetNames.length) {
          setFileError('这个 Excel 里没有任何工作表。请确认文件没有损坏。');
          return;
        }
        // 优先挑「读到学生最多」的那张表：老师的名单不一定在第一张
        let best: { name: string; rows: unknown[][] } | null = null;
        let bestCount = -1;
        for (const name of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
            header: 1,
            blankrows: false,
            defval: '',
          });
          const got = studentsFromRows(rows as unknown[][]).students.length;
          if (got > bestCount) {
            bestCount = got;
            best = { name, rows: rows as unknown[][] };
          }
        }
        if (!best || bestCount <= 0) {
          setFileError(
            '这个 Excel 里没有读到学生名单。系统会找「学号」「姓名」这样的表头，'
            + '请确认表格里至少有一列写着学生姓名。',
          );
          return;
        }
        const parsed = studentsFromRows(best.rows);
        setXlsx({
          students: parsed.students,
          warnings: parsed.warnings,
          sheetName: best.name,
          headerRow: parsed.headerRow,
        });
        setSource('xlsx');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // 加密文档 / 损坏文件会给很技术化的报错，翻译成人话
        if (/password|encrypt/i.test(msg)) {
          setFileError('这个 Excel 有密码保护，系统打不开。请在 Excel 里「另存为」一个不加密的副本。');
        } else if (/format|corrupt|unzip|zip/i.test(msg)) {
          setFileError('这个文件不是有效的 Excel，可能已损坏，或者扩展名被改过。请在 Excel 里打开确认后重新保存。');
        } else {
          setFileError(`读取 Excel 失败：${msg}。可以试试在 Excel 里「另存为 CSV」再导入。`);
        }
      }
      return;
    }

    // ---- CSV / TXT ----
    const buf = await f.arrayBuffer();
    if (looksLikeNonText(buf)) {
      setFileError(nonTextFileHint(f.name));
      setText('');
      return;
    }
    setText(decodeCsv(buf));
    setSource('csv');
  };

  return (
    <Modal
      title="导入花名册"
      size="lg"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>取消</Pill>
          <Pill variant="save" onClick={apply} disabled={!!fatal || !students.length}>
            {fatal ? '无法导入' : `导入 ${students.length} 人`}
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
            也可以直接把名单复制粘贴到下面的输入框里，一行一个人。
          </div>
        </div>
      ) : null}

      {xlsx ? (
        <div className="file-ok">
          ✅ 已从「{xlsx.sheetName}」读取到 <strong>{xlsx.students.length}</strong> 人
          {xlsx.headerRow !== null ? `（表头在第 ${xlsx.headerRow + 1} 行）` : ''}
        </div>
      ) : null}

      <div className="settings-actions">
        <Pill variant="ghost" onClick={() => fileRef.current?.click()}>
          📂 选择文件（Excel / CSV / TXT）
        </Pill>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/plain,text/csv"
          aria-label="选择名单文件"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              await onFile(f);
            } catch (err) {
              setFileError(`读取文件失败：${err instanceof Error ? err.message : String(err)}`);
            }
          }}
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label className="field-label" htmlFor="roster-text">
          {source === 'xlsx' ? '或者改写 / 粘贴名单（一行一人，可带学号）' : '粘贴名单（一行一人，可带学号）'}
        </label>
        <textarea
          id="roster-text"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            reset();
            setSource('paste');
          }}
          placeholder={'1 张三\n2 李四\n王五'}
        />
        <div className="field-hint">
          支持「1 张三」「1,张三」「纯姓名」三种写法；超过 120 人会截断。
        </div>
      </div>

      {!fatal && warnings.length ? (
        <ul className="field-hint" style={{ marginTop: 8 }}>
          {warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
        </ul>
      ) : null}

      {!fatal && students.length ? (
        <div className="field-hint" style={{ marginTop: 8 }}>
          预览：{students.slice(0, 8).map((s) => `${s.no}${s.name ? s.name : ''}`).join('、')}
          {students.length > 8 ? ' …' : ''}
        </div>
      ) : null}
    </Modal>
  );
}
