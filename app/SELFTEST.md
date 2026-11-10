# 自测记录 · g6-midterm explorer

命题：`2026-11-10-g6-midterm-v1.0.1`  
时区标签：Asia/Shanghai  
记录时间：2026-11-10 22:40（Asia/Shanghai）

## 已测

| 项 | 结果 | 说明 |
| --- | --- | --- |
| 命题版本与 sha256 | PASS | `2026-11-10-g6-midterm-v1.0.1`；JSON sha256 与锁库值一致 |
| 学生端字段白名单 | PASS | 无 answer／acceptAlternate／goalIds／analysis／recallImagePrompt／literacy 等；不带图题无回忆字段 |
| 判分：单选全文、GM09 pick_fix、GM15 双序、GM17 填槽、GC05 方案槽 | PASS | `npm run test:grade` **12/12** |
| 主卷百分 round | PASS | 40/40→100；30/40→75；20/40→50；31/40→78；13/40→33 |
| 挑战加分 | PASS | 每对 +2；5 对已 +10；6 对仍封顶 +10 |
| API 一条龙 | PASS | `npm run selftest` **59/59**：登录→八站（含刷新持久化）→全错仍解锁→先挑战不自动交主卷→30/40 首答 75 且锁定→40/40→100→教师屏 |
| 过关反馈为短鼓励语、无泄题 | PASS | 只用 `stages[].clearFeedback` |
| 构建 `npm run build` | PASS | Vite es2019／cssTarget chrome87，未使用 `:has()` |
| 服务启动 | PASS | 全流程检测用 **PORT=8830** + `DATA_DIR=/tmp/g6-midterm-v101-data`（8790 为本机出站隧道，未占用；未抢 8766／8780／8782／8809／8829） |

## 浏览器全流程（v1.0.1）

| 项 | 结果 | 说明 |
| --- | --- | --- |
| 全流程交互与控件检测 | PASS **75** / FAIL **0** / WARN **1** | 报告 `drafts/QA_FULL_FLOW_交互检测_g6_v1.0.1_20261110.md`；截图 `screenshots/qa-v1.0.1-20261110/`（未入库） |
| 学生一条龙＋教师屏 | 登录→8 站→先挑战 +10 未交主卷→再交主卷 100 | 教师屏免密，含按课／题型／素养 |
| 焦点／过关不泄答案 | 未作答无预高亮；引导不点亮正确项 | API 无 answer／goalIds／analysis |
| 回忆与题对应 | 带图题保留图区＋`recallCaption`；不带图题无空图 | 成品图尚未接入（WARN） |
| 完成站关后刷新核对 | PASS | 第 1 站提交后刷新再登录，服务端 `stagesCompleted` 含 `gate_l1`，`gate_l2` 已解锁；其后每站提交后均 `GET /api/state` 复核 |

## 未测 / 已知限制

| 项 | 说明 |
| --- | --- |
| Win7 Chrome 实机 | **未测**。构建 target es2019／cssTarget chrome87，未使用 `:has()`；待机房验收 |
| 回忆插图真图 | 17 张成品尚未放到 `assets/recall/{id}.webp`；学生端为中性占位＋caption |
| 读屏／无障碍专项 | 未做 |
| 默认端口 | 文档与默认启动为 **8830**（建议的 8790 已被系统隧道占用） |
