import { useState } from 'react';
import './QuickAddButtons.css';

const PRESETS = [
  { label: '0:30', seconds: 30 },
  { label: '1:00', seconds: 60 },
  { label: '1:30', seconds: 90 },
  { label: '2:00', seconds: 120 },
  { label: '3:00', seconds: 180 },
];

export default function QuickAddButtons({ onQuickAdd, disabled }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

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
      setShowCustom(false);
      setCustomValue('');
    }
  }

  return (
    <div className="quick-add-section">
      <div className="quick-add-buttons">
        {PRESETS.map(({ label, seconds }) => (
          <button
            key={label}
            className="quick-add-btn"
            onClick={() => onQuickAdd(seconds)}
            disabled={disabled}
          >
            {label}
          </button>
        ))}
        <button
          className="quick-add-btn quick-add-plus"
          onClick={() => setShowCustom(!showCustom)}
          disabled={disabled}
        >
          +
        </button>
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
          />
          <button type="submit" className="custom-time-submit">GO</button>
        </form>
      )}
    </div>
  );
}
