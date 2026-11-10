import React from 'react';
import StageNode from './StageNode.jsx';

export default function ExplorerCampMap({
  stageProgress,
  onEnter,
  onSubmitMain,
  mainReady,
  mainSubmitted,
}) {
  const mainNodes = (stageProgress || []).filter((n) => n.required !== false);
  const bonusNodes = (stageProgress || []).filter((n) => n.required === false);
  return (
    <div className="map-page page-fill">
      <div className="card map-intro">
        <h2>探秘营站点地图 · 八站通行证</h2>
        <p className="muted" style={{ margin: 0 }}>
          一站接一站闯关。本关题全部作答提交即可解锁下一站（不因分数卡关）。主卷 40
          题，建议用时约 35 分钟。到时不强制锁死交卷。
        </p>
      </div>
      <div className="camp-trail">
        <div className="carnival-map explorer-map">
          {mainNodes.map((n) => (
            <StageNode key={n.stageId} node={n} onEnter={onEnter} />
          ))}
        </div>
        {bonusNodes.length ? (
          <div className="bonus-row">
            {bonusNodes.map((n) => (
              <StageNode key={n.stageId} node={n} onEnter={onEnter} />
            ))}
          </div>
        ) : null}
      </div>
      {mainReady ? (
        <div>
          {!mainSubmitted ? (
            <p className="muted" style={{ margin: '8px 0 0' }}>
              八站已齐：可先交主卷看百分，也可先点「加分挑战关」。进挑战不会自动交主卷。
            </p>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn-primary" onClick={onSubmitMain} disabled={mainSubmitted}>
              {mainSubmitted ? '主卷已交卷' : '提交主卷 · 查看百分'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
