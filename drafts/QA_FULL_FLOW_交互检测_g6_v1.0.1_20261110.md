# 六年级期中应用全流程交互与控件检测

- 应用：控制探秘营·八站通行证
- 命题：`2026-11-10-g6-midterm-v1.0.1`（status=locked）
- JSON sha256：`512d9975f0afd2191b8e43358c05cc874fbb03c8321fc88e86a65ec507f48095`
- 检测时间：2026-11-10 22:39（Asia/Shanghai）
- 环境：云电脑 Linux + Playwright/Chromium（viewport 1280×800 与 1024×768）
- 服务：`PORT=8830`，`DATA_DIR=/tmp/g6-midterm-v101-data`
- 账号：601 班名册学生（邱劲骁）一条龙；教师大屏 `/teacher` 免密
- 截图目录：`/workspace/g6-midterm/screenshots/qa-v1.0.1-20261110/`（不入库）
- 脚本：`tools/qa-full-flow.cjs`

## 总评

| 结果 | 数量 |
| --- | --- |
| PASS | 75 |
| FAIL | 0 |
| WARN | 1 |

**无阻断 FAIL，可以交付（回忆成品图待美术接入）。**

WARN 唯一项：17 道带回忆图题的 `assets/recall/{id}.webp` 尚未生成，学生端已按占位路径保留图区，展示中性占位与 JSON `recallCaption`／`recallSceneAnchor`，未自行编造插图。图一旦放到 `/workspace/g6-midterm/assets/recall/`，服务端会直接托管，无需改题库。

## 学生端一条龙

1. 登录页：外壳名「控制探秘营·八站通行证」，班级 601–606，点选姓名进入（无嘉年华文案）。
2. 站点地图：8 站关名与 JSON `stages[].stageName` 一致；开场仅第 1 站可进入；挑战站可见但未解锁。
3. 第 1 站作答并提交 → 过关语「寻设备站通关！下一站：开与关的秘密。」（无泄题）。
4. **刷新核对**：整页刷新回到登录（无本地会话），再点同一学生进入；地图第 1 站为「已通关」5/5，第 2 站「可进入」。同时 `GET /api/state`：`stagesCompleted=["gate_l1"]`，`unlockedStageIds` 含 `gate_l1`、`gate_l2`。之后第 2–8 站每站提交后均再次请求服务端进度，完成与解锁字段均已写入，不是桥接回声。
5. 八站完成后 `mainReady=true` 且尚未交主卷。进入挑战关作答提交：挑战 +10（6/6，封顶），结果页主卷百分仍为「尚未交卷」。`GET /api/state`：`challengeSubmitted=true`，`mainSubmitted=false`，`firstSubmitMain=null`。
6. 再点「提交主卷」：主卷百分 100（40/40），挑战 +10，综合分 110。

## 控件与布局

| 控件／页面 | 结果 | 截图 | 说明 |
| --- | --- | --- | --- |
| 登录 | PASS | `01-login-1280.png` | 601–606，名单点选 |
| 探秘营地图 | PASS | `03-camp-map-1280.png`、`03b-camp-map-1024.png` | 8 站＋加分站；状态除颜色外有文字 |
| 带图单选 GM01 | PASS | `04-GM01-recall-1280.png`、`04b-…-1024.png` | 上图下题，余量给图区；状态微表；两列选项；未作答零高亮 |
| 不带图单选 GM03 | PASS | `06-GM03-no-recall-1280.png` | 无空图位；状态微表；选项随内容收紧 |
| 流程图改法 GM09 `flowchart_pick_fix` | PASS | `10-GM09-pick-fix.png` | 残局 diagram 已渲染；点选改法；无预高亮 |
| 排序卡 GM15 `flowchart_order_cards` | PASS | `12-GM15-order-cards.png` | 四槽①②③④皆空，卡片无默认选中；题干未改成只写一种先后。判分另测：主序与 acceptAlternate 都对，错误序为错 |
| 填槽 GM17 `flowchart_fill_slots` | PASS | `13-GM17-fill-slots.png` | 带回忆图区；输入／计算／输出三槽＋多余干扰卡「当日进馆人次的统计结果」 |
| 方案点选 GC05 `flowchart_pick_plan` | PASS | `16-GC05-pick-plan.png` | 单槽「应选择的测试方案」，无默认选中 |
| 挑战 GC06 升降杆 | PASS | `17-GC06-barrier.png` | 主卷无停车场升降杆；仅挑战保留回忆字段 |
| 先挑战结果 | PASS | `18-result-after-challenge-first.png` | 主卷尚未交卷，挑战已 +10 |
| 交主卷 | PASS | `19-result-main-100.png` | 100 +10 = 110 |
| 教师大屏 | PASS | `20-teacher-1280.png`、`20b-teacher-1024.png` | `/teacher` 免密；按课／题型／素养；见到该生 100／+10 |
| 过关页 | PASS | `08-stage1-clear.png`、`11-stage2-clear.png` | 只用 JSON 过关语 |
| 刷新后地图 | PASS | `09-map-after-refresh.png` | 第 1 站已通关，第 2 站可进入 |

操作引导均来自 JSON `guides`／`diagram.note`，检测未见「正确选项／答案是／应选」等泄题用语。未作答选项无黄框、发光、小手或默认选中。学生可见文案未出现 G1／K1／remixFrom 等内部代号。

## 自动化自测对照

- `npm run test:grade`：**12/12**
- `npm run selftest`：**59/59**（含全错仍解锁、首答锁定 30/40→75、挑战第 6 题封顶、字段剥离、刷新持久化）

## 未测

- **Win7 Chrome 实机未测**。本环境为 Linux。构建目标 es2019、cssTarget chrome87，样式未使用 `:has()` 或 aspect-ratio，待机房验收。
- 读屏／无障碍专项未做。

## 待美术／总管

- 17 张回忆图成品接入 `assets/recall/{id}.webp` 后，无需改题库即可替换占位。
- 默认服务端口用 8830，因建议的 8790 已被本机出站隧道占用。
