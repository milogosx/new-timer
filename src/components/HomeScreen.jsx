import { useState } from 'react';
import { loadSettings, normalizeSettings, saveSettings } from '../utils/storage';
import { loadWorkouts } from '../utils/workoutStorage';
import { sortWorkouts } from '../utils/workoutReadModels';
import './HomeScreen.css';

const TYPE_LABELS = {
  strength: 'STRENGTH',
  cardio: 'CARDIO',
  mobility: 'MOBILITY',
  hiit: 'HIIT',
  other: 'OTHER',
};

const MAX_VISIBLE_WORKOUTS = 4;
const SETTINGS_PRESET_OPTIONS = [
  {
    key: 'workoutDefaults',
    label: 'WORKOUT',
    helperText: 'Used when you tap a saved workout.',
  },
  {
    key: 'timerOnlyDefaults',
    label: 'TIMER ONLY',
    helperText: 'Used when you launch Timer Only from Home.',
  },
];

function toDraftPreset(preset) {
  return {
    sessionMinutes: String(preset.sessionMinutes),
    intervalSeconds: String(preset.intervalSeconds),
  };
}

function toDraftSettings(settings) {
  return {
    workoutDefaults: toDraftPreset(settings.workoutDefaults),
    timerOnlyDefaults: toDraftPreset(settings.timerOnlyDefaults),
  };
}

function sanitizeNumericInput(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 3);
}

function SessionSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="settings-toggle-glyph">
      <rect x="4" y="5" width="16" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 9.5H20" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.25V6.25M16 3.25V6.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WorkoutTypeIcon({ type }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (type) {
    case 'cardio':
      return (
        <svg {...common}><path d="M3 12h3l2-5 4 10 2-5h2" /><path d="M17 12h4" /></svg>
      );
    case 'mobility':
      return (
        <svg {...common}><path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></svg>
      );
    case 'hiit':
      return (
        <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg>
      );
    case 'strength':
      return (
        <svg {...common}><line x1="6" y1="18" x2="6" y2="10" /><line x1="12" y1="18" x2="12" y2="6" /><line x1="18" y1="18" x2="18" y2="14" /></svg>
      );
    default:
      return (
        <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /></svg>
      );
  }
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function HeroGauge() {
  // Gauge: brushed dark bezel (top-left) + amber arc glow (right side, 12 -> 6 o'clock)
  return (
    <svg className="home-hero-gauge" viewBox="0 0 400 400" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="heroAmberArc" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF8C3F" stopOpacity="1" />
          <stop offset="60%" stopColor="#FF6B1A" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#B03D00" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="heroBezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A3D44" />
          <stop offset="50%" stopColor="#1F2126" />
          <stop offset="100%" stopColor="#0D0E12" />
        </linearGradient>
        <filter id="heroArcGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* thick dark brushed bezel — full circle */}
      <circle cx="200" cy="200" r="162" stroke="url(#heroBezel)" strokeWidth="18" />
      {/* inner highlight */}
      <circle cx="200" cy="200" r="152" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      {/* amber arc — RIGHT HALF only, from top (12) clockwise to bottom (6) */}
      <path
        d="M 200 38 A 162 162 0 0 1 200 362"
        stroke="url(#heroAmberArc)"
        strokeWidth="5"
        strokeLinecap="round"
        filter="url(#heroArcGlow)"
      />
      {/* amber glow core on right side */}
      <path
        d="M 200 38 A 162 162 0 0 1 200 362"
        stroke="#FF6B1A"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* pointer triangle at 12 o'clock */}
      <path d="M 200 22 L 194 38 L 206 38 Z" fill="#FF6B1A" />
    </svg>
  );
}

function IconWaves() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></svg>; }
function IconBolt() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg>; }
function IconBars() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><line x1="6" y1="19" x2="6" y2="11" /><line x1="12" y1="19" x2="12" y2="6" /><line x1="18" y1="19" x2="18" y2="14" /></svg>; }
function IconHeart() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /><path d="M8 12h2l1.5-2 1 3 1.5-2H16" /></svg>; }

