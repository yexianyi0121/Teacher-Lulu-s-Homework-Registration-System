import { useRef } from 'react';
import { useStore } from '../../store';
import { GRADE_ORDER, SCHEME_LABEL } from '../../domain/constants';
import { buildGradeKeyMap, keyMapPairs } from '../../domain/keymap';
import { passConfigOf } from '../../domain/passRule';
import { pruneEntries } from '../../domain/scheme';
import type { GradeLetter, SchemeKind, ScorePassTier } from '../../domain/types';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

const KINDS: SchemeKind[] = ['grade', 'score', 'check', 'mixed', 'text'];

/** 评分方案面板（设计 04 §9 SchemeEditor / PRD FR-17） */
export function SchemeModal() {
  const scheme = useStore((s) => s.draft.scheme);
  const setScheme = useStore((s) => s.setScheme);
  const resetScheme = useStore((s) => s.resetScheme);
  const applySchemePrune = useStore((s) => s.applySchemePrune);
  const entries = useStore((s) => s.draft.entries);
  const showToast = useStore((s) => s.showToast);
  const setModal = useStore((s) => s.setModal);
  const openConfirm = useStore((s) => s.openConfirm);

  // v2.6.3 问题三：点「完成」时和打开面板时的方案对比，判断要不要清空已登记值
  const initial = useRef(scheme);

  const close = () => setModal(null);

  const cfg = passConfigOf(scheme);
  const gradePassOn = scheme.kind === 'grade' || scheme.kind === 'mixed';
  const scorePassOn = scheme.kind === 'score' || scheme.kind === 'mixed';

  const scores = Object.values(entries).filter((e) => e.value?.kind === 'score').length;
  const grades = Object.values(entries).filter((e) => e.value?.kind === 'grade').length;
  // v2.5.10 FR-68.1：把当前启用等级的数字键位显示出来，
  // 让老师勾完等级就知道“按哪个数字键录哪一桩”，不用回主界面猜。
  const pairs = keyMapPairs(buildGradeKeyMap(scheme));

  const toggleGrade = (g: GradeLetter) => {
    const has = scheme.grades.includes(g);
    if (has && scheme.grades.length <= 1) return;
    setScheme({
      grades: has
        ? scheme.grades.filter((x) => x !== g)
        : [...scheme.grades, g].sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b)),
    });
  };

  // v2.6.3 FR-72.1：等级制 / 混合制的过关白名单，只能从「可用等级」里挑
  const toggleGradePass = (g: GradeLetter) => {
    const has = cfg.gradePass.includes(g);
    const next = has ? cfg.gradePass.filter((x) => x !== g) : [...cfg.gradePass, g];
    setScheme({ gradePass: next.sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b)) });
  };

  const pct = (r: number) => Math.round(r * 1000) / 10;

  /**
   * 完成（v2.6.3 问题三）：方案类型 / 满分 / 可用等级变化会让旧值不再适用，
   * 先算清要清几格，再二次确认；取消则把方案回滚到打开面板时的样子。
   */
  const finish = () => {
    const before = initial.current;
    const { cleared } = pruneEntries(entries, scheme, before);
    if (!cleared) {
      close();
      return;
    }
    close();
    openConfirm({
      title: '确认修改本表方案？',
      message: `按新方案，已登记的 ${cleared} 个格子将被清空（方案类型 / 满分 / 可用等级变化后不再适用），其余已登记值不受影响。\n\n清空后可用 Ctrl+Z 撤销。`,
      confirmText: '确认修改',
      danger: true,
      onConfirm: () => {
        const n = applySchemePrune(before);
        showToast(n ? `已按新方案清空 ${n} 个格子` : '方案已更新', 'ok', 4000);
      },
      onCancel: () => {
        setScheme({ ...before, grades: [...before.grades] });
        showToast('已取消修改，方案已回滚', 'warn');
      },
    });
  };

  return (
    <Modal
      title="本表评分方案"
      size="lg"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={resetScheme}>恢复默认</Pill>
          <Pill variant="save" onClick={finish}>完成</Pill>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="scheme-kind">方案类型</label>
        <select
          id="scheme-kind"
          value={scheme.kind}
          onChange={(e) => {
            const kind = e.target.value as SchemeKind;
            setScheme({
              kind,
              maxScore: kind === 'score' || kind === 'mixed' ? (scheme.maxScore ?? 100) : null,
            });
          }}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>{SCHEME_LABEL[k]}</option>
          ))}
        </select>
        <div className="field-hint">
          方案类型决定过关规则的口径；点「完成」时若已登记值与新方案不兼容，会先问你再清空。
          {scores && (scheme.kind === 'grade' || scheme.kind === 'check') ? `（当前有 ${scores} 条分数不参与判定）` : ''}
          {grades && (scheme.kind === 'score' || scheme.kind === 'check') ? `（当前有 ${grades} 条等级不参与判定）` : ''}
        </div>
      </div>

      {scheme.kind === 'score' || scheme.kind === 'mixed' ? (
        <div className="field">
          <label className="field-label" htmlFor="scheme-max">满分（1–200）</label>
          <input
            id="scheme-max"
            type="number"
            min={1}
            max={200}
            value={scheme.maxScore ?? 100}
            onChange={(e) => setScheme({ maxScore: Math.min(200, Math.max(1, Number(e.target.value) || 100)) })}
          />
          <div className="field-hint">
            已有 {scores} 条分数不会等比缩放；改满分后判定按新百分比重算
          </div>
        </div>
      ) : null}

      <div className="field-row">
        {([
          ['优秀%', 'excellentRate'],
          ['良好%', 'goodRate'],
          ['及格%', 'passRate'],
        ] as const).map(([label, key]) => (
          <div className="field" key={key}>
            <label className="field-label" htmlFor={`scheme-${key}`}>{label}</label>
            <input
              id={`scheme-${key}`}
              type="number"
              min={0}
              max={100}
              value={pct(scheme[key])}
              onChange={(e) => {
                // v2.6.1 FR-70.2：及格% 下限 5%。老师曾把它误设成 7%，导致 7 分以上全判过关。
                const MIN_PASS = 5;
                const raw = Number(e.target.value);
                if (key === 'passRate' && Number.isFinite(raw) && raw < MIN_PASS) {
                  showToast(`及格% 不能低于 ${MIN_PASS}%，否则几乎人人过关`, 'warn');
                  return;
                }
                const v = Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100;
                const next = { ...scheme, [key]: v };
                // 夹取关系：0 ≤ 及格 ≤ 良好 ≤ 优秀 ≤ 100
                const pass = Math.min(next.passRate, next.goodRate);
                const good = Math.min(next.goodRate, next.excellentRate);
                setScheme({ [key]: v, passRate: pass, goodRate: good } as never);
              }}
            />
          </div>
        ))}
      </div>

      <div className="field">
        <span className="field-label">可用等级（至少留 1 档）</span>
        <div className="grade-chips">
          {GRADE_ORDER.map((g) => (
            <button
              key={g}
              type="button"
              className="chip"
              data-on={scheme.grades.includes(g) ? '1' : '0'}
              onClick={() => toggleGrade(g)}
              aria-pressed={scheme.grades.includes(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="field-hint">
          勾选后按从左到右的顺序绑定数字键：
          {pairs.map((p) => ` ${p.key}=${p.grade}`).join('')}
        </div>
      </div>

      {/* v2.6.3 问题二：过关规则从系统设置搬到这里，跟着方案类型走 */}
      <div className="field">
        <span className="field-label">过关规则（由方案类型决定）</span>

        {gradePassOn ? (
          <>
            <div className="field-hint">
              {scheme.kind === 'grade'
                ? '等级制：只有勾选的等级算过关（强制按等级白名单，未勾的等级一律不算）。'
                : '混合制：等级值只看白名单；分数值只看下面的分数过关线，两条线互不越界。'}
            </div>
            <div className="grade-chips">
              {scheme.grades.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="chip"
                  data-on={cfg.gradePass.includes(g) ? '1' : '0'}
                  onClick={() => toggleGradePass(g)}
                  aria-pressed={cfg.gradePass.includes(g)}
                  aria-label={`等级过关 ${g}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="field-hint">
              算过关的等级：{cfg.gradePass.length ? cfg.gradePass.join(' / ') : '（一个都没勾，等级值全部不算过关）'}
            </div>
          </>
        ) : null}

        {scorePassOn ? (
          <div className="field" style={{ marginTop: 10 }}>
            <label className="field-label" htmlFor="scheme-pass-tier">分数过关线</label>
            <select
              id="scheme-pass-tier"
              value={cfg.scorePassTier}
              onChange={(e) => setScheme({ scorePassTier: e.target.value as ScorePassTier })}
            >
              <option value="pass">达到及格% 即过关（{pct(scheme.passRate)}%）</option>
              <option value="good">达到良好% 才过关（{pct(scheme.goodRate)}%）</option>
              <option value="excellent">达到优秀% 才过关（{pct(scheme.excellentRate)}%）</option>
            </select>
            <div className="field-hint">
              {scheme.kind === 'score'
                ? '分数制：只按这条线判过关，等级白名单不参与。'
                : '混合制：分数值按这条线判，等级值按上面的白名单判。'}
            </div>
          </div>
        ) : null}

        <label className="switch-row">
          <span>缺交算过关</span>
          <input
            type="checkbox"
            role="switch"
            checked={cfg.missingPass}
            onChange={(e) => setScheme({ missingPass: e.target.checked })}
            aria-label="缺交算过关"
          />
        </label>
        <label className="switch-row">
          <span>请假算过关</span>
          <input
            type="checkbox"
            role="switch"
            checked={cfg.leavePass}
            onChange={(e) => setScheme({ leavePass: e.target.checked })}
            aria-label="请假算过关"
          />
        </label>
        <label className="switch-row">
          <span>听写全对自动算过关</span>
          <input
            type="checkbox"
            role="switch"
            checked={cfg.dictationAutoPass}
            onChange={(e) => setScheme({ dictationAutoPass: e.target.checked })}
            aria-label="听写全对自动算过关"
          />
        </label>
      </div>

      <div className="field">
        <span className="field-label">附加能力</span>
        <label className="switch-row">
          <span>允许 ✓ 过关标记</span>
          <input
            type="checkbox"
            checked={scheme.allowCheck}
            onChange={(e) => setScheme({ allowCheck: e.target.checked })}
            aria-label="允许过关标记"
          />
        </label>
        <label className="switch-row">
          <span>允许自定义文字</span>
          <input
            type="checkbox"
            checked={scheme.allowText}
            onChange={(e) => setScheme({ allowText: e.target.checked })}
            aria-label="允许自定义文字"
          />
        </label>
        <label className="switch-row">
          <span>允许一位小数</span>
          <input
            type="checkbox"
            checked={scheme.decimals >= 1}
            onChange={(e) => setScheme({ decimals: e.target.checked ? 1 : 0 })}
            aria-label="允许一位小数"
          />
        </label>
      </div>
    </Modal>
  );
}
