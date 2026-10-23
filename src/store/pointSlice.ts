import type { PointRule } from '../domain/types';
import { manualAward as buildAward, revokePoint as revoke } from '../domain/points';
import type { AppState, StoreGet, StoreSet } from './store-types';

type PointSlice = Pick<AppState, 'manualAward' | 'revokePoint' | 'setRules'>;

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
  };
}
