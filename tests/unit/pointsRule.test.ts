import { describe, expect, it } from 'vitest';
import { conditionKey, revertRuleLedger, validateRule } from '../../src/domain/points';
import type { PointLedgerEntry, PointRule } from '../../src/domain/types';

const base: PointRule = {
  id: 'rule_custom_1', name: '积极回答', source: 'auto',
  condition: { kind: 'tierAtLeast', tier: 'pass' },
  delta: 2, freq: 'perEntry', enabled: true, builtin: false,
};

function entry(over: Partial<PointLedgerEntry>): PointLedgerEntry {
  return {
    id: 'p1', classId: 'cls_1', studentNo: 1, date: '2026-10-20', ruleId: 'rule_custom_1',
    delta: 2, reason: '积极回答', source: 'auto', dedupeKey: 'k1', createdAt: 1, ...over,
  };
}

describe('validateRule：闭集表单校验（FR-41.3）', () => {
  it('合法规则通过', () => {
    expect(validateRule(base, [])).toBeNull();
  });

  it('名称空 / 超 16 字 / 重名', () => {
    expect(validateRule({ ...base, name: ' ' }, [])).toContain('不能为空');
    expect(validateRule({ ...base, name: '一'.repeat(17) }, [])).toContain('16');
    expect(validateRule(base, [{ ...base, id: 'other' }])).toContain('重复');
  });

  it('分值为 0 / 超范围', () => {
    expect(validateRule({ ...base, delta: 0 }, [])).toContain('非 0');
    expect(validateRule({ ...base, delta: 11 }, [])).toContain('−10');
  });

  it('同条件 + 同频率拒绝', () => {
    const other = { ...base, id: 'rule_custom_2', name: '另一个名字' };
    expect(conditionKey(other.condition)).toBe(conditionKey(base.condition));
    expect(validateRule(other, [base])).toContain('相同条件');
  });
});

describe('revertRuleLedger：删除规则写冲正（AC-41.2 / INV-10）', () => {
  it('按学生汇总后反向记账，原行保留', () => {
    const ledger = [entry({ id: 'p1' }), entry({ id: 'p2', studentNo: 2, delta: 3, dedupeKey: 'k2' })];
    const next = revertRuleLedger(ledger, 'rule_custom_1', 99);
    expect(next).toHaveLength(4);
    expect(next[2]).toMatchObject({ studentNo: 1, delta: -2, source: 'revert', reason: '规则删除冲正' });
    expect(next[3]).toMatchObject({ studentNo: 2, delta: -3 });
    expect(next[0]).toBe(ledger[0]);
  });

  it('幂等：再次调用不会重复冲正', () => {
    const once = revertRuleLedger([entry({})], 'rule_custom_1', 99);
    const twice = revertRuleLedger(once, 'rule_custom_1', 100);
    expect(twice).toHaveLength(2);
  });

  it('没有该规则的账本 → 原样返回', () => {
    const ledger = [entry({ ruleId: 'other' })];
    expect(revertRuleLedger(ledger, 'rule_custom_1', 99)).toHaveLength(1);
  });
});
