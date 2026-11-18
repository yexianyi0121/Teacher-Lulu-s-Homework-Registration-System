import { useCallback } from 'react';
import { useStore } from '../store';

/**
 * 离开当前表前的「更新修改」提醒。
 *
 * 老师录完一两个学生就去切日期 / 切班级 / 新建下一张表时，很容易忘记点
 * 【💾 更新修改】。这里统一拦一下：只要当前表已有登记且还没保存到历史，
 * 就先弹确认，提醒先保存；老师确认「仍要切换」再继续。
 * 未录入任何内容时不打扰。
 */
export function useGuardedSwitch() {
  return useCallback((action: () => void, what = '切换') => {
    const s = useStore.getState();
    const cur = s.draft;
    const filled = cur ? Object.keys(cur.entries).length : 0;
    const saved = cur ? s.history.some((h) => h.key === cur.key && h.savedAt >= cur.updatedAt) : true;

    if (cur && filled > 0 && !saved) {
      s.openConfirm({
        title: '先点【更新修改】再离开？',
        message:
          `当前这张表已登记 ${filled} 位学生，还没点【💾 更新修改】保存到历史记录。\n\n` +
          `建议先保存，再${what}——否则「历史记录」里可能看不到这次登记。\n\n` +
          `确定要直接${what}吗？`,
        confirmText: `仍要${what}`,
        onConfirm: action,
      });
      return;
    }
    action();
  }, []);
}
