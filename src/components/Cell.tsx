import { memo, useRef, useState } from 'react';
import type { Entry, Mode } from '../domain/types';
import { cellTone } from '../domain/tone';
import { useStore } from '../store';
import { CellView } from './CellView';

export interface CellProps {
  no: number;
  entry?: Entry | undefined;
  mode: Mode;
  width?: number;
  matched?: boolean;
}

function toneForBuffer(text: string, settings: { excellentLine: number; passLine: number }) {
  const num = Number(text);
  if (!Number.isFinite(num) || text === '' || text === '.') return 'empty' as const;
  return cellTone('quiz', { kind: 'score', score: Math.min(100, num) }, {
    ...settings,
    count: 0,
    secondsJump: false,
    showName: false,
    honorIncludesA: false,
  });
}

interface InlineEditorProps {
  no: number;
  initial: string;
}

function InlineEditor({ no, initial }: InlineEditorProps) {
  const [text, setText] = useState(initial);
  const doneRef = useRef(false);

  const finish = (advance: number, value?: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const st = useStore.getState();
    const next = (value ?? text).trim().slice(0, 20);
    st.setEditing(null);
    if (next) st.setValue(no, { kind: 'text', text: next });
    else st.clearCell(no);
    if (advance && st.settings.secondsJump) st.moveFocus(advance);
  };

  return (
    <input
      className="cell-editor"
      autoFocus
      value={text}
      maxLength={20}
      aria-label={`${no}号听写内容`}
      onChange={(e) => setText(e.target.value.slice(0, 20))}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(1);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          doneRef.current = true;
          useStore.getState().setEditing(null);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          finish(1);
        }
      }}
      onBlur={() => finish(0)}
    />
  );
}

/**
 * 单元格（编辑态）：每格只订阅自己那条 entry（设计 §5.4 / §9.3 性能要求）
 */
export const Cell = memo(function Cell({ no, mode, matched }: CellProps) {
  const entry = useStore((s) => s.drafts[s.activeKey]?.entries[String(no)]);
  const settings = useStore((s) => s.settings);
  const focusedNo = useStore((s) => s.focusedNo);
  const selected = useStore((s) => s.selection.has(no));
  const hasSelection = useStore((s) => s.selection.size > 0);
  const pulsing = useStore((s) => s.pulsingNo === no);
  const flash = useStore((s) => s.flashNo === no);
  const bufferText = useStore((s) => (s.buffer && s.buffer.no === no ? s.buffer.text : null));
  const editingDraft = useStore((s) => (s.editing && s.editing.no === no ? s.editing.draft : null));

  const value = entry?.value ?? null;
  const tone = bufferText !== null ? toneForBuffer(bufferText, settings) : cellTone(mode, value, settings);
  const focused = focusedNo === no;
  const student = useStore((s) => s.classInfo.students[no - 1]);

  return (
    <CellView
      variant="edit"
      no={no}
      value={value}
      stamp={entry?.stamp ?? 'none'}
      mode={mode}
      tone={tone}
      focused={focused && !hasSelection}
      selected={selected}
      matched={matched}
      pulsing={pulsing}
      flash={flash}
      displayText={bufferText ?? undefined}
      showName={settings.showName}
      name={student?.name}
      tabIndex={focused ? 0 : -1}
      onClick={() => {
        const st = useStore.getState();
        if (st.selection.size > 0) st.exitSelection();
        st.setFocusedNo(no);
      }}
      onAnimationEnd={() => {
        const st = useStore.getState();
        if (st.pulsingNo === no) st.setPulsingNo(null);
        if (st.flashNo === no) st.setFlashNo(null);
      }}
    >
      {editingDraft !== null ? <InlineEditor no={no} initial={editingDraft} /> : null}
    </CellView>
  );
});
