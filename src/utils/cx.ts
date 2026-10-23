import clsx from 'clsx';
import type { ClassValue } from 'clsx';

/** clsx 包装（设计 §3 utils/cx.ts） */
export function cx(...args: ClassValue[]): string {
  return clsx(...args);
}
