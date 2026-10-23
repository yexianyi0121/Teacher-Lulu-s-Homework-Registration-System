import { useEffect, useMemo, useRef } from 'react';
import { useStore, currentClass } from '../store';
import { matchStudents } from '../domain/search';
import { IconButton } from './ui/controls';

export interface HeaderProps {
  onImport: () => void;
  onSettings: () => void;
  onManual: () => void;
}

function fmtTime(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `已自动保存 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Header({ onImport, onSettings, onManual }: HeaderProps) {
  const classes = useStore((s) => s.classes);
  const activeClassId = useStore((s) => s.activeClassId);
  const switchClass = useStore((s) => s.switchClass);
  const secondsJump = useStore((s) => s.settings.secondsJump);
  const updateSettings = useStore((s) => s.updateSettings);
  const searchOpen = useStore((s) => s.searchOpen);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setFocusedNo = useStore((s) => s.setFocusedNo);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const cls = currentClass();
  const count = cls?.count ?? 0;

  const inputRef = useRef<HTMLInputElement>(null);
  const candidateRef = useRef(0);
  const matches = useMemo(() => matchStudents(searchQuery, count), [searchQuery, count]);

  useEffect(() => {
    if (searchOpen) {
      candidateRef.current = 0;
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    candidateRef.current = 0;
  }, [searchQuery]);

  const jumpTo = (no: number) => {
    setFocusedNo(no);
    setSearchQuery('');
    setSearchOpen(false);
    inputRef.current?.blur();
  };

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-emoji" aria-hidden="true">🌸</span>
        <span>学情登记分析系统</span>
      </div>

      <div className="header-right">
        <select
          className="pill pill--select class-select"
          aria-label="切换班级"
          value={activeClassId}
          onChange={(e) => {
            if (e.target.value === '__new__') {
              onSettings();
              return;
            }
            switchClass(e.target.value);
          }}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{`${c.name} · ${c.count}人`}</option>
          ))}
          <option value="__new__">＋ 新建 / 管理班级…</option>
        </select>

        <span className="save-indicator" aria-live="polite">{fmtTime(lastSavedAt)}</span>

        <button
          type="button"
          className={`pill ${secondsJump ? 'pill--jump-on' : ''}`}
          aria-pressed={secondsJump}
          aria-label="秒跳开关"
          title="提交后自动跳到下一格"
          onClick={() => updateSettings({ secondsJump: !secondsJump })}
        >
          ⚡ 秒跳
        </button>

        <div className="search-wrap">
          <label className="pill-input search-box">
            <span aria-hidden="true">🔍</span>
            <input
              ref={inputRef}
              data-search="1"
              type="text"
              inputMode="numeric"
              placeholder="搜学号"
              aria-label="搜学号"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.replace(/[^0-9]/g, ''))}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const no = matches[candidateRef.current] ?? matches[0];
                  if (no) jumpTo(no);
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  if (matches.length > 0) candidateRef.current = (candidateRef.current + 1) % matches.length;
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setSearchOpen(false);
                  inputRef.current?.blur();
                }
              }}
            />
          </label>
          {searchOpen && searchQuery ? (
            <div className="search-pop" role="listbox" aria-label="匹配的学号">
              {matches.length === 0 ? (
                <div className="search-pop-empty">没有匹配的学号</div>
              ) : (
                matches.slice(0, 8).map((no, i) => (
                  <button
                    key={no}
                    type="button"
                    role="option"
                    aria-selected={i === candidateRef.current}
                    className="search-pop-item"
                    data-active={i === candidateRef.current ? '1' : undefined}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      jumpTo(no);
                    }}
                  >
                    {no} 号
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <IconButton icon="📖" title="使用手册" onClick={onManual} />
        <IconButton icon="📁" title="导入花名册" onClick={onImport} />
        <IconButton icon="⚙️" title="设置" onClick={onSettings} />
      </div>
    </header>
  );
}
