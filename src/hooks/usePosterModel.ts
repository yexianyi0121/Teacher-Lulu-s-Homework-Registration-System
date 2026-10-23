import { useStore } from '../store';
import { selectPosterModel } from '../store/selectors';

/** 海报数据模型选择器 */
export function usePosterModel() {
  return useStore(selectPosterModel);
}
