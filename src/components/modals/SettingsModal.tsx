import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { SUBJECTS } from '../../domain/constants';
import { formatDateCN, stampForFile } from '../../domain/date';
import { migrate } from '../../infra/persistence';
import { downloadText } from '../../infra/clipboard';
import { Modal } from '../ui/Modal';
import { Pill, Toggle } from '../ui/controls';

export function SettingsModal() {
  const classInfo = useStore((s) => s.classInfo);
  const settings = useStore((s) => s.settings);
  const updateClassInfo = useStore((s) => s.updateClassInfo);
  const updateSettings = useStore((s) => s.updateSettings);
  const setModal = useStore((s) => s.setModal);
  const openConfirm = useStore((s) => s.openConfirm);
  const exportState = useStore((s) => s.exportState);
  const replaceState = useStore((s) => s.replaceState);
  const resetAll = useStore((s) => s.resetAll);
  const history = useStore((s) => s.history);
  const deleteHistory = useStore((s) => s.deleteHistory);
  const clearHistory = useStore((s) => s.clearHistory);
  const showToast = useStore((s) => s.showToast);

  const [countText, setCountText] = useState(String(settings.count));
  const [countError, setCountError] = useState('');
  const [excellentText, setExcellentText] = useState(String(settings.excellentLine));
  const [passText, setPassText] = useState(String(settings.passLine));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCountText(String(settings.count)), [settings.count]);
  useEffect(() => setExcellentText(String(settings.excellentLine)), [settings.excellentLine]);
  useEffect(() => setPassText(String(settings.passLine)), [settings.passLine]);

  const close = () => setModal(null);

  const commitCount = () => {
    const n = Number(countText);
    if (!Number.isInteger(n) || n < 1 || n > 120) {
      setCountError('请输入 1–120 的整数');
      return;
    }
    setCountError('');
    updateSettings({ count: n });
  };

  const exportBackup = () => {
    const data = exportState();
    downloadText(JSON.stringify(data, null, 2), `学情登记-${stampForFile()}.json`);
    showToast('已导出备份', 'ok');
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = migrate(JSON.parse(text) as unknown);
      if (!parsed) {
        showToast('备份文件解析失败，请检查文件', 'error');
        return;
      }
      openConfirm({
        title: '导入备份',
        message: '导入将覆盖当前全部数据（含设置与历史记录），确定继续？',
        confirmText: '覆盖导入',
        danger: true,
        onConfirm: () => {
          replaceState(parsed);
          showToast('已导入备份', 'ok');
        },
      });
    } catch {
      showToast('备份文件解析失败，请检查文件', 'error');
    }
  };

  return (
    <Modal
      title="设置"
      size="lg"
      onClose={close}
      footer={
        <Pill variant="save" onClick={close}>
          完成
        </Pill>
      }
    >
      <section className="settings-section">
        <div className="settings-title">班级信息</div>
        <div className="field">
          <label className="field-label" htmlFor="set-class">班级名</label>
          <input
            id="set-class"
            type="text"
            maxLength={20}
            value={classInfo.name}
            onChange={(e) => updateClassInfo({ name: e.target.value.slice(0, 20) })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="set-school">学校名</label>
          <input
            id="set-school"
            type="text"
            maxLength={20}
            value={classInfo.school}
            placeholder="用于海报署名"
            onChange={(e) => updateClassInfo({ school: e.target.value.slice(0, 20) })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="set-teacher">教师名</label>
          <input
            id="set-teacher"
            type="text"
            maxLength={20}
            value={classInfo.teacher}
            onChange={(e) => updateClassInfo({ teacher: e.target.value.slice(0, 20) })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="set-subject">学科</label>
          <select
            id="set-subject"
            value={classInfo.subject}
            onChange={(e) => updateClassInfo({ subject: e.target.value })}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">花名册</div>
        <div className="field">
          <label className="field-label" htmlFor="set-count">学生人数（1–120）</label>
          <input
            id="set-count"
            type="number"
            min={1}
            max={120}
            value={countText}
            aria-invalid={countError ? true : undefined}
            onChange={(e) => setCountText(e.target.value)}
            onBlur={commitCount}
          />
          {countError ? <span className="field-error">{countError}</span> : null}
          <span className="field-hint">调小人数不会删除已录入数据，调回后自动恢复。</span>
        </div>
        <div className="settings-actions" style={{ marginBottom: 10 }}>
          <Pill variant="ghost" onClick={() => setModal('import')}>
            📁 导入花名册
          </Pill>
        </div>
        <div className="switch-row">
          <span>显示姓名</span>
          <Toggle
            checked={settings.showName}
            onChange={(v) => updateSettings({ showName: v })}
            label="显示姓名"
          />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">录入偏好</div>
        <div className="switch-row">
          <span>秒跳（提交后自动前进）</span>
          <Toggle
            checked={settings.secondsJump}
            onChange={(v) => updateSettings({ secondsJump: v })}
            label="秒跳"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="set-excellent">优秀线（80–100）</label>
          <input
            id="set-excellent"
            type="number"
            min={80}
            max={100}
            value={excellentText}
            onChange={(e) => setExcellentText(e.target.value)}
            onBlur={() => updateSettings({ excellentLine: Number(excellentText) })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="set-pass">及格线（0–80）</label>
          <input
            id="set-pass"
            type="number"
            min={0}
            max={80}
            value={passText}
            onChange={(e) => setPassText(e.target.value)}
            onBlur={() => updateSettings({ passLine: Number(passText) })}
          />
          <span className="field-hint">越界会自动夹取到最近合法值。</span>
        </div>
        <div className="switch-row">
          <span>光荣榜含 A（常规作业）</span>
          <Toggle
            checked={settings.honorIncludesA}
            onChange={(v) => updateSettings({ honorIncludesA: v })}
            label="光荣榜含 A"
          />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">数据</div>
        <div className="settings-actions">
          <Pill variant="ghost" onClick={exportBackup}>
            📦 导出备份
          </Pill>
          <Pill variant="ghost" onClick={() => fileRef.current?.click()}>
            📥 导入备份
          </Pill>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importBackup(f);
              e.target.value = '';
            }}
          />
          <Pill
            variant="ghost"
            onClick={() =>
              openConfirm({
                title: '清空全部数据',
                message: '将删除全部录入、历史记录与设置，且不可撤销。建议先导出备份。',
                requireText: '清空',
                confirmText: '清空全部数据',
                danger: true,
                onConfirm: () => {
                  resetAll();
                  showToast('已清空全部数据', 'ok');
                },
              })
            }
          >
            🗑️ 清空全部数据
          </Pill>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="field-label" style={{ marginBottom: 6 }}>
            历史记录（{history.length} 条，最多保留 200 条）
          </div>
          {history.length === 0 ? (
            <div className="field-hint">暂无历史记录</div>
          ) : (
            <>
              <ul className="history-list">
                {history.slice(0, 50).map((h) => (
                  <li key={h.id}>
                    <span>
                      {formatDateCN(h.date)} · {h.content || '未填写'} · 录入 {h.metrics.entered} 人
                      {h.metrics.avg === null ? '' : ` · 均分 ${h.metrics.avg}`}
                    </span>
                    <button
                      type="button"
                      className="btn-sm"
                      data-danger="1"
                      aria-label={`删除 ${formatDateCN(h.date)} 的记录`}
                      onClick={() =>
                        openConfirm({
                          title: '删除历史记录',
                          message: `确定删除「${formatDateCN(h.date)} · ${h.content || '未填写'}」这条历史记录？`,
                          danger: true,
                          onConfirm: () => {
                            deleteHistory(h.id);
                            showToast('已删除该条历史记录', 'ok');
                          },
                        })
                      }
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
              <div className="settings-actions" style={{ marginTop: 8 }}>
                <Pill
                  variant="ghost"
                  onClick={() =>
                    openConfirm({
                      title: '清空历史记录',
                      message: '将删除全部历史记录，不影响当前录入。确定继续？',
                      danger: true,
                      onConfirm: clearHistory,
                    })
                  }
                >
                  清空历史记录
                </Pill>
              </div>
            </>
          )}
        </div>
      </section>
    </Modal>
  );
}
