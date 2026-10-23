import type { Entry } from './types';

/**
 * 补交门禁（设计 06 §3.5 / INV-22）—— 唯一入口。
 * 只有「缺交 / 请假」可以补交；有值或已过关一律拒绝。
 */
export function canMakeup(e: Entry | undefined): boolean {
  return !!e && (e.status === 'missing' || e.status === 'leave');
}

export class MakeupNotAllowedError extends Error {
  constructor() {
    super('MAKEUP_NOT_ALLOWED');
    this.name = 'MakeupNotAllowedError';
  }
}

export function assertCanMakeup(e: Entry | undefined): void {
  if (!canMakeup(e)) throw new MakeupNotAllowedError();
}
