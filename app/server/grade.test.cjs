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
assert.equal(paper.scoring.main.questionCount, 50);
assert.equal(paper.scoring.challenge.questionCount, 6);
assert.equal(paper.scoring.passLine, null);
assert.equal(paperSha256(), EXPECTED_SHA256);
const byId = Object.fromEntries(paper.questions.map((q) => [q.id, q]));
const mainQs = paper.questions.filter((q) => q.section === 'main');
const challengeQs = paper.questions.filter((q) => q.section === 'challenge');
assert.equal(mainQs.length, 50);
assert.equal(challengeQs.length, 6);

test('paper json sha256 locked', () => {
  assert.equal(paperSha256(DESIGN_JSON), '3dff5a296cfd82fd2eb1791ea2ba0b207eaaed0809efa5d3a07d7589fdc12662');
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

test('main percent rounding uses 50', () => {
  assert.equal(mainPercent(50, 50), 100);
  assert.equal(mainPercent(40, 50), 80);
  assert.equal(mainPercent(30, 50), 60);
  assert.equal(mainPercent(25, 50), 50);
  assert.equal(mainPercent(38, 50), 76);
  assert.equal(mainPercent(13, 50), 26);
  assert.equal(mainPercent(0, 50), 0);
});

test('challenge bonus +2, cap +10, sixth does not exceed', () => {
  assert.equal(challengeBonus(1, 2, 10), 2);
  assert.equal(challengeBonus(4, 2, 10), 8);
  assert.equal(challengeBonus(5, 2, 10), 10);
  assert.equal(challengeBonus(6, 2, 10), 10);
});

test('perfect main set grades 50/50 → 100', () => {
  const answers = {};
  for (const q of mainQs) answers[q.id] = q.answer;
  const g = gradeSet(mainQs, answers);
  assert.equal(g.correct, 50);
  assert.equal(g.total, 50);
  assert.equal(mainPercent(g.correct, paper.scoring.main.questionCount), 100);
});

test('typical first-answer set grades 30/50 → 60', () => {
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
  assert.equal(mainPercent(g.correct, paper.scoring.main.questionCount), 60);
});

test('parking barrier only appears in challenge GC06 student-facing text', () => {
  const studentKeys = [
    'prompt',
    'options',
    'guides',
    'cards',
    'slots',
    'left',
    'right',
    'diagram',
    'stateTable',
    'recallCaption',
    'recallSceneAnchor',
    'stageName',
  ];
  for (const q of mainQs) {
    const blob = JSON.stringify(Object.fromEntries(studentKeys.filter((k) => q[k] != null).map((k) => [k, q[k]])));
    assert.equal(blob.indexOf('升降杆') === -1 && blob.indexOf('停车场') === -1, true, q.id);
  }
  const gc06 = JSON.stringify(Object.fromEntries(studentKeys.filter((k) => byId.GC06[k] != null).map((k) => [k, byId.GC06[k]])));
  assert.ok(gc06.indexOf('升降杆') >= 0);
});

test('client paper strips server-only fields and keeps student fields', () => {
  const client = buildClientPaper(paper);
  assert.equal(client.version, EXPECTED_VERSION);
  assert.equal(client.shell, '控制探秘营·八站通行证');
  assert.equal(client.scoringPublic.mainQuestionCount, 50);
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
    gate_l1: 6,
    gate_l2: 6,
    gate_l3: 6,
    gate_l4: 6,
    gate_l5: 7,
    gate_l6: 7,
    gate_l7: 6,
    gate_l8: 6,
    gate_bonus: 6,
  });
  for (const q of client.questions) {
    assert.equal(q.estimatedMinutes, undefined, q.id + ' estimatedMinutes');
  }
  for (const s of client.stages) {
    assert.equal(s.suggestedMinutes, undefined, s.stageId + ' suggestedMinutes');
  }
  assert.ok(!/正确选项|正确答案/.test(client.stages.map((s) => s.clearFeedback).join('')));
});
