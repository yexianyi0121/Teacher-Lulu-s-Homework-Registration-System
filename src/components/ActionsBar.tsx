import { STAMP_LABEL } from '../domain/constants';
import { schemeHasPass } from '../domain/scoring';
import { canMakeup } from '../domain/makeup';
import { useStore } from '../store';
import { Pill, Toggle } from './ui/controls';

export interface ActionsBarProps {
  onVoice: () => void;
  voiceListening: boolean;
  voiceSupported: boolean;
  onReport: () => void;
  onPoster: () => void;
  onSummary: () => void;
  onWeek: () => void;
  onClear: () => void;
  onSave: () => void;
}

/**
 * 工具栏（V3 设计 06 §4.3）：两行、同高同间距。
 * 第一行 = 录入动作；第二行 = 输出/管理动作。
 */
export function ActionsBar({
  onVoice,
  voiceListening,
  voiceSupported,
  onReport,
  onPoster,
  onSummary,
  onWeek,
  onClear,
  onSave,
}: ActionsBarProps) {
  const currentStamp = useStore((s) => s.currentStamp);
  const setCurrentStamp = useStore((s) => s.setCurrentStamp);
  const scheme = useStore((s) => s.draft.scheme);
  const filterNotPassed = useStore((s) => s.filterNotPassed);
  const setFilterNotPassed = useStore((s) => s.setFilterNotPassed);
  const togglePass = useStore((s) => s.togglePass);
  const setStatus = useStore((s) => s.setStatus);
  const setModal = useStore((s) => s.setModal);
  const toggleSelectAll = useStore((s) => s.toggleSelectAll);
  const focusedNo = useStore((s) => s.focusedNo);

  const act = (fn: (no: number) => void) => {
    if (focusedNo === null) return;
    fn(focusedNo);
  };

  /** 补交门禁（FR-33.1）：焦点格/所选里没有缺交或请假 → Toast 拒绝，不打开弹窗 */
  const openMakeup = () => {
    const st = useStore.getState();
    const pool = st.selection.size ? [...st.selection] : (st.focusedNo !== null ? [st.focusedNo] : []);
    const any = pool.some((no) => canMakeup(st.draft.entries[String(no)]));
    const hasCandidates = st.selection.size
      ? any
      : pool.length === 0 || any;
    if (!hasCandidates) {
      st.showToast('只有缺交或请假可以补交', 'warn');
      return;
    }
    st.setModal('makeup');
  };

  return (
    <div className="actions">
      <div className="actions-row">
        <Pill
          variant={voiceListening ? 'voice-on' : 'voice'}
          onClick={onVoice}
          disabled={!voiceSupported}
          title={voiceSupported ? '语音录入（Ctrl+M）' : '当前浏览器不支持语音识别，请用 Edge / Chrome'}
        >
          🎤 {voiceListening ? '聆听中…' : '语音'}
        </Pill>

        <select
          className="pill pill--select"
          aria-label="盖章类型"
          value={currentStamp}
          onChange={(e) => setCurrentStamp(e.target.value as typeof currentStamp)}
        >
          <option value="corrected">✅ {STAMP_LABEL.corrected}</option>
          <option value="excellent">⭐ {STAMP_LABEL.excellent}</option>
        </select>

        {schemeHasPass(scheme) ? (
          <>
            <Pill variant="ghost" onClick={() => act(togglePass)} title="过关 / 取消（G）">
              ✅ 过关
            </Pill>
            <label className="filter-toggle" title="只看未过关（不持久化）">
              <Toggle checked={filterNotPassed} onChange={setFilterNotPassed} label="只看未过关" />
              <span>👁 只看未过关</span>
            </label>
          </>
        ) : null}

        <Pill variant="ghost" onClick={openMakeup} title="补交（M）">
          📥 补交
        </Pill>
        <Pill variant="ghost" onClick={() => act((no) => setStatus(no, 'missing'))} title="缺交（X）">
          ❌ 缺交
        </Pill>
        <Pill variant="ghost" onClick={() => act((no) => setStatus(no, 'leave'))} title="请假（L）">
          🏖️ 请假
        </Pill>

        <Pill variant="ghost" onClick={toggleSelectAll} title="全选已有内容的格子">
          ☑️ 全选
        </Pill>
      </div>

      <div className="actions-row">
        <Pill variant="report" onClick={onReport} title="生成报表（Ctrl+Enter）">
          📋 报表生成
        </Pill>
        <Pill variant="poster" onClick={onPoster} title="单条海报（Ctrl+J）">
          🖼️ 截图发群
        </Pill>
        <Pill variant="ghost" onClick={onSummary} title="当日全部登记拼成一张长图">
          📸 当日汇总
        </Pill>
        <Pill variant="ghost" onClick={onWeek} title="本周按日拼接的长图">
          🗓️ 本周汇总
        </Pill>
        <Pill variant="ghost" onClick={() => setModal('points')}>⭐ 积分</Pill>
        <Pill variant="ghost" onClick={() => setModal('export')}>📤 导出</Pill>
        <Pill variant="ghost" onClick={onClear}>🧹 清空</Pill>
        <Pill variant="save" onClick={onSave} title="保存到历史（Ctrl+S）">
          💾 更新修改
        </Pill>
      </div>
    </div>
  );
}
