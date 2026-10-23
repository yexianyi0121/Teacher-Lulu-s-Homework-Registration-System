import { useMemo, useState } from 'react';
import { useStore, currentClass } from '../../store';
import { selectNames } from '../../store/selectors';
import { monthStats, pointsOf } from '../../domain/points';
import { monthOf, todayISO } from '../../domain/date';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

type Tab = 'ledger' | 'month' | 'rules';

export function PointsModal() {
  const s = useStore();
  const cls = currentClass()!;
  const names = useStore(selectNames);
  const [tab, setTab] = useState<Tab>('month');
  const [month, setMonth] = useState(monthOf(todayISO()));
  const [open, setOpen] = useState<number | null>(null);

  const stats = useMemo(
    () => monthStats({
      history: s.history,
      ledger: s.pointLedger,
      classId: cls.id,
      month,
      n: cls.count,
      names,
    }),
    [s.history, s.pointLedger, cls.id, cls.count, month, names],
  );

  const close = () => s.setModal(null);

  const months = useMemo(() => {
    const set = new Set<string>([month, monthOf(todayISO())]);
    for (const h of s.history) if (h.classId === cls.id) set.add(monthOf(h.date));
    for (const l of s.pointLedger) if (l.classId === cls.id) set.add(monthOf(l.date));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [s.history, s.pointLedger, cls.id, month]);

  return (
    <Modal
      title="积分"
      size="xl"
      onClose={close}
      footer={<Pill variant="save" onClick={close}>完成</Pill>}
    >
      <div className="tabs" role="tablist">
        {([['month', '月度统计'], ['ledger', '账本'], ['rules', '规则']] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className="tab"
            data-on={tab === k ? '1' : '0'}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'month' ? (
        <>
          <div className="settings-actions" style={{ margin: '10px 0' }}>
            <select aria-label="选择月份" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="field-hint">
              总积分 {stats.total} · 人均 {stats.avg} · 最高 {stats.top} ·
              达标率 {(stats.qualifiedRate * 100).toFixed(1)}%
            </span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>学号</th><th>姓名</th><th>登记</th><th>达标</th><th>缺交</th>
                <th>请假</th><th>补交</th><th>本月积分</th><th>名次</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.filter((r) => r.sessions > 0 || r.points !== 0).map((r) => (
                <>
                  <tr key={r.no} onClick={() => setOpen(open === r.no ? null : r.no)} style={{ cursor: 'pointer' }}>
                    <td>{r.no}</td>
                    <td>{r.name ?? ''}</td>
                    <td>{r.sessions}</td>
                    <td>{r.qualified}</td>
                    <td>{r.missing}</td>
                    <td>{r.leave}</td>
                    <td>{r.madeUp}</td>
                    <td><strong>{r.points > 0 ? `+${r.points}` : r.points}</strong></td>
                    <td>{r.rank}</td>
                  </tr>
                  {open === r.no ? (
                    <tr key={`${r.no}-detail`}>
                      <td colSpan={9}>
                        <ul className="history-list">
                          {s.pointLedger
                            .filter((x) => x.classId === cls.id && x.studentNo === r.no && x.date.startsWith(month))
                            .map((x) => (
                              <li key={x.id}>
                                <span>{x.date} · {x.reason} · {x.delta > 0 ? `+${x.delta}` : x.delta}</span>
                                {x.source === 'revert' ? <span className="field-hint">（撤销记录）</span> : (
                                  <button type="button" className="btn-sm" onClick={(e) => {
                                    e.stopPropagation();
                                    s.revokePoint(x.id);
                                  }}>撤销</button>
                                )}
                              </li>
                            ))}
                          {pointsOf(s.pointLedger, cls.id, r.no, month) === 0 && s.pointLedger.length === 0 ? (
                            <li className="field-hint">本月暂无积分记录</li>
                          ) : null}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </>
              ))}
              {stats.rows.every((r) => r.sessions === 0 && r.points === 0) ? (
                <tr><td colSpan={9} className="field-hint">本月还没有登记</td></tr>
              ) : null}
            </tbody>
          </table>
        </>
      ) : null}

      {tab === 'ledger' ? (
        <ul className="history-list">
          {s.pointLedger.length === 0 ? <li className="field-hint">账本为空</li> : null}
          {[...s.pointLedger].reverse().slice(0, 100).map((x) => (
            <li key={x.id}>
              <span>
                {x.date} · {x.studentNo}号{names[x.studentNo] ? ` ${names[x.studentNo]}` : ''} ·
                {' '}{x.reason} · {x.delta > 0 ? `+${x.delta}` : x.delta}
                {x.source === 'revert' ? '（撤销）' : x.source === 'manual' ? '（手动）' : ''}
              </span>
              {x.source === 'revert' ? null : (
                <button type="button" className="btn-sm" onClick={() => s.revokePoint(x.id)}>撤销</button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'rules' ? (
        <table className="data-table">
          <thead>
            <tr><th>规则</th><th>分值</th><th>频率</th><th>启用</th></tr>
          </thead>
          <tbody>
            {s.pointRules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}{r.builtin ? '' : '（自定义）'}</td>
                <td>
                  <input
                    type="number"
                    min={-10}
                    max={10}
                    value={r.delta}
                    aria-label={`${r.name} 分值`}
                    style={{ width: 70 }}
                    onChange={(e) => {
                      const v = Math.max(-10, Math.min(10, Number(e.target.value) || 0));
                      s.setRules(s.pointRules.map((x) => (x.id === r.id ? { ...x, delta: v } : x)));
                    }}
                  />
                </td>
                <td>{r.freq}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    aria-label={`启用 ${r.name}`}
                    onChange={(e) => s.setRules(s.pointRules.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Modal>
  );
}
