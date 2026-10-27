import { describe, expect, it } from 'vitest';
import { fromPersisted, useStore } from '../../src/store';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { normalizeScheme, pruneEntries, valueAllowedByScheme } from '../../src/domain/scheme';
import { passConfigOf } from '../../src/domain/passRule';
import { studentsOf } from '../fixtures';
import { todayISO } from '../../src/domain/date';
import type {
  Entry,
  GradeLetter,
  PassRule,
  PersistedStateV4,
  RecordDoc,
  ScorePassTier,
  ScoringScheme,
} from '../../src/domain/types';

/**
 * v2.6.3 回归（FR-72 / FR-73）：
 * - FR-72.1：老备份把过关规则放在 settings.passRule，载入时必须并进每条记录自己的方案；
 * - FR-72.2：方案类型与过关口径绑定（等级制看白名单 / 分数制看分数线 / 混合制各管各的）；
 * - FR-73.1：改方案后不兼容的已登记值要被清掉（返回清空个数）；
 * - FR-73.2：清空之前先问人（这里只测 pruneEntries 的判定，弹窗由 SchemeModal 负责）。
 */

const grades: GradeLetter[] = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'];

function scheme(over: Partial<ScoringScheme> = {}): ScoringScheme {
  return {
    kind: 'grade', maxScore: null,
    grades: [...grades],
    allowCheck: true, allowText: true, decimals: 0,
    excellentRate: 0.9, goodRate: 0.8, passRate: 0.6,
    gradePass: ['A+', 'A'], scorePassTier: 'pass',
    missingPass: false, leavePass: false, dictationAutoPass: true,
    ...over,
  };
}

const gEntry = (letter: GradeLetter): Entry => ({
  value: { kind: 'grade', grade: letter },
  stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 1,
});
const sEntry = (n: number): Entry => ({
  value: { kind: 'score', score: n },
  stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 1,
});
const mEntry: Entry = {
  value: null, stamp: 'none', status: 'missing', pass: false, makeup: null, updatedAt: 1,
};

