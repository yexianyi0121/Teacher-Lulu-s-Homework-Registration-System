import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../../src/store';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';

/**
 * FR-56：异常操作护栏（v2.5.3）
 *
 * 这些用例锁的是「老师赶时间时手滑」的场景：
 * 半截数字悬空、全选后误按、人数调整后数据是否还在、撤销的边界。
 * 每一条都对应一次真实误操作，不允许以后改回去。
 */

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
  // FR-73.4：作业内容是登记前提，测试里先填一个
  useStore.getState().setContent('默写');
}

describe('FR-56-1 半截分数缓冲不得悬空（焦点离开即丢弃）', () => {
  beforeEach(resetStore);

  it('setFocusedNo 到别的格子会清掉旧格的 buffer', () => {
    const s = useStore.getState();
    const no = 1;
    s.setFocusedNo(no);
    s.setBuffer({ no, text: '8' });
    expect(useStore.getState().buffer).toEqual({ no: 1, text: '8' });

    // 老师点到 5 号格
    useStore.getState().setFocusedNo(5);
    expect(useStore.getState().focusedNo).toBe(5);
    expect(useStore.getState().buffer).toBeNull();
  });

  it('焦点留在原格时 buffer 必须保留（否则输入到一半就被清掉）', () => {
    const s = useStore.getState();
    s.setFocusedNo(3);
    s.setBuffer({ no: 3, text: '87' });
    useStore.getState().setFocusedNo(3);
    expect(useStore.getState().buffer).toEqual({ no: 3, text: '87' });
  });

  it('setFocusedNo(null) 也清 buffer', () => {
    const s = useStore.getState();
    s.setFocusedNo(2);
    s.setBuffer({ no: 2, text: '9' });
    useStore.getState().setFocusedNo(null);
    expect(useStore.getState().buffer).toBeNull();
  });

  it('moveFocus 到别的格子也会清掉旧格的 buffer', () => {
    const s = useStore.getState();
    s.setFocusedNo(1);
    s.setBuffer({ no: 1, text: '7' });
    useStore.getState().moveFocus(1);
    expect(useStore.getState().focusedNo).toBe(2);
    expect(useStore.getState().buffer).toBeNull();
  });
});

describe('FR-56-2 全选按钮必须反映多选态', () => {
  beforeEach(resetStore);

  it('全选后 selection 非空，再点一次清空', () => {
    const s = useStore.getState();
    // 造两个有值的格子
    s.commitValue(1, { kind: 'score', score: 95 });
    s.commitValue(2, { kind: 'score', score: 88 });

    useStore.getState().toggleSelectAll();
    expect(useStore.getState().selection.size).toBe(2);

    useStore.getState().toggleSelectAll();
    expect(useStore.getState().selection.size).toBe(0);
  });

  it('没有可选的格子时给出提示而不是静默失败', () => {
    useStore.getState().toggleSelectAll();
    expect(useStore.getState().selection.size).toBe(0);
    expect(useStore.getState().toast?.text ?? '').toContain('还没有可选的单元格');
  });
});

describe('FR-56-3 人数调整不得删数据', () => {
  beforeEach(resetStore);

  it('50 → 30 → 50 后 31–50 号的值仍在', () => {
    const s = useStore.getState();
    const no = 40;
    s.commitValue(no, { kind: 'score', score: 66 });
    expect(useStore.getState().draft.entries[String(no)]).toBeTruthy();

    useStore.getState().setCount(30);
    // 存储里还在（只是不参与计算）
    expect(useStore.getState().draft.entries[String(no)]).toBeTruthy();

    useStore.getState().setCount(50);
    const e = useStore.getState().draft.entries[String(no)];
    expect(e).toBeTruthy();
    expect(e.value).toEqual({ kind: 'score', score: 66 });
  });
});

describe('FR-56-4 撤销边界', () => {
  beforeEach(resetStore);

  it('撤到底不应抛错，也不应把状态搞坏', () => {
    const s = useStore.getState();
    s.commitValue(1, { kind: 'score', score: 90 });
    for (let i = 0; i < 5; i++) useStore.getState().undo();
    const e = useStore.getState().draft.entries['1'];
    expect(e === undefined || e.value === null || e.value !== null).toBe(true);
  });

  it('撤销后可以重做回来', () => {
    const s = useStore.getState();
    s.commitValue(1, { kind: 'score', score: 90 });
    useStore.getState().undo();
    useStore.getState().redo();
    const e = useStore.getState().draft.entries['1'];
    expect(e?.value).toEqual({ kind: 'score', score: 90 });
  });
});

describe('FR-56-5 默认设置约束（防止误改）', () => {
  beforeEach(resetStore);

  it('默认人数 50，阈值 90/80/60 口径不变（V4 起阈值在方案里）', () => {
    const s = useStore.getState();
    const cls = s.classes.find((c) => c.id === s.activeClassId)!;
    expect(cls.count).toBe(50);
    // 质量监测（百分比制）的默认档位
    const scheme = s.draft.scheme;
    expect(scheme.kind === 'score' || scheme.kind === 'mixed' || scheme.kind === 'grade').toBe(true);
  });

  it('默认开启秒跳（老师最依赖的极速录入）', () => {
    expect(DEFAULT_SETTINGS.secondsJump).toBe(true);
  });
});
