import { useMemo, useState, useRef, useEffect } from 'react';
import { useStore, currentClass } from '../store';
import { formatDateCN, todayISO, weekdayCN } from '../domain/date';
import { hasEntries } from '../store/initial';

/** 
 * 日期选择器增强版：
 * - 日期栏视图调大
 * - 高亮有登记历史的日期
 * - 鼠标悬浮显示当天已登记的表名称
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
  const calendarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 收集该班级所有有登记记录的日期及其表名
  const dateInfo = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (date: string, content: string) => {
      if (!map.has(date)) map.set(date, new Set());
      if (content) map.get(date)!.add(content);
    };
    for (const r of Object.values(s.records)) {
      if (r.classId === cls?.id && hasEntries(r.entries)) add(r.date, r.content);
    }
    for (const h of s.history) {
      if (h.classId === cls?.id) add(h.date, h.content);
    }
    return map;
  }, [s.records, s.history, cls?.id]);

  // 生成当前显示月份的日历格子
  const calendarDays = useMemo(() => {
    const parts = value.split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const startPad = firstDay.getDay() || 7; // 周一=1..周日=7
    const days: Array<{ date: string; day: number; hasData: boolean; isToday: boolean; isSelected: boolean }> = [];
    
    // 前置空白
    for (let i = 1; i < startPad; i++) {
      days.push({ date: '', day: 0, hasData: false, isToday: false, isSelected: false });
    }
    
    const today = todayISO();
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = y + '-' + mm + '-' + dd;
      days.push({
        date: dateStr,
        day: d,
        hasData: dateInfo.has(dateStr),
        isToday: dateStr === today,
        isSelected: dateStr === value,
      });
    }
    return days;
  }, [value, dateInfo]);

  // 点击外部关闭日历
  useEffect(() => {
    if (!showCalendar) return;
    const onDown = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showCalendar]);

  const monthLabel = (() => {
    const parts = value.split('-').map(Number);
    return parts[0] + '年' + parts[1] + '月';
  })();

  const goMonth = (delta: number) => {
    const parts = value.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1 + delta, 1);
    const newVal = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
    onChange(newVal);
  };

  const weekHeaders = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div className="date-picker-wrap">
      <input
        ref={inputRef}
        type="date"
        className="date-input-enhanced"
        aria-label="日期"
        value={value}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value);
            setShowCalendar(false);
          }
        }}
        onFocus={() => setShowCalendar(true)}
        onClick={() => setShowCalendar(true)}
      />
      
      {showCalendar ? (
        <div className="date-calendar-dropdown" ref={calendarRef}>
          <div className="date-calendar-header">
            <button type="button" className="cal-nav-btn" onClick={() => goMonth(-1)}>◀</button>
            <span className="cal-month-label">{monthLabel}</span>
            <button type="button" className="cal-nav-btn" onClick={() => goMonth(1)}>▶</button>
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
                  if (d.date) {
                    onChange(d.date);
                    setShowCalendar(false);
                  }
                }}
                onMouseEnter={(e) => {
                  if (d.hasData && d.date) {
                    setHoverDate(d.date);
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
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
          
          {hoverDate && tooltipPos && dateInfo.has(hoverDate) ? (
            <div
              className="cal-tooltip"
              style={{
                position: 'fixed',
                left: tooltipPos.x + 'px',
                top: (tooltipPos.y - 8) + 'px',
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="cal-tooltip-date">{formatDateCN(hoverDate)} {weekdayCN(hoverDate)}</div>
              {[...(dateInfo.get(hoverDate) ?? [])].slice(0, 8).map((name, j) => (
                <div key={j} className="cal-tooltip-item">📋 {name || '未命名'}</div>
              ))}
              {(dateInfo.get(hoverDate)?.size ?? 0) > 8 ? (
                <div className="cal-tooltip-more">…还有 {(dateInfo.get(hoverDate)?.size ?? 0) - 8} 张表</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}