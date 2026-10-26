import { useStore } from '../../store';
import { GRADE_ORDER, SCHEME_LABEL } from '../../domain/constants';
import { buildGradeKeyMap, keyMapPairs } from '../../domain/keymap';
import type { GradeLetter, SchemeKind } from '../../domain/types';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/controls';

const KINDS: SchemeKind[] = ['grade', 'score', 'check', 'mixed', 'text'];

/** 评分方案面板（设计 04 §9 SchemeEditor / PRD FR-17） */
export function SchemeModal() {
  const scheme = useStore((s) => s.draft.scheme);
  const setScheme = useStore((s) => s.setScheme);
  const resetScheme = useStore((s) => s.resetScheme);
  const entries = useStore((s) => s.draft.entries);
  const showToast = useStore((s) => s.showToast);
  const setModal = useStore((s) => s.setModal);

  const close = () => setModal(null);

  const scores = Object.values(entries).filter((e) => e.value?.kind === 'score').length;
  const grades = Object.values(entries).filter((e) => e.value?.kind === 'grade').length;
  // v2.5.10 FR-68.1：把当前启用等级的数字键位显示出来，
  // 让老师勾完等级就知道“按哪个数字键录哪一桩”，不用回主界面猜。
  const pairs = keyMapPairs(buildGradeKeyMap(scheme));

  const toggleGrade = (g: GradeLetter) => {
    const has = scheme.grades.includes(g);
    if (has && scheme.grades.length <= 1) return;
    setScheme({ grades: has ? scheme.grades.filter((x) => x !== g) : [...scheme.grades, g].sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b)) });
  };

  const pct = (r: number) => Math.round(r * 1000) / 10;

  return (
    <Modal
      title="本表评分方案"
      size="lg"
      onClose={close}
      footer={
        <>
          <Pill variant="ghost" onClick={resetScheme}>恢复默认</Pill>
          <Pill variant="save" onClick={close}>完成</Pill>
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
          改方案不会改动已录的值，只重算判定与名单
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
      <div className="field-hint">
        及格% 是「低于它就算未过关」的线，最低 5%；等级值达到及格线时，混合判定也会算过关（见设置 → 过关规则）。
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