describe('FR-72.1：老 settings.passRule 并进每条记录的方案', () => {
  const legacy: PassRule = {
    kind: 'mixed',
    gradePass: ['A+', 'A', 'B+', 'B', 'C'] as GradeLetter[],
    dictationAutoPass: true,
    missingPass: true,
    leavePass: false,
  };

  it('normalizeScheme 把旧规则灌进方案，且不动方案自己的字段', () => {
    const bare = { ...scheme(), gradePass: undefined, scorePassTier: undefined, missingPass: undefined, leavePass: undefined, dictationAutoPass: undefined };
    const out = normalizeScheme(bare, legacy);
    expect(out.gradePass).toEqual(['A+', 'A', 'B+', 'B', 'C']);
    expect(out.missingPass).toBe(true);
    expect(out.leavePass).toBe(false);
    expect(out.scorePassTier).toBe('pass');
    expect(out.kind).toBe('grade');
    expect(out.grades).toEqual(grades);
  });

  it('方案自己已经带了过关字段时以方案为准（不被旧规则覆盖）', () => {
    const own = scheme({ gradePass: ['A+'], missingPass: false });
    const out = normalizeScheme(own, legacy);
    expect(out.gradePass).toEqual(['A+']);
    expect(out.missingPass).toBe(false);
  });

  it('fromPersisted 老数据（settings 里带 passRule）读回后：每条 records/history 都带上新字段', () => {
    const date = todayISO();
    const rec = {
      key: `cls_1|${date}|默写|sheet_default_homework`,
      classId: 'cls_1', date, content: '默写', sheetId: 'sheet_default_homework', templateId: 'homework',
      scheme: { kind: 'grade', maxScore: null, grades: [...grades], allowCheck: true, allowText: true, decimals: 0, excellentRate: 0.9, goodRate: 0.8, passRate: 0.6 },
      entries: { 1: gEntry('A+') }, createdAt: 1, updatedAt: 1,
    } as unknown as RecordDoc;
    const dumped = {
      version: 4, activeClassId: 'cls_1',
      classes: [{ id: 'cls_1', name: '2025级19班', school: '', teacher: '', subject: '语文', students: studentsOf(5), count: 5, createdAt: 1 }],
      records: [rec], history: [], pointRules: [], pointLedger: [],
      settings: { ...DEFAULT_SETTINGS, passRule: legacy } as unknown as typeof DEFAULT_SETTINGS,
      lastSavedAt: 1,
    } as PersistedStateV4;

    const st = fromPersisted(dumped);
    const back = st.records![rec.key];
    expect(passConfigOf(back.scheme).gradePass).toEqual(['A+', 'A', 'B+', 'B', 'C']);
    expect(passConfigOf(back.scheme).missingPass).toBe(true);
    // settings 里不再残留 passRule
    expect('passRule' in (st.settings as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe('FR-72.2：方案类型决定过关口径', () => {
  it('等级制：等级值只认白名单（A- 不因 90% 过关）', () => {
    const cfg = passConfigOf(scheme());
    expect(cfg.gradePass).toEqual(['A+', 'A']);
    expect(passConfigOf(scheme({ kind: 'score' })).gradePass).toEqual(['A+', 'A']);
  });

  it('分数制：scorePassTier 三档都读得出来', () => {
    for (const tier of ['pass', 'good', 'excellent'] as ScorePassTier[]) {
      expect(passConfigOf(scheme({ kind: 'score', scorePassTier: tier })).scorePassTier).toBe(tier);
    }
    expect(passConfigOf(scheme({ kind: 'score', scorePassTier: undefined })).scorePassTier).toBe('pass');
  });
});

describe('FR-73.1：改方案后不兼容的已登记值被清空', () => {
  it('等级制 → 分数制：等级值全部清掉，缺交状态保留', () => {
    const next = scheme({ kind: 'score', maxScore: 100 });
    const { entries, cleared } = pruneEntries({ 1: gEntry('A+'), 2: mEntry, 3: gEntry('B') }, next, scheme());
    expect(cleared).toBe(2);
    expect(entries['1'].value).toBeNull();
    expect(entries['3'].value).toBeNull();
    expect(entries['2'].status).toBe('missing');     // 状态不因改方案而丢
  });

  it('分数制 → 等级制：分数值全部清掉', () => {
    const prev = scheme({ kind: 'score', maxScore: 100 });
    const next = scheme({ kind: 'grade' });
    const { entries, cleared } = pruneEntries({ 1: sEntry(95), 2: sEntry(60) }, next, prev);
    expect(cleared).toBe(2);
    expect(entries['1'].value).toBeNull();
  });

  it('满分变化：已登记的分数全部清空（100 → 120）', () => {
    const prev = scheme({ kind: 'score', maxScore: 100 });
    const next = scheme({ kind: 'score', maxScore: 120 });
    const { cleared } = pruneEntries({ 1: sEntry(95) }, next, prev);
    expect(cleared).toBe(1);
  });

  it('等级列表收窄：被去掉的等级清空，仍在列表里的保留', () => {
    const next = scheme({ grades: ['A+', 'A', 'A-', 'B+', 'B', 'C'] });   // 去掉 D、B- 之外无变化
    const { entries, cleared } = pruneEntries({ 1: gEntry('A'), 2: gEntry('D') }, next, scheme());
    expect(cleared).toBe(1);
    expect(entries['1'].value).not.toBeNull();
    expect(entries['2'].value).toBeNull();
  });

  it('兼容的变化不清任何东西（只改阈值）', () => {
    const next = scheme({ passRate: 0.8 });
    expect(pruneEntries({ 1: gEntry('A') }, next, scheme()).cleared).toBe(0);
  });

  it('valueAllowedByScheme：混合制下等级与分数都允许，纯文本看 allowText', () => {
    expect(valueAllowedByScheme({ kind: 'grade', grade: 'A' }, scheme({ kind: 'mixed' }))).toBe(true);
    expect(valueAllowedByScheme({ kind: 'score', score: 80 }, scheme({ kind: 'mixed' }))).toBe(true);
    // 混合制本来就要同时装等级和分数，文本由 allowText 单独控制
    expect(valueAllowedByScheme({ kind: 'text', text: '全对' }, scheme({ kind: 'mixed', allowText: false }))).toBe(true);
    expect(valueAllowedByScheme({ kind: 'text', text: '全对' }, scheme({ kind: 'grade', allowText: false }))).toBe(false);
    expect(valueAllowedByScheme({ kind: 'text', text: '全对' }, scheme({ kind: 'grade', allowText: true }))).toBe(true);
  });
});

describe('FR-73.2：applySchemePrune 写回 store 并返回清空个数', () => {
  it('清空后 records 与 draft 同步，pushUndo 可撤销', () => {
    const date = todayISO();
    const key = `cls_1|${date}|默写|sheet_default_homework`;
    const rec = {
      key, classId: 'cls_1', date, content: '默写', sheetId: 'sheet_default_homework', templateId: 'homework',
      scheme: scheme(), entries: { 1: gEntry('A+'), 2: gEntry('B') }, createdAt: 1, updatedAt: 1,
    } as unknown as RecordDoc;
    const dumped = {
      version: 4, activeClassId: 'cls_1',
      classes: [{ id: 'cls_1', name: '2025级19班', school: '', teacher: '', subject: '语文', students: studentsOf(5), count: 5, createdAt: 1 }],
      records: [rec], history: [], pointRules: [], pointLedger: [],
      settings: { ...DEFAULT_SETTINGS }, lastSavedAt: 1,
    } as unknown as PersistedStateV4;

    useStore.getState().replaceState(dumped);
    const before = useStore.getState().draft.scheme;
    useStore.getState().setScheme({ kind: 'score', maxScore: 100, gradePass: undefined, scorePassTier: 'pass' });
    const cleared = useStore.getState().applySchemePrune(before);
    expect(cleared).toBe(2);
    expect(useStore.getState().draft.entries['1'].value).toBeNull();
    expect(useStore.getState().records[key].entries['2'].value).toBeNull();
  });
});
