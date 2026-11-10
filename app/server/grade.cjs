'use strict';
/**
 * Server-side grading for explorer-camp midterm stages.
 * No answer leakage — only used after submit.
 */

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeMatching(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
  const out = {};
  for (const k of Object.keys(map).sort()) {
    out[k] = map[k];
  }
  return out;
}

function isSlotKey(key) {
  return (
    key === 'flowchart_order_cards' ||
    key === 'flowchart_fill_slots' ||
    key === 'flowchart_fill_triple' ||
    key === 'flowchart_pick_plan' ||
    key === 'matching' ||
    key === 'matching_one_to_one'
  );
}

function gradeOne(question, studentAnswer) {
  const key = question.interactionSpecKey || question.type;
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    return { correct: false, reason: 'empty' };
  }

  switch (key) {
    case 'single_choice':
    case 'flowchart_pick_fix': {
      const ok = String(studentAnswer) === String(question.answer);
      return { correct: ok };
    }
    case 'flowchart_order_cards':
    case 'flowchart_fill_slots':
    case 'flowchart_fill_triple':
    case 'flowchart_pick_plan': {
      const a = normalizeMatching(studentAnswer);
      const primary = normalizeMatching(question.answer);
      if (deepEqual(a, primary)) return { correct: true };
      if (question.acceptAlternate) {
        const alt = normalizeMatching(question.acceptAlternate);
        if (deepEqual(a, alt)) return { correct: true };
      }
      return { correct: false };
    }
    default: {
      if (typeof question.answer === 'string') {
        return { correct: String(studentAnswer) === question.answer };
      }
      const a = normalizeMatching(studentAnswer);
      if (deepEqual(a, normalizeMatching(question.answer))) return { correct: true };
      if (question.acceptAlternate && deepEqual(a, normalizeMatching(question.acceptAlternate))) {
        return { correct: true };
      }
      return { correct: false };
    }
  }
}

function isAnswered(answer, question) {
  if (answer === undefined || answer === null || answer === '') return false;
  const key = (question && (question.interactionSpecKey || question.type)) || '';
  if (isSlotKey(key)) {
    if (typeof answer !== 'object') return false;
    const need = question.left
      ? question.left.length
      : question.slots
        ? question.slots.length
        : 0;
    const filled = Object.keys(answer).filter((k) => answer[k] != null && answer[k] !== '').length;
    return need > 0 ? filled >= need : filled > 0;
  }
  return true;
}

function gradeSet(questions, answersMap) {
  let correct = 0;
  const detail = [];
  for (const q of questions) {
    const ans = answersMap[q.id];
    const g = gradeOne(q, ans);
    if (g.correct) correct += 1;
    detail.push({
      id: q.id,
      correct: !!g.correct,
      lesson: q.lesson,
      type: q.type,
      interactionSpecKey: q.interactionSpecKey || q.type,
      stageId: q.stageId,
      literacy: Array.isArray(q.literacy) ? q.literacy.slice() : q.literacy || [],
    });
  }
  return { correct, total: questions.length, detail };
}

function mainPercent(correctCount, total) {
  if (!total) return 0;
  return Math.round((correctCount / total) * 100);
}

function challengeBonus(correctCount, pointsPer, maxBonus) {
  const raw = correctCount * pointsPer;
  return Math.min(raw, maxBonus);
}

module.exports = {
  gradeOne,
  gradeSet,
  isAnswered,
  mainPercent,
  challengeBonus,
};
