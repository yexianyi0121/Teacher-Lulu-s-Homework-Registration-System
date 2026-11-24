import { useEffect, useState } from 'react';

/**
 * 数字输入框（带本地草稿）。
 *
 * 原生的受控 number 框有个通病：用户习惯先全选删除再输入，删空的瞬间
 * Number('') 变 0，父组件把 value 写回 0 并重渲染，光标被顶到 0 左边。
 *
 * 这里把「正在编辑的文本」留在组件内部：允许暂时为空/半截，失焦或回车时
 * 才解析、夹取并提交；非法或为空则恢复成原值。聚焦时自动全选，直接打字即替换。
 */
export function NumberField({
  id,
  ariaLabel,
  value,
  min,
  max,
  decimals = 0,
  onCommit,
  title,
}: {
  id?: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  /** 允许的小数位（0 = 只接受整数） */
  decimals?: number;
  /** 返回 false 表示拒绝本次输入（组件会恢复成原值） */
  onCommit: (n: number) => boolean | void;
  title?: string;
}) {
  const fmt = (n: number) => String(decimals > 0 ? Math.round(n * 10 ** decimals) / 10 ** decimals : Math.round(n));

  const [text, setText] = useState(() => fmt(value));
  const [focused, setFocused] = useState(false);

  // 外部值变化（例如夹取关系修正了另一个框）时同步，但不要打断正在输入的人
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const sanitize = (raw: string) => {
    let s = raw.replace(/[^\d.]/g, '');
    const firstDot = s.indexOf('.');
    if (decimals === 0) {
      s = s.replace(/\./g, '');
    } else if (firstDot >= 0) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
      const [i, f = ''] = s.split('.');
      s = `${i}.${f.slice(0, decimals)}`;
    }
    return s;
  };

  const commit = () => {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n)) {
      setText(fmt(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    const rounded = decimals > 0 ? Math.round(clamped * 10 ** decimals) / 10 ** decimals : Math.round(clamped);
    const ok = onCommit(rounded);
    setText(fmt(ok === false ? value : rounded));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      aria-label={ariaLabel}
      title={title}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setText(sanitize(e.target.value))}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setText(fmt(value));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}
