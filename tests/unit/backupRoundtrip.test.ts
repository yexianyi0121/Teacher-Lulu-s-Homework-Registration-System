import { describe, expect, it } from 'vitest';
import { exportAllBlob, importAll } from '../../src/infra/backup';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import type { PersistedStateV2, PersistedStateV4 } from '../../src/domain/types';
import { e, makeScheme, score, studentsOf } from '../fixtures';

async function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsText(blob);
  });
}

function v3(): PersistedStateV4 {
  return {
    version: 4,
    activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '三年二班', school: '某某中学', teacher: '刘露', subject: '语文', students: studentsOf(40), count: 40, createdAt: 1 }],
    records: [{
      key: 'cls_1|2026-10-23|语文本|sheet_default_homework',
      classId: 'cls_1', date: '2026-10-23', content: '语文本', sheetId: 'sheet_default_homework',
      templateId: 'quality', scheme: makeScheme('score'), entries: { '1': e(score(95)), '2': e(score(58)) },
      createdAt: 1, updatedAt: 1,
    }],
    history: [],
    pointRules: [],
    pointLedger: [],
    settings: { ...DEFAULT_SETTINGS },
    lastSavedAt: 1,
  };
}

describe('exportAllBlob → importAll：完整往返（FR-44 / E2E-24）', () => {
  it('导出再导入深度相等', async () => {
    const source = v3();
    const text = await blobText(exportAllBlob(source));
    const result = importAll(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(source);
  });

  it('信封里带 app / version / exportedAt', async () => {
    const text = await blobText(exportAllBlob(v3()));
    const env = JSON.parse(text);
    expect(env.app).toBe('学情登记分析系统');
    expect(env.version).toBe(4);
    expect(typeof env.exportedAt).toBe('string');
    expect(env.state.records).toHaveLength(1);
  });

  it('兼容「裸 state」旧备份', () => {
    const raw = JSON.stringify(v3());
    const result = importAll(raw);
    expect(result.ok).toBe(true);
  });

  it('v2 备份可自动升级导入', () => {
    const old: PersistedStateV2 = {
      ...v3(),
      version: 2,
      settings: {
        secondsJump: true, showName: false, honorIncludesA: false,
        voiceEnabled: true, voiceAutoConfirmMs: 1500, theme: 'pink',
      },
    } as unknown as PersistedStateV2;
    const result = importAll(JSON.stringify(old));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.version).toBe(4);
  });

  it('坏 JSON / 未知版本 → 给出原因而不是抛异常', () => {
    expect(importAll('{oops')).toEqual({ ok: false, reason: '不是合法的 JSON 文件' });
    expect(importAll(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false });
  });
});
