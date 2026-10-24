import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  APP_AUTHOR,
  APP_CONTACT_EMAIL,
  APP_CONTACT_MAILTO,
  APP_NAME,
  APP_REPO_URL,
  APP_VERSION,
} from '../../src/domain/appInfo';

/**
 * FR-52（v2.4.0）：设置 → 关于 展示的版本 / 作者 / 邮箱 / 仓库地址。
 * 版本号是 package.json 的镜像——这里就是防漂移的闸门。
 */
describe('appInfo：关于面板的应用信息（FR-52）', () => {
  // 注意：jsdom 环境下全局 URL 以 http://localhost:3000/ 为基，相对解析会跑偏，
  // 必须走 createRequire（Node 原生 file:// 解析）
  const pkg = createRequire(import.meta.url)('../../package.json') as { version: string };

  it('版本号与 package.json 一致（改版本忘改 appInfo 会红）', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('系统名非空且含「学情」', () => {
    expect(APP_NAME.length).toBeGreaterThan(0);
    expect(APP_NAME).toContain('学情');
  });

  it('仓库地址是 https 的 GitHub 地址且包含作者账号', () => {
    expect(APP_REPO_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    expect(APP_REPO_URL).toContain(APP_AUTHOR);
  });

  it('作者账号与仓库 owner 一致（yexianyi0121）', () => {
    expect(APP_AUTHOR).toBe('yexianyi0121');
  });

  it('联系邮箱格式合法，mailto 由其派生', () => {
    expect(APP_CONTACT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(APP_CONTACT_EMAIL).toBe('xianyiye0121@163.com');
    expect(APP_CONTACT_MAILTO).toBe(`mailto:${APP_CONTACT_EMAIL}`);
  });
});
