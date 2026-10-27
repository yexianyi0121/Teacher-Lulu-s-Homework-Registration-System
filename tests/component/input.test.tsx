import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { App } from '../../src/App';
import { useStore } from '../../src/store';
import { createEmptyState } from '../../src/store/initial';

function press(key: string, opts: KeyboardEventInit = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
  });
}

function flushTimers(ms = 800) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function setup(template: 'homework' | 'quality' | 'dictation' | 'custom' = 'homework') {
  useStore.getState().replaceState(createEmptyState(0));
  useStore.getState().setCount(10);
  useStore.getState().switchTemplate(template);
  // FR-73.4：作业内容是登记前提
  useStore.getState().setContent('默写');
  useStore.getState().updateSettings({ secondsJump: false });
  useStore.getState().setFocusedNo(1);
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(<App />);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('录入内核（组件级）', () => {
  it('常规作业：按 1 → A+（700ms 后落库）', () => {
    setup('homework');
    press('1');
    flushTimers();
    expect(useStore.getState().draft.entries['1'].value).toEqual({ kind: 'grade', grade: 'A+' });
  });

  it('等级修饰：A 后 700ms 内按 - → A-', () => {
    setup('homework');
    press('a');
    press('-');
    flushTimers();
    expect(useStore.getState().draft.entries['1'].value).toEqual({ kind: 'grade', grade: 'A-' });
  });

  it('质量监测：8 7 . 5 后 Enter → 87.5（AC-17.2 同类）', () => {
    setup('quality');
    press('8');
    press('7');
    press('.');
    press('5');
    press('Enter');
    expect(useStore.getState().draft.entries['1'].value).toEqual({ kind: 'score', score: 87.5 });
  });

  it('分数不提前跳格：输入 87.5 过程中焦点仍在 1 号', () => {
    setup('quality');
    press('8');
    press('7');
    expect(useStore.getState().focusedNo).toBe(1);
    expect(useStore.getState().draft.entries['1']).toBeUndefined();
  });

  it('超过满分整条拒绝（不写入任何值，AC-39.1）', () => {
    setup('quality');
    press('1');
    press('2');
    press('0');
    press('Enter');
    expect(useStore.getState().draft.entries['1']).toBeUndefined();
    expect(useStore.getState().cellError).toBe(1);
  });

  it('听写：数字 2 → 文字「错2」，Enter 过关（G 同效）', () => {
    setup('dictation');
    press('2');
    expect(useStore.getState().draft.entries['1'].value).toEqual({ kind: 'text', text: '错2' });
    press('g');
    expect(useStore.getState().draft.entries['1'].pass).toBe(true);
    expect(useStore.getState().draft.entries['1'].value).toBeNull();
  });

  it('X 缺交、再按一次取消（状态位互斥）', () => {
    setup('homework');
    press('x');
    expect(useStore.getState().draft.entries['1'].status).toBe('missing');
    press('x');
    expect(useStore.getState().draft.entries['1']).toBeUndefined();
  });

  it('L 请假 / 再按取消', () => {
    setup('homework');
    press('l');
    expect(useStore.getState().draft.entries['1'].status).toBe('leave');
    press('l');
    expect(useStore.getState().draft.entries['1']).toBeUndefined();
  });

  it('空格盖章：无 → 已更正 → 无', () => {
    setup('homework');
    press('1');
    flushTimers();
    press(' ');
    expect(useStore.getState().draft.entries['1'].stamp).toBe('corrected');
    press(' ');
    expect(useStore.getState().draft.entries['1'].stamp).toBe('none');
  });

  it('Ctrl+Z 撤销一次录入、Ctrl+Y 重做', () => {
    setup('homework');
    press('2');
    flushTimers();
    expect(useStore.getState().draft.entries['1'].value).toEqual({ kind: 'grade', grade: 'A' });
    press('z', { ctrlKey: true });
    expect(useStore.getState().draft.entries['1']).toBeUndefined();
    press('y', { ctrlKey: true });
    expect(useStore.getState().draft.entries['1'].value).toEqual({ kind: 'grade', grade: 'A' });
  });

  it('秒跳关闭时焦点不动', () => {
    setup('homework');
    useStore.getState().updateSettings({ secondsJump: false });
    press('1');
    flushTimers();
    expect(useStore.getState().focusedNo).toBe(1);
  });

  it('秒跳开启时自动前进到下一格', () => {
    setup('homework');
    useStore.getState().updateSettings({ secondsJump: true });
    press('1');
    flushTimers();
    expect(useStore.getState().focusedNo).toBe(2);
  });

  it('输入框聚焦时数字键不污染网格（A-06）', () => {
    setup('quality');
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true }));
    });
    expect(useStore.getState().draft.entries['1']).toBeUndefined();
    input.remove();
  });

  it('页码/网格渲染与人数一致（10 人 → 10 格）', () => {
    setup('homework');
    expect(document.querySelectorAll('.cell').length).toBe(10);
  });
});
