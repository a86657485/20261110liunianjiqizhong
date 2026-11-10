'use strict';
/**
 * Load midterm paper (v1.0.1) and strip server-only fields for students.
 */
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_VERSION = '2026-11-10-g6-midterm-v1.0.1';
const EXPECTED_SHA256 = '512d9975f0afd2191b8e43358c05cc874fbb03c8321fc88e86a65ec507f48095';

const DESIGN_JSON =
  process.env.PAPER_JSON ||
  path.join(__dirname, '..', '..', 'design', '01_questions.json');

const CLIENT_ALLOW = new Set([
  'id',
  'section',
  'type',
  'lesson',
  'lessonTitle',
  'prompt',
  'options',
  'left',
  'right',
  'slots',
  'cards',
  'diagram',
  'stateTable',
  'appRef',
  'interactionSpecKey',
  'guides',
  'estimatedMinutes',
  'stage',
  'stageId',
  'stageName',
  'hasRecallImage',
  'recallSceneAnchor',
  'recallCaption',
  'recallImage',
  'recallImageMaxWidthPx',
  'recallImageAnimated',
]);

const SERVER_ONLY = new Set([
  'answer',
  'accept',
  'acceptAlternate',
  'analysis',
  'misconceptionMap',
  'literacy',
  'ctTags',
  'soloLevel',
  'difficultyEstimate',
  'remixFrom',
  'sourceId',
  'remixNote',
  'reverseDebug',
  'teacherNote',
  'goalIds',
  'examPoint',
  'whyInSyllabus',
  'recallImagePrompt',
  'recallImageMotionNote',
  'recallListItem',
  'recallStillPath',
  'recallStillNote',
]);

const RECALL_FIELDS = [
  'recallSceneAnchor',
  'recallCaption',
  'recallImage',
  'recallImageMaxWidthPx',
  'recallImageAnimated',
];

function loadPaper() {
  const rawText = fs.readFileSync(DESIGN_JSON, 'utf8');
  const raw = JSON.parse(rawText);
  if (raw.version !== EXPECTED_VERSION) {
    console.warn('[paper] unexpected version:', raw.version);
  }
  return raw;
}

function paperSha256(filePath) {
  const { createHash } = require('node:crypto');
  const buf = fs.readFileSync(filePath || DESIGN_JSON);
  return createHash('sha256').update(buf).digest('hex');
}

function clientQuestion(q) {
  const out = {};
  for (const key of CLIENT_ALLOW) {
    if (!Object.prototype.hasOwnProperty.call(q, key) || q[key] === undefined) continue;
    if (key === 'options' && q[key] == null) continue;
    out[key] = q[key];
  }
  if (q.hasRecallImage === false) {
    for (const key of RECALL_FIELDS) delete out[key];
  }
  for (const key of SERVER_ONLY) {
    if (Object.prototype.hasOwnProperty.call(out, key)) delete out[key];
  }
  return out;
}

function publicStages(stages) {
  return (stages || []).map((s) => ({
    order: s.order,
    stage: s.stage,
    stageId: s.stageId,
    stageName: s.stageName,
    lesson: s.lesson,
    lessonTitle: s.lessonTitle || undefined,
    questionIds: s.questionIds.slice(),
    suggestedMinutes: s.suggestedMinutes,
    unlockRule: s.unlockRule,
    clearFeedback: s.clearFeedback,
    required: !!s.required,
    skippable: !!s.skippable,
    bonusOnly: !!s.bonusOnly,
  }));
}

function buildClientPaper(paper) {
  return {
    version: paper.version,
    shell: paper.shell,
    paperType: paper.paperType,
    scoringPublic: {
      mode: paper.scoring.mode,
      passLine: paper.scoring.passLine,
      mainFullScore: paper.scoring.main.fullScore,
      mainQuestionCount: paper.scoring.main.questionCount,
      challengePointsPerCorrect: paper.scoring.challengePointsPerCorrect,
      challengeMaxBonus: paper.scoring.challengeMaxBonus,
      stageUnlockIndependentOfScore: paper.scoring.stageUnlockIndependentOfScore,
    },
    stages: publicStages(paper.stages),
    questions: paper.questions.map(clientQuestion),
  };
}

module.exports = {
  DESIGN_JSON,
  EXPECTED_VERSION,
  EXPECTED_SHA256,
  SERVER_ONLY,
  loadPaper,
  clientQuestion,
  buildClientPaper,
  publicStages,
  paperSha256,
};
