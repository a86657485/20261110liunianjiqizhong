'use strict';

// Run after building app/client. Uses only synthetic identities and a temporary DB.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { createService } = require('../app/server/index.cjs');

const output = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'g6-midterm-layout-qa');
const viewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];
const cases = ['initial', 'main-only', 'challenge-first', 'all-done', 'skipped'];
const checks = [];

function record(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail });
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g6-layout-data-'));
  const service = createService({
    dataDir,
    roster: cases.map((id) => ({ id, classId: '601', name: '模拟布局-' + id })),
  });
  let browser;
  try {
    await service.listen(0);
    const base = 'http://127.0.0.1:' + service.server.address().port;
    async function post(route, body) {
      const response = await fetch(base + route, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(route + ': ' + await response.text());
      return response.json();
    }
    const paper = service.paper;
    const byId = Object.fromEntries(paper.questions.map((q) => [q.id, q]));
    for (const studentId of cases.filter((id) => id !== 'initial')) {
      await post('/api/login', { studentId });
      for (const stage of paper.stages.filter((s) => s.required)) {
        await post('/api/stage/submit', {
          studentId, stageId: stage.stageId,
          answers: Object.fromEntries(stage.questionIds.map((id) => [id, byId[id].answer])),
        });
      }
      if (studentId === 'challenge-first' || studentId === 'all-done') {
        await post('/api/challenge/submit', {
          studentId, answers: Object.fromEntries(paper.questions.filter((q) => q.section === 'challenge').map((q) => [q.id, q.answer])),
        });
      }
      if (studentId === 'main-only' || studentId === 'all-done') await post('/api/main/submit', { studentId });
      if (studentId === 'skipped') await post('/api/challenge/skip', { studentId });
    }
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const engine = await (await context.newCDPSession(page)).send('Browser.getVersion');
    async function login(studentId) {
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '模拟布局-' + studentId, exact: true }).click();
      await page.getByRole('button', { name: '确认进入探秘营', exact: true }).click();
      await page.locator('.stage-node').first().waitFor();
    }

    // Inspect every actual question, including all 17 images, at each resolution.
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await login('initial');
      const label = viewport.width + 'x' + viewport.height;
      for (let si = 0; si < paper.stages.length; si++) {
        await page.locator('.stage-node').nth(si).click();
        for (let qi = 0; qi < paper.stages[si].questionIds.length; qi++) {
          const q = byId[paper.stages[si].questionIds[qi]];
          await page.locator('.q-jump-btn').nth(qi).click();
          if (q.hasRecallImage) await page.waitForFunction(() => [...document.querySelectorAll('.recall-zone-img')].every((i) => i.complete && i.naturalWidth));
          const layout = await page.evaluate(() => {
            const rect = (selector) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { top: r.top, bottom: r.bottom, height: r.height };
            };
            const images = [...document.querySelectorAll('.recall-zone-img')].map((i) => ({ complete: i.complete, naturalWidth: i.naturalWidth }));
            return { stack: rect('.qa-stack'), body: rect('.qa-body'), options: rect('.option-list'), recall: rect('.recall-zone'), images, footer: rect('.question-page > .btn-row'), horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
          });
          record(label + ' ' + q.id + ' footer', Math.abs(layout.footer.bottom - (viewport.height - 8)) <= 2 && !layout.horizontalOverflow, layout);
          if (q.hasRecallImage) {
            record(label + ' ' + q.id + ' image', layout.recall && layout.recall.height > 0 && layout.images.length === 1 && layout.images[0].complete && layout.images[0].naturalWidth > 0, layout);
          } else {
            record(label + ' ' + q.id + ' fills-body', !layout.recall && Math.abs(layout.body.bottom - (layout.stack.bottom - 2)) <= 2, layout);
            if (layout.options) record(label + ' ' + q.id + ' fills-options', Math.abs(layout.options.bottom - (layout.body.bottom - 18)) <= 2, layout);
          }
          if (['GM01', 'GM03', 'GM15'].includes(q.id)) await page.screenshot({ path: path.join(output, label + '-' + q.id + '.png'), fullPage: true });
        }
        await page.getByRole('button', { name: '回到探秘营地图', exact: true }).click();
      }
    }

    // API fixtures create result states; all nine entry controls are clicked normally.
    for (const studentId of cases) {
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await login(studentId);
        const label = viewport.width + 'x' + viewport.height + ' ' + studentId;
        for (let si = 0; si < paper.stages.length; si++) {
          const node = page.locator('.stage-node').nth(si);
          await node.scrollIntoViewIfNeeded();
          const hit = await node.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return { clickable: el.contains(target), target: target && target.closest('button') && target.closest('button').getAttribute('aria-label') };
          });
          record(label + ' ' + paper.stages[si].stageId + ' clickable', hit.clickable, hit);
          if (!hit.clickable) continue;
          await node.click();
          record(label + ' ' + paper.stages[si].stageId + ' enters', await page.locator('.scene-prompt').isVisible());
          await page.getByRole('button', { name: '回到探秘营地图', exact: true }).click();
        }
        if (studentId !== 'initial') {
          const result = page.getByRole('heading', { name: '闯关结果', exact: true });
          await result.scrollIntoViewIfNeeded();
          const panel = await result.evaluate((el) => {
            const r = el.parentElement.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, viewportHeight: innerHeight };
          });
          record(label + ' result-accessible', panel.top >= 0 && panel.bottom <= panel.viewportHeight, panel);
        }
        await page.locator('.map-page').evaluate((el) => { el.scrollTop = 0; });
        await page.screenshot({ path: path.join(output, viewport.width + 'x' + viewport.height + '-map-' + studentId + '.png'), fullPage: true });
      }
    }
    record('no-page-errors', errors.length === 0, errors);
    const failed = checks.filter((c) => !c.pass);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ engine, base, checks, passed: checks.length - failed.length, failed: failed.length }, null, 2));
    console.log(checks.length - failed.length + '/' + checks.length + ' PASS; ' + failed.length + ' FAIL');
    for (const check of failed.slice(0, 12)) console.log('FAIL ' + check.name + ' ' + JSON.stringify(check.detail));
    if (failed.length) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => service.server.close(resolve));
    service.db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
