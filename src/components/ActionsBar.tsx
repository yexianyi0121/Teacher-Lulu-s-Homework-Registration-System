import type { Stamp } from '../domain/types';
import { STAMP_ICON, STAMP_LABEL } from '../domain/constants';
import { useStore } from '../store';
import { Pill } from './ui/controls';

export interface ActionsBarProps {
  onVoice: () => void;
  onReport: () => void;
  onPoster: () => void;
  onClear: () => void;
  onSave: () => void;
}

export function ActionsBar({ onVoice, onReport, onPoster, onClear, onSave }: ActionsBarProps) {
  const currentStamp = useStore((s) => s.currentStamp);
  const setCurrentStamp = useStore((s) => s.setCurrentStamp);
  const selectionSize = useStore((s) => s.selection.size);
  const toggleSelectAll = useStore((s) => s.toggleSelectAll);
  const rec = useStore((s) => s.drafts[s.activeKey]);
  const voiceListening = useStore((s) => s.voiceListening);
  const posterLoading = useStore((s) => s.posterLoading);

  const hasEntries = !!rec && Object.keys(rec.entries).length > 0;

  return (
    <section className="actions" aria-label="操作">
      <Pill
        variant={voiceListening ? 'voice-on' : 'voice'}
        onClick={onVoice}
        title={voiceListening ? '停止语音识别' : '开始语音识别（Ctrl+M）'}
        ariaPressed={voiceListening}
      >
        {voiceListening ? '🔴 聆听中' : '🎤 语音'}
      </Pill>

      <label className="pill pill--select" title="选择章型（只影响后续盖章）">
        <span aria-hidden="true">{STAMP_ICON[currentStamp]}</span>
        <select
          aria-label="章型"
          value={currentStamp}
          onChange={(e) => setCurrentStamp(e.target.value as Exclude<Stamp, 'none'>)}
        >
          <option value="corrected">盖章 · 已更正</option>
          <option value="excellent">盖章 · 优秀</option>
        </select>
      </label>

      <Pill
        variant={selectionSize > 0 ? 'active' : 'default'}
        onClick={toggleSelectAll}
        title="全选已录入或已盖章的单元格"
        ariaPressed={selectionSize > 0}
      >
        ✨ 全选{selectionSize > 0 ? `（${selectionSize}）` : ''}
      </Pill>

      <Pill variant="report" onClick={onReport} title="生成报表文案（Ctrl+Enter）">
        📊 报表生成
      </Pill>

      <Pill variant="poster" onClick={onPoster} disabled={posterLoading} title="生成海报图片">
        {posterLoading ? '生成中…' : '📋 截图发群'}
      </Pill>

      <Pill variant="ghost" onClick={onClear} disabled={!hasEntries} title="清空当前记录（可撤销）">
        🧹 清空
      </Pill>

      <Pill variant="save" onClick={onSave} title="保存到历史记录（Ctrl+S）">
        💾 更新修改
      </Pill>

      <span className="sr-only" aria-live="polite">
        当前章型：{STAMP_LABEL[currentStamp]}
      </span>
    </section>
  );
}
