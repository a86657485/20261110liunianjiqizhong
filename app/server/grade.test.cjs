'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  loadPaper,
  buildClientPaper,
  EXPECTED_VERSION,
  EXPECTED_SHA256,
  SERVER_ONLY,
  paperSha256,
  DESIGN_JSON,
} = require('./paper.cjs');
const { gradeOne, gradeSet, mainPercent, challengeBonus, isAnswered } = require('./grade.cjs');

const paper = loadPaper();
assert.equal(paper.version, EXPECTED_VERSION);
assert.equal(paper.scoring.main.questionCount, 40);
assert.equal(paper.scoring.challenge.questionCount, 6);
assert.equal(paper.scoring.passLine, null);
assert.equal(paperSha256(), EXPECTED_SHA256);
const byId = Object.fromEntries(paper.questions.map((q) => [q.id, q]));
const mainQs = paper.questions.filter((q) => q.section === 'main');
const challengeQs = paper.questions.filter((q) => q.section === 'challenge');
assert.equal(mainQs.length, 40);
assert.equal(challengeQs.length, 6);

test('paper json sha256 locked', () => {
  assert.equal(paperSha256(DESIGN_JSON), '512d9975f0afd2191b8e43358c05cc874fbb03c8321fc88e86a65ec507f48095');
});

test('single_choice full-text equality', () => {
  const q = byId.GM01;
  assert.equal(gradeOne(q, q.answer).correct, true);
  assert.equal(gradeOne(q, '不必再控制任何设备，过道会自行达到足够照明').correct, false);
});

test('flowchart_pick_fix grades as a chosen plan', () => {
  const q = byId.GM09;
  assert.equal(q.interactionSpecKey, 'flowchart_pick_fix');
  assert.equal(gradeOne(q, q.answer).correct, true);
  assert.equal(gradeOne(q, q.cards[1]).correct, false);
});

test('GM15 accepts both arrival orders and rejects the error order', () => {
  const q = byId.GM15;
  assert.equal(q.interactionSpecKey, 'flowchart_order_cards');
  assert.equal(gradeOne(q, q.answer).correct, true);
  assert.equal(gradeOne(q, q.acceptAlternate).correct, true);
  const errorOrder = {
    '①': '前进',
    '②': '到站提醒',
    '③': '转向进入阅览室',
    '④': '停止',
  };
  assert.equal(gradeOne(q, errorOrder).correct, false);
  const onlyPrimaryPrefixWrongTail = {
    '①': '前进',
    '②': '转向进入阅览室',
    '③': '到站提醒',
    '④': '前进',
  };
  assert.equal(gradeOne(q, onlyPrimaryPrefixWrongTail).correct, false);
  assert.equal(isAnswered({ '①': '前进', '②': '转向进入阅览室' }, q), false);
  assert.equal(isAnswered(q.answer, q), true);
  assert.equal(isAnswered(q.acceptAlternate, q), true);
});

test('flowchart_fill_slots ignores the extra card', () => {
  const q = byId.GM17;
  assert.equal(gradeOne(q, q.answer).correct, true);
  const wrong = {
    输入: '检测到附近有人靠近',
    计算: '当日进馆人次的统计结果',
    输出: '门扇向两边打开',
  };
  assert.equal(gradeOne(q, wrong).correct, false);
  assert.equal(isAnswered({ 输入: q.answer['输入'] }, q), false);
  assert.equal(isAnswered(q.answer, q), true);
});

test('flowchart_pick_plan uses the slot object', () => {
  const q = byId.GC05;
  assert.equal(gradeOne(q, q.answer).correct, true);
  assert.equal(
    gradeOne(q, { 应选择的测试方案: '只测试「两个条件都为真」这一组，即可证明规则是与运算' }).correct,
    false
  );
  assert.equal(isAnswered(q.answer, q), true);
  assert.equal(isAnswered({}, q), false);
});

test('main percent rounding uses 40', () => {
  assert.equal(mainPercent(40, 40), 100);
  assert.equal(mainPercent(30, 40), 75);
  assert.equal(mainPercent(20, 40), 50);
  assert.equal(mainPercent(31, 40), 78);
  assert.equal(mainPercent(13, 40), 33);
  assert.equal(mainPercent(0, 40), 0);
});

