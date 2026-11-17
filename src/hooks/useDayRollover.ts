import { useEffect } from 'react';
import { useStore } from '../store';
import { todayISO } from '../domain/date';
import { hasEntries } from '../store/initial';

/**
 * 跨天自动切到「今天」。
 *
 * `fromPersisted()` 只在页面打开时决定落在哪张表；如果老师把页面一直开着过夜，
 * 第二天看到的仍是昨天的表（日期、作业内容都不变）。这里每分钟 + 回到前台时检查一次：
 * 只要当前这张表**还没有任何录入**，就切到今天的空表（内容清空）。
 * 若老师正在回看一张旧的有数据的表，则不动它——避免打断批改/回看。
 */
export function useDayRollover() {
  useEffect(() => {
    const check = () => {
      const s = useStore.getState();
      if (s.readOnly) return;
      const today = todayISO();
      if (!s.draft || s.draft.date === today) return;
      // 有录入的表不自动跳走（老师可能在回看/补录历史）
      if (hasEntries(s.draft.entries)) return;
      s.switchRecord({ date: today, content: '' });
    };

    const timer = window.setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const onFocus = () => check();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}