function pickIconForWorkout(workout) {
  const name = (workout.name || '').toLowerCase();
  if (workout.type === 'cardio' || /engine|run|row|bike|cycle/.test(name)) return <IconHeart />;
  if (/pull|push|power|bolt|hiit|snatch|clean|jerk/.test(name) || workout.type === 'hiit') return <IconBolt />;
  if (/flow|mobility|stretch|prime|yoga/.test(name) || workout.type === 'mobility') return <IconWaves />;
  if (workout.type === 'strength') return <IconBars />;
  return <IconBars />;
}

export default function HomeScreen({
  onStartTimer,
  onManageWorkouts,
  onCreateWorkout,
  theme,
  onToggleTheme,
}) {
  const [settingsDraft, setSettingsDraft] = useState(() => toDraftSettings(loadSettings()));
  const [activePresetKey, setActivePresetKey] = useState('workoutDefaults');
  const [workouts] = useState(() => sortWorkouts(loadWorkouts()));
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function getSanitizedSettings(source = settingsDraft) {
    return normalizeSettings(source);
  }

  function commitSettings(source = settingsDraft) {
    const nextSettings = getSanitizedSettings(source);
    saveSettings(nextSettings);
    setSettingsDraft(toDraftSettings(nextSettings));
    return nextSettings;
  }

  function updateActivePresetField(field, value) {
    setSettingsDraft((previous) => ({
      ...previous,
      [activePresetKey]: {
        ...previous[activePresetKey],
        [field]: sanitizeNumericInput(value),
      },
    }));
  }

  function handleSettingsToggle() {
    if (settingsOpen) {
      commitSettings();
    }
    setSettingsOpen(!settingsOpen);
  }

  function handlePresetSwitch(nextPresetKey) {
    if (nextPresetKey === activePresetKey) return;
    commitSettings();
    setActivePresetKey(nextPresetKey);
  }

  function handleNumericInputFocus(event) {
    const input = event.currentTarget;
    window.requestAnimationFrame(() => {
      input.select();
    });
  }

  // One-tap start: tap a workout card → go straight to timer
  function handleWorkoutTap(workout) {
    const nextSettings = commitSettings();
    onStartTimer(
      nextSettings.workoutDefaults.sessionMinutes,
      nextSettings.workoutDefaults.intervalSeconds,
      workout,
    );
  }

  // Timer Only mode
  function handleTimerOnly() {
    const nextSettings = commitSettings();
    onStartTimer(
      nextSettings.timerOnlyDefaults.sessionMinutes,
      nextSettings.timerOnlyDefaults.intervalSeconds,
      null,
    );
  }

  const visibleWorkouts = showAllWorkouts ? workouts : workouts.slice(0, MAX_VISIBLE_WORKOUTS);
  const hasOverflow = workouts.length > MAX_VISIBLE_WORKOUTS;
  const normalizedSettings = getSanitizedSettings();
  const activePreset = settingsDraft[activePresetKey];
  const activePresetSummary = normalizedSettings[activePresetKey];
  const timerOnlySummary = normalizedSettings.timerOnlyDefaults;
  const activePresetMeta = SETTINGS_PRESET_OPTIONS.find((option) => option.key === activePresetKey)
    ?? SETTINGS_PRESET_OPTIONS[0];
  const activePresetDomId = activePresetKey === 'workoutDefaults' ? 'workout' : 'timer-only';

  return (
    <div className="home-screen">
      {/* 1. Hero Header — gauge-ring wordmark */}
      <header className="home-hero">
        <button
          className="home-hero-settings"
          onClick={handleSettingsToggle}
          type="button"
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <span className="home-hero-sub">ELITE RECOMPOSITION</span>
        <div className="home-hero-wordmark">
          <HeroGauge />
          <div className="home-hero-titles">
            <span className="home-hero-title home-hero-title-top">WORKOUT</span>
            <span className="home-hero-title home-hero-title-bottom">TIMER</span>
          </div>
        </div>
      </header>

      {/* 2. Workout Selection */}
      <div className="workout-section">
        <div className="workout-section-header">
          <h2 className="workout-section-title">YOUR WORKOUTS</h2>
          <button className="workout-manage-btn" onClick={onManageWorkouts} title="Manage Workouts">
            EDIT
          </button>
        </div>

        <div className="workout-cards">
          {visibleWorkouts.map((workout) => (
            <button
              key={workout.id}
              className={`workout-card ${workout.pinned ? 'is-pinned' : ''}`}
              onClick={() => handleWorkoutTap(workout)}
            >
              <span className="workout-card-icon">
                {pickIconForWorkout(workout)}
              </span>
              <span className="workout-card-name">{workout.name}</span>
              <span className="workout-card-type">{TYPE_LABELS[workout.type] || 'OTHER'}</span>
              <span className="workout-card-chev"><ChevronRight /></span>
            </button>
          ))}
        </div>

        {hasOverflow && (
          <button className="workout-show-more" onClick={() => setShowAllWorkouts(!showAllWorkouts)}>
            {showAllWorkouts ? 'SHOW LESS' : `+${workouts.length - MAX_VISIBLE_WORKOUTS} MORE`}
          </button>
        )}

        {/* Create New Workout */}
        <button className="workout-create-btn" onClick={onCreateWorkout}>
          + CREATE NEW WORKOUT
        </button>

        <button className="home-timer-only-launch home-row-btn" onClick={handleTimerOnly} type="button">
          <span className="home-row-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9V13L14.6 15.6" />
              <path d="M9.5 2.5H14.5" />
              <path d="M12 2.5V4.5" />
            </svg>
          </span>
          <span className="home-row-label">TIMER ONLY</span>
          <span className="home-row-summary">
            {timerOnlySummary.sessionMinutes} MIN <span className="home-row-summary-dot">·</span> {timerOnlySummary.intervalSeconds} SEC
          </span>
          <span className="home-row-chev"><ChevronRight /></span>
        </button>

        {/* Session Settings — directly after create button */}
        <div className={`settings-compact ${settingsOpen ? 'settings-open' : ''}`}>
          <button
            className="settings-toggle-bar home-row-btn"
            onClick={handleSettingsToggle}
            type="button"
            aria-expanded={settingsOpen}
          >
            <span className="home-row-icon">
              <SessionSettingsIcon />
            </span>
            <span className="home-row-label">SESSION</span>
            <span className="home-row-summary">
              {activePresetSummary.sessionMinutes} MIN <span className="home-row-summary-dot">·</span> {activePresetSummary.intervalSeconds} SEC
            </span>
            <span className="home-row-chev">{settingsOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15" /></svg>
            ) : <ChevronRight />}</span>
          </button>

          {settingsOpen && (
            <div className="settings-expanded">
              <div className="settings-expanded-top">
                <div className="settings-preset-switch" role="group" aria-label="Session defaults">
                  {SETTINGS_PRESET_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`settings-preset-btn${activePresetKey === option.key ? ' is-active' : ''}`}
                      onClick={() => handlePresetSwitch(option.key)}
                      aria-pressed={activePresetKey === option.key}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <button
                  className="theme-toggle-btn"
                  onClick={onToggleTheme}
                  type="button"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="settings-preset-note">{activePresetMeta.helperText}</p>

              <div className="settings-controls-row">
                <div className="settings-compact-group">
                  <label className="settings-compact-label" htmlFor={`session-duration-${activePresetDomId}`}>SESSION</label>
                  <div className="settings-compact-input-row">
                    <input
                      id={`session-duration-${activePresetDomId}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint="done"
                      autoComplete="off"
                      className="settings-compact-input"
                      value={activePreset.sessionMinutes}
                      onChange={(event) => updateActivePresetField('sessionMinutes', event.target.value)}
                      onFocus={handleNumericInputFocus}
                      onClick={handleNumericInputFocus}
                      onBlur={() => commitSettings()}
                      aria-label={`${activePresetMeta.label} session minutes`}
                    />
                    <span className="settings-compact-unit">MIN</span>
                  </div>
                </div>

                <div className="settings-compact-group">
                  <label className="settings-compact-label" htmlFor={`interval-duration-${activePresetDomId}`}>INTERVAL</label>
                  <div className="settings-compact-input-row">
                    <input
                      id={`interval-duration-${activePresetDomId}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint="done"
                      autoComplete="off"
                      className="settings-compact-input"
                      value={activePreset.intervalSeconds}
                      onChange={(event) => updateActivePresetField('intervalSeconds', event.target.value)}
                      onFocus={handleNumericInputFocus}
                      onClick={handleNumericInputFocus}
                      onBlur={() => commitSettings()}
                      aria-label={`${activePresetMeta.label} interval seconds`}
                    />
                    <span className="settings-compact-unit">SEC</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
