# 变更日志（CHANGELOG）

本文件按**产品版本**记录每次交付改了什么。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> **只写「做了什么、为什么、验收到什么程度」**，不贴用户操作步骤与反馈原话。
> 每次改动的细节（根因、代码位置、验收编号）见 `docs/` 里对应的需求说明书或修复日志。

## [2.6.1] - 2026-10-26

### 修复 Fixed

- 修复 过关规则没说清混合判定会被本表及格线找回：设置里写明等级值达到及格线时同样算过关，并列出当前勾选的等级（FR-70.1）。
- 修复 及格% 可以被改成个位数：本表设置的阈值输入框加下限（最低 5%）与提示，防止及格线过低导致几乎人人过关（FR-70.2）。
- 修复 B- 在代码里有两处遗漏：`GRADE_LETTERS` 补上 B-；手机键盘等级行允许换行且每键可缩，375px 屏 8 档全都见得到、点得到（FR-70.3 / FR-70.4）。
- 修复 本表未启用的等级没有入口：提示条多一个「未启用…，点此添加」，直达本表设置（FR-70.5）。

### 文档 Docs

- 新增 `docs/26-修复日志-v2.6.1.md`（根因、代码位置与验收编号）。
- 版本号升至 **2.6.1**，`dist/` 已重建。

## [未发布] Unreleased

- 文档仓库整理：V1 / V2 文档移入 `docs/archive/`；新增 `CHANGELOG.md`、`CONTRIBUTING.md`；
  `docs/README.md` 重排为「需求 → 设计 → 修复日志 → 审查 → 资产」五层导航。
- 版本号升至 **2.6.0**（文档与工程规范整理，产品功能不变，`dist/` 已重建）。

## [2.6.0] - 2026-10-26

### 变更 Changed

- 修复 界面不随屏幕适配：解除 `.app-inner` 的 1440px 内容上限，按 1600 / 1920 / 2560 三档逐级放大格子、字号、按钮与图标（FR-69.1）。
- 修复 提示条看不出启用等级的键位与顺序：启用等级做成带键号色块，配色与该等级格子一致；长等级链不再被省略号裁掉（FR-68.1）。

### 修复 Fixed

- 修复 主屏在多张同类型登记表之间无法切换：新增主界面「选择登记表」，只在该模板当天确有多张表时出现，切换落回原有记录（FR-66.1）。
- 修复 汇总图的评价语只能整张写一条：汇总按表分节展示，每张表各写各的一条（FR-66.2）。
- 修复 等级旁表情与等级文字互相遮挡、汇总格不显示表情：表情改为主值下方独立一行，按主网格 / 海报 / 汇总分别给字号（FR-67.1）。

### 文档 Docs

- 新增 `CHANGELOG.md` 与 `CONTRIBUTING.md`；`docs/README.md` 改为分层导航；早期 V1/V2 文档归档至 `docs/archive/`。

### 验收 Verification

- `tsc --noEmit` 0 错误；`scripts/check-layers.mjs` 通过；单元测试 **46 文件 / 433 例**全过；
  Playwright E2E **62 条**全过；`npm run build` 成功，`dist/` 已随源码提交。

---

## [2.5.10] - 2026-10-26

用户反馈五条：主屏看不到同类型的第二张表、汇总只能写一条标语、表情遮挡等级、开了 A-/B- 提示语不变、界面不随屏幕适配。
**结论：没有一条是数据丢失。**

### 修复 Fixed

- 主界面新增「选择登记表」下拉（同模板多表时才出现），切换走 `switchRecord` 落回原记录（FR-66.1）。
- 汇总按表分节写评价语，与整图页脚语并存；单条海报仍只写当前表（FR-66.2）。
- 表情从「跟在主值后面 inline」改为主值下方独立一行；汇总格不再隐藏表情（FR-67.1）。
- 提示条与「本表设置」显示当前方案的键位绑定顺序，配色与该等级格子一致（FR-68.1）。
- `.app-inner` 解除 1440px 上限，令牌按 1600/1920/2560 三档放大（FR-69.1）。

### 验收 Verification

