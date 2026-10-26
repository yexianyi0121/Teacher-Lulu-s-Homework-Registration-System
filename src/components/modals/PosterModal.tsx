import { useState } from 'react';
import { useStore } from '../../store';
import { selectSheetsOfDay, selectSummary, selectWeek } from '../../store/selectors';
import type { PosterTarget } from '../../domain/types';
import { addDaysISO } from '../../domain/date';
import { COMMENT_MAX, SHEET_TEMPLATES } from '../../domain/constants';
import { copyPngBlob } from '../../infra/clipboard';
import { downloadBlob } from '../../infra/download';
import { shareImageBlob } from '../../infra/share';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

const TITLES: Record<PosterTarget['mode'], string> = {
  single: '海报预览',
  daily: '当日汇总预览',
  week: '本周汇总预览',
};

const ALTS: Record<PosterTarget['mode'], string> = {
  single: '学情海报预览',
  daily: '当日汇总预览',
  week: '本周汇总预览',
};

/** 汇总预览与切换（V3 FR-34）：onSwitch 传目标值，不读闭包旧值 */
export function PosterModal({
  target,
  onSwitch,
  onRegenerate,
}: {
  target: PosterTarget;
  onSwitch: (next: PosterTarget) => void;
  onRegenerate: () => void;
}) {
  const url = useStore((s) => s.posterUrl);
  const blob = useStore((s) => s.posterBlob);
  const pages = useStore((s) => s.posterPages);
  const loading = useStore((s) => s.posterLoading);
  const setModal = useStore((s) => s.setModal);
  const showToast = useStore((s) => s.showToast);
  const date = useStore((s) => s.draft.date);
  // v2.5.8：这里原来直接写 `s.draft.comment ?? s.settings.defaultComment`。
  // `defaultComment` 在 Settings 里是**可选**字段（老数据 / 手改过的备份 / 迁移中间态都可能缺），
  // 两个都为 undefined 时 `comment` 就是 undefined，下面 `comment.length` 直接把整个应用打崩成白屏。
  // 弹窗组件不该因为一个可选字段缺失就崩，兜底成空串。
  const comment = useStore((s) => s.draft.comment ?? s.settings.defaultComment) ?? '';
  const setComment = useStore((s) => s.setComment);
  const setSheetComment = useStore((s) => s.setSheetComment);
  const sheets = useStore(selectSheetsOfDay);
  // v2.5.10 FR-66.2：汇总图里每张表各写各的评价语，不再只有整图一条
  const summary = useStore(selectSummary);
  const week = useStore(selectWeek);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const sections = target.mode === 'daily' ? summary.sections
    : target.mode === 'week' ? (week.pages[0] ?? []).flatMap((p) => p.sheets)
      : [];

  const close = () => setModal(null);
  const weekStart = target.mode === 'week' ? target.weekStart : null;
  const fileBase = weekStart
    ? `学情周汇总-${weekStart}_${addDaysISO(weekStart, 6)}`
    : target.mode === 'daily' ? `当日汇总-${date}` : `学情海报-${date}`;

  const downloadAll = () => {
    if (!pages.length) return;
    pages.forEach((p, i) => {
      downloadBlob(p.blob, pages.length > 1 ? `${fileBase}-${i + 1}.png` : `${fileBase}.png`);
    });
  };

  const handleCopy = async () => {
    if (!blob) return;
    const ok = await copyPngBlob(blob);
    if (ok) {
      showToast('已复制图片，去微信群粘贴吧 ✓', 'ok');
      return;
    }
    downloadBlob(blob, `${fileBase}.png`);
    showToast('当前浏览器不支持复制图片，已下载 PNG，可手动粘贴', 'warn');
  };

  /** FR-51.3：手机端优先系统分享，不支持则回退下载 */
  const handleShare = async () => {
    if (!blob) return;
    const outcome = await shareImageBlob(blob, `${fileBase}.png`, TITLES[target.mode]);
    if (outcome === 'shared') showToast('已调起系统分享 ✓', 'ok');
    else if (outcome === 'downloaded') showToast('当前环境不支持系统分享，已下载 PNG', 'warn');
    // cancelled：用户自己关的分享面板，不打扰
  };

  return (
    <Modal
      title={TITLES[target.mode]}
      size="poster"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>关闭</Pill>
          <Pill
            variant={target.mode === 'single' ? 'ghost' : 'ghost'}
            onClick={() => onSwitch({ mode: 'single', key: useStore.getState().draft.key })}
            disabled={target.mode === 'single'}
          >
            单条
          </Pill>
          <Pill variant="ghost" onClick={() => onSwitch({ mode: 'daily' })} disabled={target.mode === 'daily'}>
            当日汇总
          </Pill>
          <Pill
            variant="ghost"
            onClick={() => onSwitch({ mode: 'week', weekStart: weekStart ?? date })}
            disabled={target.mode === 'week'}
          >
            本周汇总
          </Pill>
          <Pill variant="ghost" onClick={onRegenerate} disabled={loading}>
            {loading ? '生成中…' : '🔄 重新生成'}
          </Pill>
          <Pill variant="ghost" onClick={downloadAll} disabled={!pages.length}>
            ⬇️ 下载 PNG{pages.length > 1 ? `（${pages.length} 张）` : ''}
          </Pill>
          <Pill variant="poster" onClick={() => void handleShare()} disabled={!blob}>📤 分享图片</Pill>
          <Pill variant="poster" onClick={handleCopy} disabled={!blob}>📋 复制图片</Pill>
        </>
      }
    >
      {target.mode === 'single' ? (
        <div className="field" style={{ marginBottom: 10 }}>
          <label className="field-label" htmlFor="poster-sheet">选择登记表</label>
          <select
            id="poster-sheet"
            value={target.key}
            onChange={(e) => onSwitch({ mode: 'single', key: e.target.value })}
          >
            {sheets.map((s) => (
              <option key={s.key} value={s.key}>
                {SHEET_TEMPLATES[s.templateId as keyof typeof SHEET_TEMPLATES]?.name ?? s.templateId}
                {s.content ? ` · ${s.content}` : ''} · {s.entered} 人
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {target.mode === 'single' ? (
        <div className="field" style={{ marginBottom: 10 }}>
          <label className="field-label" htmlFor="poster-comment">
            评价语（显示在海报页脚）
          </label>
          <textarea
            id="poster-comment"
            rows={2}
            maxLength={COMMENT_MAX}
            value={comment}
            placeholder="例：本次听写整体不错，错得多的同学请把错字抄三遍。"
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onRegenerate()}
          />
          <div className="field-hint">{comment.length}/{COMMENT_MAX} 字 · 失焦后自动重新生成</div>
        </div>
      ) : sections.length ? (
        /* v2.5.10 FR-66.2：汇总图按作业内容逐表写评价语
           （原来整张图只能写一条，同一天多张表时不够用） */
        <div className="field" style={{ marginBottom: 10 }}>
          <span className="field-label">评价语（每张表各写各的，显示在该表页脚）</span>
          <div className="sheet-comments">
            {sections.map((sec) => (
              <div className="sheet-comment" key={sec.key} data-open={openComment === sec.key ? '1' : undefined}>
                <div className="sheet-comment-head">
                  <span className="sheet-comment-name">
                    {sec.icon} {sec.sheetName}{sec.content ? ` · ${sec.content}` : ''}
                  </span>
                  <button
                    type="button"
                    className="chip"
                    aria-expanded={openComment === sec.key}
                    onClick={() => setOpenComment(openComment === sec.key ? null : sec.key)}
                  >
                    {sec.comment ? '改评价语' : '写评价语'}
                  </button>
                </div>
                {openComment === sec.key ? (
                  <>
                    <textarea
                      rows={2}
                      maxLength={COMMENT_MAX}
                      value={sec.comment}
                      placeholder="例：这一遍默写整体不错，错字请抄三遍。"
                      onChange={(e) => setSheetComment(sec.key, e.target.value)}
                      onBlur={() => onRegenerate()}
                    />
                    <div className="field-hint">{sec.comment.length}/{COMMENT_MAX} 字 · 失焦后自动重新生成</div>
                  </>
                ) : sec.comment ? (
                  <div className="sheet-comment-text">{sec.comment}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {url ? (
        <img className="poster-preview" src={url} alt={ALTS[target.mode]} />
      ) : (
        <div className="chart-empty">{loading ? '生成中…' : '暂无图片'}</div>
      )}
    </Modal>
  );
}
