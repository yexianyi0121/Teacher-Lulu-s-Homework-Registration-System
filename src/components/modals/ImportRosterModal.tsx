import { useMemo, useRef, useState } from 'react';
import { useStore, currentClass } from '../../store';
import { savePreimportSnapshot } from '../../infra/storage';
import { decodeCsv, looksLikeNonText, nonTextFileHint, parseRosterText } from '../../domain/roster-import';
import { studentsFromRows } from '../../domain/roster-xlsx';
import * as XLSX from 'xlsx';
import type { Student } from '../../domain/types';
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

/** 当前班级已有的姓名列表（按学号顺序） */
function floorNames(cls: { students: Student[] } | undefined): string[] {
  return (cls?.students ?? []).map((st) => (st.name ?? '').trim());
}

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
  /** 大文件解析期间置 true：SheetJS 同步解析会阻塞主线程，先让「正在读取」画出来（R-10） */
  const [parsing, setParsing] = useState(false);
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
    const cur = cls?.count ?? 0;
    // 名单是否真的变了：同名同姓同序号视为没变（重复导入同一份名单不该弹框）
    const oldNames = floorNames(cls);
    const newNames = students.map((st) => (st.name ?? '').trim());
    const changed = next !== cur || newNames.some((nm, i) => nm !== (oldNames[i] ?? ''));

    const doImport = () => {
      // FR-57.3：导入前留底，让「设置 → 回退到导入前」真的能救回来。
      // 用 infra 提供的函数（会顺带修剪旧快照，避免越积越多吃满配额 —— D-14）。
      savePreimportSnapshot(JSON.stringify(useStore.getState().exportState()));
      importRoster(students);
      close();
      useStore.getState().showToast(
        `已导入 ${next} 人名单${changed ? '，可在【设置 → 回退到导入前】恢复' : ''}`,
        'ok',
      );
    };

    if (!changed) {
      doImport();
      return;
    }

    openConfirm({
      title: '导入名单会替换全部学生姓名',
      message:
        `当前 ${cur} 人，导入后 ${next} 人。` +
        '\n\n⚠️ 已登记的成绩、盖章、积分会按【学号】保留给新名单上同号的学生。' +
        (next === cur ? '\n如果这是新学期的另一批学生，他们的成绩会被挂到这些学生名下。' : '') +
        '\n\n导入前的数据会自动留底，可在【设置 → 回退到导入前】恢复。',
      confirmText: '确认替换名单',
      danger: true,
      onConfirm: doImport,
    });
  };

  const onFile = async (f: File) => {
    const ext = f.name.toLowerCase().split('.').pop() ?? '';
    reset();
    setFileName(f.name);

    // 1000 行左右的表解析要 1 秒以上，期间主线程被占满，界面会像卡死。
    // 先置 parsing 并让出两个宏任务，把「正在读取」渲染出来再开干。
    setParsing(true);
    await new Promise((r) => setTimeout(r, 0));
    try {
      await onFileInner(f, ext);
    } finally {
      setParsing(false);
    }
  };

  const onFileInner = async (f: File, ext: string) => {

    // ---- Excel ----
    // .et 是 WPS 表格的扩展名，文件内容仍是 xls/xlsx 容器 —— 老师多用 WPS（R-14）
    if (ext === 'xlsx' || ext === 'xls' || ext === 'et') {
      try {
        const buf = await f.arrayBuffer();
        // 静态打包（不走动态 import）：dist 的入口脚本会被 inline-dist 内联进 HTML，
        // 而动态 import 产生的 xlsx-*.js 不会再被内联，file:// 下会 404。
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

        if (!wb.SheetNames.length) {
          setFileError('这个 Excel 里没有任何工作表。请确认文件没有损坏。');
          return;
        }
        // 优先挑「读到学生最多」的那张表：老师的名单不一定在第一张。
        // 但要记住每张表读到几个人 —— 选错时至少要让老师知道别的表也有名单。
        let best: { name: string; rows: unknown[][] } | null = null;
        let bestCount = -1;
        const others: string[] = [];
        for (const name of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
            header: 1,
            blankrows: false,
            defval: '',
          });
          const got = studentsFromRows(rows as unknown[][]).students.length;
          if (got > bestCount) {
            if (bestCount > 0 && best) others.push(`「${best.name}」${bestCount} 人`);
            bestCount = got;
            best = { name, rows: rows as unknown[][] };
          } else if (got > 0) {
            others.push(`「${name}」${got} 人`);
          }
        }
        if (!best || bestCount <= 0) {
          setFileError(
            '这个 Excel 里没有读到学生名单。系统会找「学号」「姓名」「序号」「名字」这样的表头或列，'
            + '请确认表格里至少有一列写着学生姓名；如果名字混在别的文字里，'
            + '也可以直接用「粘贴名单」的方式导入。',
          );
          return;
        }
        const parsed = studentsFromRows(best.rows);
        if (others.length) {
          parsed.warnings.push(
            `这个文件里还有 ${others.length} 张表也像名单（${others.join('、')}），`
            + `当前读的是「${best.name}」。如果选错了，请把它单独存成一个 Excel 再导入。`,
          );
        }
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

      {parsing ? (
        <div className="file-ok" role="status" aria-live="polite">
          ⏳ 正在读取「{fileName}」，文件很大时需要一两秒…
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
          📂 选择文件（Excel / WPS / CSV / TXT）
        </Pill>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.et,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/plain,text/csv"
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
