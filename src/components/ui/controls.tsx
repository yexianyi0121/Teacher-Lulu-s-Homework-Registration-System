import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../../utils/cx';

export interface PillProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'jump-on' | 'voice' | 'voice-on' | 'report' | 'poster' | 'save' | 'ghost' | 'active' | 'danger';
  size?: 'md' | 'lg';
  disabled?: boolean;
  /** 生成中：显示 spinner 并禁用（FR-49.7a），其余按钮不受影响 */
  busy?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  className?: string;
}

export function Pill({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled,
  busy,
  title,
  ariaLabel,
  ariaPressed,
  className,
}: PillProps) {
  const variantClass =
    variant === 'jump-on'
      ? 'pill--jump-on'
      : variant === 'voice'
        ? 'pill--voice'
        : variant === 'voice-on'
          ? 'pill--voice-on'
          : variant === 'report'
            ? 'pill--primary-report'
            : variant === 'poster'
              ? 'pill--primary-poster'
              : variant === 'save'
                ? 'pill--primary-save'
                : variant === 'ghost'
                  ? 'pill--ghost'
                  : variant === 'active'
                    ? 'pill--active'
                    : variant === 'danger'
                      ? 'pill--danger'
                      : '';

  return (
    <button
      type="button"
      className={cx('pill', size === 'lg' && 'pill-lg', variantClass, className)}
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-busy={busy || undefined}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps {
  icon: string;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function IconButton({ icon, title, onClick, disabled }: IconButtonProps) {
  return (
    <button type="button" className="icon-btn" title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      className="toggle"
      data-on={checked ? '1' : '0'}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

export function stopKey(e: KeyboardEvent) {
  e.stopPropagation();
}
