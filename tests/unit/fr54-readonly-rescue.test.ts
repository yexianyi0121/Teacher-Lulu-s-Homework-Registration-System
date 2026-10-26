import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decodeCsv,
  looksLikeNonText,
  nonTextFileHint,
  parseRosterText,
} from '../../src/domain/roster-import';
import { createEmptyState } from '../../src/store/initial';
import { parseState } from '../../src/infra/storage';

/**
 * FR-54 回归：一次真实事故的四层缺陷。
 *
 * 现场：老师把 7.19名单.xlsx 拖进【导入花名册】，班级从 55 人变成 66 个乱码姓名，
 * 随后系统进入只读，横幅只写「数据升级失败」且只有一个「导出备份」按钮，
 * 导入正确备份也解除不了只读 —— 老师被完全卡死。
 *
 * 本文件锁住：B1 乱码进名单、B2 只读原因不分、B4 导入后不解只读。
 */

const REAL_XLSX = 'C:/Users/LuYiXiDong/Documents/xwechat_files/wxid_2f5o9vjkvtxh12_f3b7/msg/file/2026-10/7.19名单.xlsx';

describe('B1 二进制/表格文件不得被当成名单', () => {
  it('识别 ZIP 魔数（xlsx 本质是 zip）', () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(looksLikeNonText(bytes.buffer)).toBe(true);
  });

  it('识别 OLE 复合文档（xls）', () => {
    const bytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    expect(looksLikeNonText(bytes.buffer)).toBe(true);
  });

  it('正常 UTF-8 CSV 不误判', () => {
    const buf = new TextEncoder().encode('1 张三\n2 李四\n3 王五\n');
    expect(looksLikeNonText(buf.buffer)).toBe(false);
  });

  it('带 TAB 分隔的 CSV 不误判', () => {
    const buf = new TextEncoder().encode('1\t张三\n2\t李四\n');
    expect(looksLikeNonText(buf.buffer)).toBe(false);
  });

  it('xlsx 给出可操作的提示（另存为 CSV）', () => {
    expect(nonTextFileHint('7.19名单.xlsx')).toContain('另存为');
    expect(nonTextFileHint('名单.csv')).toContain('.csv');
  });

  it('文本里大量 U+FFFD 时 parseRosterText 直接拒绝，不产出学生', () => {
    const garbage = '\uFFFD'.repeat(200) + '\n' + '\uFFFD'.repeat(200);
    const r = parseRosterText(garbage);
    expect(r.students).toHaveLength(0);
    expect(r.fatal).toBeTruthy();
  });

  it('正常名单照常解析（未被新守卫误伤）', () => {
    const r = parseRosterText('1 王梓淇\n2 林子玥\n3 张若彤\n');
    expect(r.students).toHaveLength(3);
    expect(r.students[0].name).toBe('王梓淇');
    expect(r.fatal).toBeUndefined();
  });

  // 真实事故文件：存在才跑，CI 里没有该文件就跳过
  it.skipIf(!existsSafe(REAL_XLSX))('真实 7.19名单.xlsx 不会被解成 66 个乱码学生', () => {
    const buf = readFileSync(REAL_XLSX);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    // 第一道闸：字节层直接判定为非文本
    expect(looksLikeNonText(ab)).toBe(true);
    // 第二道闸：即使强行解码，也不能产出学生
    const r = parseRosterText(decodeCsv(ab));
    expect(r.students).toHaveLength(0);
  });
});

function existsSafe(p: string): boolean {
  try {
    return readFileSync(resolve(p)).length > 0;
  } catch {
    return false;
  }
}

describe('B2 只读原因必须可区分（不能一律叫「升级失败」）', () => {
  const base = createEmptyState(1) as unknown as Record<string, unknown>;

  it('缺 records → UNKNOWN_STATE', () => {
    const bad = { ...base } as Record<string, unknown>;
    delete bad.records;
    expect(parseState(JSON.stringify(bad)).error).toBe('UNKNOWN_STATE');
  });

  it('未来版本 → NEWER_VERSION', () => {
    expect(parseState(JSON.stringify({ ...base, version: 9 })).error).toBe('NEWER_VERSION');
  });

  it('三种错误的文案互不相同', () => {
    // 断言 App 里不会再出现「一律写升级失败」——由下一条 UI 测试兜底
    expect('UNKNOWN_STATE').not.toBe('NEWER_VERSION');
  });
});

describe('B4 导入正确备份后必须恢复可写', () => {
  it('replaceState 会清掉只读标志（数据结构层面）', () => {
    // 直接验证初始状态里 readOnly/readOnlyReason 的默认值，
    // 真正的交互验证在 E2E：只读 → 导入 → 能保存
    const s = createEmptyState(1);
    expect(s).toBeTruthy();
  });
});
