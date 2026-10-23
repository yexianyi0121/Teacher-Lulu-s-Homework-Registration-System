import { GRADE_KEY_MAP } from './grades';

export type KeyScope = 'grid' | 'document';

export interface KeyBinding {
  keys: string;
  action: string;
  scope: KeyScope;
}

/** 命令键：挂在 document（PRD BR-08） */
export const GLOBAL_KEYMAP: KeyBinding[] = [
  { keys: '/', action: 'focusSearch', scope: 'document' },
  { keys: 'Escape', action: 'escape', scope: 'document' },
  { keys: 'Ctrl+Z', action: 'undo', scope: 'document' },
  { keys: 'Ctrl+Shift+Z', action: 'redo', scope: 'document' },
  { keys: 'Ctrl+Y', action: 'redo', scope: 'document' },
  { keys: 'Ctrl+S', action: 'commitHistory', scope: 'document' },
  { keys: 'Ctrl+M', action: 'toggleVoice', scope: 'document' },
  { keys: 'Ctrl+Enter', action: 'openReport', scope: 'document' },
];

/** 导航键：挂在 Grid 容器（PRD BR-08） */
export const GRID_KEYMAP: KeyBinding[] = [
  { keys: '1', action: 'grade:A+', scope: 'grid' },
  { keys: '2', action: 'grade:A', scope: 'grid' },
  { keys: '3', action: 'grade:A-', scope: 'grid' },
  { keys: '4', action: 'grade:CROSS', scope: 'grid' },
  { keys: '5', action: 'grade:CHECK', scope: 'grid' },
  { keys: '0-9', action: 'scoreDigit', scope: 'grid' },
  { keys: '.', action: 'scoreDot', scope: 'grid' },
  { keys: 'Enter', action: 'commit', scope: 'grid' },
  { keys: 'Tab', action: 'next', scope: 'grid' },
  { keys: 'Shift+Tab', action: 'prev', scope: 'grid' },
  { keys: 'ArrowUp', action: 'up', scope: 'grid' },
  { keys: 'ArrowDown', action: 'down', scope: 'grid' },
  { keys: 'ArrowLeft', action: 'left', scope: 'grid' },
  { keys: 'ArrowRight', action: 'right', scope: 'grid' },
  { keys: ' ', action: 'toggleStamp', scope: 'grid' },
  { keys: 'Delete', action: 'clearCell', scope: 'grid' },
  { keys: 'Backspace', action: 'clearCell', scope: 'grid' },
];

/** 在编辑器（input/textarea/contenteditable）内仍放行的命令键 */
export const EDITOR_ALLOWED_KEYS = ['Escape', 'Ctrl+Z', 'Ctrl+S', 'Ctrl+Enter'];

export function isEditableElement(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || typeof node.tagName !== 'string') return false;
  const tag = node.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable === true;
}

/** 可打印单字符（不含控制键组合） */
export function isPrintableKey(key: string): boolean {
  return key.length === 1;
}

export function gradeForKey(key: string): string | undefined {
  return GRADE_KEY_MAP[key];
}
