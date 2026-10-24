import { useEffect, useRef, useState } from 'react';
import { useStore, currentClass } from '../../store';
import { selectNames } from '../../store/selectors';
import { COMMENT_MAX, EMOJI_CHOICES, GRADE_ORDER, SUBJECTS, DEFAULT_GRADE_EMOJI } from '../../domain/constants';
import { THEMES } from '../../domain/theme';
import { formatDateCN, monthOf, stampForFile } from '../../domain/date';
import type { GradeLetter, PassRuleKind } from '../../domain/types';
import { downloadBlob, downloadText } from '../../infra/download';
import { getSnapshots, getVoiceLogs } from '../../infra/idb';
import { exportAllBlob, importAll, markBackupDone } from '../../infra/backup';
import { readHealth, type StorageHealth } from '../../infra/storageHealth';
import { Modal } from '../ui/Modal';
import { Pill, Toggle } from '../ui/controls';

const PASS_KIND: Array<[PassRuleKind, string]> = [
  ['percent', '按及格线（百分）'],
  ['grade', '按等级白名单'],
  ['mixed', '百分或等级（默认）'],
];

export function SettingsModal() {
  const s = useStore();
  const cls = currentClass()!;
  const names = useStore(selectNames);
  const setModal = useStore((m) => m.setModal);

  const [countText, setCountText] = useState(String(cls.count));
  const [newClass, setNewClass] = useState('');
  const [countError, setCountError] = useState('');
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCountText(String(cls.count)), [cls.count]);

  useEffect(() => {
    void getSnapshots().then((snaps) => setHealth(readHealth(useStore.getState().exportState(), snaps.length)));
  }, []);

  const close = () => setModal(null);

  const commitCount = () => {
    const n = Number(countText);
    if (!Number.isInteger(n) || n < 1 || n > 120) {
      setCountError('请输入 1–120 的整数');
      return;
    }
    setCountError('');
    s.setCount(n);
  };

  const setPassRule = (patch: Partial<typeof s.settings.passRule>) => {
    s.updateSettings({ passRule: { ...s.settings.passRule, ...patch } });
  };

  const toggleGradePass = (g: GradeLetter) => {
    const has = s.settings.passRule.gradePass.includes(g);
    const next = has
      ? s.settings.passRule.gradePass.filter((x) => x !== g)
      : [...s.settings.passRule.gradePass, g].sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));
    setPassRule({ gradePass: next });
  };

  const historyByMonth = new Map<string, typeof s.history>();
  for (const h of s.history) {
    const k = monthOf(h.date);
    const arr = historyByMonth.get(k) ?? [];
    arr.push(h);
    historyByMonth.set(k, arr);
  }

  return (
    <Modal
      title="设置"
      size="lg"
      onClose={close}
      footer={<Pill variant="save" onClick={close}>完成</Pill>}
    >
      <section className="settings-section">
        <div className="settings-title">班级信息</div>
        <div className="field">
          <label className="field-label" htmlFor="set-class">班级名</label>
          <input id="set-class" type="text" maxLength={20} value={cls.name}
            onChange={(e) => s.updateClassInfo({ name: e.target.value.slice(0, 20) })} />
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="set-school">学校名</label>
            <input id="set-school" type="text" maxLength={20} value={cls.school}
              placeholder="用于海报署名" onChange={(e) => s.updateClassInfo({ school: e.target.value.slice(0, 20) })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="set-teacher">老师姓名</label>
            <input id="set-teacher" type="text" maxLength={20} value={cls.teacher}
              placeholder="用于海报署名" onChange={(e) => s.updateClassInfo({ teacher: e.target.value.slice(0, 20) })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="set-subject">学科</label>
            <select id="set-subject" value={cls.subject} onChange={(e) => s.updateClassInfo({ subject: e.target.value })}>
              {SUBJECTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="set-count">学生人数（1–120）</label>
            <input
              id="set-count"
              type="number"
              min={1}
              max={120}
              value={countText}
              aria-label="学生人数（1–120）"
              onChange={(e) => setCountText(e.target.value)}
              onBlur={commitCount}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCount(); }}
            />
            {countError ? <div className="field-error">{countError}</div> : null}
            <div className="field-hint">调小只会隐藏多出的学号，数据不删（INV-8）。</div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">班级管理</div>
        <ul className="history-list">
          {s.classes.map((c) => (
            <li key={c.id}>
              <span>{c.name} · {c.count}人 {c.id === s.activeClassId ? '（当前）' : ''}</span>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <button type="button" className="btn-sm" onClick={() => s.switchClass(c.id)}>切换</button>
                <button
                  type="button"
                  className="btn-sm"
                  onClick={() => {
                    const name = window.prompt('重命名班级', c.name);
                    if (name) s.renameClass(c.id, name);
                  }}
                >
                  重命名
                </button>
                <button
                  type="button"
                  className="btn-sm"
                  data-danger="1"
                  onClick={() =>
                    s.openConfirm({
                      title: '删除班级',
                      message: `删除「${c.name}」后，该班 ${s.history.filter((h) => h.classId === c.id).length} 条历史与积分不再展示（数据保留，可通过导出取回）。确定？`,
                      confirmText: '删除',
                      danger: true,
                      onConfirm: () => s.deleteClass(c.id),
                    })
                  }
                >
                  删除
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="settings-actions" style={{ marginTop: 8 }}>
          <input
            type="text"
            placeholder="新班级名，如：一年一班"
            value={newClass}
            maxLength={20}
            aria-label="新班级名"
            onChange={(e) => setNewClass(e.target.value)}
          />
          <Pill
            variant="ghost"
            onClick={() => {
              s.addClass(newClass);
              setNewClass('');
            }}
          >
            ＋ 新建班级
          </Pill>
        </div>
      </section>

      <section className="settings-section" data-section="pass-rule">
        <div className="settings-title">过关规则</div>
        <div className="field">
          <label className="field-label" htmlFor="pass-kind">判定方式</label>
          <select
            id="pass-kind"
            value={s.settings.passRule.kind}
            onChange={(e) => setPassRule({ kind: e.target.value as PassRuleKind })}
          >
            {PASS_KIND.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        {s.settings.passRule.kind !== 'percent' ? (
          <div className="field">
            <span className="field-label">哪些等级算过关（分数仍按及格线）</span>
            <div className="grade-chips">
              {GRADE_ORDER.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="chip"
                  data-on={s.settings.passRule.gradePass.includes(g) ? '1' : '0'}
                  aria-pressed={s.settings.passRule.gradePass.includes(g)}
                  aria-label={`等级 ${g} 算过关`}
                  onClick={() => toggleGradePass(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="switch-row">
          <span>听写「全对/错0」自动算过关</span>
          <Toggle
            checked={s.settings.passRule.dictationAutoPass}
            onChange={(v) => setPassRule({ dictationAutoPass: v })}
            label="听写全对自动过关"
          />
        </div>
        <div className="field-hint">改规则只重算 ✅ / 名单 / 达标率，不改任何已录入的值。</div>
      </section>

      <section className="settings-section" data-section="display">
        <div className="settings-title">显示</div>
        <div className="switch-row">
          <span>秒跳（提交后自动跳下一格）</span>
          <Toggle checked={s.settings.secondsJump} onChange={(v) => s.updateSettings({ secondsJump: v })} label="秒跳" />
        </div>
        <div className="switch-row">
          <span>网格显示姓名</span>
          <Toggle checked={s.settings.showName} onChange={(v) => s.updateSettings({ showName: v })} label="显示姓名" />
        </div>
        <div className="switch-row">
          <span>光荣榜含 A-（等级制）</span>
          <Toggle checked={s.settings.honorIncludesA} onChange={(v) => s.updateSettings({ honorIncludesA: v })} label="光荣榜含 A-" />
        </div>
        <div className="switch-row">
          <span>启用语音识别</span>
          <Toggle checked={s.settings.voiceEnabled} onChange={(v) => s.updateSettings({ voiceEnabled: v })} label="启用语音" />
        </div>
        <div className="switch-row">
          <span>等级旁显示表情</span>
          <Toggle checked={s.settings.showEmoji} onChange={(v) => s.updateSettings({ showEmoji: v })} label="显示表情" />
        </div>
        {s.settings.showEmoji ? (
          <div className="emoji-grid">
            {GRADE_ORDER.map((g) => (
              <label key={g} className="emoji-item">
                <span className="emoji-grade">{g}</span>
                <select
                  aria-label={`${g} 的表情`}
                  value={s.settings.gradeEmoji[g]}
                  onChange={(e) => s.updateSettings({
                    gradeEmoji: { ...s.settings.gradeEmoji, [g]: e.target.value },
                  })}
                >
                  {EMOJI_CHOICES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
            ))}
            <Pill variant="ghost" onClick={() => s.updateSettings({ gradeEmoji: { ...DEFAULT_GRADE_EMOJI } })}>
              恢复默认表情
            </Pill>
          </div>
        ) : null}
      </section>

      <section className="settings-section" data-section="appearance">
        <div className="settings-title">外观（背景主题）</div>
        <div className="theme-grid" role="radiogroup" aria-label="背景主题">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={s.settings.theme === t.key}
              className="theme-card"
              data-theme-key={t.key}
              data-on={s.settings.theme === t.key ? '1' : undefined}
              onClick={() => s.updateSettings({ theme: t.key })}
            >
              <span className="theme-swatch" style={{ background: t.bg, borderColor: t.brand }} aria-hidden="true" />
              <span className="theme-name">{t.name}</span>
            </button>
          ))}
        </div>
        <div className="field-hint">
          切换立即生效，只换页面背景与主色；卡片与网格保持白底，发群的海报也不受影响（默认）。
        </div>
        <div className="switch-row">
          <span>海报也套用背景</span>
          <Toggle
            checked={s.settings.posterFollowTheme}
            onChange={(v) => s.updateSettings({ posterFollowTheme: v })}
            label="海报跟随主题"
          />
        </div>
        <div className="field-hint">
          默认关闭：海报保持白底 + 品牌粉，发家长群视觉稳定。打开后海报会跟随上面的主题。
        </div>
      </section>

      <section className="settings-section" data-section="poster">
        <div className="settings-title">海报</div>
        <div className="field">
          <label className="field-label" htmlFor="set-comment">默认评价语（≤60 字）</label>
          <textarea
            id="set-comment"
            rows={2}
            maxLength={COMMENT_MAX}
            value={s.settings.defaultComment}
            placeholder="新登记表默认带上的点评语，可逐表修改"
            onChange={(e) => s.updateSettings({ defaultComment: e.target.value.slice(0, COMMENT_MAX) })}
          />
        </div>
        <div className="switch-row">
          <span>海报页脚显示学校名</span>
          <Toggle
            checked={s.settings.showSchoolInPoster}
            onChange={(v) => s.updateSettings({ showSchoolInPoster: v })}
            label="显示学校名"
          />
        </div>
      </section>

      <section className="settings-section" data-section="data">
        <div className="settings-title">数据健康</div>
        {health ? (
          <ul className="health-list" data-testid="storage-health">
            <li>打开方式：{health.mode === 'file' ? '双击文件（file://）' : `网址（${health.origin}）`}</li>
            <li>存储键：{health.key}</li>
            <li>已用：{(health.bytes / 1024).toFixed(1)} KB</li>
            <li>最后保存：{health.lastSavedAt ? new Date(health.lastSavedAt).toLocaleString() : '尚未保存'}</li>
            <li>自动快照：{health.snapshotCount} 份</li>
            <li>记录 {health.records} 条 · 历史 {health.history} 条 · 班级 {health.classes} 个</li>
          </ul>
        ) : (
          <div className="field-hint">正在读取存储状态…</div>
        )}

        <div className="settings-actions">
          <Pill variant="ghost" onClick={() => {
            downloadBlob(exportAllBlob(s.exportState()), `学情备份-${stampForFile()}.json`);
            markBackupDone();
            s.markExported();      // FR-51.2：导出即重置 7 天未导出提醒
            s.showToast('已导出完整备份（含班级、登记、积分、设置）', 'ok');
          }}>
            📦 导出全部数据
          </Pill>
          <Pill variant="ghost" onClick={() => fileRef.current?.click()}>📥 导入恢复</Pill>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="选择备份文件"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              e.target.value = '';
              const parsed = importAll(text);
              if (!parsed.ok) {
                s.showToast(`导入失败：${parsed.reason}`, 'error');
                return;
              }
              const recs = parsed.state.records.length;
              const hist = parsed.state.history.length;
              s.openConfirm({
                title: '导入恢复',
                message: `备份含 ${recs} 条记录、${hist} 条历史。导入会覆盖当前数据（导入前会自动留一份，可在设置里回退）。确定继续？`,
                confirmText: '覆盖导入',
                danger: true,
                onConfirm: () => {
                  try {
                    localStorage.setItem(`xq.preimport.${Date.now()}`, JSON.stringify(s.exportState()));
                  } catch {
                    // 空间不足时仍允许导入：至少还有导出的文件
                  }
                  s.replaceState(parsed.state);
                  s.showToast('已恢复数据（导入前的数据已留底）', 'ok');
                },
              });
            }}
          />
          <Pill variant="ghost" onClick={async () => {
            const text = JSON.stringify(health ?? {}, null, 2);
            try {
              await navigator.clipboard.writeText(text);
              s.showToast('诊断信息已复制', 'ok');
            } catch {
              s.showToast('当前浏览器不允许复制，请截图健康面板', 'warn');
            }
          }}>
            📋 复制诊断信息
          </Pill>
          <Pill variant="ghost" onClick={() => {
            const key = Object.keys(localStorage).filter((k) => k.startsWith('xq.preimport.')).sort().pop();
            if (!key) {
              s.showToast('没有可回退的导入记录', 'warn');
              return;
            }
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const parsed = importAll(raw);
            if (!parsed.ok) {
              s.showToast('回退数据已损坏', 'error');
              return;
            }
            s.replaceState(parsed.state);
            s.showToast('已回退到导入前的数据', 'ok');
          }}>
            ↩️ 回退到导入前
          </Pill>
          <Pill variant="ghost" onClick={async () => {
            const logs = await getVoiceLogs();
            if (!logs.length) {
              s.showToast('暂无语音纠错日志', 'warn');
              return;
            }
            const rows = [['时间', '原始', '解析结果', '已接受', '问题'], ...logs.map((l) => [
              new Date(l.at).toLocaleString(), l.raw, l.parsedJson, l.accepted ? '是' : '否', l.correctedTo,
            ])];
            const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
            downloadText(csv, `语音纠错日志-${stampForFile()}.csv`, 'text/csv;charset=utf-8');
          }}>
            🎤 导出语音日志
          </Pill>
          <Pill variant="ghost" onClick={() => s.openConfirm({
            title: '清空全部数据',
            message: '将删除全部登记、历史与积分，且不可撤销。建议先导出备份。',
            requireText: '清空',
            confirmText: '清空全部数据',
            danger: true,
            onConfirm: () => s.resetAll(),
          })}>
            🗑️ 清空全部数据
          </Pill>
        </div>

        <div className="field" style={{ marginTop: 8 }}>
          <label className="field-label" htmlFor="backup-days">备份提醒</label>
          <select
            id="backup-days"
            value={String(s.settings.autoBackupDays)}
            onChange={(e) => s.updateSettings({ autoBackupDays: Number(e.target.value) })}
          >
            <option value="0">关闭</option>
            <option value="7">每 7 天提醒一次</option>
            <option value="30">每 30 天提醒一次</option>
          </select>
          <div className="field-hint">只提醒，不会自动下载文件。</div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">
          历史记录（{s.history.length} 条，最多保留 200 条）
        </div>
        {s.history.length === 0 ? (
          <div className="field-hint">暂无历史记录</div>
        ) : (
          <>
            <ul className="history-list">
              {s.history.slice(0, 30).map((h) => (
                <li key={h.key}>
                  <span>
                    {formatDateCN(h.date)} · {h.content || '未填写'} · 录入 {h.metrics.entered} 人
                    {h.metrics.avgScore === null ? '' : ` · 平均 ${h.metrics.avgScore}`}
                    {h.metricsVersion === 1 ? ' · 旧版数据' : ''}
                  </span>
                  <button
                    type="button"
                    className="btn-sm"
                    data-danger="1"
                    aria-label={`删除 ${formatDateCN(h.date)} 的记录`}
                    onClick={() => s.openConfirm({
                      title: '删除历史记录',
                      message: `确定删除「${formatDateCN(h.date)} · ${h.content || '未填写'}」这条历史记录？`,
                      danger: true,
                      onConfirm: () => s.deleteHistory(h.key),
                    })}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
            <div className="settings-actions" style={{ marginTop: 8 }}>
              <Pill variant="ghost" onClick={() => s.openConfirm({
                title: '清空历史记录',
                message: '将删除全部历史记录（不影响当前录入），确定继续？',
                danger: true,
                onConfirm: s.clearHistory,
              })}>
                清空历史记录
              </Pill>
            </div>
          </>
        )}
      </section>

      <div className="field-hint">
        当前班级学生：{cls.students.length === cls.count ? `${cls.count} 人` : '数据不一致，请检查'} ·
        姓名示例：{names[1] ?? '（未填写）'}
      </div>
    </Modal>
  );
}