- 单元测试 433 例、E2E 62 条全绿；新增 `tests/unit/fr66-sheet-comment.test.ts`（14 例）、
  `tests/e2e/v5-feedback.spec.ts`（6 条，A-143 ~ A-147）。

---

## [2.5.9] - 2026-10-26

用户反馈四问：登记等级要加 B-、Mac 上通过标记显示成根号、切回常规作业后「登记没了」、登记了两张常规作业生成不了第二张的图。
**结论：没有一条是数据丢失。**

### 新增 Added

- 等级阶梯补全 **B-**（百分表 75 分），键位上限放开到 1..8；`normalize.ts` 的「b减 → B-」语音映射落地（FR-64.5）。

### 变更 Changed

- 表的身份统一为完整 key（`classId|date|content|sheetId`）：选择列表、单表海报解析、INV-23 校验全部改为按 key（FR-64.1 / 64.2）。
- 切换模板落当天该模板最近一条已有记录，不再落回空表（FR-64.3）。
- 显示层统一输出 **U+2713「✓」**（格子 / 海报 / CSV 同源）；输入仍接受 U+221A「√」（FR-65）。
- 名单阈值从魔法数字改为从 `RANK['A']` / `RANK['A-']` 推导，「≥A 进光荣榜」语义不变，golden 一字不改。

### 修复 Fixed

- 汇总.csv「登记表数」改按记录 key 统计（FR-64.6）。

### 验收 Verification

- 单元测试 419 例、E2E 56 条全绿；新增 `tests/unit/fr64-sheet-identity.test.ts`（6 例）。

---

## [2.5.8] - 2026-10-26

用户反馈「截图中为什么还是会出现这种图标重叠以及显示过小的问题?」——五个独立缺陷，都在显示层，不涉及数据。

### 修复 Fixed

- 可选字段兜底：`defaultComment` 老数据缺失时不再白屏（FR-63.1）。
- 补上从未渲染的 `data-len` 属性，字号阶梯规则恢复生效（FR-63.2）。
- 格子改上下两条带（学号/印章 + 主值/角标），整格状态去重角标（FR-63.3）。
- 汇总 mini 格由定宽改弹性列，占满卡片（FR-63.4）。
- 海报弹窗新增 `poster` 档 `min(1240px, 100%)`，近似 1:1（FR-63.5）。

### 验收 Verification

- 单元测试 413 例、E2E 56 条全绿；新增 `tests/component/fr63-cell-render.test.tsx`（4 例）。

---

## [2.5.7] - 2026-10-26

老师实机反馈「上方一直有数据为空的提示，点了清空并重来也没用」——实为三个叠加缺陷造成的**真实数据丢失事故**。

### 修复 Fixed

- 打开后落表逻辑：今天有内容→今天，否则→库里最近的记录；硬保证 `draft.key === 该记录自身 key`（FR-62.1）。
- `exportState()` 合并当前草稿，录一整天不切表也不会丢（FR-62.2）。
- 覆盖保护不再把「今天还没录」误判成「数据被清空」而永久只读（FR-62.3）。
- `resetAll()` 同步解除只读标记（FR-62.4）。
- Esc 关闭弹窗（FR-62.5）；「⋯ 更多」弹层改为 fixed 定位，不再被裁切（FR-62.6）。

### 验收 Verification

- 单元测试 409 例、E2E 56 条全绿；新增 `tests/unit/fr62-today-draft.test.ts`（5 例）、`tests/unit/storageGuard.test.ts`（9 例）。

---

## [2.5.6] - 2026-10-26

委托方要求「从用户使用角度审视非常规操作会引发哪些错」。4 位独立审查员以真人手速与习惯操作，
以 `localStorage` 实际内容 + DOM 状态 + 截图三方取证，共 **68 条**问题。

### 新增 Added

- 多窗口互写保护：写盘前比对磁盘指纹，不静默整表覆盖（FR-60）。
- 录入防误操作：点格子退出多选、撤销焦点归位、弹窗开着禁用全部快捷键（FR-61）。

### 修复 Fixed

