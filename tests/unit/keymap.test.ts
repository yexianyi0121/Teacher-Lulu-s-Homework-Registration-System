import { describe, expect, it } from 'vitest';
import { EDITOR_ALLOWED_KEYS, GLOBAL_KEYMAP, GRID_KEYMAP, gradeForKey, isEditableElement, isPrintableKey } from '../../src/domain/keymap';

describe('快捷键表完整性（BR-08 键位两级）', () => {
  const actions = GLOBAL_KEYMAP.map((k) => k.action);
  it('命令键齐全且全部挂 document', () => {
    for (const a of ['undo', 'redo', 'commitHistory', 'toggleVoice', 'openReport', 'focusSearch', 'escape']) {
      expect(actions).toContain(a);
    }
    expect(GLOBAL_KEYMAP.every((k) => k.scope === 'document')).toBe(true);
  });

  it('导航键齐全且全部挂 grid', () => {
    const gridActions = GRID_KEYMAP.map((k) => k.action);
    for (const a of ['up', 'down', 'left', 'right', 'next', 'prev', 'commit', 'toggleStamp', 'clearCell']) {
      expect(gridActions).toContain(a);
    }
    expect(GRID_KEYMAP.every((k) => k.scope === 'grid')).toBe(true);
  });

  it('常规作业 1–5 映射覆盖', () => {
    expect(gradeForKey('1')).toBe('A+');
    expect(gradeForKey('5')).toBe('CHECK');
    expect(gradeForKey('9')).toBeUndefined();
  });

  it('编辑器内仅放行四条命令键', () => {
    expect(EDITOR_ALLOWED_KEYS).toEqual(['Escape', 'Ctrl+Z', 'Ctrl+S', 'Ctrl+Enter']);
  });

  it('isEditableElement 识别 input/textarea/contenteditable', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(textarea)).toBe(true);
    expect(isEditableElement(div)).toBe(false);
    expect(isEditableElement(editable)).toBe(true);
    expect(isEditableElement(null)).toBe(false);
  });

  it('isPrintableKey 只认单字符', () => {
    expect(isPrintableKey('错')).toBe(true);
    expect(isPrintableKey('Enter')).toBe(false);
  });
});
