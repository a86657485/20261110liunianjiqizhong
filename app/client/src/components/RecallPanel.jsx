import React from 'react';

/**
 * Upper recall image zone. Sharp image uses object-fit:contain so it is not
 * stretched; a blurred full-bleed copy fills the side/top gaps.
 * Neutral placeholder if the art file is not ready yet.
 */
export default function RecallPanel({ question }) {
  if (!question) return null;
  const caption = question.recallCaption || question.recallSceneAnchor || '回忆当时学习画面';
  const src = question.recallImage;
  const url = src ? '/' + String(src).replace(/^\//, '') : '';

  return (
    <div className="recall-zone">
      {src ? (
        <img className="recall-zone-bleed" src={url} alt="" aria-hidden="true" />
      ) : null}
      {src ? (
        <img
          className="recall-zone-img"
          src={url}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const bleed = e.currentTarget.previousSibling;
            if (bleed && bleed.classList && bleed.classList.contains('recall-zone-bleed')) {
              bleed.style.display = 'none';
            }
            const ph = e.currentTarget.nextSibling;
            if (ph) ph.style.display = 'flex';
          }}
        />
      ) : null}
      <div
        className="recall-zone-placeholder"
        style={{ display: src ? 'none' : 'flex' }}
        aria-hidden={!!src}
      >
        {question.recallSceneAnchor || '探秘营回忆画板（插图稍后接入）'}
      </div>
      <div className="recall-zone-caption">{caption}</div>
    </div>
  );
}
