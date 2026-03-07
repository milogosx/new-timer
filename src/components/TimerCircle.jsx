import { memo } from 'react';
import { formatTime } from '../utils/timerLogic';
import './TimerCircle.css';

const CIRCLE_COLORS = {
  black: '#4DD0E1', // Idle/Interval A: Cyan
  teal: '#FF2D78',  // Interval B: Pink/Red (matches resume button)
  rest: '#00897B',  // Rest: Teal
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

  // SVG circle progress
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const strokeDashoffset = circumference * (1 - safeProgress);

  const modeClass = MODE_CLASS_MAP[timerMode] || 'mode-running';

  return (
    <div className={`timer-circle-wrapper ${modeClass}`}>
      <div className="timer-circle-border">
        <svg className="progress-ring" viewBox="0 0 320 320">
          {/* Background track */}
          <circle
            className="progress-ring-bg"
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            className="progress-ring-fill"
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 160 160)"
          />
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
