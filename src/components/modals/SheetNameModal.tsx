import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { SHEET_TEMPLATES } from '../../domain/constants';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

/**
 * 新建登记 / 修改表名弹窗。
 *
 * 新建流程：点「＋ 新建登记」→ 在这里输入作业内容 → 确定后才建表。
 * 修改流程：原地改当前表名，保留已录数据；当天同类型重名则拒绝。
 */
export function SheetNameModal() {
  const dlg = useStore((s) => s.sheetDialog);
  const draft = useStore((s) => s.draft);
  const records = useStore((s) => s.records);
  const history = useStore((s) => s.history);
  const activeClassId = useStore((s) => s.activeClassId);
  const newSheet = useStore((s) => s.newSheet);
  const renameCurrentSheet = useStore((s) => s.renameCurrentSheet);
  const close = useStore((s) => s.closeSheetDialog);

  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dlg) return;
    setName(dlg.mode === 'rename' ? draft.content : '');
    setError('');
  }, [dlg, draft.content]);

  const tplName = SHEET_TEMPLATES[draft.templateId]?.name ?? '';

  // 当天同类型已有名称（用于重名提示）
  const existingNames = useMemo(() => {
    const set = new Set<string>();
    const add = (r: { key: string; classId: string; date: string; templateId: string; content: string }) => {
      if (r.classId !== activeClassId || r.date !== draft.date || r.templateId !== draft.templateId) return;
      if (dlg?.mode === 'rename' && r.key === draft.key) return;
      const c = r.content.trim();
      if (c) set.add(c);
    };
    for (const r of Object.values(records)) add(r);
    for (const h of history) add(h);
    return set;
  }, [records, history, activeClassId, draft.date, draft.templateId, draft.key, dlg?.mode]);

  if (!dlg) return null;

  const submit = () => {
    const v = name.trim().slice(0, 20);
    if (!v) { setError('请填写作业内容'); return; }
    if (existingNames.has(v)) { setError('当天已有同名登记表，请换个名称'); return; }
    if (dlg.mode === 'create') {
      newSheet(v);
      close();
    } else {
      if (renameCurrentSheet(v)) close();
    }
  };

  return (
    <Modal
      title={dlg.mode === 'create' ? '新建登记' : '修改表名'}
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>取消</Pill>
          <Pill variant="save" onClick={submit}>{dlg.mode === 'create' ? '创建登记表' : '保存表名'}</Pill>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="sheet-name">
          作业内容（{tplName} · {draft.date}）
        </label>
        <input
          id="sheet-name"
          type="text"
          aria-label="登记表名称"
          maxLength={20}
          autoFocus
          placeholder="如：第3单元字词"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
          }}
        />
        <div className="field-hint">最多 20 字。同一天同一登记类型下不能重名。</div>
        {error ? <div className="field-error" role="alert">{error}</div> : null}
      </div>
    </Modal>
  );
}
