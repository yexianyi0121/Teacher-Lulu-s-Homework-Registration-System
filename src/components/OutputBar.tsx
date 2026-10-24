import { Pill } from './ui/controls';

/**
 * 输出带（V4 FR-49.1 / ADR-25）：只放 4 个输出动作，顺序固定，右对齐。
 * 一节课后老师最常点的就是前两个，因此用实心主按钮；「清空」等破坏性动作
 * 不在这行（FR-49.5 视觉隔离）。生成中的按钮显示 spinner 并禁用（FR-49.7a），
 * 其余按钮不变灰——避免老师连点。
 */
export type OutputJob = 'report' | 'poster' | 'daily' | 'week' | null;

export function OutputBar({
  onReport,
  onPoster,
  onSummary,
  onWeek,
  busy,
  note = '录入完成 → 一键输出',
}: {
  onReport: () => void;
  onPoster: () => void;
  onSummary: () => void;
  onWeek: () => void;
  busy?: OutputJob;
  note?: string;
}) {
  return (
    <div className="output-bar" role="toolbar" aria-label="输出">
      <span className="output-note">{note}</span>
      <span className="output-grow" />
      <Pill
        variant="report"
        onClick={onReport}
        busy={busy === 'report'}
        ariaLabel="报表生成"
        title="生成报表（Ctrl+Enter）"
      >
        📋 报表生成
      </Pill>
      <Pill
        variant="poster"
        onClick={onPoster}
        busy={busy === 'poster'}
        ariaLabel="单条海报"
        title="单条海报（Ctrl+J）"
      >
        🖼️ 单条海报
      </Pill>
      <Pill variant="ghost" onClick={onSummary} busy={busy === 'daily'} ariaLabel="当日汇总" title="当日全部登记拼成一张长图">
        📸 当日汇总
      </Pill>
      <Pill variant="ghost" onClick={onWeek} busy={busy === 'week'} ariaLabel="本周汇总" title="本周按日拼接的长图">
        🗓️ 本周汇总
      </Pill>
    </div>
  );
}
