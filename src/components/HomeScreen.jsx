import { useState, useRef, useEffect } from 'react';
import { loadSettings, saveSettings } from '../utils/storage';
import { loadWorkouts, sortWorkouts } from '../utils/workoutStorage';
import {
  toggleBackgroundMusic,
} from '../utils/audioManager';
import { useBackgroundMusicState } from '../hooks/useBackgroundMusicState';
import FireParticles from './FireParticles';
import ElectricArc from './ElectricArc';
import AmbientEcgPulse from './AmbientEcgPulse';
import './HomeScreen.css';

const TYPE_LABELS = {
  strength: 'STRENGTH',
  cardio: 'CARDIO',
  mobility: 'MOBILITY',
  hiit: 'HIIT',
  other: 'OTHER',
};

const MAX_VISIBLE_WORKOUTS = 4;

export default function HomeScreen({ onStartTimer, onManageWorkouts, onCreateWorkout, theme, onToggleTheme }) {
  const [sessionMinutes, setSessionMinutes] = useState(() => String(loadSettings().sessionMinutes));
  const [intervalSeconds, setIntervalSeconds] = useState(() => String(loadSettings().intervalSeconds));
  const [workouts] = useState(() => sortWorkouts(loadWorkouts()));
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const bgmState = useBackgroundMusicState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const glitchTimerRef = useRef(null);

  // Glitch effect — trigger every 5-7 seconds for 300ms
  useEffect(() => {
    function scheduleGlitch() {
      const delay = 5000 + Math.random() * 2000;
      glitchTimerRef.current = setTimeout(() => {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 300);
        scheduleGlitch();
      }, delay);
    }
    scheduleGlitch();
    return () => {
      if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
    };
  }, []);

  // One-tap start: tap a workout card → go straight to timer
  function handleWorkoutTap(workout) {
    const mins = Math.max(1, Math.min(180, parseInt(sessionMinutes) || 60));
    const secs = Math.max(5, Math.min(600, parseInt(intervalSeconds) || 30));
    saveSettings({ sessionMinutes: mins, intervalSeconds: secs });
    onStartTimer(mins, secs, workout);
  }

  // Timer Only mode
  function handleTimerOnly() {
    const mins = Math.max(1, Math.min(180, parseInt(sessionMinutes) || 60));
    const secs = Math.max(5, Math.min(600, parseInt(intervalSeconds) || 30));
    saveSettings({ sessionMinutes: mins, intervalSeconds: secs });
    onStartTimer(mins, secs, null);
  }

  const visibleWorkouts = showAllWorkouts ? workouts : workouts.slice(0, MAX_VISIBLE_WORKOUTS);
  const hasOverflow = workouts.length > MAX_VISIBLE_WORKOUTS;

  return (
    <div className="home-screen">
      {/* 1. Hero Header — compact */}
      <header className="home-hero">
        <span className="home-hero-sub">ELITE RECOMPOSITION</span>
        <div className="home-hero-title-wrap">
          <FireParticles width={390} height={50} />
          <ElectricArc width={390} height={40} />
          <h1
            className={`home-hero-title${isGlitching ? ' glitch-active' : ''}`}
            data-title="WORKOUT TIMER"
          >
            WORKOUT TIMER
          </h1>
          <div className="scanlines" />
        </div>
        <AmbientEcgPulse />
      </header>

      {/* 2. Workout Selection */}
      <div className="workout-section">
        <div className="workout-section-header">
          <h2 className="workout-section-title">YOUR WORKOUTS</h2>
          <button className="workout-manage-btn" onClick={onManageWorkouts} title="Manage Workouts">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </button>
        </div>

        <div className="workout-cards">
          {visibleWorkouts.map((workout) => (
            <button
              key={workout.id}
              className="workout-card"
              onClick={() => handleWorkoutTap(workout)}
            >
              <div className="workout-card-row">
                {workout.pinned && <span className="workout-card-pin">★</span>}
                <span className="workout-card-name">{workout.name}</span>
                <span className="workout-card-type">{TYPE_LABELS[workout.type] || 'OTHER'}</span>
              </div>
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

        {/* Session Settings — directly after create button */}
        <div className={`settings-compact ${settingsOpen ? 'settings-open' : ''}`}>
          <button
            className="settings-toggle-bar"
            onClick={() => setSettingsOpen(!settingsOpen)}
            type="button"
          >
            <span className="settings-toggle-label">⏱ SESSION</span>
            <span className="settings-toggle-summary">
              {sessionMinutes}min · {intervalSeconds}sec
            </span>
            <span className="settings-toggle-icon">{settingsOpen ? '▾' : '▸'}</span>
          </button>

          {settingsOpen && (
            <div className="settings-expanded">
              <div className="settings-compact-group">
                <label className="settings-compact-label" htmlFor="session-duration">SESSION</label>
                <div className="settings-compact-input-row">
                  <input
                    id="session-duration"
                    type="number"
                    className="settings-compact-input"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(e.target.value)}
                    min={1}
                    max={180}
                  />
                  <span className="settings-compact-unit">MIN</span>
                </div>
              </div>

              <div className="settings-compact-group">
                <label className="settings-compact-label" htmlFor="interval-duration">INTERVAL</label>
                <div className="settings-compact-input-row">
                  <input
                    id="interval-duration"
                    type="number"
                    className="settings-compact-input"
                    value={intervalSeconds}
                    onChange={(e) => setIntervalSeconds(e.target.value)}
                    min={5}
                    max={600}
                  />
                  <span className="settings-compact-unit">SEC</span>
                </div>
              </div>

              <button className="timer-only-btn" onClick={handleTimerOnly}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2.5" />
                  <path d="M10 2h4" />
                  <path d="M12 2v2" />
                </svg>
                TIMER ONLY
              </button>

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
          )}
        </div>
      </div>

      {/* Floating music button — bottom right */}
      <button
        className={`home-music-fab ${bgmState.enabled ? 'is-on' : 'is-off'}`}
        onClick={() => toggleBackgroundMusic()}
        type="button"
        title={bgmState.enabled ? 'Music On' : 'Music Off'}
      >
        {bgmState.enabled ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </button>

    </div>
  );
}
