/**
 * 应用信息（设置 → 关于，FR-52 / v2.4.0）：版本号 / 仓库地址 / 作者 / 联系邮箱。
 *
 * 版本号以 package.json 的 version 为唯一事实来源——本文件是镜像，
 * tests/unit/appInfo.test.ts 断言两者一致（改了 package.json 忘改这里测试会红）。
 *
 * 纯常量、零依赖、零网络请求：关于面板只是把这几个值渲染成文字与链接
 * （GitHub 链接由用户主动点击才打开，不属于应用自身发起的请求）。
 */

/** 系统显示名（海报页眉 / 设置关于共用） */
export const APP_NAME = '学情登记分析系统';

/** 产品版本，与 package.json version 同步 */
export const APP_VERSION = '2.6.4';

/** 作者 GitHub 账号（仓库 owner） */
export const APP_AUTHOR = 'yexianyi0121';

/** GitHub 仓库地址（https，公开仓库） */
export const APP_REPO_URL = 'https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System';

/** 联系邮箱（用户反馈提供） */
export const APP_CONTACT_EMAIL = 'xianyiye0121@163.com';

/** mailto 链接（联系邮箱行点击即唤起邮件客户端） */
export const APP_CONTACT_MAILTO = `mailto:${APP_CONTACT_EMAIL}`;
