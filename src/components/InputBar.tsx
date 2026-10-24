import { useEffect, useRef, useState } from 'react';
import { STAMP_LABEL } from '../domain/constants';
import { schemeHasPass } from '../domain/scoring';
import { canMakeup } from '../domain/makeup';
import { useStore } from '../store';
import { Pill, Toggle } from './ui/controls';

/**
 * 录入带（V4 FR-49.3 / ADR-25）：原 V3 第一行下移，紧贴提示条与网格。
 * 布局：当前格动作（语音/盖章/过关/补交/缺交/请假/全选） │ 筛选与存储（只看未过关 /
 * 本表设置 / 清空 / 更新修改） │ ⋯ 更多（积分/导出的第二入口，FR-49.4）。
 * 「清空」用危险色描边 + 二次确认显示格数（FR-49.7c）。
 */
export function InputBar({
  onVoice,
  voiceListening,
  voiceSupported,
  onClear,
  onSave,
}: {
  onVoice: () => void;
  voiceListening: boolean;
  voiceSupported: boolean;
  onClear: () => void;
  onSave: () => void;
}) {
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

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [moreOpen]);

  const act = (fn: (no: number) => void) => {
    if (focusedNo === null) return;
    fn(focusedNo);
  };

  /** 补交门禁（FR-33.1）：焦点格/所选里没有缺交或请假 → Toast 拒绝，不打开弹窗 */
  const openMakeup = () => {
    const st = useStore.getState();
    const pool = st.selection.size ? [...st.selection] : (st.focusedNo !== null ? [st.focusedNo] : []);
    const any = pool.some((no) => canMakeup(st.draft.entries[String(no)]));
    const hasCandidates = st.selection.size ? any : pool.length === 0 || any;
    if (!hasCandidates) {
      st.showToast('只有缺交或请假可以补交', 'warn');
      return;
    }
    st.setModal('makeup');
  };

  return (
    <div className="input-bar" role="toolbar" aria-label="录入">
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
        <Pill variant="ghost" onClick={() => act(togglePass)} title="过关 / 取消（G）">
          ✅ 过关
        </Pill>
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

      <span className="input-grow" />

      <label className="filter-toggle" title="只看未过关（不持久化）">
        <Toggle checked={filterNotPassed} onChange={setFilterNotPassed} label="只看未过关" />
        <span>👁 只看未过关</span>
      </label>

      <Pill variant="ghost" onClick={() => setModal('scheme')} title="本表评分方案">
        ⚙️ 本表设置
      </Pill>

      <span className="input-sep" aria-hidden="true" />

      <Pill variant="danger" onClick={onClear} title="清空本条登记的全部录入（可 Ctrl+Z 撤销）">
        🧹 清空
      </Pill>
      <Pill variant="save" onClick={onSave} title="保存到历史（Ctrl+S）">
        💾 更新修改
      </Pill>

      <div className="more-wrap" ref={moreRef}>
        <Pill
          variant="ghost"
          onClick={() => setMoreOpen((v) => !v)}
          ariaPressed={moreOpen}
          ariaLabel="更多"
          title="更多（积分 / 导出）"
        >
          ⋯
        </Pill>
        {moreOpen ? (
          <div className="more-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setModal('points'); }}>
              ⭐ 积分
            </button>
            <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setModal('export'); }}>
              📤 导出
            </button>
            <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setModal('settings'); }}>
              ⚙️ 设置
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
