import { memo } from 'react';
import { formatTime } from '../utils/timerLogic';
import './TimerCircle.css';

const CIRCLE_COLORS = {
  black: 'transparent',
  teal: 'rgba(255, 107, 26, 0.04)',
  rest: 'rgba(77, 208, 225, 0.04)',
};

const MODE_CLASS_MAP = { rest: 'mode-rest', idle: 'mode-idle' };

function TimerCircle({
  remainingSeconds,
  circleColor,
  progress,
  countdownNumber,
  timerMode, // 'idle' | 'running' | 'rest'
}) {
  const bgColor = CIRCLE_COLORS[circleColor] || CIRCLE_COLORS.black;

  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const modeClass = MODE_CLASS_MAP[timerMode] || 'mode-running';

  // Segmented bar gauge — 60 trapezoidal segments forming a thick ring
  const segCount = 60;
  const segInner = 118;
  const segOuter = 140;
  const gapDeg = 0.8;
  const segments = [];
  const elapsedSegs = Math.round(safeProgress * segCount);
  for (let i = 0; i < segCount; i++) {
    const a0 = (i / segCount) * 360 - 90 + gapDeg / 2;
    const a1 = ((i + 1) / segCount) * 360 - 90 - gapDeg / 2;
    const r0 = (a0 * Math.PI) / 180;
    const r1 = (a1 * Math.PI) / 180;
    const x0o = 160 + Math.cos(r0) * segOuter;
    const y0o = 160 + Math.sin(r0) * segOuter;
    const x1o = 160 + Math.cos(r1) * segOuter;
    const y1o = 160 + Math.sin(r1) * segOuter;
    const x1i = 160 + Math.cos(r1) * segInner;
    const y1i = 160 + Math.sin(r1) * segInner;
    const x0i = 160 + Math.cos(r0) * segInner;
    const y0i = 160 + Math.sin(r0) * segInner;
    const isElapsed = i < elapsedSegs;
    const d = `M ${x0o} ${y0o} A ${segOuter} ${segOuter} 0 0 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${segInner} ${segInner} 0 0 0 ${x0i} ${y0i} Z`;
    segments.push(
      <path
        key={`s${i}`}
        d={d}
        fill={isElapsed ? 'url(#workoutAmberSeg)' : '#1E2128'}
        stroke={isElapsed ? 'rgba(255,140,60,0.8)' : 'rgba(255,255,255,0.04)'}
        strokeWidth={isElapsed ? 0.5 : 0.5}
        style={isElapsed ? { filter: 'drop-shadow(0 0 3px rgba(255,107,26,0.55))' } : undefined}
      />
    );
  }
  const labels = [
    { n: '0', x: 160, y: 100 },
    { n: '15', x: 260, y: 160 },
    { n: '30', x: 160, y: 220 },
    { n: '45', x: 60, y: 160 },
  ].map((l) => (
    <text
      key={`l${l.n}`}
      x={l.x}
      y={l.y}
      fill="rgba(255,255,255,0.55)"
      fontFamily="Orbitron, monospace"
      fontSize="13"
      fontWeight="500"
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {l.n}
    </text>
  ));

  return (
    <div className={`timer-circle-wrapper ${modeClass}`}>
      <div className="timer-circle-border">
        <svg className="progress-ring" viewBox="0 0 320 320">
          <defs>
            <linearGradient id="workoutAmberSeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF9A4F" />
              <stop offset="100%" stopColor="#CC4E0A" />
            </linearGradient>
          </defs>
          {segments}
          {labels}
        </svg>

        <div
          className="timer-circle-inner"
          style={{ backgroundColor: bgColor }}
        >
          {countdownNumber !== null ? (
            <span className="countdown-number" style={{ color: '#FFFFFF' }}>
              {countdownNumber}
            </span>
          ) : (
            <span
              className="timer-display"
              style={{ color: '#FFFFFF' }}
            >
              {formatTime(remainingSeconds || 0)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TimerCircle);
