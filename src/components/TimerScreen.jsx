import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TimerCircle from './TimerCircle';
import QuickAddButtons from './QuickAddButtons';
import ExerciseChecklist from './ExerciseChecklist';
import { useTimer } from '../hooks/useTimer';
import { useBackgroundMusicState } from '../hooks/useBackgroundMusicState';
import { formatTime } from '../utils/timerLogic';
import { loadSessionState, clearSessionState } from '../utils/storage';
import { isWakeLockActive, isWakeLockSupported } from '../utils/wakeLock';
import {
  toggleBackgroundMusic,
} from '../utils/audioManager';
import { getWarmupExercisesForWorkout, getCardioExercisesForWorkout } from '../utils/workoutStorage';
import './TimerScreen.css';

function haptic(style = 'light') {
  if (navigator.vibrate) {
    navigator.vibrate(style === 'heavy' ? 50 : 15);
  }
}

function createExerciseProgress(exercises) {
  return exercises.map((ex) => ({
    completed: false,
    setsCompleted: Array(ex.sets).fill(false),
  }));
}

function normalizeExerciseProgress(exercises, savedProgress) {
  if (!Array.isArray(savedProgress)) {
    return createExerciseProgress(exercises);
  }

  return exercises.map((exercise, index) => {
    const fallback = {
      completed: false,
      setsCompleted: Array(exercise.sets).fill(false),
    };
    const saved = savedProgress[index];
    if (!saved || !Array.isArray(saved.setsCompleted)) return fallback;

    const setsCompleted = Array.from({ length: exercise.sets }, (_, setIndex) =>
      Boolean(saved.setsCompleted[setIndex])
    );

    return {
      completed: setsCompleted.every(Boolean),
      setsCompleted,
    };
  });
}

