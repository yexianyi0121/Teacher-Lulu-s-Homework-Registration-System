import { useStore } from '../store';
import { selectStats } from '../store/selectors';

/** 统计选择器（引用稳定，派生自 entries） */
export function useStats() {
  return useStore(selectStats);
}
