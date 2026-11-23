import React, { Fragment, useMemo, useState, useEffect } from 'react';
import RecallPanel from './RecallPanel.jsx';
import StageProgressChip from './StageProgressChip.jsx';
import StateTable from './StateTable.jsx';
import FlowchartView from './FlowchartView.jsx';
import { FLOWCHARTS } from '../lib/flowchartSpecs.js';
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

function ChoiceOptions({ options, value, onChange, disabled }) {
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
            disabled={disabled}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function OrderCardsView({ cards, slots, value, onChange, guide, disabled }) {
  const mapping = value || {};
  // Do not pre-activate a slot — avoids looking like a default selection.
  const [activeSlot, setActiveSlot] = useState(null);
  const used = new Set(Object.values(mapping));

  function place(card) {
    if (disabled) return;
    const next = { ...mapping };
    const currentSlot = Object.keys(next).find((k) => next[k] === card);
    let target = activeSlot || (slots || []).find((s) => !next[s]);
    if (!target) {
      // All slots filled and none selected.
      if (currentSlot) {
        delete next[currentSlot];
        onChange(next);
        setActiveSlot(currentSlot);
        return;
      }
      // One-slot items (e.g. GC05): clicking another card replaces the current one,
      // so the student is not stuck with the first pick.
      if ((slots || []).length === 1) {
        target = slots[0];
      } else {
        return;
      }
    }
    if (currentSlot) delete next[currentSlot];
    next[target] = card;
    onChange(next);
    const idx = (slots || []).indexOf(target);
    const nextEmpty =
      (slots || []).find((s, i) => i > idx && !next[s]) || (slots || []).find((s) => !next[s]);
    setActiveSlot(nextEmpty || null);
  }

  function clearSlot(slot) {
    if (disabled) return;
    const next = { ...mapping };
    delete next[slot];
    onChange(next);
    setActiveSlot(slot);
  }

  function onSlotClick(slot) {
    if (disabled) return;
    if (activeSlot === slot && mapping[slot]) {
      clearSlot(slot);
      return;
    }
    setActiveSlot(slot);
  }

  return (
    <div>
      <GuideText text={guide || '先点下方空位，再点卡片放入。点空位上的内容可清除。'} />
      <p className="muted slot-hint">点空位再点卡片放入；再点已放入的空位可取出，也可点已放入的卡片改放。</p>
      <div className={'slots-row' + ((slots || []).length > 1 ? ' slots-row--flow' : '')}>
        {(slots || []).map((slot, i) => (
          <Fragment key={slot}>
            <button
              type="button"
              className={'slot-box' + (activeSlot === slot ? ' active' : '')}
              disabled={disabled}
              onClick={() => onSlotClick(slot)}
            >
              <div className="muted" style={{ fontSize: '0.75rem' }}>
                {slot}
              </div>
              <div>{mapping[slot] || '（空）'}</div>
            </button>
            {i < (slots || []).length - 1 ? (
              <span className="flow-arrow" aria-hidden="true">→</span>
            ) : null}
          </Fragment>
        ))}
      </div>
      <div className="cards-row">
        {(cards || []).map((card) => (
          <button
            key={card}
            type="button"
            className={'card-chip' + (used.has(card) ? ' used' : '')}
            disabled={disabled}
            onClick={() => place(card)}
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
  onJump,
  onBackMap,
  answeredFlags,
  onSubmitStage,
  canSubmitStage,
  submitting,
  locked,
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
              disabled={locked}
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
              disabled={locked}
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
            disabled={locked}
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
            disabled={locked}
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
            disabled={locked}
          />
        );
      default:
        if (question.options) {
          return (
            <div>
              <GuideText text={guide} />
              <ChoiceOptions
                options={question.options}
                value={value}
                onChange={onChange}
                disabled={locked}
              />
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
              disabled={locked}
            />
          );
        }
        return <p className="error-box">暂不支持的交互：{key}</p>;
    }
  }, [question, key, value, onChange, locked]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [question && question.id]);

  if (!question) return null;

  const showRecall = questionShowsRecall(question);
  const flowSpec = FLOWCHARTS[question.id];
  const diagramVisual = question.diagram && question.diagram.visual;
  const flowSlots = key === 'flowchart_fill_slots' || key === 'flowchart_order_cards' || key === 'flowchart_pick_plan';
  const diagramNote = sanitizeStudentGuide(question.diagram && question.diagram.note);

  return (
    <div className={'card question-page page-fill' + (showRecall ? '' : ' question-page--no-recall')}>
      <div className="stage-toolbar">
        <button type="button" className="btn-ghost" onClick={onBackMap}>
          回到探秘营地图
        </button>
        <StageProgressChip
          stageName={stageName}
          answeredCount={answeredCount}
          questionCount={questionCount}
        />
        <div className="q-jump" role="navigation" aria-label="本关题目">
          {Array.from({ length: pageTotal }, (_, i) => (
            <button
              key={i}
              type="button"
              className={
                'q-jump-btn' +
                (i === pageIndex ? ' current' : '') +
                (answeredFlags && answeredFlags[i] ? ' done' : '')
              }
              onClick={() => onJump && onJump(i)}
              aria-current={i === pageIndex ? 'page' : undefined}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 6 }} />
      <div className={'qa-stack' + (showRecall ? '' : ' qa-stack--no-recall')}>
        {showRecall ? <RecallPanel question={question} /> : null}
        <div className="qa-body">
          <div className="scene-prompt">{question.prompt}</div>
          {flowSpec ? null : <StateTable table={question.stateTable} />}
          {flowSpec ? <FlowchartView spec={flowSpec} /> : null}
          {!flowSpec && diagramVisual && !flowSlots ? <div className="state-board">{diagramVisual}</div> : null}
          {diagramNote ? (
            <p className="muted" style={{ marginTop: 0 }}>
              {diagramNote}
            </p>
          ) : null}
          <div className="scene-interact">{body}</div>
        </div>
      </div>
      {locked ? (
        <p className="error-box" style={{ margin: '0 0 6px' }}>
          本卷已交卷，不能再次作答；可查看题目，但不能修改答案。
        </p>
      ) : answeredCount < questionCount ? (
        <p className="muted" style={{ margin: '0 0 6px' }}>
          本关还有 {questionCount - answeredCount} 题未作答，未答按答错计；可直接提交，也可回到探秘营地图。
        </p>
      ) : null}
      <div className="btn-row">
        <button type="button" className="btn-ghost" onClick={onPrev} disabled={pageIndex <= 0}>
          上一题
        </button>
        {pageIndex < pageTotal - 1 ? (
          <button type="button" className="btn-primary" onClick={onNext}>
            下一题
          </button>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          onClick={onSubmitStage}
          disabled={!canSubmitStage || submitting || locked}
        >
          {submitting ? '提交中…' : '提交本关'}
        </button>
      </div>
    </div>
  );
}
