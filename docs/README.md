# 学情登记分析系统 · 文档交付包

> 为 **刘露老师（初中语文教师）** 定制的「作业 / 测验成绩极速登记 + 一键出图出文案」单页工具。

本目录是交给编码 Agent 的**唯二事实来源**。两份文档互为配套，编号互相引用，不可拆分阅读。

| 文档 | 作用 | 谁看 |
|---|---|---|
| [01-需求说明书.md](./01-需求说明书.md) | **做什么**：产品定位、用户场景、16 条功能需求（含逐条 Given-When-Then 验收标准）、界面规格、业务口径、验收基准样例 | 产品 / 评审 / 编码 |
| [02-设计说明书.md](./02-设计说明书.md) | **怎么做**：技术选型与 ADR、分层架构、数据模型、状态管理、录入内核、统计/报表/海报/语音/持久化模块、核心算法、组件契约、测试策略、里程碑、**§17 交付仓库与构建环境** | 编码 / 评审 |

**当前版本：两份文档均为 v1.1**（已过三轮交叉审计：数值逐位复核 11 项 + 缺口审计 15 项 + 终审 16 项，全部关闭；另用脚本机器校验折行/数值/交叉引用，0 错误）。规模：PRD 1307 行 / 87 KB；设计 1681 行 / 74 KB。

## 交付位置（已在 GitHub 上建好仓库，不要重建）

| 项 | 值 |
|---|---|
| 本地工作目录 | `D:\Develop\Homework_registration_system\Teacher-Lulu-s-Homework-Registration-System` |
| GitHub 仓库 | <https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System>（公开） |
| 分支 | `main`（已有 `Initial commit`，仅一个标题行 README） |
| 推送 | `git push origin main`，**禁止** `git init` 重建 / `--force` / 另建仓库 |

**本机环境实况（2026-10-23 实测）**：`git` ✅ 2.56；`gh` ❌ 未安装（不要用 `gh repo create`）；`node`/`npm`/`pnpm` ❌ **全部未安装**，须先 `winget install --id OpenJS.NodeJS.LTS -e`，再 `corepack enable` + `corepack prepare pnpm@9.15.0 --activate`；git `user.name`/`user.email` 为空，首次提交前须配置（详见设计 §17.2–17.3）。

**发布方式**：用户已选择「只推代码、不自动部署 Pages」——因此 **`dist/` 构建产物要一并提交**（`.gitignore` 不得忽略 `dist/`），**不生成** `.github/workflows/`。使用者下载仓库 ZIP 后双击 `dist/index.html` 即可用（`vite base: './'` 不可改）。

## 给编码 Agent 的启动指令（可直接粘贴）

> 你的任务：在已存在的仓库 `D:\Develop\Homework_registration_system\Teacher-Lulu-s-Homework-Registration-System`（远端 `https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System`，分支 `main`）里，按两份文档从零实现这个产品，并推送回 `origin main`。
>
> 第一步：把 `docs/01-需求说明书.md`、`docs/02-设计说明书.md`、`docs/README.md` 复制进仓库的 `docs/` 目录；然后完整读一遍 `02-设计说明书.md` 的 **§17（交付仓库与构建环境）** 和 **§16（对齐补充 10 条）**，再按 **§15.3** 的实现顺序（M1→M8）推进。
> 第二步：先自查环境，`node -v` 不存在就装 Node 20 LTS，再装 pnpm；`git config user.name/user.email` 为空就先配（`yexianyi0121` / `yexianyi0121@users.noreply.github.com`，仓库级）。**不要把 `git init`、`gh repo create`、force push 用在这个仓库上。**
> 铁律：① 类型与函数签名照抄，不得改名；② 统计/名单/报表/海报必须是纯函数并可单测；③ 零网络请求（唯一例外：用户主动点语音）；④ 运行时依赖不得超出设计 §1.4 清单。
> 每完成一个里程碑：跑 `pnpm typecheck && pnpm test --run && pnpm build`，用 PRD §7 的黄金样例 A/B/C 自测，通过后 `git commit` 一次（约定式提交，如 `feat(M3): ...`）。
> 全部完成后：`pnpm build` 更新 `dist/` → `git add -A` → `git commit -m "chore(release): v1.0 全部里程碑完成"` → `git push origin main`；若 push 需要交互登录而当前会话无法弹窗，就把这条命令原样交给用户执行。
> 文档间若有冲突，以 PRD 为准；设计与 PRD 冲突时以设计 §16 为准；设计内部冲突按 §17 > §16 > §8 > §10 优先级取准。任何偏差都要在提交信息里写明。

## 编码前必看的 5 个高危点

这五处曾因文档内部矛盾而无法实现，v1.1 已裁定；agent 若凭直觉实现极易做错：

1. **秒跳只管「提交后前进」，不管输入过程**（PRD FR-04）：单元测试必须按 `Enter` 提交，否则 `87.5` 输不完。
2. **键位两级**（设计 §6.1.1）：导航键挂 `Grid`，命令键挂 `document`——只挂一处必有一半快捷键不可用。
3. **折行按显示宽度 70 半角单位**（`1号、`=5，`12号、`=6），不是按学号个数（设计 §8.2）；这决定报表能否逐字复现参考截图。
4. **统计条/图表只在单元测试模式渲染**（PRD §4.2 高度预算）：否则 1366×768 首屏放不下 5 行网格。
5. **盖章会改变名单归类**：`需更正 = 未达线且未盖「已更正」`（PRD §6.6），否则盖完章名单不清零。

## 产品的三个不可让步点

1. **全键盘录入**：一次按键完成「定位 → 赋值 → 前进」，手离开键盘即算失败。
2. **零手工统计**：统计条、图表、三名单全部由录入数据派生，不存在第二份真相。
3. **一键对外**：报表文案与海报图片都能直接进剪贴板，粘贴到微信即为成品。

## 验收

编码完成后，由评审方按 `01-需求说明书.md` §7.4 的 **30 项**清单逐条勾选，并使用 §7.1 / §7.2 的样例数据做数值与文案的逐字比对。