test('challenge bonus +2, cap +10, sixth does not exceed', () => {
  assert.equal(challengeBonus(1, 2, 10), 2);
  assert.equal(challengeBonus(4, 2, 10), 8);
  assert.equal(challengeBonus(5, 2, 10), 10);
  assert.equal(challengeBonus(6, 2, 10), 10);
});

test('perfect main set grades 40/40 → 100', () => {
  const answers = {};
  for (const q of mainQs) answers[q.id] = q.answer;
  const g = gradeSet(mainQs, answers);
  assert.equal(g.correct, 40);
  assert.equal(g.total, 40);
  assert.equal(mainPercent(g.correct, paper.scoring.main.questionCount), 100);
});

test('typical first-answer set grades 30/40 → 75', () => {
  const answers = {};
  mainQs.forEach((q, i) => {
    if (i < 30) answers[q.id] = q.answer;
    else if (typeof q.answer === 'string') answers[q.id] = '__wrong__';
    else {
      const wrong = {};
      Object.keys(q.answer).forEach((k) => {
        wrong[k] = '__wrong__';
      });
      answers[q.id] = wrong;
    }
  });
  const g = gradeSet(mainQs, answers);
  assert.equal(g.correct, 30);
  assert.equal(mainPercent(g.correct, paper.scoring.main.questionCount), 75);
});

test('parking barrier only appears in challenge GC06', () => {
  for (const q of mainQs) {
    const blob = JSON.stringify(q);
    assert.equal(blob.indexOf('升降杆') === -1 && blob.indexOf('停车场') === -1, true, q.id);
  }
  const gc06 = JSON.stringify(byId.GC06);
  assert.ok(gc06.indexOf('升降杆') >= 0);
});

test('client paper strips server-only fields and keeps student fields', () => {
  const client = buildClientPaper(paper);
  assert.equal(client.version, EXPECTED_VERSION);
  assert.equal(client.shell, '控制探秘营·八站通行证');
  assert.equal(client.scoringPublic.mainQuestionCount, 40);
  assert.equal(client.scoringPublic.passLine, null);
  const forbidden = /(?:^|[^A-Za-z0-9_])(G1|G2|G3|K1|K2|D1|S1|E1|I0|M1|remixFrom)(?:[^A-Za-z0-9_]|$)/;
  for (const q of client.questions) {
    for (const field of SERVER_ONLY) {
      assert.equal(q[field], undefined, q.id + ' ' + field);
    }
    const blob = JSON.stringify(q);
    assert.ok(!forbidden.test(blob), q.id + ' leaked forbidden term');
  }
  const gm03 = client.questions.find((q) => q.id === 'GM03');
  assert.equal(gm03.hasRecallImage, false);
  assert.equal(gm03.recallImage, undefined);
  assert.equal(gm03.recallCaption, undefined);
  assert.ok(gm03.stateTable && gm03.stateTable.rows);
  const gm01 = client.questions.find((q) => q.id === 'GM01');
  assert.ok(gm01.recallImage);
  assert.ok(gm01.stateTable);
  const gm15 = client.questions.find((q) => q.id === 'GM15');
  assert.equal(gm15.acceptAlternate, undefined);
  assert.equal(gm15.answer, undefined);
  assert.ok(gm15.cards && gm15.slots);
  const gm17 = client.questions.find((q) => q.id === 'GM17');
  assert.equal(gm17.hasRecallImage, true);
  assert.ok(gm17.diagram);
  const counts = Object.fromEntries(client.stages.map((s) => [s.stageId, s.questionIds.length]));
  assert.deepEqual(counts, {
    gate_l1: 5,
    gate_l2: 5,
    gate_l3: 5,
    gate_l4: 5,
    gate_l5: 5,
    gate_l6: 5,
    gate_l7: 5,
    gate_l8: 5,
    gate_bonus: 6,
  });
  assert.ok(!/正确选项|正确答案/.test(client.stages.map((s) => s.clearFeedback).join('')));
});