export default function TimerScreen({ sessionMinutes, intervalSeconds, workout, onBack }) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const bgmState = useBackgroundMusicState();
  const initialSavedSession = useMemo(() => {
    const saved = loadSessionState();
    if (!saved || !saved.sessionActive) return null;
    const timingMatches =
      saved.sessionDuration === sessionMinutes * 60 &&
      saved.intervalDuration === intervalSeconds;
    return { ...saved, timingMatches };
  }, [sessionMinutes, intervalSeconds]);
  const [savedSession, setSavedSession] = useState(() => initialSavedSession);
  const [showResumeDialog, setShowResumeDialog] = useState(() => Boolean(initialSavedSession));

  // Merge warm-up exercises (first) with workout exercises
  const allExercises = useMemo(() => {
    const warmupExercises = workout ? getWarmupExercisesForWorkout(workout) : [];
    const cardioExercises = workout ? getCardioExercisesForWorkout(workout) : [];
    const mainExercises = (workout?.exercises || []).map((ex) => ({ ...ex, _isWarmup: false, _isCardio: false }));
    return [...warmupExercises, ...cardioExercises, ...mainExercises];
  }, [workout]);

  // Exercise progress: array of { completed, setsCompleted: [bool] }
  const exercises = allExercises;
  const [exerciseProgress, setExerciseProgress] = useState(() =>
    createExerciseProgress(exercises)
  );
  const sessionMetadata = useMemo(() => ({
    workoutId: workout?.id || null,
    workoutName: workout?.name || null,
    exerciseProgress,
  }), [workout?.id, workout?.name, exerciseProgress]);
  const timer = useTimer(sessionMinutes, intervalSeconds, sessionMetadata);

  const isActive = timer.status === 'running' || timer.status === 'paused' || timer.status === 'countdown';
  const canResumeTiming = Boolean(savedSession?.timingMatches);
  const workoutMatchesSavedSession = (savedSession?.workoutId || null) === (workout?.id || null);
  const isSessionComplete = timer.completedElapsedSeconds > 0;
  const didCompleteHapticRef = useRef(false);
  const { persistSession } = timer;

  useEffect(() => {
    if (timer.completedElapsedSeconds <= 0) {
      didCompleteHapticRef.current = false;
      return;
    }
    if (!didCompleteHapticRef.current) {
      haptic('heavy');
      didCompleteHapticRef.current = true;
    }
  }, [timer.completedElapsedSeconds]);

  useEffect(() => {
    if (!isActive) return;
    persistSession();
  }, [exerciseProgress, isActive, persistSession, workout?.id, workout?.name]);

  function handleResume() {
    if (savedSession) {
      if (!savedSession.timingMatches) {
        clearSessionState();
        setShowResumeDialog(false);
        setSavedSession(null);
        return;
      }

      const didResume = timer.resumeSession(savedSession);
      if (didResume && workoutMatchesSavedSession) {
        setExerciseProgress(
          normalizeExerciseProgress(exercises, savedSession.exerciseProgress)
        );
      } else if (didResume) {
        setExerciseProgress(createExerciseProgress(exercises));
      }
    }
    setShowResumeDialog(false);
    setSavedSession(null);
  }

  function handleDiscardSession() {
    clearSessionState();
    setShowResumeDialog(false);
    setSavedSession(null);
  }

  function handleBack() {
    if (isActive) {
      setShowBackConfirm(true);
    } else {
      onBack();
    }
  }

  function confirmBack() {
    timer.reset();
    setShowBackConfirm(false);
    onBack();
  }

  function handleMainButton() {
    haptic();
    switch (timer.status) {
      case 'idle':
        timer.start();
        break;
      case 'running':
        timer.pause();
        break;
      case 'paused':
        timer.resume();
        break;
      default:
        break;
    }
  }

  function handleReset() {
    if (timer.status === 'idle') return;
    setShowResetConfirm(true);
  }

  function confirmReset() {
    timer.reset();
    setExerciseProgress(createExerciseProgress(exercises));
    setShowResetConfirm(false);
  }

  const handleToggleSet = useCallback((exerciseIdx, setIdx) => {
    haptic();
    setExerciseProgress((prev) => {
      const updated = prev.map((p, i) => {
        if (i !== exerciseIdx) return p;
        const newSets = [...p.setsCompleted];
        newSets[setIdx] = !newSets[setIdx];
        const allDone = newSets.every(Boolean);
        return { completed: allDone, setsCompleted: newSets };
      });
      return updated;
    });
  }, []);

  const handleToggleExercise = useCallback((exerciseIdx) => {
    haptic('heavy');
    setExerciseProgress((prev) => {
      const updated = prev.map((p, i) => {
        if (i !== exerciseIdx) return p;
        const newCompleted = !p.completed;
        return {
          completed: newCompleted,
          setsCompleted: p.setsCompleted.map(() => newCompleted),
        };
      });
      return updated;
    });
  }, []);

  const mainButtonLabel = {
    idle: 'START',
    countdown: 'STARTING...',
    running: 'PAUSE',
    paused: 'RESUME',
  }[timer.status] || 'START';

  // Session progress (0 to 100)
  const sessionDurationSec = sessionMinutes * 60;
  const sessionProgressPct = sessionDurationSec > 0
    ? Math.min(100, (timer.elapsedSeconds / sessionDurationSec) * 100)
    : 0;

  // Completed exercise count
  const completedExercises = exerciseProgress.filter((p) => p.completed).length;

  return (
    <div className="timer-screen">
      {/* Header — compact nav row */}
      <header className="timer-header">
        <div className="timer-header-row">
          <button className="back-btn" onClick={handleBack}>
            ←
          </button>
          <div className="header-titles">
            <h1 className="header-main">WORKOUT TIMER</h1>
          </div>
          <div className="timer-header-controls">
            {isWakeLockSupported() && isActive ? (
              <div className={`wake-lock-badge ${isWakeLockActive() ? 'active' : 'inactive'}`}>
                {isWakeLockActive() ? '🔒' : '⚠️'}
              </div>
            ) : (
              <div className="wake-lock-badge wake-lock-placeholder" aria-hidden="true" />
            )}
          </div>
        </div>
        {workout && (
          <span className="header-workout-name">{workout.name}</span>
        )}
      </header>

      {/* Session Progress Bar */}
      {isActive && (
        <div className="session-progress-bar">
          <div className="session-progress-fill" style={{ width: `${sessionProgressPct}%` }} />
        </div>
      )}

      {/* Timer Circle */}
      <TimerCircle
        remainingSeconds={timer.intervalRemaining}
        circleColor={timer.circleColor}
        progress={timer.intervalProgress}
        countdownNumber={timer.countdownNumber}
        timerMode={timer.circleColor === 'rest' ? 'rest' : timer.status === 'idle' ? 'idle' : 'running'}
      />

      {/* Interval & Elapsed Info — spread apart */}
      <div className="timer-info">
        <span className="timer-info-label">
          {timer.intervalCount}/{timer.totalIntervals}
        </span>
        <span className="timer-info-elapsed">
          {formatTime(timer.elapsedSeconds)}
        </span>
      </div>

      {/* Quick Add + Controls in one row */}
      <div className="timer-action-row">
        <QuickAddButtons
          onQuickAdd={(s) => { haptic(); timer.quickAdd(s); }}
          disabled={timer.status !== 'running'}
        />
        <div className="timer-controls">
          <button
            className={`ctrl-btn ctrl-btn-main ${timer.status === 'idle' ? 'ctrl-btn-pulse' : 'ctrl-btn-running'}`}
            onClick={handleMainButton}
            disabled={timer.status === 'countdown'}
          >
            {mainButtonLabel}
          </button>
          <button
            className="ctrl-btn ctrl-btn-reset"
            onClick={handleReset}
            disabled={timer.status === 'idle'}
          >
            RESET
          </button>
        </div>
      </div>

      {/* Exercise Checklist */}
      {exercises.length > 0 && (
        <ExerciseChecklist
          exercises={exercises}
          progress={exerciseProgress}
          onToggleSet={handleToggleSet}
          onToggleExercise={handleToggleExercise}
        />
      )}

      {/* Session Complete Celebration */}
      {isSessionComplete && (
        <div className="complete-overlay">
          <div className="complete-box">
            <div className="complete-emoji">💪</div>
            <h2 className="complete-title">SESSION DONE!</h2>
            <p className="complete-subtitle">
              {workout ? workout.name : 'Timer session'} complete
            </p>
            <div className="complete-stats">
              <div className="complete-stat">
                <span className="complete-stat-value">{formatTime(timer.completedElapsedSeconds)}</span>
                <span className="complete-stat-label">DURATION</span>
              </div>
              <div className="complete-stat">
                <span className="complete-stat-value">{timer.intervalCount}</span>
                <span className="complete-stat-label">INTERVALS</span>
              </div>
              {exercises.length > 0 && (
                <div className="complete-stat">
                  <span className="complete-stat-value">{completedExercises}/{exercises.length}</span>
                  <span className="complete-stat-label">EXERCISES</span>
                </div>
              )}
            </div>
            <button className="complete-done-btn" onClick={onBack}>
              DONE
            </button>
          </div>
        </div>
      )}

      {/* Floating music button — bottom right */}
      <button
        className={`timer-music-fab ${bgmState.enabled ? 'is-on' : 'is-off'}`}
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

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">RESET SESSION?</h2>
            <p className="dialog-text">This cannot be undone. All progress will be lost.</p>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-cancel" onClick={() => setShowResetConfirm(false)}>
                CANCEL
              </button>
              <button className="dialog-btn dialog-btn-confirm" onClick={confirmReset}>
                RESET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Confirmation Dialog */}
      {showBackConfirm && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">LEAVE SESSION?</h2>
            <p className="dialog-text">Your active session will be lost. Are you sure?</p>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-cancel" onClick={() => setShowBackConfirm(false)}>
                STAY
              </button>
              <button className="dialog-btn dialog-btn-confirm" onClick={confirmBack}>
                LEAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Session Dialog */}
      {showResumeDialog && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">ACTIVE SESSION FOUND</h2>
            <p className="dialog-text">
              {canResumeTiming
                ? 'You have an unfinished workout session. Would you like to resume?'
                : 'Saved session settings do not match this timer. Discard to continue with current settings.'}
              {canResumeTiming && !workoutMatchesSavedSession && (
                <>
                  <br />
                  <br />
                  Saved workout: {savedSession?.workoutName || 'Timer Only'}. Exercise checklist will reset.
                </>
              )}
            </p>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-cancel" onClick={handleDiscardSession}>
                DISCARD
              </button>
              {canResumeTiming && (
                <button className="dialog-btn dialog-btn-confirm" onClick={handleResume}>
                  RESUME
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
