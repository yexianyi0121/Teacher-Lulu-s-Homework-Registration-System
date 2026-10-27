import { Pill } from './ui/controls';
import type { ScoringScheme } from '../domain/types';
import { schemeHint } from '../domain/scheme';

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
  scheme,
  onOpenScheme,
}: {
  onReport: () => void;
  onPoster: () => void;
  onSummary: () => void;
  onWeek: () => void;
  busy?: OutputJob;
  /** 当前这张表的方案（v2.6.5 需求3：常驻显示方案类型 + 过关口径） */
  scheme: ScoringScheme;
  onOpenScheme: () => void;
}) {
  return (
    <div className="output-bar" role="toolbar" aria-label="输出">
      {/* v2.6.5 需求3：原来那句「录入完成 → 一键输出」没有任何信息量，换成可点的本表方案提示 */}
      <button
        type="button"
        className="pill pill--scheme output-scheme"
        aria-label="本表方案"
        title="查看或修改本表的方案类型与过关规则"
        onClick={onOpenScheme}
      >
        {schemeHint(scheme)}
      </button>
      <span className="output-grow" />
      <Pill
        variant="report"
        onClick={onReport}
        busy={busy === 'report'}
        ariaLabel="报表生成"
        title="生成报表（Ctrl+Enter）"
      >
        <span aria-hidden="true">📋</span><span className="output-label">报表生成</span>
      </Pill>
      <Pill
        variant="poster"
        onClick={onPoster}
        busy={busy === 'poster'}
        ariaLabel="单条海报"
        title="单条海报（Ctrl+J）"
      >
        <span aria-hidden="true">🖼️</span><span className="output-label">单条海报</span>
      </Pill>
      <Pill variant="ghost" onClick={onSummary} busy={busy === 'daily'} ariaLabel="当日汇总" title="当日全部登记拼成一张长图">
        <span aria-hidden="true">📸</span><span className="output-label">当日汇总</span>
      </Pill>
      <Pill variant="ghost" onClick={onWeek} busy={busy === 'week'} ariaLabel="本周汇总" title="本周按日拼接的长图">
        <span aria-hidden="true">🗓️</span><span className="output-label">本周汇总</span>
      </Pill>
    </div>
  );
}
