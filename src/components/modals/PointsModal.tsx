import { useMemo, useState } from 'react';
import { useStore, currentClass } from '../../store';
import { selectNames } from '../../store/selectors';
import { monthStats, pointsOf, validateRule } from '../../domain/points';
import { monthOf, todayISO } from '../../domain/date';
import { SHEET_TEMPLATES } from '../../domain/constants';
import type { PointRule, RuleCondition, SheetTemplateId } from '../../domain/types';
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
  const [editing, setEditing] = useState<PointRule | null>(null);
  const [ruleError, setRuleError] = useState('');

  const stats = useMemo(
    () => monthStats({
      history: s.history,
      ledger: s.pointLedger,
      classId: cls.id,
      month,
      n: cls.count,
      names,
      passRule: s.settings.passRule,
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
        <>
          <div className="settings-actions" style={{ margin: '10px 0' }}>
            <Pill
              variant="ghost"
              onClick={() => {
                setRuleError('');
                setEditing({
                  id: `rule_custom_${Date.now()}`,
                  name: '',
                  source: 'auto',
                  condition: { kind: 'tierAtLeast', tier: 'pass' },
                  delta: 1,
                  freq: 'perEntry',
                  enabled: true,
                  builtin: false,
                });
              }}
            >
              ＋ 新建规则
            </Pill>
            <span className="field-hint">内置 8 条不可删除，只能停用或改分；自定义规则可删除（删除会写冲正记录）。</span>
          </div>

          {editing ? (
            <div className="rule-editor" data-testid="rule-editor">
              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="rule-name">名称（≤16 字）</label>
                  <input
                    id="rule-name"
                    maxLength={16}
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="如：积极回答"
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="rule-delta">分值（−10 ~ +10）</label>
                  <input
                    id="rule-delta"
                    type="number"
                    min={-10}
                    max={10}
                    value={editing.delta}
                    onChange={(e) => setEditing({ ...editing, delta: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="rule-condition">条件</label>
                  <select
                    id="rule-condition"
                    value={conditionValue(editing.condition)}
                    onChange={(e) => setEditing({ ...editing, condition: conditionFrom(e.target.value) })}
                  >
                    <option value="pass">过关</option>
                    <option value="excellent">本次优秀</option>
                    <option value="needsfix">需更正</option>
                    <option value="makeup">补交</option>
                    <option value="missing">缺交</option>
                    <option value="leave">请假</option>
                    <option value="streak">连续 N 次达标</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="rule-freq">频率</label>
                  <select
                    id="rule-freq"
                    value={editing.freq}
                    onChange={(e) => setEditing({ ...editing, freq: e.target.value as PointRule['freq'] })}
                  >
                    <option value="perEntry">每次</option>
                    <option value="perDay">每天</option>
                    <option value="perWeek">每周</option>
                    <option value="once">仅一次</option>
                  </select>
                </div>
              </div>

              {editing.condition.kind === 'streak' ? (
                <div className="field-row">
                  <div className="field">
                    <label className="field-label" htmlFor="rule-times">连续次数（2–10）</label>
                    <input
                      id="rule-times"
                      type="number"
                      min={2}
                      max={10}
                      value={editing.condition.times}
                      onChange={(e) => setEditing({
                        ...editing,
                        condition: { kind: 'streak', times: Math.max(2, Math.min(10, Number(e.target.value) || 2)), templateId: editing.condition.kind === 'streak' ? editing.condition.templateId : 'homework' },
                      })}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="rule-template">登记类型</label>
                    <select
                      id="rule-template"
                      value={editing.condition.kind === 'streak' ? editing.condition.templateId : 'homework'}
                      onChange={(e) => setEditing({
                        ...editing,
                        condition: { kind: 'streak', times: editing.condition.kind === 'streak' ? editing.condition.times : 3, templateId: e.target.value as SheetTemplateId },
                      })}
                    >
                      {Object.values(SHEET_TEMPLATES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : null}

              {ruleError ? <div className="field-error">{ruleError}</div> : null}

              <div className="settings-actions">
                <Pill variant="ghost" onClick={() => setEditing(null)}>取消</Pill>
                <Pill
                  variant="ghost"
                  onClick={() => {
                    const n = s.history.filter((h) => h.classId === cls.id).length;
                    s.showToast(`规则只影响之后的新登记；已有 ${n} 条历史不会重算`, 'ok');
                  }}
                >
                  预览影响
                </Pill>
                <Pill
                  variant="save"
                  onClick={() => {
                    const err = validateRule(editing, s.pointRules);
                    if (err) {
                      setRuleError(err);
                      return;
                    }
                    const exists = s.pointRules.some((r) => r.id === editing.id);
                    s.setRules(exists
                      ? s.pointRules.map((r) => (r.id === editing.id ? editing : r))
                      : [...s.pointRules, editing]);
                    setEditing(null);
                    s.showToast(exists ? '规则已更新' : '规则已创建', 'ok');
                  }}
                >
                  保存规则
                </Pill>
              </div>
            </div>
          ) : null}

          <table className="data-table">
            <thead>
              <tr><th>规则</th><th>分值</th><th>频率</th><th>启用</th><th>操作</th></tr>
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
                  <td>
                    {r.builtin ? <span className="field-hint">内置</span> : (
                      <button
                        type="button"
                        className="btn-sm"
                        data-danger="1"
                        aria-label={`删除规则 ${r.name}`}
                        onClick={() => s.openConfirm({
                          title: '删除自定义规则',
                          message: `删除「${r.name}」？已产生的账本不删除，会追加一条冲正记录。`,
                          confirmText: '删除',
                          danger: true,
                          onConfirm: () => s.removeRule(r.id),
                        })}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </Modal>
  );
}

function conditionValue(c: RuleCondition): string {
  switch (c.kind) {
    case 'tierAtLeast': return c.tier === 'excellent' ? 'excellent' : c.tier === 'pass' ? 'pass' : 'needsfix';
    case 'status': return c.status === 'leave' ? 'leave' : 'missing';
    case 'makeup': return 'makeup';
    case 'streak': return 'streak';
    case 'weeklyDone': return 'streak';
    case 'manual': return 'pass';
  }
}

function conditionFrom(v: string): RuleCondition {
  switch (v) {
    case 'excellent': return { kind: 'tierAtLeast', tier: 'excellent' };
    case 'needsfix': return { kind: 'tierAtLeast', tier: 'fail' };
    case 'makeup': return { kind: 'makeup' };
    case 'missing': return { kind: 'status', status: 'missing' };
    case 'leave': return { kind: 'status', status: 'leave' };
    case 'streak': return { kind: 'streak', times: 3, templateId: 'homework' };
    default: return { kind: 'tierAtLeast', tier: 'pass' };
  }
}
