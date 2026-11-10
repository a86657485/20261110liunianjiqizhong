# 六年级《过程与控制》期中 · 控制探秘营·八站通行证

命题版本：**2026-11-10-g6-midterm-v1.0.1**（只读自仓库 `design/01_questions.json`，勿改题库）。

JSON sha256：`512d9975f0afd2191b8e43358c05cc874fbb03c8321fc88e86a65ec507f48095`

## 启动

```bash
cd app
npm install          # 会顺带安装 client 依赖
npm run build        # 构建学生端 / 教师大屏 SPA
DATA_DIR=./data PORT=8830 npm start
```

- 学生端：http://127.0.0.1:8830/
- 教师大屏：http://127.0.0.1:8830/teacher （免密，仅本机/局域网）
- 默认端口 **8830**。建议测试目录：`DATA_DIR=/tmp/g6-midterm-v101-data`
- **不要**占用在线课堂 **8766**，也不要抢 8780／8782／8809／8829。本机 **8790** 为出站隧道，勿占用。

## 自测

```bash
npm run test:grade   # 判分、双序、字段剥离、sha256
npm run selftest     # API 一条龙（临时 DATA_DIR）
```

详见 `SELFTEST.md`。

## 目录摘要

```
app/
  server/index.cjs    # HTTP API + 静态托管
  server/paper.cjs    # 加载 v1.0.1 并剥离 serverOnly 字段
  server/grade.cjs    # 服务端判分（含 GM15 acceptAlternate）
  client/             # Vite + React 18（es2019，cssTarget chrome87）
  roster/roster.json  # 601–606 名单（来自六年级课堂名册副本）
  data/               # 默认 DATA_DIR（sqlite）
```

回忆插图按 JSON 路径 `assets/recall/{id}.webp` 提供。成品若已放到仓库 `assets/recall/`，服务端会直接托管；尚未到图时学生端保留中性占位与 `recallCaption`。

## 产品口径（已实现）

- 外壳：控制探秘营·八站通行证（8 站主卷 40 题＋可选挑战 GC01–GC06）
- 答完解锁，不因分数卡关；`passLine=null`
- 主卷百分 = `round(首答正确/40×100)`；挑战每对 +2、满分封顶 +10（第 6 题已满 10 不再加），不计入主卷百分
- GM15 两种到达顺序都对
- 一题一页：带图题上图下题（余量给插图）；不带图题不留空图位
- 未作答选项零高亮；过关反馈仅用 `stages[].clearFeedback`
- 学生端不下发 answer／acceptAlternate／goalIds／analysis／remix／recallImagePrompt 等
- 无填空（禁止 `sentence_fill`）
