import { useState } from 'react';
import { useStore, currentClass } from '../../store';
import { selectNames } from '../../store/selectors';
import { buildDetailCsv, buildPointsCsv, buildSummaryCsv, recordsInRange, statsOfRecords, termRange } from '../../domain/exporter';
import { monthStats } from '../../domain/points';
import { zipStore, utf8 } from '../../infra/zip';
import { downloadBlob, downloadCsv, safeName } from '../../infra/download';
import { monthOf, todayISO } from '../../domain/date';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

export function ExportModal() {
  const s = useStore();
  const cls = currentClass()!;
  const names = useStore(selectNames);
  const [mode, setMode] = useState<'month' | 'term'>('month');
  const [month, setMonth] = useState(monthOf(todayISO()));
  const [year, setYear] = useState(new Date().getFullYear());
  const [term, setTerm] = useState<'first' | 'second'>(new Date().getMonth() + 1 >= 9 ? 'first' : 'second');

  const close = () => s.setModal(null);

  const range = mode === 'month'
    ? { from: `${month}-01`, to: `${month}-31`, label: month }
    : (() => {
      const r = termRange(year, term);
      return { from: r.from, to: r.to, label: r.label };
    })();

  const build = () => {
    const records = recordsInRange(s.history, cls.id, range.from, range.to);
    const agg = statsOfRecords(records);
    const st = monthStats({
      history: s.history,
      ledger: s.pointLedger,
      classId: cls.id,
      month: mode === 'month' ? month : range.from.slice(0, 7),
      n: cls.count,
      names,
    });
    const detail = buildDetailCsv({ className: cls.name, records, n: cls.count, names });
    const points = buildPointsCsv({ className: cls.name, month: range.label, stats: st, ledger: s.pointLedger, names });
    const summary = buildSummaryCsv({
      className: cls.name,
      rangeLabel: range.label,
      records,
      n: cls.count,
      totalPoints: st.total,
      qualifiedRate: agg.qualifiedRate,
      avgPercent: agg.avgPercent,
      maxPercent: agg.maxPercent,
      minPercent: agg.minPercent,
    });
    return { records, detail, points, summary };
  };

  const doExport = () => {
    const { records, detail, points, summary } = build();
    const blob = zipStore([
      { name: '登记明细.csv', data: utf8(detail) },
      { name: '月度积分.csv', data: utf8(points) },
      { name: '汇总.csv', data: utf8(summary) },
    ]);
    downloadBlob(blob, `${safeName(cls.name)}_${mode === 'month' ? month : range.label}.zip`);
    s.markExported();           // FR-51.2：导出即重置 7 天未导出提醒
    s.showToast(records.length ? `已导出 ${records.length} 条登记` : '该区间无数据（已导出表头）', records.length ? 'ok' : 'warn');
  };

  const single = (kind: 'detail' | 'points' | 'summary') => {
    const { detail, points, summary } = build();
    const map = { detail, points, summary } as const;
    const file = { detail: '登记明细.csv', points: '月度积分.csv', summary: '汇总.csv' } as const;
    downloadCsv(map[kind], `${safeName(cls.name)}_${file[kind]}`);
    s.markExported();
    // U-06：这两个按钮原本点完毫无反馈，老师不知道到底导没导成
    const rows = map[kind].split('\n').filter((x) => x.trim()).length - 1;
    s.showToast(
      rows > 0 ? `已导出${file[kind]}（${rows} 行）` : `${file[kind]}没有数据（已导出表头）`,
      rows > 0 ? 'ok' : 'warn',
    );
  };

  return (
    <Modal
      title="导出"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={close}>取消</Pill>
          <Pill variant="ghost" onClick={() => single('detail')}>仅登记明细</Pill>
          <Pill variant="ghost" onClick={() => single('points')}>仅积分</Pill>
          <Pill variant="save" onClick={doExport}>📤 导出 ZIP</Pill>
        </>
      }
    >
      <div className="tabs">
        <button type="button" className="tab" data-on={mode === 'month' ? '1' : '0'} onClick={() => setMode('month')}>月度</button>
        <button type="button" className="tab" data-on={mode === 'term' ? '1' : '0'} onClick={() => setMode('term')}>学期</button>
      </div>

      {mode === 'month' ? (
        <div className="field" style={{ marginTop: 12 }}>
          <label className="field-label" htmlFor="export-month">月份</label>
          <input id="export-month" type="month" aria-label="月份" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      ) : (
        <div className="field-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label className="field-label" htmlFor="export-year">学年</label>
            <input id="export-year" type="number" value={year} aria-label="学年" onChange={(e) => setYear(Number(e.target.value) || year)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="export-term">学期</label>
            <select id="export-term" aria-label="学期" value={term} onChange={(e) => setTerm(e.target.value as 'first' | 'second')}>
              <option value="first">上学期（09-01 ~ 次年 01-31）</option>
              <option value="second">下学期（02-01 ~ 07-31）</option>
            </select>
          </div>
        </div>
      )}

      <div className="field-hint" style={{ marginTop: 10 }}>
        区间：{range.from} ~ {range.to} · 班级：{cls.name} · 含 3 个 CSV（UTF-8 BOM，Excel 双击不乱码）
      </div>
    </Modal>
  );
}
