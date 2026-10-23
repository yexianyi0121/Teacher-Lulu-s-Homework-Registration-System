import type { PointRule } from '../domain/types';
import { manualAward as buildAward, revertRuleLedger, revokePoint as revoke } from '../domain/points';
import type { AppState, StoreGet, StoreSet } from './store-types';

type PointSlice = Pick<AppState, 'manualAward' | 'revokePoint' | 'setRules' | 'removeRule'>;

export function createPointSlice(set: StoreSet, get: StoreGet): PointSlice {
  return {
    manualAward(nos, delta, reason, ruleId) {
      const s = get();
      const now = Date.now();
      const rows = nos.map((no) =>
        buildAward({
          classId: s.activeClassId,
          studentNo: no,
          date: s.draft.date,
          delta,
          reason,
          ruleId: ruleId ?? null,
          now,
        }),
      );
      set({ pointLedger: [...s.pointLedger, ...rows] });
      const label = delta > 0 ? `+${delta}` : String(delta);
      s.showToast(`已给 ${nos.length} 人记 ${label} 分（${reason}）`, 'ok');
    },

    revokePoint(id) {
      const s = get();
      set({ pointLedger: revoke(s.pointLedger, id, Date.now()) });
      s.showToast('已撤销该条积分（写入反向记录）', 'ok');
    },

    setRules(rules: PointRule[]) {
      set({ pointRules: rules });
    },

    removeRule(id) {
      const s = get();
      const rule = s.pointRules.find((r) => r.id === id);
      if (!rule) return;
      if (rule.builtin) {
        s.showToast('内置规则不能删除，可停用', 'warn');
        return;
      }
      set({
        pointRules: s.pointRules.filter((r) => r.id !== id),
        pointLedger: revertRuleLedger(s.pointLedger, id, Date.now()),
      });
      s.showToast(`已删除「${rule.name}」，已写入冲正记录`, 'ok');
    },
  };
}
