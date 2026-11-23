import React from 'react';

/**
 * 题面流程图：只呈现题干信息，不标记正确项，不随作答状态变化。
 * 使用 SVG，随容器等比缩放；字号与线条按 960 宽设计。
 */
const C = {
  ink: '#1f2d3d',
  muted: '#64748b',
  line: '#94a3b8',
  brand: '#0f766e',
  brandSoft: '#ecfdf5',
  warn: '#b45309',
  warnSoft: '#fffbeb',
  white: '#ffffff',
};

function Defs() {
  return (
    <defs>
      <marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={C.line} />
      </marker>
    </defs>
  );
}

function BranchChart({ spec }) {
  return (
    <svg viewBox="0 0 960 260" role="img" aria-label={`流程图：${spec.start}，判断${spec.decision}，是则${spec.yes.text}，否则${spec.no.text}`}>
      <Defs />
      {/* 开始/输入 */}
      <rect x="20" y="98" width="190" height="64" rx="12" fill={C.brandSoft} stroke={C.brand} strokeWidth="2" />
      <text x="115" y="136" textAnchor="middle" fill={C.ink} fontSize="18" fontWeight="700">{spec.start}</text>

      {/* 进入判断 */}
      <line x1="210" y1="130" x2="312" y2="130" stroke={C.line} strokeWidth="2" markerEnd="url(#fc-arrow)" />

      {/* 判断菱形 */}
      <polygon points="320,130 470,48 620,130 470,212" fill={C.warnSoft} stroke={C.warn} strokeWidth="2" />
      <text x="470" y="136" textAnchor="middle" fill={C.ink} fontSize="17" fontWeight="700">{spec.decision}</text>

      {/* 是 / 否 分支 */}
      <path d="M620 130 H690 V52 H712" fill="none" stroke={C.line} strokeWidth="2" markerEnd="url(#fc-arrow)" />
      <path d="M620 130 H690 V208 H712" fill="none" stroke={C.line} strokeWidth="2" markerEnd="url(#fc-arrow)" />

      <rect x="696" y="88" width="30" height="24" rx="6" fill={C.white} />
      <text x="711" y="105" textAnchor="middle" fill={C.ink} fontSize="14" fontWeight="800">{spec.yes.label}</text>
      <rect x="696" y="148" width="30" height="24" rx="6" fill={C.white} />
      <text x="711" y="165" textAnchor="middle" fill={C.ink} fontSize="14" fontWeight="800">{spec.no.label}</text>

      {/* 两个出口 */}
      <rect x="720" y="20" width="200" height="64" rx="12" fill={C.white} stroke={C.line} strokeWidth="2" />
      <text x="820" y="58" textAnchor="middle" fill={C.ink} fontSize="18" fontWeight="700">{spec.yes.text}</text>
      <rect x="720" y="176" width="200" height="64" rx="12" fill={C.white} stroke={C.line} strokeWidth="2" />
      <text x="820" y="214" textAnchor="middle" fill={C.ink} fontSize="18" fontWeight="700">{spec.no.text}</text>
    </svg>
  );
}

function AndGateChart({ spec }) {
  const [a, b] = spec.conditions;
  return (
    <svg viewBox="0 0 780 220" role="img" aria-label={`规则示意：${a}且${b}，才${spec.action}`}>
      <Defs />
      <rect x="20" y="40" width="220" height="56" rx="10" fill={C.white} stroke={C.line} strokeWidth="2" />
      <text x="130" y="75" textAnchor="middle" fill={C.ink} fontSize="17" fontWeight="700">{a}</text>
      <rect x="20" y="148" width="220" height="56" rx="10" fill={C.white} stroke={C.line} strokeWidth="2" />
      <text x="130" y="183" textAnchor="middle" fill={C.ink} fontSize="17" fontWeight="700">{b}</text>

      <path d="M240 68 H300 V104" fill="none" stroke={C.line} strokeWidth="2" />
      <path d="M240 176 H300 V140" fill="none" stroke={C.line} strokeWidth="2" />

      <rect x="300" y="84" width="96" height="72" rx="14" fill={C.warnSoft} stroke={C.warn} strokeWidth="2" />
      <text x="348" y="127" textAnchor="middle" fill={C.warn} fontSize="21" fontWeight="800">{spec.op}</text>

      <line x1="396" y1="120" x2="464" y2="120" stroke={C.line} strokeWidth="2" markerEnd="url(#fc-arrow)" />
      <rect x="470" y="90" width="280" height="60" rx="12" fill={C.brandSoft} stroke={C.brand} strokeWidth="2" />
      <text x="610" y="127" textAnchor="middle" fill={C.ink} fontSize="18" fontWeight="700">{spec.action}</text>
    </svg>
  );
}

export default function FlowchartView({ spec }) {
  if (!spec) return null;
  return (
    <div className="flowchart">
      <div className="flowchart-head">
        <span className="flowchart-badge">{spec.badge || '流程图'}</span>
      </div>
      {spec.kind === 'andGate' ? <AndGateChart spec={spec} /> : <BranchChart spec={spec} />}
    </div>
  );
}
