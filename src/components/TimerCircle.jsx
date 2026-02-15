import { memo } from 'react';
import { formatTime } from '../utils/timerLogic';
import AmbientEcgPulse from './AmbientEcgPulse';
import './TimerCircle.css';

const CIRCLE_COLORS = {
  black: '#4DD0E1', // Idle/Interval A: Cyan
  teal: '#FF2D78',  // Interval B: Pink/Red (matches resume button)
  rest: '#00897B',  // Rest: Teal
};

function TimerCircle({
  remainingSeconds,
  circleColor,
  progress,
  countdownNumber,
  timerMode, // 'idle' | 'running' | 'rest'
  suppressAmbientEffects = false,
}) {
  const bgColor = CIRCLE_COLORS[circleColor] || CIRCLE_COLORS.black;
  const textColor = '#FFFFFF';

  // SVG circle progress
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  // Fallback to 0 if progress is NaN
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const strokeDashoffset = circumference * (1 - safeProgress);

  // Mode class for ring color
  const modeClass = timerMode === 'rest' ? 'mode-rest' : timerMode === 'idle' ? 'mode-idle' : 'mode-running';
  const wrapperClass = `timer-circle-wrapper ${modeClass}${suppressAmbientEffects ? ' effects-static' : ''}`;

  return (
    <div className={wrapperClass}>
      {/* ECG pulse behind the timer */}
      {!suppressAmbientEffects && (
        <div className="timer-ecg-bg">
          <AmbientEcgPulse />
        </div>
      )}

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
            <span className="countdown-number" style={{ color: textColor }}>
              {countdownNumber}
            </span>
          ) : (
            <span
              className="timer-display"
              style={{ color: textColor }}
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
