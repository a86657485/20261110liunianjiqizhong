'use strict';
/**
 * API smoke selftest against an ephemeral DATA_DIR + random port.
 */
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createService } = require('./index.cjs');
const { EXPECTED_VERSION } = require('./paper.cjs');

function req(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://127.0.0.1:' + port,
          Host: '127.0.0.1:' + port,
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

function wrongAnswer(q) {
  if (q.answer && typeof q.answer === 'object') {
    const wrong = {};
    Object.keys(q.answer).forEach((k) => {
      wrong[k] = '__wrong__';
    });
    return wrong;
  }
  return '__wrong__';
}

async function answerStage(port, studentId, stage, fullById, picker) {
  const answers = {};
  for (const qid of stage.questionIds) {
    const q = fullById[qid];
    answers[qid] = picker ? picker(q) : q.answer;
    await req(port, 'POST', '/api/answer', {
      studentId,
      questionId: qid,
      answer: answers[qid],
    });
  }
  return req(port, 'POST', '/api/stage/submit', {
    studentId,
    stageId: stage.stageId,
    answers,
  });
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g6mid-'));
  const svc = createService({ dataDir: tmp });
  const port = 18830 + Math.floor(Math.random() * 200);
  await new Promise((resolve) => svc.server.listen(port, '127.0.0.1', resolve));

  const logs = [];
  function ok(name, cond, detail) {
    logs.push({ name, pass: !!cond, detail: detail || '' });
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
  }

  try {
    const cfg = await req(port, 'GET', '/api/config');
    ok('config version', cfg.json.version === EXPECTED_VERSION, cfg.json.version);
    ok('config mainQuestionCount 40', cfg.json.mainQuestionCount === 40, String(cfg.json.mainQuestionCount));
    ok('config classes 601-606', JSON.stringify(cfg.json.classes) === JSON.stringify(['601', '602', '603', '604', '605', '606']));
    ok('config passLine null', cfg.json.passLine == null);
    ok('config shell', cfg.json.shell === '控制探秘营·八站通行证');

    const paper = await req(port, 'GET', '/api/paper');
    const leaked = (paper.json.questions || []).some(
      (q) =>
        q.answer != null ||
        q.acceptAlternate != null ||
        q.goalIds ||
        q.analysis ||
        q.recallImagePrompt ||
        q.literacy ||
        q.teacherNote
    );
    ok('paper strips server-only fields', !leaked);
    ok('paper version', paper.json.version === EXPECTED_VERSION, paper.json.version);
    ok(
      'paper mainQuestionCount 40',
      paper.json.scoringPublic && paper.json.scoringPublic.mainQuestionCount === 40,
      String(paper.json.scoringPublic && paper.json.scoringPublic.mainQuestionCount)
    );
    const clientMain = (paper.json.questions || []).filter((q) => q.section === 'main');
    const clientCh = (paper.json.questions || []).filter((q) => q.section === 'challenge');
    ok('client paper 40 main + 6 challenge', clientMain.length === 40 && clientCh.length === 6, clientMain.length + '+' + clientCh.length);
    const noRecallOk = clientMain
      .filter((q) => q.hasRecallImage === false)
      .every((q) => !q.recallImage && !q.recallCaption && !q.recallSceneAnchor);
    ok('no-image items have no recall fields', noRecallOk);
    const stageCounts = (paper.json.stages || [])
      .map((s) => s.stageId + ':' + s.questionIds.length)
      .join(',');
    ok(
      'stage sizes 8x5 + bonus 6',
      stageCounts === 'gate_l1:5,gate_l2:5,gate_l3:5,gate_l4:5,gate_l5:5,gate_l6:5,gate_l7:5,gate_l8:5,gate_bonus:6',
      stageCounts
    );

    const roster = await req(port, 'GET', '/api/roster');
    ok('roster has 601', !!(roster.json.classes || []).find((c) => c.id === '601' && c.students.length > 2));
    const s0 = roster.json.classes[0].students[0];
    const s1 = roster.json.classes[0].students[1];
    const s2 = roster.json.classes[0].students[2];
    const s3 = roster.json.classes[0].students[3];

    const login = await req(port, 'POST', '/api/login', { studentId: s0.id });
    ok('login', login.status === 200 && login.json.student.name === s0.name);

    const stages = login.json.paper.stages.filter((s) => s.required);
    ok('eight required stages', stages.length === 8, String(stages.length));
    const full = require('./paper.cjs').loadPaper();
    const fullById = Object.fromEntries(full.questions.map((q) => [q.id, q]));

    // Unlock independent of score: all-wrong stage 1 still unlocks stage 2; persist after "refresh"
    await req(port, 'POST', '/api/login', { studentId: s3.id });
    const wrong1 = await answerStage(port, s3.id, stages[0], fullById, wrongAnswer);
    ok(
      'all-wrong stage1 still clears',
      wrong1.status === 200 && (wrong1.json.progress.stagesCompleted || []).includes('gate_l1'),
      String(wrong1.status)
    );
    ok(
      'all-wrong unlocks stage2 (no score gate)',
      (wrong1.json.progress.unlockedStageIds || []).includes('gate_l2'),
      JSON.stringify(wrong1.json.progress.unlockedStageIds)
    );
    const refreshed = await req(port, 'GET', '/api/state?studentId=' + encodeURIComponent(s3.id));
    ok(
      'refresh persists completed+unlocked',
      (refreshed.json.progress.stagesCompleted || []).includes('gate_l1') &&
        (refreshed.json.progress.unlockedStageIds || []).includes('gate_l2')
    );
    const relogin = await req(port, 'POST', '/api/login', { studentId: s3.id });
    ok(
      'relogin still has stage1 completed',
      (relogin.json.progress.stagesCompleted || []).includes('gate_l1')
    );

    // s0 perfect run of 8 stages
    for (const stage of stages) {
      const sub = await answerStage(port, s0.id, stage, fullById);
      ok(
        'stage ' + stage.stageId,
        sub.status === 200 && typeof sub.json.stageClearFeedback === 'string',
        sub.json.stageClearFeedback
      );
      ok(
        'feedback no answer leak ' + stage.stageId,
        !/正确选项|答案是|应选/.test(sub.json.stageClearFeedback || '')
      );
      const after = await req(port, 'GET', '/api/state?studentId=' + encodeURIComponent(s0.id));
      ok(
        'persist ' + stage.stageId,
        (after.json.progress.stagesCompleted || []).includes(stage.stageId)
      );
    }

    // Challenge-first: must NOT auto-submit main
    await req(port, 'POST', '/api/login', { studentId: s1.id });
    for (const stage of stages) {
      await answerStage(port, s1.id, stage, fullById);
    }
    const beforeCh = (await req(port, 'POST', '/api/login', { studentId: s1.id })).json.progress;
    ok('challenge-first mainReady', !!beforeCh.mainReady);
    ok('challenge-first not yet mainSubmitted', !beforeCh.mainSubmitted && !beforeCh.firstSubmitMain);

    const bonusEarly = full.stages.find((s) => s.stageId === 'gate_bonus');
    const earlyAnswers = {};
    for (const qid of bonusEarly.questionIds) {
      earlyAnswers[qid] = fullById[qid].answer;
      await req(port, 'POST', '/api/answer', {
        studentId: s1.id,
        questionId: qid,
        answer: earlyAnswers[qid],
      });
    }
    const chEarly = await req(port, 'POST', '/api/challenge/submit', {
      studentId: s1.id,
      answers: earlyAnswers,
    });
    ok(
      'challenge-first 6/6 still +10 (cap)',
      chEarly.status === 200 && chEarly.json.bonus === 10 && chEarly.json.correct === 6,
      JSON.stringify({ bonus: chEarly.json.bonus, correct: chEarly.json.correct })
    );
    ok(
      'challenge-first no auto main submit',
      !!(chEarly.json.progress && !chEarly.json.progress.mainSubmitted && !chEarly.json.progress.firstSubmitMain)
    );
    const mainLater = await req(port, 'POST', '/api/main/submit', { studentId: s1.id });
    ok('challenge-first main submit later 100', mainLater.status === 200 && mainLater.json.percent === 100);

    // Typical first-answer percent: 30/40 → 75
    await req(port, 'POST', '/api/login', { studentId: s2.id });
    let typicalLeft = 30;
    for (const stage of stages) {
      await answerStage(port, s2.id, stage, fullById, (q) => {
        if (typicalLeft > 0) {
          typicalLeft -= 1;
          return q.answer;
        }
        return wrongAnswer(q);
      });
    }
    const typMain = await req(port, 'POST', '/api/main/submit', { studentId: s2.id });
    ok(
      'typical first-answer 30/40 → 75',
      typMain.status === 200 && typMain.json.percent === 75 && typMain.json.correct === 30 && typMain.json.total === 40,
      JSON.stringify({ percent: typMain.json.percent, correct: typMain.json.correct, total: typMain.json.total })
    );

    // First-submit lock: fix a previously wrong stage and resubmit; first stays 75, recent rises
    const lastStage = stages[stages.length - 1];
    const flipped = {};
    for (const qid of lastStage.questionIds) flipped[qid] = fullById[qid].answer;
    await req(port, 'POST', '/api/stage/submit', {
      studentId: s2.id,
      stageId: lastStage.stageId,
      answers: flipped,
    });
    const typAgain = await req(port, 'POST', '/api/main/submit', { studentId: s2.id });
    ok(
      'first-submit percent locked at 75',
      typAgain.status === 200 && typAgain.json.percent === 75 && typAgain.json.recentPercent === 88,
      JSON.stringify({ first: typAgain.json.percent, recent: typAgain.json.recentPercent })
    );

    const main = await req(port, 'POST', '/api/main/submit', { studentId: s0.id });
    ok(
      'main submit 40/40 → 100',
      main.status === 200 && main.json.percent === 100 && main.json.total === 40,
      String(main.json.percent) + '/' + String(main.json.total)
    );

    // s0 challenge: 5 correct already hits cap; 6th must not add
    const bonus = full.stages.find((s) => s.stageId === 'gate_bonus');
    const canswers = {};
    bonus.questionIds.forEach((qid, i) => {
      canswers[qid] = i < 5 ? fullById[qid].answer : wrongAnswer(fullById[qid]);
    });
    for (const qid of bonus.questionIds) {
      await req(port, 'POST', '/api/answer', {
        studentId: s0.id,
        questionId: qid,
        answer: canswers[qid],
      });
    }
    const ch5 = await req(port, 'POST', '/api/challenge/submit', {
      studentId: s0.id,
      answers: canswers,
    });
    ok('challenge 5/6 already +10', ch5.status === 200 && ch5.json.bonus === 10 && ch5.json.correct === 5, String(ch5.json.bonus));

    // resubmit all 6 correct: first bonus stays 10
    const allCorrect = {};
    for (const qid of bonus.questionIds) allCorrect[qid] = fullById[qid].answer;
    const ch6 = await req(port, 'POST', '/api/challenge/submit', {
      studentId: s0.id,
      answers: allCorrect,
    });
    ok(
      'challenge first bonus locked at 10 when 6th later correct',
      ch6.status === 200 && ch6.json.bonus === 10,
      JSON.stringify({ first: ch6.json.bonus, recent: ch6.json.recentBonus, correctFirst: ch6.json.correct })
    );

    // GM15 via API: student who only uses acceptAlternate should be counted correct in a dedicated check
    // (already unit-tested; here confirm server grade path via a fresh partial isn't needed)
    const gm15 = fullById.GM15;
    const { gradeOne } = require('./grade.cjs');
    ok('server grade GM15 primary', gradeOne(gm15, gm15.answer).correct);
    ok('server grade GM15 alternate', gradeOne(gm15, gm15.acceptAlternate).correct);

    const teacher = await req(port, 'GET', '/api/teacher?classId=' + (s0.classId || '601'));
    ok('teacher entered', teacher.status === 200 && teacher.json.entered >= 1);
    ok('teacher mainQuestionCount 40', teacher.json.mainQuestionCount === 40, String(teacher.json.mainQuestionCount));
    ok('teacher has literacy diagnostics', !!(teacher.json.diagnostics && teacher.json.diagnostics.byLiteracy));
    const t0 = (teacher.json.students || []).find((s) => s.id === s0.id);
    ok('teacher s0 100 + challenge', t0 && t0.mainPercent === 100 && t0.challengeBonus === 10, t0 && String(t0.mainPercent));
    const t2 = (teacher.json.students || []).find((s) => s.id === s2.id);
    ok('teacher typical 75', t2 && t2.mainPercent === 75, t2 && String(t2.mainPercent));

    const failed = logs.filter((l) => !l.pass);
    console.log('---');
    console.log('passed', logs.length - failed.length, '/', logs.length);
    if (failed.length) process.exitCode = 1;
  } finally {
    svc.server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
