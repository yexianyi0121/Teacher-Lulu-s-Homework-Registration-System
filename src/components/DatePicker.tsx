import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, currentClass } from '../store';
import { formatDateCN, todayISO, weekdayCN } from '../domain/date';
import { hasEntries } from '../store/initial';
import { SHEET_TEMPLATES } from '../domain/constants';

/**
 * 日期选择器（自定义月历）：
 *  - 日期栏视图加大（CSS: .date-input-enhanced）
 *  - 有登记记录的日期高亮显示小圆点
 *  - 鼠标悬浮到高亮日期时，浮出当天已登记的表名清单
 *  - 用 text 输入代替原生 type=date：否则浏览器原生面板会盖住本日历，
 *    悬浮提示与高亮根本点不到（这是「功能完全没实现」的根因之一）。
 *  - 浏览月份只改「视图月份」，绝不改动当前登记日期（避免翻月误改数据）。
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

  const wrapRef = useRef<HTMLDivElement>(null);

  // 视图月份：与「选中日期」解耦，翻月不改变登记日期
  const [view, setView] = useState(() => {
    const p = value.split('-').map(Number);
    return { year: p[0] || new Date().getFullYear(), month: p[1] || new Date().getMonth() + 1 };
  });

  // 外部（例如跨天刷新）改了 value 时，同步输入框与视图月份
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

  // 当前视图月份的日历格子（周一为一周第一天）
  const calendarDays = useMemo(() => {
    const { year, month } = view;
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startPad = firstDay.getDay() || 7; // 周一=1 … 周日=7
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

  // 点击外部关闭
  useEffect(() => {
    if (!showCalendar) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowCalendar(false);
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
    // 回环校验：拦掉 2026-02-30 这类不存在的日期
    if (Number.isNaN(d.getTime()) || todayISO(d) !== v) { setText(value); return; }
    onChange(v);
  };

  const weekHeaders = ['一', '二', '三', '四', '五', '六', '日'];
  const hoverItems = hoverDate ? [...(dateInfo.get(hoverDate) ?? [])] : [];

  return (
    <div className="date-picker-wrap" ref={wrapRef}>
      <input
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

      {showCalendar ? (
        <div className="date-calendar-dropdown">
          <div className="date-calendar-header">
            <button type="button" className="cal-nav-btn" onClick={() => goMonth(-1)} aria-label="上个月">◀</button>
            <span className="cal-month-label">{view.year}年{view.month}月</span>
            <button type="button" className="cal-nav-btn" onClick={() => goMonth(1)} aria-label="下个月">▶</button>
          </div>

          <div className="date-calendar-grid">
            {weekHeaders.map((h) => (
              <div key={h} className="cal-weekday">{h}</div>
            ))}
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
                onMouseLeave={() => {
                  setHoverDate(null);
                  setTooltipPos(null);
                }}
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
            <span className="cal-legend">
              <i className="cal-legend-dot" /> 有登记
            </span>
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
      ) : null}
    </div>
  );
}
