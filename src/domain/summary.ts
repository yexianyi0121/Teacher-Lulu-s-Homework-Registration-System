import type { Entries, PersistedStateV4, ScoringScheme, SessionMetrics, SheetTemplateId } from './types';
import { SHEET_TEMPLATES } from './constants';
import { computeStats } from './stats';

/**
 * 当日汇总快照（设计 04 §6.6.1）—— 纯函数。
 * 数据源 = records ∪ history 中该班该日的全部登记，**records 优先**（§16-10：
 * 老师可能先【更新修改】固化再截图，只看 records 会漏）。
 */
export interface DaySheetSnapshot {
  key: string;
  sheetId: string;
  templateId: SheetTemplateId;
  sheetName: string;
  icon: string;
  content: string;
  scheme: ScoringScheme;
  entries: Entries;
  metrics: SessionMetrics;
  createdAt: number;
}

export function snapshotDay(
  state: PersistedStateV4,
  classId: string,
  date: string,
): DaySheetSnapshot[] {
  const cls = state.classes.find((c) => c.id === classId);
  const n = cls?.count ?? 0;

  const byKey = new Map<string, PersistedStateV4['records'][number]>();
  for (const h of state.history) if (h.classId === classId && h.date === date) byKey.set(h.key, h);
  for (const r of state.records) if (r.classId === classId && r.date === date) byKey.set(r.key, r);

  return [...byKey.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({
      key: r.key,
      sheetId: r.sheetId,
      templateId: r.templateId,
      sheetName: SHEET_TEMPLATES[r.templateId].name,
      icon: SHEET_TEMPLATES[r.templateId].icon,
      content: r.content,
      scheme: r.scheme,
      entries: r.entries,
      metrics: computeStats(r.entries, r.scheme, n, state.settings.honorIncludesA),
      createdAt: r.createdAt,
    }));
}

/** 单条登记是否「有内容」（空表不进汇总图） */
export function hasContent(s: DaySheetSnapshot): boolean {
  return Object.values(s.entries).some(
    (e) => e.value !== null || e.status !== 'normal' || e.pass || e.stamp !== 'none' || e.makeup,
  );
}
