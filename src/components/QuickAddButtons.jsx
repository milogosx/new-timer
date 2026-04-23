import { memo, useState } from 'react';
import './QuickAddButtons.css';

const PRESETS = [
  { label: '0:30', seconds: 30 },
  { label: '1:00', seconds: 60 },
  { label: '1:30', seconds: 90 },
  { label: '2:00', seconds: 120 },
  { label: '3:00', seconds: 180 },
];

function QuickAddButtons({ onQuickAdd, disabled, hidden = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  if (hidden) {
    return <div className="quick-add-inline quick-add-hidden" aria-hidden="true" />;
  }

  function handleCustomSubmit(e) {
    e.preventDefault();
    const val = customValue.trim();
    if (!val) return;

    let seconds = 0;
    if (val.includes(':')) {
      const [min, sec] = val.split(':').map(Number);
      seconds = (min || 0) * 60 + (sec || 0);
    } else {
      seconds = parseInt(val, 10);
    }

    if (seconds > 0) {
      onQuickAdd(seconds);
      setIsExpanded(false);
      setShowCustom(false);
      setCustomValue('');
    }
  }

  return (
    <div className="quick-add-inline">
      <button
        type="button"
        className={`quick-add-trigger ${isExpanded ? 'is-open' : ''}`}
        onClick={() => {
          setIsExpanded((prev) => {
            const next = !prev;
            if (!next) {
              setShowCustom(false);
              setCustomValue('');
            }
            return next;
          });
        }}
        aria-label={isExpanded ? 'Hide quick add options' : 'Show quick add options'}
        aria-expanded={isExpanded}
        disabled={disabled}
      >
        +
      </button>

      {isExpanded && !disabled && (
        <>
          <div className="quick-add-panel">
            <div className="quick-add-buttons">
              {PRESETS.map(({ label, seconds }) => (
                <button
                  key={label}
                  className="quick-add-btn"
                  onClick={() => {
                    onQuickAdd(seconds);
                    setIsExpanded(false);
                    setShowCustom(false);
                    setCustomValue('');
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                className="quick-add-btn quick-add-plus"
                onClick={() => setShowCustom((prev) => !prev)}
              >
                +
              </button>
            </div>
          </div>

          {showCustom && (
            <form className="custom-time-form" onSubmit={handleCustomSubmit}>
              <input
                type="text"
                className="custom-time-input"
                placeholder="e.g. 2:45 or 90"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                autoFocus
                disabled={disabled}
              />
              <button type="submit" className="custom-time-submit" disabled={disabled}>GO</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default memo(QuickAddButtons);
