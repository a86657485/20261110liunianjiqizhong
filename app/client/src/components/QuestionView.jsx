import React, { useMemo, useState, useEffect } from 'react';
import RecallPanel from './RecallPanel.jsx';
import StageProgressChip from './StageProgressChip.jsx';
import StateTable from './StateTable.jsx';
import { sanitizeStudentGuide } from '../lib/sanitizeStudentGuide.js';

/**
 * One question per page. Interaction focus must NOT hint the correct option
 * before the student answers (no yellow glow / hand / default selection).
 */

function questionShowsRecall(question) {
  if (!question) return false;
  if (question.hasRecallImage === false) return false;
  return !!(question.recallImage || question.recallCaption || question.recallSceneAnchor);
}

function GuideText({ text }) {
  const shown = sanitizeStudentGuide(text);
  if (!shown) return null;
  return <p className="guide-text">{shown}</p>;
}

function ChoiceOptions({ options, value, onChange }) {
  return (
    <div
      className={'option-list' + ((options || []).length >= 3 ? ' option-list--tiles' : '')}
      role="radiogroup"
    >
      {(options || []).map((opt) => {
        const picked = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={picked}
            className={'option-btn' + (picked ? ' picked' : '')}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function OrderCardsView({ cards, slots, value, onChange, guide }) {
  const mapping = value || {};
  // Do not pre-activate a slot — avoids looking like a default selection.
  const [activeSlot, setActiveSlot] = useState(null);
  const used = new Set(Object.values(mapping));

  function place(card) {
    const target = activeSlot || (slots || []).find((s) => !mapping[s]);
    if (!target) return;
    const next = { ...mapping };
    for (const k of Object.keys(next)) {
      if (next[k] === card) delete next[k];
    }
    next[target] = card;
    onChange(next);
    const idx = (slots || []).indexOf(target);
    const nextEmpty =
      (slots || []).find((s, i) => i > idx && !next[s]) || (slots || []).find((s) => !next[s]);
    setActiveSlot(nextEmpty || null);
  }

  function clearSlot(slot) {
    const next = { ...mapping };
    delete next[slot];
    onChange(next);
    setActiveSlot(slot);
  }

  return (
    <div>
      <GuideText text={guide || '先点下方空位，再点卡片放入。点空位上的内容可清除。'} />
      <div className="slots-row">
        {(slots || []).map((slot) => (
          <button
            key={slot}
            type="button"
            className={'slot-box' + (activeSlot === slot ? ' active' : '')}
            onClick={() => (mapping[slot] ? clearSlot(slot) : setActiveSlot(slot))}
          >
            <div className="muted" style={{ fontSize: '0.75rem' }}>
              {slot}
            </div>
            <div>{mapping[slot] || '（空）'}</div>
          </button>
        ))}
      </div>
      <div className="cards-row">
        {(cards || []).map((card) => (
          <button
            key={card}
            type="button"
            className={'card-chip' + (used.has(card) ? ' used' : '')}
            onClick={() => place(card)}
            disabled={used.has(card)}
          >
            {card}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function QuestionView({
  question,
  value,
  onChange,
  stageName,
  answeredCount,
  questionCount,
  pageIndex,
  pageTotal,
  onPrev,
  onNext,
  onSubmitStage,
  canSubmitStage,
  submitting,
}) {
  const key = (question && (question.interactionSpecKey || question.type)) || '';

  const body = useMemo(() => {
    if (!question) return null;
    const guide = question.guides;
    switch (key) {
      case 'single_choice':
        return (
          <div>
            <GuideText text={guide} />
            <ChoiceOptions
              key={question.id}
              options={question.options}
              value={value}
              onChange={onChange}
            />
          </div>
        );
      case 'flowchart_pick_fix':
        return (
          <div>
            <GuideText text={guide} />
            <ChoiceOptions
              options={question.options || question.cards}
              value={value}
              onChange={onChange}
            />
          </div>
        );
      case 'flowchart_pick_plan':
        return (
          <OrderCardsView
            key={question.id}
            cards={question.cards || question.options}
            slots={question.slots || ['应选择的测试方案']}
            value={typeof value === 'object' && value ? value : {}}
            onChange={onChange}
            guide={guide}
          />
        );
      case 'flowchart_order_cards':
        return (
          <OrderCardsView
            key={question.id}
            cards={question.cards}
            slots={question.slots}
            value={value || {}}
            onChange={onChange}
            guide={guide}
          />
        );
      case 'flowchart_fill_slots':
        return (
          <OrderCardsView
            key={question.id}
            cards={question.cards}
            slots={question.slots}
            value={value || {}}
            onChange={onChange}
            guide={guide}
          />
        );
      default:
        if (question.options) {
          return (
            <div>
              <GuideText text={guide} />
              <ChoiceOptions options={question.options} value={value} onChange={onChange} />
            </div>
          );
        }
        if (question.cards && question.slots) {
          return (
            <OrderCardsView
              cards={question.cards}
              slots={question.slots}
              value={value || {}}
              onChange={onChange}
              guide={guide}
            />
          );
        }
        return <p className="error-box">暂不支持的交互：{key}</p>;
    }
  }, [question, key, value, onChange]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [question && question.id]);

  if (!question) return null;

  const showRecall = questionShowsRecall(question);
  const diagramVisual = question.diagram && question.diagram.visual;
  const diagramNote = question.diagram && question.diagram.note;

  return (
    <div className={'card question-page page-fill' + (showRecall ? '' : ' question-page--no-recall')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <StageProgressChip
          stageName={stageName}
          answeredCount={answeredCount}
          questionCount={questionCount}
        />
        <span className="chip">
          第 {pageIndex + 1}/{pageTotal} 题
        </span>
      </div>
      <div style={{ height: 6 }} />
      <div className={'qa-stack' + (showRecall ? '' : ' qa-stack--no-recall')}>
        {showRecall ? <RecallPanel question={question} /> : null}
        <div className="qa-body">
          <div className="scene-prompt">{question.prompt}</div>
          <StateTable table={question.stateTable} />
          {diagramVisual ? <div className="state-board">{diagramVisual}</div> : null}
          {diagramNote ? (
            <p className="muted" style={{ marginTop: 0 }}>
              {diagramNote}
            </p>
          ) : null}
          <div className="scene-interact">{body}</div>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn-ghost" onClick={onPrev} disabled={pageIndex <= 0}>
          上一题
        </button>
        {pageIndex < pageTotal - 1 ? (
          <button type="button" className="btn-primary" onClick={onNext}>
            下一题
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={onSubmitStage}
            disabled={!canSubmitStage || submitting}
          >
            {submitting ? '提交中…' : '提交本关'}
          </button>
        )}
      </div>
    </div>
  );
}
