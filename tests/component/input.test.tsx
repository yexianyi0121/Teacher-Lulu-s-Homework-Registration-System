import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { useStore } from '../../src/store';

function cell(no: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-no="${no}"]`);
  if (!el) throw new Error(`cell ${no} not found`);
  return el;
}

function press(key: string, init: Record<string, unknown> = {}) {
  const target = (document.activeElement as HTMLElement) ?? document.body;
  fireEvent.keyDown(target, { key, ...init });
}

function activeNo(): number | null {
  const el = document.activeElement as HTMLElement | null;
  const v = el?.getAttribute('data-no');
  return v === null || v === undefined ? null : Number(v);
}

function entryOf(no: number) {
  const st = useStore.getState();
  return st.drafts[st.activeKey].entries[String(no)];
}

beforeEach(() => {
  localStorage.clear();
  act(() => {
    useStore.getState().resetAll();
    useStore.getState().updateSettings({ count: 50, secondsJump: true, excellentLine: 90, passLine: 60 });
  });
});

describe('秒跳与常规作业录入（AC-04.1 / AC-04.2）', () => {
  it('秒跳开：按 1 → 1 号 A+，焦点到 2 号', () => {
    render(<App />);
    expect(activeNo()).toBe(1);
    act(() => press('1'));
    expect(cell(1).textContent).toContain('A+');
    expect(cell(1).getAttribute('data-tone')).toBe('green');
    expect(activeNo()).toBe(2);
  });

  it('秒跳关：按 1 → 值生效但焦点不动', () => {
    act(() => useStore.getState().updateSettings({ secondsJump: false }));
    render(<App />);
    act(() => press('1'));
    expect(cell(1).textContent).toContain('A+');
    expect(activeNo()).toBe(1);
  });

  it('6–0 在常规作业下无响应', () => {
    render(<App />);
    act(() => press('6'));
    expect(entryOf(1)).toBeUndefined();
  });
});

describe('防误触与 IME（AC-04.5 / AC-04.6）', () => {
  it('作业内容输入框内按 1 只改变输入框', () => {
    render(<App />);
    const input = screen.getByLabelText('作业内容') as HTMLInputElement;
    act(() => {
      input.focus();
      fireEvent.keyDown(input, { key: '1' });
      fireEvent.change(input, { target: { value: '1' } });
    });
    expect(input.value).toBe('1');
    const st = useStore.getState();
    expect(st.drafts[st.activeKey].entries['1']).toBeUndefined();
  });

  it('组合态下的 Enter 不提交', () => {
    act(() => useStore.getState().switchMode('quiz'));
    render(<App />);
    act(() => press('9'));
    act(() => press('Enter', { isComposing: true }));
    expect(entryOf(1)).toBeUndefined();
    expect(useStore.getState().buffer?.text).toBe('9');
  });
});

describe('单元测试缓冲态（AC-03.2 / AC-03.3 / A-28）', () => {
  it('87.5 可完整输入，按 Enter 才前进', () => {
    act(() => useStore.getState().switchMode('quiz'));
    render(<App />);
    act(() => press('8'));
    expect(activeNo()).toBe(1);
    act(() => press('7'));
    act(() => press('.'));
    act(() => press('5'));
    expect(cell(1).textContent).toContain('87.5');
    expect(activeNo()).toBe(1);
    act(() => press('Enter'));
    expect(entryOf(1)?.value).toEqual({ kind: 'score', score: 87.5 });
    expect(activeNo()).toBe(2);
  });

  it('输入 1000 截断为 100', () => {
    act(() => useStore.getState().switchMode('quiz'));
    render(<App />);
    act(() => press('1'));
    act(() => press('0'));
    act(() => press('0'));
    act(() => press('0'));
    act(() => press('Enter'));
    expect(entryOf(1)?.value).toEqual({ kind: 'score', score: 100 });
  });

  it('第二个小数点被忽略', () => {
    act(() => useStore.getState().switchMode('quiz'));
    render(<App />);
    act(() => press('8'));
    act(() => press('.'));
    act(() => press('5'));
    act(() => press('.'));
    expect(useStore.getState().buffer?.text).toBe('8.5');
  });
});

describe('听写默写内联编辑（AC-03.4）', () => {
  it('输入「错2」后显示黄底', () => {
    act(() => useStore.getState().switchMode('dictation'));
    render(<App />);
    act(() => press('错'));
    const input = document.querySelector<HTMLInputElement>('.cell-editor');
    expect(input).not.toBeNull();
    act(() => {
      fireEvent.change(input as HTMLInputElement, { target: { value: '错2' } });
      fireEvent.keyDown(input as HTMLInputElement, { key: 'Enter' });
    });
    expect(entryOf(1)?.value).toEqual({ kind: 'text', text: '错2' });
    expect(cell(1).getAttribute('data-tone')).toBe('amber');
  });
});

describe('盖章与撤销（AC-05.x / AC-14.x）', () => {
  it('空格三态：盖 / 取消 / 换章', () => {
    render(<App />);
    act(() => press('3')); // A-，焦点到 2
    act(() => useStore.getState().setFocusedNo(1));
    act(() => press(' '));
    expect(cell(1).querySelector('.stamp-badge')?.getAttribute('data-kind')).toBe('corrected');

    act(() => press(' '));
    expect(cell(1).querySelector('.stamp-badge')).toBeNull();

    act(() => useStore.getState().setCurrentStamp('excellent'));
    act(() => press(' '));
    expect(cell(1).querySelector('.stamp-badge')?.getAttribute('data-kind')).toBe('excellent');
  });

  it('Delete 清值与章', () => {
    render(<App />);
    act(() => press('3'));
    act(() => useStore.getState().setFocusedNo(1));
    act(() => press(' '));
    expect(entryOf(1)?.stamp).toBe('corrected');
    act(() => press('Delete'));
    expect(entryOf(1)).toBeUndefined();
    expect(cell(1).textContent).not.toContain('A-');
  });

  it('Ctrl+Z 撤销上一次录入，Ctrl+Shift+Z 重做', () => {
    render(<App />);
    act(() => press('1'));
    expect(entryOf(1)?.value).toEqual({ kind: 'grade', grade: 'A+' });
    act(() => press('z', { ctrlKey: true }));
    expect(entryOf(1)).toBeUndefined();
    act(() => press('z', { ctrlKey: true, shiftKey: true }));
    expect(entryOf(1)?.value).toEqual({ kind: 'grade', grade: 'A+' });
  });

  it('全选后空格批量盖章', () => {
    render(<App />);
    act(() => press('1'));
    act(() => press('2'));
    act(() => press('3'));
    act(() => {
      useStore.getState().toggleSelectAll();
    });
    expect(useStore.getState().selection.size).toBe(3);
    act(() => press(' '));
    for (const no of [1, 2, 3]) expect(entryOf(no)?.stamp).toBe('corrected');
  });
});

describe('人数调整不丢隐藏数据（AC-02.2 / AC-02.3）', () => {
  it('50 → 3 → 50 后 4 号原值恢复', () => {
    render(<App />);
    act(() => useStore.getState().setValue(4, { kind: 'grade', grade: 'A+' }));
    act(() => useStore.getState().updateSettings({ count: 3 }));
    expect(document.querySelector('[data-no="4"]')).toBeNull();
    act(() => useStore.getState().updateSettings({ count: 50 }));
    expect(cell(4).textContent).toContain('A+');
  });
});

describe('报表与统计接线（AC-06.1）', () => {
  it('单元测试录入样例 A 后统计条数值正确', () => {
    act(() => {
      const st = useStore.getState();
      st.switchMode('quiz');
      st.setContent('语文本');
      const scores: Array<[number, number]> = [
        [1, 98], [2, 95], [3, 94], [4, 89], [5, 92], [6, 91], [7, 95], [8, 98], [9, 98], [10, 94],
        [11, 92], [12, 90.5], [13, 94], [14, 88], [15, 72], [16, 94], [17, 43], [18, 88], [19, 73], [20, 75],
      ];
      for (const [no, score] of scores) st.setValue(no, { kind: 'score', score });
    });

    render(<App />);

    const stats = document.querySelector('.stats');
    expect(stats?.textContent).toContain('录入人数20');
    expect(stats?.textContent).toContain('平均分87.7');
    expect(stats?.textContent).toContain('优秀(90+)13');
    expect(stats?.textContent).toContain('良好(80+)3');
    expect(stats?.textContent).toContain('及格(60+)3');
    expect(stats?.textContent).toContain('不及格1');
  });
});
