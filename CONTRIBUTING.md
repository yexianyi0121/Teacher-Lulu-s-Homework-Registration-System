# 参与开发 / 贡献指南

本仓库是给**刘露老师（初中语文教师）**定制的「作业 / 测验成绩极速登记 + 一键出图出文案」单页工具。
纯前端、纯本地、**零网络请求**（唯一例外：老师自己点「语音」时才调用浏览器语音识别）。

> 老师怎么用看根目录 [`README.md`](./README.md)；本文只写给**改代码 / 改文档的开发者与编码 Agent**。

---

## 1. 环境要求

| 项 | 要求 | 说明 |
|---|---|---|
| Node | **≥ 22** | Node 20 下 `vite build` 会报 `Dynamic require of "workbox-build" is not supported`（已确认缺陷） |
| 包管理器 | npm 或 pnpm（`corepack prepare pnpm@9.15.0 --activate`） | 本机 `pnpm` 常缺，可直接 `npm run <script>` |
| git | 必需 | `gh` CLI **不要用**（本机没有，也不许 `gh repo create`） |

**分支与仓库（不许改）**：远端 `https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System`，分支 `main`。
**禁止** `git init` 重建 / `--force` 推送 / 另建仓库 / 改默认分支名。

---

## 2. 常用命令

```bash
npm install              # 首次
npm run typecheck        # tsc --noEmit
npm test -- --run        # 单元测试（vitest）
node scripts/check-layers.mjs   # 分层约束：domain / store / infra 无越界依赖
npm run build            # vite build + 内联 dist + 生成中文入口与启动器
npm run preview -- --host 127.0.0.1 --port 4173   # 本地预览（E2E 需要）

npx playwright test      # 全部 E2E（需要先起上面的 preview，端口 4173）
npx playwright test tests/e2e/xxx.spec.ts -g "用例名"   # 单条
```

### 提交前必须全绿的四道闸门

```
tsc --noEmit 0 错误  →  check-layers 通过  →  单元测试全过  →  Playwright 全过
```

任一不过，本轮视为未完成。**E2E 跑完会顺手改写 `docs/assets/v2.3.0/mobile-*.png`（测试截图产物）——
提交前用 `git checkout -- docs/assets` 还原，不要把它混进功能提交。**

### 一个已知的 git 怪癖

DSH 一类的工具写文件会保留 mtime，导致 `git status` **漏报**已修改文件。
提交前先跑一次：

```bash
git ls-files -z | xargs -0 touch --     # 强制重哈希，让 status 说实话
```

---

## 3. 代码约定

- **分层**：`domain`（纯逻辑）← `store`（状态）← `infra`（存储/导入导出）← `components`（UI）。
  反向依赖会被 `scripts/check-layers.mjs` 拦下。
- **不新增运行时依赖**：只允许 `react` / `zustand` / `html-to-image` / `clsx`。
- **不新增网络请求**：除老师主动点「语音」外零请求。
- **表的身份永远是完整 key**：`classId|date|content|sheetId`。同一天同模板的多张表共享默认 sheetId，
  **按 sheetId 去重会吞掉第二张表**（v2.5.9 踩过，见 `docs/24`）。
- **显示与输入分开**：显示层输出的码位要与输入接受的一致映射（如 ✓ 输出 U+2713、仍接受 U+221A）。
- **可选字段必须兜底**：类型上必填但老数据可能缺失的字段，读取处要 `?? 默认值`。
- **逐字回归不许破**：报表文案、样例 A/B/C 的数字与名单、CSV 字节必须保持不变。
- **CSS 与代码必须同步**：每档等级的颜色在 `domain/tone.ts` 的 `GRADE_TONE` 与 `global.css` 的
  per-grade 块里各一份，改一处必须改另一处（E2E-30 会抓）。

---

## 4. 文档约定（`docs/`）

`docs/` 是本项目的**唯一事实来源**，结构如下：

```
docs/
├── README.md            # 总导航：进度、交付位置、高危点、各版本结论
├── archive/             # 已归档的 V1 / V2 需求与设计（保留编号，不再改）
├── reviews/             # 异常操作审查报告（4 份 + 索引）
├── assets/              # 文档截图（按版本分目录）
├── NN-需求说明书-*.md    # 需求（功能、平台、验收编号）
├── NN-自测报告-*.md      # 自测报告（跑了什么、截图、没覆盖什么）
└── NN-修复日志-*.md      # 单次修复日志
```

### 命名规则

| 类型 | 文件名 | 内容边界 |
|---|---|---|
| 需求 | `NN-需求说明书-<版本>.md` | 只写**功能需求、运行平台、验收编号** |
| 设计 | `NN-设计说明书-<版本>.md` | 数据模型、模块划分、ADR、里程碑 |
| 自测 | `NN-自测报告-<版本>.md` | 闸门结果、覆盖项、未覆盖项 |
| 修复日志 | `NN-修复日志-<版本>.md` | 只说「修复 XXX」，不贴用户操作步骤或反馈原话 |

- `NN` 为连续编号，已发布的不重排、不复用。
- **需求文档不收录 bug 修复**——每次修复单独写一份修复日志，两不相混。
- 仓库只呈现有用的东西：验证脚本、临时截图、一次性探针**不进仓库**。
- 跨文档引用用相对路径（`./xx.md` / `./archive/xx.md`），改目录后必须同步改引用。

---

## 5. 提交与发布

### 提交信息格式

```
<type>(<版本>): <一句话说明>
```

`type` 取值：`feat`（新功能）/ `fix`（修复）/ `docs`（文档）/ `chore`（杂务，含 `chore(release)`）。
说明写**根因或改动性质**，不贴用户原话。例：

```
fix(v2.5.10): 用户反馈五条——主屏多表切换、按表评价语、表情版位、提示条键位色块、大屏适配（FR-66/67/68/69）
```

### 发布流程

1. 改代码 → 补测试 → 四道闸门全绿；
2. 更新 `package.json` 的 `version` 与 `src/domain/appInfo.ts` 的 `APP_VERSION`（两者必须一致，有测试对拍）；
3. 写本次的修复日志 / 自测报告，更新 `CHANGELOG.md` 与 `docs/README.md`；
4. `npm run build`，**`dist/` 必须随源码提交**（`.gitignore` 不得忽略 `dist/`）；
5. 提交并推送 `main`；
6. 打 tag（`v2.5.10` 形式）并推送 tag。

**不生成** `.github/workflows/`，不自动部署 Pages —— 使用者下载 ZIP 后进 `dist/` 双击
`学情登记系统.html`（或 Windows 双击「启动学情登记系统.cmd」）即可用。

---

## 6. 三条不可让步点

1. **数据不丢**：任何版本升级、任何操作，都不能让老师的登记变少；出问题必须能从备份/快照/JSON 恢复。
2. **输出逐字对**：报表文案、样例 A/B/C 的数字与名单，一位都不能错。
3. **不联网**：除用户主动点语音外，不得有任何请求。
