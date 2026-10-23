import { useEffect, useRef, useState } from 'react';
import { useStore, currentClass } from '../../store';
import { selectNames } from '../../store/selectors';
import { SUBJECTS } from '../../domain/constants';
import { formatDateCN, monthOf, stampForFile } from '../../domain/date';
import { downloadText } from '../../infra/download';
import { getVoiceLogs } from '../../infra/idb';
import { parseState } from '../../infra/storage';
import { Modal } from '../ui/Modal';
import { Pill, Toggle } from '../ui/controls';

export function SettingsModal() {
  const s = useStore();
  const cls = currentClass()!;
  const names = useStore(selectNames);
  const setModal = useStore((m) => m.setModal);

  const [countText, setCountText] = useState(String(cls.count));
  const [newClass, setNewClass] = useState('');
  const [countError, setCountError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCountText(String(cls.count)), [cls.count]);

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

      <section className="settings-section">
        <div className="settings-title">录入偏好</div>
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
      </section>

      <section className="settings-section">
        <div className="settings-title">数据</div>
        <div className="settings-actions">
          <Pill variant="ghost" onClick={() => {
            downloadText(JSON.stringify(s.exportState(), null, 2), `学情登记-${stampForFile()}.json`, 'application/json');
            s.showToast('已导出备份', 'ok');
          }}>
            📦 导出备份
          </Pill>
          <Pill variant="ghost" onClick={() => fileRef.current?.click()}>📥 导入备份</Pill>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              const parsed = parseState(text);
              e.target.value = '';
              if (!parsed.state) {
                s.showToast('备份文件解析失败，请检查文件', 'error');
                return;
              }
              s.openConfirm({
                title: '导入备份',
                message: '导入将覆盖当前全部数据（含班级、登记、积分与设置），确定继续？',
                confirmText: '覆盖导入',
                danger: true,
                onConfirm: () => {
                  s.replaceState(parsed.state!);
                  s.showToast('已导入备份', 'ok');
                },
              });
            }}
          />
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
