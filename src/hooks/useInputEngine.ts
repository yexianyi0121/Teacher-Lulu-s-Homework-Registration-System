import { useCallback, useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useStore } from '../store';
import type { AppState } from '../store/store-types';
import { isEditableElement, isPrintableKey } from '../domain/keymap';
import { GRADE_KEY_MAP } from '../domain/grades';
import { gridColumns } from '../domain/layout';

type AnyKeyEvent = KeyboardEvent | ReactKeyboardEvent;

export const VOICE_TOGGLE_EVENT = 'xq:toggle-voice';

function afterCommit(st: AppState, no: number) {
  if (st.settings.secondsJump) st.moveFocus(1);
  else st.setPulsingNo(no);
}

function commitBuffer(st: AppState, advance: boolean): boolean {
  const buf = st.buffer;
  if (!buf) return false;
  const raw = buf.text;
  st.setBuffer(null);
  if (raw === '' || raw === '.') return false;
  const num = Number(raw);
  if (!Number.isFinite(num)) return false;
  st.setValue(buf.no, { kind: 'score', score: Math.min(100, Math.max(0, num)) });
  if (advance && st.settings.secondsJump) st.moveFocus(1);
  return true;
}

function appendBuffer(st: AppState, key: string) {
  const no = st.focusedNo;
  if (no === null) return;

  const cur = st.buffer && st.buffer.no === no ? st.buffer.text : '';
  let next: string;

  if (key === '.') {
    if (cur.includes('.')) return;
    next = cur === '' ? '0.' : `${cur}.`;
  } else if (cur.includes('.')) {
    const dec = cur.split('.')[1] ?? '';
    if (dec.length >= 1) return;
    next = cur + key;
  } else {
    if (cur.length >= 3) return;
    next = `${cur}${key}`.replace(/^0+(?=\d)/, '');
  }

  if (!/^\d{0,3}(\.\d?)?$/.test(next)) return;

  const num = Number(next);
  if (Number.isFinite(num) && num > 100) {
    st.setBuffer({ no, text: '100' });
    st.showToast('分数不能超过 100，已截断', 'warn');
    return;
  }

  st.setBuffer({ no, text: next });
}

/** 全局命令键（挂在 document，也可从 Grid 冒泡进入，幂等） */
function handleGlobal(
  e: AnyKeyEvent,
  st: AppState,
  key: string,
  ctrl: boolean,
  inEditor: boolean,
): boolean {
  const lower = key.toLowerCase();

  if (ctrl && lower === 'z') {
    if (st.editing) return false; // 内联编辑中交给浏览器处理文本撤销
    e.preventDefault();
    if (e.shiftKey) st.redo();
    else st.undo();
    return true;
  }

  if (ctrl && lower === 'y') {
    e.preventDefault();
    st.redo();
    return true;
  }

  if (ctrl && lower === 's') {
    e.preventDefault();
    st.commitToHistory();
    return true;
  }

  if (ctrl && lower === 'm') {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent(VOICE_TOGGLE_EVENT));
    return true;
  }

  if (ctrl && key === 'Enter') {
    e.preventDefault();
    st.setModal('report');
    return true;
  }

  if (!inEditor && !ctrl && key === '/') {
    e.preventDefault();
    st.setSearchOpen(true);
    return true;
  }

  if (key === 'Escape') {
    e.preventDefault();
    if (st.confirmRequest) st.closeConfirm();
    else if (st.modal) st.setModal(null);
    else if (st.editing) st.setEditing(null);
    else if (st.buffer) st.setBuffer(null);
    else if (st.selection.size > 0) st.exitSelection();
    else if (st.searchOpen) st.setSearchOpen(false);
    return true;
  }

  return false;
}

function handleGrid(e: AnyKeyEvent, st: AppState, key: string, ctrl: boolean) {
  const rec = st.drafts[st.activeKey];
  if (!rec) return;

  const cols = gridColumns(typeof window === 'undefined' ? 1280 : window.innerWidth);
  const no = st.focusedNo;

  // 多选态（PRD §4.6.5 状态矩阵）
  if (st.selection.size > 0) {
    if (key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const n = st.selection.size;
      st.batchStamp([...st.selection]);
      st.showToast(`已对 ${n} 个单元格盖章`, 'ok');
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      const n = st.selection.size;
      st.batchClear([...st.selection]);
      st.showToast(`已清空 ${n} 个单元格`, 'ok');
    }
    return;
  }

  if (no === null) return;

  if (key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    const entry = rec.entries[String(no)];
    st.toggleStamp(no);
    if (!entry?.value) st.showToast('该学号尚无录入值，仍会出现在未提交名单中', 'warn');
    return;
  }

  if (key === 'Delete' || key === 'Backspace') {
    e.preventDefault();
    e.stopPropagation();
    commitBuffer(st, false);
    st.clearCell(no);
    return;
  }

  if (key === 'Tab') {
    e.preventDefault();
    e.stopPropagation();
    commitBuffer(st, false);
    st.moveFocus(e.shiftKey ? -1 : 1);
    return;
  }

  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    commitBuffer(st, false);
    const delta =
      key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -cols : cols;
    st.moveFocus(delta);
    return;
  }

  if (key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    const committed = commitBuffer(st, false);
    if (st.settings.secondsJump) st.moveFocus(1);
    else if (committed) st.setPulsingNo(no);
    return;
  }

  if (rec.mode === 'homework') {
    const grade = GRADE_KEY_MAP[key];
    if (!grade) return;
    e.preventDefault();
    e.stopPropagation();
    st.setValue(no, { kind: 'grade', grade });
    afterCommit(st, no);
    return;
  }

  if (rec.mode === 'quiz') {
    if (/^[0-9]$/.test(key) || key === '.') {
      e.preventDefault();
      e.stopPropagation();
      appendBuffer(st, key);
    }
    return;
  }

  if (!ctrl && !e.altKey && isPrintableKey(key)) {
    e.preventDefault();
    e.stopPropagation();
    st.setEditing({ no, draft: key });
  }
}

/**
 * 键盘引擎（设计 §6.1）
 * 导航键挂 Grid（冒泡），命令键挂 document；共用同一处理函数。
 */
export function useInputEngine() {
  const handleKey = useCallback((e: AnyKeyEvent) => {
    const native = 'nativeEvent' in e ? (e.nativeEvent as KeyboardEvent) : (e as KeyboardEvent);
    if (native.isComposing || native.keyCode === 229) return;
    if (e.defaultPrevented) return;

    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const inEditor = isEditableElement(e.target);

    // 编辑器内只放行 Esc / Ctrl+Z / Ctrl+S / Ctrl+Enter
    if (inEditor) {
      const allowed =
        key === 'Escape' ||
        (ctrl && (key.toLowerCase() === 'z' || key.toLowerCase() === 's' || key === 'Enter'));
      if (!allowed) return;
    }

    const st = useStore.getState();

    if (handleGlobal(e, st, key, ctrl, inEditor)) {
      if (e.defaultPrevented) e.stopPropagation();
      return;
    }

    if (inEditor) return;
    if (st.modal || st.confirmRequest) return;

    const target = e.target as HTMLElement | null;
    if (st.searchOpen && target?.getAttribute('data-search') !== '1') return;

    handleGrid(e, st, key, ctrl);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleKey(e);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  return { handleKey };
}
