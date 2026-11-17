import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, currentClass } from '../store';
import { formatDateCN, todayISO, weekdayCN } from '../domain/date';
import { hasEntries } from '../store/initial';
import { SHEET_TEMPLATES } from '../domain/constants';

/**
 * 日期选择器（自定义月历）。
 *
 * 为什么用 Portal：参数行 `.params` 是 `position:relative; z-index:1` 的层叠上下文，
 * 而录入带 `.input-bar` 是 `z-index:20`。日历作为 `.params` 的子节点时，无论自身
 * z-index 多大都会被整个参数行的层级压住——出现「日历被过关/补交那排按钮遮住」。
 * 把日历挂到 body 上并改为 fixed 定位，才能稳定浮在所有工具栏之上。
 */
export function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const s = useStore();
  const cls = currentClass();

  const [showCalendar, setShowCalendar] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState(value);
  const [pos, setPos] = useState<{ left: number; top: number; openUp: boolean }>({ left: 0, top: 0, openUp: false });

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // 视图月份与「选中日期」解耦：翻月只改视图，不会误改登记日期
  const [view, setView] = useState(() => {
    const p = value.split('-').map(Number);
    return { year: p[0] || new Date().getFullYear(), month: p[1] || new Date().getMonth() + 1 };
  });

  useEffect(() => {
    setText(value);
    const p = value.split('-').map(Number);
    if (p[0] && p[1]) setView({ year: p[0], month: p[1] });
  }, [value]);

  // 该班级所有有登记的日期 → 当天表名集合
  const dateInfo = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (date: string, label: string) => {
      if (!date) return;
      if (!map.has(date)) map.set(date, new Set());
      map.get(date)!.add(label);
    };
    for (const r of Object.values(s.records)) {
      if (r.classId !== cls?.id || !hasEntries(r.entries)) continue;
      const tpl = SHEET_TEMPLATES[r.templateId]?.name ?? '';
      add(r.date, `${tpl}${r.content ? ` · ${r.content}` : ''}`.trim() || '未命名表');
    }
    for (const h of s.history) {
      if (h.classId !== cls?.id || !hasEntries(h.entries)) continue;
      const tpl = SHEET_TEMPLATES[h.templateId]?.name ?? '';
      add(h.date, `${tpl}${h.content ? ` · ${h.content}` : ''}`.trim() || '未命名表');
    }
    return map;
  }, [s.records, s.history, cls?.id]);

  // 重新计算浮层位置（fixed 定位，跟着输入框走）
  const place = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 320;
    const estHeight = 400;
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    const openUp = r.bottom + estHeight > window.innerHeight - 8 && r.top > estHeight;
    const top = openUp ? r.top - 6 : r.bottom + 6;
    setPos({ left, top, openUp });
  }, []);

  useEffect(() => {
    if (!showCalendar) return;
    place();
    const onScrollOrResize = () => place();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [showCalendar, place]);

  const calendarDays = useMemo(() => {
    const { year, month } = view;
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startPad = firstDay.getDay() || 7;
    const days: Array<{ date: string; day: number; hasData: boolean; isToday: boolean; isSelected: boolean }> = [];
    for (let i = 1; i < startPad; i++) {
      days.push({ date: '', day: 0, hasData: false, isToday: false, isSelected: false });
    }
    const today = todayISO();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        day: d,
        hasData: dateInfo.has(dateStr),
        isToday: dateStr === today,
        isSelected: dateStr === value,
      });
    }
    return days;
  }, [view, dateInfo, value]);

  // 点击外部关闭（输入框 + Portal 浮层都不算外部）
  useEffect(() => {
    if (!showCalendar) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (dropRef.current?.contains(t)) return;
      setShowCalendar(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showCalendar]);

  const goMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };

  const commitText = () => {
    const v = text.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { setText(value); return; }
    const d = new Date(`${v}T00:00:00`);
    if (Number.isNaN(d.getTime()) || todayISO(d) !== v) { setText(value); return; }
    onChange(v);
  };

  const weekHeaders = ['一', '二', '三', '四', '五', '六', '日'];
  const hoverItems = hoverDate ? [...(dateInfo.get(hoverDate) ?? [])] : [];

  const dropdown = showCalendar ? (
    <div
      ref={dropRef}
      className="date-calendar-dropdown"
      style={{
        position: 'fixed',
        left: pos.left + 'px',
        top: pos.top + 'px',
        transform: pos.openUp ? 'translateY(-100%)' : undefined,
        zIndex: 9999,
      }}
    >
      <div className="date-calendar-header">
        <button type="button" className="cal-nav-btn" onClick={() => goMonth(-1)} aria-label="上个月">◀</button>
        <span className="cal-month-label">{view.year}年{view.month}月</span>
        <button type="button" className="cal-nav-btn" onClick={() => goMonth(1)} aria-label="下个月">▶</button>
      </div>

      <div className="date-calendar-grid">
        {weekHeaders.map((h) => (<div key={h} className="cal-weekday">{h}</div>))}
        {calendarDays.map((d, i) => (
          <div
            key={i}
            className={
              'cal-day' +
              (d.hasData ? ' cal-day--has-data' : '') +
              (d.isToday ? ' cal-day--today' : '') +
              (d.isSelected ? ' cal-day--selected' : '') +
              (!d.date ? ' cal-day--empty' : '')
            }
            onClick={() => {
              if (d.date) { onChange(d.date); setShowCalendar(false); }
            }}
            onMouseEnter={(e) => {
              if (d.hasData && d.date) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHoverDate(d.date);
                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
              }
            }}
            onMouseLeave={() => { setHoverDate(null); setTooltipPos(null); }}
          >
            {d.day || ''}
          </div>
        ))}
      </div>

      <div className="date-calendar-footer">
        <button
          type="button"
          className="cal-today-btn"
          onClick={() => { onChange(todayISO()); setShowCalendar(false); }}
        >回到今天</button>
        <span className="cal-legend"><i className="cal-legend-dot" /> 有登记</span>
      </div>

      {hoverDate && tooltipPos && hoverItems.length > 0 ? (
        <div
          className="cal-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x + 'px',
            top: (tooltipPos.y - 6) + 'px',
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="cal-tooltip-date">{formatDateCN(hoverDate)} {weekdayCN(hoverDate)}</div>
          {hoverItems.slice(0, 10).map((name, j) => (
            <div key={j} className="cal-tooltip-item">📋 {name}</div>
          ))}
          {hoverItems.length > 10 ? (
            <div className="cal-tooltip-more">…还有 {hoverItems.length - 10} 张表</div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="date-picker-wrap" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="date-input-enhanced"
        aria-label="日期"
        placeholder="YYYY-MM-DD"
        maxLength={10}
        value={text}
        title="点击选择日期；有登记的日期会高亮显示"
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onFocus={() => setShowCalendar(true)}
        onClick={() => setShowCalendar(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commitText(); setShowCalendar(false); }
          if (e.key === 'Escape') setShowCalendar(false);
        }}
      />
      {dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
