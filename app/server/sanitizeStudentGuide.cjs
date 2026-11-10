'use strict';

/**
 * Strip implementer-only constraints from JSON `guides` before showing them
 * to students. Keep the operation hint (e.g. “点选一个选项后提交”).
 * Does not mutate the question bank.
 */
function sanitizeStudentGuide(text) {
  if (text == null) return '';
  const raw = String(text).trim();
  if (!raw) return '';
  const parts = raw.split(/(?<=[。！？.!?；;])\s*/);
  const kept = [];
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    const mentionsHighlight = /黄框|发光|小手/.test(t);
    const isConstraint = /不要|勿|禁止|未作答前|未放入前/.test(t);
    if (mentionsHighlight && isConstraint) continue;
    kept.push(t);
  }
  return kept.join('').replace(/[；;]+$/g, '。');
}

module.exports = { sanitizeStudentGuide };
