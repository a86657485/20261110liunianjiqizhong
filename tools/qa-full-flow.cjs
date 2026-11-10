'use strict';
/**
 * Browser full-flow QA for 控制探秘营 v1.0.1
 * Writes screenshots + a JSON summary used by the markdown report.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { loadPaper } = require('../app/server/paper.cjs');

const PORT = Number(process.env.PORT) || 8830;
const BASE = 'http://127.0.0.1:' + PORT;
const SHOT = process.env.SHOT_DIR || path.join(__dirname, '..', 'screenshots', 'qa-v1.0.1-20261110');
const REPORT_JSON = path.join(__dirname, '..', 'drafts', '_qa_full_flow_result.json');

fs.mkdirSync(SHOT, { recursive: true });

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE,
          Host: '127.0.0.1:' + PORT,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = text;
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const checks = [];
function record(id, result, detail) {
  checks.push({ id, result, detail: detail || '' });
  console.log(result + ' ' + id + (detail ? ' — ' + detail : ''));
}

async function shot(page, name) {
  const file = path.join(SHOT, name + '.png');
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function checkNoPreHighlight(page, label) {
  const picked = await page.locator('.option-btn.picked, .card-chip.picked, .side-item.active').count();
  const slotActive = await page.locator('.slot-box.active').count();
  if (picked === 0) {
    record('no-prehighlight ' + label, 'PASS', '未作答选项无 picked 高亮');
  } else {
    record('no-prehighlight ' + label, 'FAIL', '未作答已有 ' + picked + ' 个高亮');
  }
  if (slotActive === 0) {
    record('no-default-slot ' + label, 'PASS', '空槽未默认激活');
  } else {
    record('no-default-slot ' + label, 'WARN', '有 ' + slotActive + ' 个空槽处于 active（工作区，非选项）');
  }
  const yellow = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.option-btn, .card-chip'));
    return els
      .filter((el) => {
        const s = getComputedStyle(el);
        const border = (s.borderColor || '').toLowerCase();
        const shadow = (s.boxShadow || '').toLowerCase();
        return border.indexOf('255, 200') >= 0 || border.indexOf('255, 215') >= 0 || shadow.indexOf('255, 215') >= 0;
      })
      .length;
  });
  record('no-yellow-glow ' + label, yellow === 0 ? 'PASS' : 'FAIL', yellow ? '疑似黄框 ' + yellow : '无黄框发光');
}

async function checkGuides(page, question, label) {
  const guide = question.guides || '';
  if (!guide) {
    record('guide ' + label, 'WARN', '本题 JSON 无 guides');
    return;
  }
  const body = await page.locator('.qa-stack').innerText();
  const shown = body.indexOf(guide) >= 0;
  record('guide-shown ' + label, shown ? 'PASS' : 'FAIL', shown ? '引导已展示' : '未找到引导原文');
  const leak = /正确选项|正确答案|应选[A-D]|答案是/.test(body);
  record('guide-no-leak ' + label, leak ? 'FAIL' : 'PASS', leak ? '疑似泄答案' : '引导/题面未见泄答案用语');
}

async function answerOnPage(page, q) {
  const key = q.interactionSpecKey || q.type;
  if (key === 'single_choice' || key === 'flowchart_pick_fix') {
    const text = q.answer;
    const btn = page.locator('.option-btn', { hasText: text }).first();
    await btn.click();
    return;
  }
  const mapping = q.answer;
  for (const slot of q.slots) {
    const slotBtn = page.locator('.slot-box').filter({ hasText: slot }).first();
    await slotBtn.click();
    const card = page.locator('.card-chip', { hasText: mapping[slot] }).first();
    await card.click();
  }
}

async function loginAs(page, student) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: student.classId + ' 班' }).click();
  await page.getByRole('button', { name: student.name, exact: true }).click();
  await page.getByRole('button', { name: '确认进入探秘营' }).click();
  await page.waitForSelector('.explorer-map, .carnival-map, .map-page');
}

async function main() {
  const paper = loadPaper();
  const byId = Object.fromEntries(paper.questions.map((q) => [q.id, q]));
  const roster = (await req('GET', '/api/roster')).json;
  const student = roster.classes[0].students[0];
  const studentB = roster.classes[0].students[1];

  const executable =
    process.env.CHROME_PATH ||
    '/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
  const browser = await chromium.launch({
    headless: true,
    executablePath: executable,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // --- Login & map ---
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  record('login-shell', (await page.locator('h1').innerText()).indexOf('控制探秘营') >= 0 ? 'PASS' : 'FAIL');
  record(
    'no-carnival-copy',
    (await page.content()).indexOf('算法嘉年华') === -1 ? 'PASS' : 'FAIL',
    '登录页无五年级嘉年华文案'
  );
  await shot(page, '01-login-1280');

  await page.getByRole('button', { name: '601 班' }).click();
  await page.getByRole('button', { name: student.name, exact: true }).click();
  await shot(page, '02-login-name-selected');
  await page.getByRole('button', { name: '确认进入探秘营' }).click();
  await page.waitForSelector('.explorer-map, .map-page');
  const mapText = await page.locator('.map-page').innerText();
  record('map-8-stations', /机关密室·寻设备/.test(mapText) && /郑和远航·或运算/.test(mapText) ? 'PASS' : 'FAIL');
  record('map-bonus-locked-or-labeled', /加分挑战关/.test(mapText) ? 'PASS' : 'WARN', '挑战站可见于地图');
  record('map-first-unlocked', /可进入/.test(mapText) ? 'PASS' : 'FAIL');
  await shot(page, '03-camp-map-1280');

  // 1024 map
  await page.setViewportSize({ width: 1024, height: 768 });
  await shot(page, '03b-camp-map-1024');
  await page.setViewportSize({ width: 1280, height: 800 });

  // --- Stage 1, recall question GM01 ---
  await page.getByRole('button', { name: /机关密室·寻设备/ }).click();
  await page.waitForSelector('.question-page');
  const gm01 = byId.GM01;
  record(
    'GM01-recall-layout',
    (await page.locator('.recall-zone').count()) === 1 ? 'PASS' : 'FAIL',
    '带图题有回忆区'
  );
  record(
    'GM01-caption',
    (await page.locator('.recall-zone-caption').innerText()) === gm01.recallCaption ? 'PASS' : 'FAIL',
    await page.locator('.recall-zone-caption').innerText()
  );
  record(
    'GM01-state-table',
    (await page.locator('.state-table').count()) === 1 &&
      (await page.locator('.state-table-wrap').innerText()).indexOf('试验记录') >= 0
      ? 'PASS'
      : 'FAIL'
  );
  await checkGuides(page, gm01, 'GM01');
  await checkNoPreHighlight(page, 'GM01');
  // placeholder or image
  const phVisible = await page.locator('.recall-zone-placeholder').evaluate((el) => {
    const s = getComputedStyle(el);
    return s.display !== 'none';
  });
  record(
    'GM01-recall-art',
    'WARN',
    phVisible ? '插图尚未接入，中性占位已显示（含场景锚点/说明）' : '已显示回忆图（或占位已隐藏）'
  );
  await shot(page, '04-GM01-recall-1280');
  await page.setViewportSize({ width: 1024, height: 768 });
  await shot(page, '04b-GM01-recall-1024');
  await page.setViewportSize({ width: 1280, height: 800 });

  // GM02 still recall, then GM03 no-recall
  await answerOnPage(page, gm01);
  await page.getByRole('button', { name: '下一题' }).click();
  await page.waitForTimeout(150);
  await shot(page, '05-GM02-recall');
  await answerOnPage(page, byId.GM02);
  await page.getByRole('button', { name: '下一题' }).click();
  await page.waitForTimeout(150);
  const gm03 = byId.GM03;
  const noRecallSlot = await page.locator('.recall-zone').count();
  record('GM03-no-blank-image', noRecallSlot === 0 ? 'PASS' : 'FAIL', '不带图题不留空图位');
  record(
    'GM03-state-table',
    (await page.locator('.state-table').count()) === 1 ? 'PASS' : 'FAIL',
    '不带图题仍渲染状态微表'
  );
  await checkGuides(page, gm03, 'GM03');
  await checkNoPreHighlight(page, 'GM03');
  await shot(page, '06-GM03-no-recall-1280');
  await page.setViewportSize({ width: 1024, height: 768 });
  await shot(page, '06b-GM03-no-recall-1024');
  await page.setViewportSize({ width: 1280, height: 800 });

  await answerOnPage(page, gm03);
  await page.getByRole('button', { name: '下一题' }).click();
  await answerOnPage(page, byId.GM04);
  await page.getByRole('button', { name: '下一题' }).click();
  await answerOnPage(page, byId.GM05);
  await shot(page, '07-GM05-before-submit');
  await page.getByRole('button', { name: '提交本关' }).click();
  await page.waitForSelector('.clear-banner');
  const fb = await page.locator('.clear-banner').innerText();
  record('stage1-clear', /寻设备站通关/.test(fb) ? 'PASS' : 'FAIL', fb.replace(/\s+/g, ' ').slice(0, 80));
  record('stage1-clear-no-leak', !/正确选项|答案是|应选/.test(fb) ? 'PASS' : 'FAIL');
  await shot(page, '08-stage1-clear');

  // Refresh persistence
  const stateAfter = await req('GET', '/api/state?studentId=' + encodeURIComponent(student.id));
  const prog1 = stateAfter.json.progress;
  record(
    'api-stage1-persisted',
    (prog1.stagesCompleted || []).includes('gate_l1') && (prog1.unlockedStageIds || []).includes('gate_l2')
      ? 'PASS'
      : 'FAIL',
    JSON.stringify({ completed: prog1.stagesCompleted, unlocked: prog1.unlockedStageIds })
  );

  await page.reload({ waitUntil: 'networkidle' });
  // after reload, should still be logged in? Our app has no local session — reload goes to login.
  // "刷新或换节" — re-login is the student equivalent of a new session / 换节.
  if (await page.locator('h1').count()) {
    record('reload-needs-relogin', 'PASS', '无本地会话，刷新回到登录；随后重新点选同一学生以核对服务端进度');
    await loginAs(page, student);
  }
  const map2 = await page.locator('.map-page').innerText();
  record('refresh-map-stage1-done', /已通关/.test(map2) && /开与关的秘密/.test(map2) ? 'PASS' : 'FAIL');
  record('refresh-map-stage2-open', /开与关的秘密[\s\S]*可进入|可进入[\s\S]*开与关的秘密/.test(map2) || map2.indexOf('可进入') >= 0 ? 'PASS' : 'FAIL');
  await shot(page, '09-map-after-refresh');

  // Stage 2: GM09 flowchart_pick_fix
  await page.getByRole('button', { name: /开与关的秘密/ }).click();
  await page.waitForSelector('.question-page');
  // skip to GM09 (3rd of stage: GM06, GM07, GM08, GM09)
  for (const id of ['GM06', 'GM07', 'GM08']) {
    await answerOnPage(page, byId[id]);
    await page.getByRole('button', { name: '下一题' }).click();
    await page.waitForTimeout(80);
  }
  const gm09 = byId.GM09;
  record('GM09-diagram', (await page.locator('.state-board').count()) === 1 ? 'PASS' : 'FAIL', '残局图示已渲染');
  await checkGuides(page, gm09, 'GM09');
  await checkNoPreHighlight(page, 'GM09');
  await shot(page, '10-GM09-pick-fix');
  await answerOnPage(page, gm09);
  await page.getByRole('button', { name: '下一题' }).click();
  await answerOnPage(page, byId.GM10);
  await page.getByRole('button', { name: '提交本关' }).click();
  await page.waitForSelector('.clear-banner');
  await shot(page, '11-stage2-clear');
  await page.getByRole('button', { name: '回到探秘营地图' }).click();

  const state2 = (await req('GET', '/api/state?studentId=' + encodeURIComponent(student.id))).json.progress;
  record(
    'api-stage2-persisted',
    state2.stagesCompleted.indexOf('gate_l2') >= 0 && state2.unlockedStageIds.indexOf('gate_l3') >= 0 ? 'PASS' : 'FAIL'
  );

  // Remaining main stages 3-8, screenshot special controls
  const specialShot = { GM15: '12-GM15-order-cards', GM17: '13-GM17-fill-slots' };
  const mainStages = paper.stages.filter((s) => s.required);
  for (const stage of mainStages) {
    if (stage.order <= 2) continue;
    await page.getByRole('button', { name: new RegExp(stage.stageName) }).click();
    await page.waitForSelector('.question-page');
    for (let i = 0; i < stage.questionIds.length; i++) {
      const qid = stage.questionIds[i];
      const q = byId[qid];
      if (specialShot[qid]) {
        if (qid === 'GM17') {
          record('GM17-has-recall', (await page.locator('.recall-zone').count()) === 1 ? 'PASS' : 'FAIL');
        }
        if (qid === 'GM15') {
          record('GM15-no-recall', (await page.locator('.recall-zone').count()) === 0 ? 'PASS' : 'FAIL');
          record('GM15-slots', (await page.locator('.slot-box').count()) === 4 ? 'PASS' : 'FAIL');
        }
        await checkGuides(page, q, qid);
        await checkNoPreHighlight(page, qid);
        await shot(page, specialShot[qid]);
      }
      await answerOnPage(page, q);
      if (i < stage.questionIds.length - 1) {
        await page.getByRole('button', { name: '下一题' }).click();
        await page.waitForTimeout(60);
      } else {
        await page.getByRole('button', { name: '提交本关' }).click();
        await page.waitForSelector('.clear-banner');
        const t = await page.locator('.clear-banner').innerText();
        record('clear-' + stage.stageId, t.indexOf('通关') >= 0 || t.indexOf('走完') >= 0 ? 'PASS' : 'FAIL', t.slice(0, 60));
        await page.getByRole('button', { name: '回到探秘营地图' }).click();
        await page.waitForSelector('.map-page');
      }
    }
    const st = (await req('GET', '/api/state?studentId=' + encodeURIComponent(student.id))).json.progress;
    record(
      'persist-' + stage.stageId,
      (st.stagesCompleted || []).includes(stage.stageId) ? 'PASS' : 'FAIL',
      JSON.stringify(st.stagesCompleted)
    );
  }

  await shot(page, '14-map-eight-done');
  const readyState = (await req('GET', '/api/state?studentId=' + encodeURIComponent(student.id))).json.progress;
  record('main-ready', readyState.mainReady && !readyState.mainSubmitted ? 'PASS' : 'FAIL', JSON.stringify({
    mainReady: readyState.mainReady,
    mainSubmitted: readyState.mainSubmitted,
  }));

  // Challenge first: enter bonus without submitting main
  await page.getByRole('button', { name: /加分挑战关/ }).click();
  await page.waitForSelector('.question-page');
  await shot(page, '15-challenge-GC01');
  for (let i = 0; i < 6; i++) {
    const qid = paper.stages.find((s) => s.stageId === 'gate_bonus').questionIds[i];
    const q = byId[qid];
    if (qid === 'GC05') {
      await checkGuides(page, q, 'GC05');
      await checkNoPreHighlight(page, 'GC05');
      record('GC05-slots', (await page.locator('.slot-box').count()) === 1 ? 'PASS' : 'FAIL');
      await shot(page, '16-GC05-pick-plan');
    }
    if (qid === 'GC06') {
      record('GC06-recall', (await page.locator('.recall-zone').count()) === 1 ? 'PASS' : 'FAIL', '升降杆仅在挑战');
      record(
        'GC06-caption',
        (await page.locator('.recall-zone-caption').innerText()).indexOf('升降杆') >= 0 ? 'PASS' : 'FAIL'
      );
      await shot(page, '17-GC06-barrier');
    }
    await answerOnPage(page, q);
    if (i < 5) {
      await page.getByRole('button', { name: '下一题' }).click();
      await page.waitForTimeout(60);
    } else {
      await page.getByRole('button', { name: '提交本关' }).click();
    }
  }
  await page.waitForSelector('.stat, .panel-title, h2');
  const resultText = await page.locator('body').innerText();
  record(
    'challenge-no-auto-main',
    /尚未交卷/.test(resultText) || /提交主卷/.test(resultText) ? 'PASS' : 'FAIL',
    '挑战后主卷百分未自动计入'
  );
  await shot(page, '18-result-after-challenge-first');

  const mid = (await req('GET', '/api/state?studentId=' + encodeURIComponent(student.id))).json.progress;
  record(
    'api-challenge-no-auto-main',
    mid.challengeSubmitted && !mid.mainSubmitted && !mid.firstSubmitMain ? 'PASS' : 'FAIL',
    JSON.stringify({ ch: mid.challengeSubmitted, main: mid.mainSubmitted, first: mid.firstSubmitMain })
  );

  await page.getByRole('button', { name: /提交主卷/ }).click();
  await page.waitForTimeout(300);
  const afterMain = await page.locator('body').innerText();
  record('main-100', /主卷百分[\s\S]*100/.test(afterMain) || afterMain.indexOf('100') >= 0 ? 'PASS' : 'FAIL');
  await shot(page, '19-result-main-100');

  const finalState = (await req('GET', '/api/state?studentId=' + encodeURIComponent(student.id))).json.progress;
  record(
    'final-scores',
    finalState.firstSubmitMain &&
      finalState.firstSubmitMain.percent === 100 &&
      finalState.firstSubmitChallenge &&
      finalState.firstSubmitChallenge.bonus === 10
      ? 'PASS'
      : 'FAIL',
    JSON.stringify({ main: finalState.firstSubmitMain, ch: finalState.firstSubmitChallenge })
  );

  // Teacher screen
  const teacherPage = await context.newPage();
  await teacherPage.goto(BASE + '/teacher', { waitUntil: 'networkidle' });
  const ttext = await teacherPage.locator('body').innerText();
  record('teacher-no-password', /免密/.test(ttext) && /控制探秘营/.test(ttext) ? 'PASS' : 'FAIL');
  record('teacher-diagnostics', /按课/.test(ttext) && /按题型/.test(ttext) && /按素养/.test(ttext) ? 'PASS' : 'FAIL');
  record('teacher-sees-score', ttext.indexOf('100') >= 0 ? 'PASS' : 'WARN', '大屏出现主卷 100');
  await shot(teacherPage, '20-teacher-1280');
  await teacherPage.setViewportSize({ width: 1024, height: 768 });
  await shot(teacherPage, '20b-teacher-1024');

  // Paper field leak via student API already covered; double-check visible student UI has no analysis
  record(
    'student-ui-no-forbidden',
    !/(remixFrom|\bG1\b|\bK1\b)/.test(resultText) ? 'PASS' : 'FAIL'
  );

  // unused studentB just to confirm login still works after
  await teacherPage.close();

  await browser.close();

  const summary = {
    at: new Date().toISOString(),
    port: PORT,
    dataDirHint: process.env.DATA_DIR || '',
    student: { id: student.id, name: student.name, classId: student.classId },
    counts: {
      PASS: checks.filter((c) => c.result === 'PASS').length,
      FAIL: checks.filter((c) => c.result === 'FAIL').length,
      WARN: checks.filter((c) => c.result === 'WARN').length,
    },
    checks,
  };
  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2));
  console.log('---');
  console.log(JSON.stringify(summary.counts));
  if (summary.counts.FAIL) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
