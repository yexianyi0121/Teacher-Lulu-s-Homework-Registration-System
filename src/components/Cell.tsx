import { memo, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { useStore } from '../store';
import { cellDisplay } from '../domain/tone';
import type { Entry } from '../domain/types';
import { TEXT_MAX } from '../domain/constants';
import { CellView } from './CellView';

export interface CellProps {
  no: number;
  name?: string;
  showName: boolean;
}

function InlineEditor({ no, draft }: { no: number; draft: string }) {
  const setEditing = useStore((s) => s.setEditing);
  const commitText = useStore((s) => s.commitText);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (value: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    // I-06：编辑框预填的是格子里原来的内容。老师双击进去、什么都没改就按 Enter，
    // 原来会把「A+」当成自定义文字提交，格子从等级变成文本、颜色变灰、掉出优秀率。
    // 内容没变 = 老师只是想看看，直接原样退出，不做任何改写。
    if (value === draft) {
      setEditing(null);
      return;
    }
    commitText(no, value);
    setEditing(null);
  };

  return (
    <input
      ref={inputRef}
      className="cell-editor"
      defaultValue={draft}
      maxLength={TEXT_MAX}
      aria-label={`${no}号 自定义文字`}
      onBlur={(e) => submit(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          submit((e.target as HTMLInputElement).value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          submittedRef.current = true;
          setEditing(null);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          submit((e.target as HTMLInputElement).value);
        }
      }}
    />
  );
}

export const Cell = memo(function Cell({ no, name, showName }: CellProps) {
  const entry = useStore((s) => s.draft.entries[String(no)] as Entry | undefined);
  const scheme = useStore((s) => s.draft.scheme);
  const settings = useStore((s) => s.settings);
  const focused = useStore((s) => s.focusedNo === no);
  const selected = useStore((s) => s.selection.has(no));
  const buffer = useStore((s) => (s.buffer?.no === no ? s.buffer.text : null));
  const editing = useStore((s) => (s.editing?.no === no ? s.editing.draft : null));
  const flash = useStore((s) => s.flashNo === no);
  const error = useStore((s) => s.cellError === no);

  const setFocusedNo = useStore((s) => s.setFocusedNo);
  const setSelection = useStore((s) => s.setSelection);
  const setEditing = useStore((s) => s.setEditing);

  const d = cellDisplay(entry, scheme, {
    showEmoji: settings.showEmoji,
    gradeEmoji: settings.gradeEmoji,
  });

  // 输入缓冲区预览：只显示数字，不带角标/表情，避免误导「已录入」
  const display = buffer !== null
    ? { ...d, text: buffer, kind: 'score' as const, tone: 'blue' as const, emoji: undefined, badge: undefined, subText: undefined }
    : d;

  const handleClick = (e: MouseEvent) => {
    const s = useStore.getState();
    if (e.shiftKey && s.focusedNo !== null) {
      const from = Math.min(s.focusedNo, no);
      const to = Math.max(s.focusedNo, no);
      const next = new Set(s.selection);
      for (let i = from; i <= to; i++) next.add(i);
      setSelection(next);
      return;
    }
    setFocusedNo(no);
  };

  const statusText =
    entry?.status === 'leave' ? '请假'
      : entry?.status === 'missing' ? '缺交'
        : '';

  return (
    <div
      className="cell-slot"
      onDoubleClick={() => setEditing({ no, draft: statusText ? '' : d.full })}
      onClick={handleClick}
    >
      <CellView
        no={no}
        display={display}
        stamp={entry?.stamp ?? 'none'}
        status={entry?.status ?? 'normal'}
        pass={!!entry?.pass}
        makeup={!!entry?.makeup}
        focused={focused}
        selected={selected}
        error={error}
        title={[
          `${no}号${name ? ` ${name}` : ''}`,
          d.full ? `值：${d.full}` : '空',
          entry?.pass ? '已过关' : '',
          entry?.makeup ? `已补交：${entry.makeup.note || '无说明'}` : '',
          statusText,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      {showName && name ? <span className="cell-name">{name}</span> : null}
      {editing !== null ? <InlineEditor no={no} draft={editing} /> : null}
      {flash ? <span className="sr-only" role="status">已写入 {no} 号</span> : null}
    </div>
  );
});