- 界面输出拦截：空数据不许照常出报表/海报；Toast 加优先级与足够寿命（FR-59）。
- 保存失败可见化（FR-58）。
- 花名册导入安全：换名单必确认、可回退、标题行不再当表头（FR-57）。

**68 条中 64 条已修，4 条未修理由见 `docs/reviews/README.md`。**

### 验收 Verification

- 单元测试 401 例、E2E 49 条全绿。

---

## [2.5.5] - 2026-10-25

数据落盘安全专项审查（D-01 ~ D-15）后的修复（FR-58）。

### 修复 Fixed

- 保存失败从静默变为可见（Toast + 黄条 + 恢复路径）。
- 存储写满等异常场景不再「刷新后才发现全没了」。

### 验收 Verification

- 单元测试全绿，E2E 增加保存失败链路用例。

---

## [2.5.4] - 2026-10-25

花名册导入安全专项审查（R-01 ~ R-16）后的修复（FR-57）。

### 修复 Fixed

- 换名单必须确认；同名替换零确认导致「上学期成绩挂到新生头上」。
- 导入可回退；标题行不再被当表头。

### 验收 Verification

- 单元测试全绿，E2E 增加导入安全用例。

---

## [2.5.3] - 2026-10-25

### 新增 Added

- Excel（.xlsx）花名册导入：粘贴文本 / CSV / TXT / XLSX（FR-55）。
- 异常操作护栏（FR-56）。

---

## [2.5.2] - 2026-10-25

### 修复 Fixed

- 导入 xlsx 名单后班级变乱码、系统锁死只读的四层缺陷（FR-54）。

---

## [2.5.1] - 2026-10-25

### 修复 Fixed

- 启动器生成的 `--app` URL 带反斜杠 → `ERR_INVALID_URL`（评审 P2-1）。

---

## [2.5.0] - 2026-10-25

### 新增 Added

- 入口 App 化：`学情登记系统.html` + 「启动学情登记系统.cmd」无边框窗口 + 兼容镜像（FR-53）。

---

## [2.4.0] - 2026-10-25

### 新增 Added

- 设置 → 关于：版本号 / 作者 / GitHub / 联系邮箱（FR-52）。

---

## [2.3.1] - 2026-10-25

V4 评审修复 + 4 条用户反馈：手机端 fixed 底栏、night 主题对比度、等级表情、海报标题与评价语、纯白中性化。

---

## [2.3.0] - 2026-10-25

V4：布局重排（三段式）、数字键消歧、六套主题、移动端录入板、安装提示。

---

## [2.2.1] - 2026-10-24

V3 评审修复：手册补 V3 三节并说明「达标/过关」双口径。

---

## [2.2.0] - 2026-10-24

V3：体验与数据安全加固。15 条真实使用反馈 → FR-31 ~ FR-45，
含过关规则可配、补交门禁、七档色、每档表情、动态键位、周汇总长图、PWA 品牌。

### 修复 Fixed

- **关浏览器重开数据全丢**（FR-44，最严重）：先备份再写、损坏自愈、多窗口保护。

---

## [2.0.1] - 2026-10-23

V2 评审缺陷修复。

---

## [2.0.0] - 2026-10-23

V2：13 条需求 → 14 条 FR，含积分规则编辑器、过关口径、导出 CSV / 海报、语音录入、样例 C。

---

## [1.0.0] - 2026-10-22

V1 基线：16 条 FR，作业/测验成绩登记、界面规格、口径、样例 A/B。

---

[未发布]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.6.1...HEAD
[2.6.1]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.10...v2.6.0
[2.5.10]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.9...v2.5.10
[2.5.9]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.8...v2.5.9
[2.5.8]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.7...v2.5.8
[2.5.7]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.6...v2.5.7
[2.5.6]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.5...v2.5.6
[2.5.5]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.4...v2.5.5
[2.5.4]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.3...v2.5.4
[2.5.3]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.2...v2.5.3
[2.5.2]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.1...v2.5.2
[2.5.1]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.0.1...v2.2.0
[2.0.1]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System/releases/tag/v1.0.0
