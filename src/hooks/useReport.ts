import { useStore } from '../store';
import { selectReport } from '../store/selectors';

/** 报表文案选择器（纯函数 buildReport 的派生结果） */
export function useReport() {
  return useStore(selectReport);
}
