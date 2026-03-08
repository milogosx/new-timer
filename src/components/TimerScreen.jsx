import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TimerCircle from './TimerCircle';
import QuickAddButtons from './QuickAddButtons';
import ExerciseChecklist from './ExerciseChecklist';
import { useTimer } from '../hooks/useTimer';
import { formatTime } from '../utils/timerLogic';
import {
  createExerciseProgress,
  normalizeExerciseProgress,
  toggleExerciseProgress,
  toggleSetProgress,
} from '../utils/exerciseProgress';
import {
  doesWorkoutMatchSavedSession,
  getInitialSavedSession,
} from '../utils/sessionResumePolicy';
import { loadSessionState, clearSessionState } from '../utils/storage';
import { isWakeLockActive, isWakeLockSupported } from '../utils/wakeLock';
import { playSpeechAnnouncement } from '../utils/audioManager';
import { getWarmupExercisesForWorkout, getCardioExercisesForWorkout } from '../utils/workoutStorage';
import './TimerScreen.css';

function haptic(style = 'light') {
  if (navigator.vibrate) {
    navigator.vibrate(style === 'heavy' ? 50 : 15);
  }
}

function getTimerMode(circleColor, status) {
  if (circleColor === 'rest') return 'rest';
  if (status === 'idle') return 'idle';
  return 'running';
}

const WARMUP_DURATION_SEC = 15 * 60;

export default function TimerScreen({
  sessionMinutes,
  intervalSeconds,
  workout,
  onBack,
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const initialSavedSession = useMemo(() => {
    return getInitialSavedSession(loadSessionState(), sessionMinutes, intervalSeconds);
  }, [sessionMinutes, intervalSeconds]);
  const [savedSession, setSavedSession] = useState(() => initialSavedSession);
  const [showResumeDialog, setShowResumeDialog] = useState(() => Boolean(initialSavedSession));

  // Merge warm-up, cardio, and main exercises into a single list
  const exercises = useMemo(() => {
    const warmupExercises = workout ? getWarmupExercisesForWorkout(workout) : [];
    const cardioExercises = workout ? getCardioExercisesForWorkout(workout) : [];
    const mainExercises = (workout?.exercises || []).map((ex) => ({ ...ex, _isWarmup: false, _isCardio: false }));
    return [...warmupExercises, ...cardioExercises, ...mainExercises];
  }, [workout]);
  const [exerciseProgress, setExerciseProgress] = useState(() =>
    createExerciseProgress(exercises)
  );
  const sessionMetadata = useMemo(() => ({
    workoutId: workout?.id || null,
    workoutName: workout?.name || null,
    exerciseProgress,
  }), [workout?.id, workout?.name, exerciseProgress]);
  const timer = useTimer(
    sessionMinutes,
    intervalSeconds,
    sessionMetadata,
  );

  const isWarmupPhase = timer.elapsedSeconds < WARMUP_DURATION_SEC && timer.elapsedSeconds < (sessionMinutes * 60);
  const phaseLabel = isWarmupPhase ? 'WARM UP' : 'WORKOUT';

  const announcedSetRef = useRef(new Set());

  // Reset announced milestones when a new session begins
  useEffect(() => {
    if (timer.status === 'countdown' || timer.status === 'idle') {
      announcedSetRef.current.clear();
    }
  }, [timer.status]);

  // Handle Speech Announcements — uses threshold-crossing (>=) instead of exact-second
  // matching (===) so that announcements still fire even when setTimeout is throttled
  // on iOS and the tick jumps past the target second.
  useEffect(() => {
    if (timer.status !== 'running') return;

    const s = Math.floor(timer.elapsedSeconds);
    const warmupS = WARMUP_DURATION_SEC;
    const totalS = sessionMinutes * 60;
    const announced = announcedSetRef.current;

    // Build ordered milestone list — checked first-to-last so the earliest
    // un-announced milestone fires first (only one per tick to avoid stacking).
    const milestones = [
      { key: 'start_warmup', at: 1 },
      { key: 'warmup_complete', at: warmupS, guard: totalS > warmupS },
      { key: 'quarter_way', at: Math.floor(totalS * 0.25), guard: Math.floor(totalS * 0.25) > warmupS },
      { key: 'halfway', at: Math.floor(totalS / 2), guard: Math.floor(totalS / 2) > warmupS },
      { key: 'three_quarters', at: Math.floor(totalS * 0.75), guard: Math.floor(totalS * 0.75) > warmupS },
      { key: 'five_minutes', at: totalS - 300, guard: totalS - 300 > warmupS },
      { key: 'one_minute', at: totalS - 60, guard: totalS - 60 > warmupS },
      { key: 'workout_complete', at: totalS, guard: totalS > 0 },
    ];

    for (const m of milestones) {
      if (announced.has(m.key)) continue;
      if (m.guard === false) continue;
      if (s >= m.at) {
        announced.add(m.key);
        playSpeechAnnouncement(m.key);
        break; // one announcement per tick to avoid stacking audio
      }
    }
  }, [timer.status, timer.elapsedSeconds, sessionMinutes]);

  const isActive = timer.status === 'running' || timer.status === 'paused' || timer.status === 'countdown';
  const canResumeTiming = Boolean(savedSession?.timingMatches);
  const workoutMatchesSavedSession = doesWorkoutMatchSavedSession(savedSession, workout);
  const isSessionComplete = timer.completedElapsedSeconds > 0;
  const didCompleteHapticRef = useRef(false);
  const { persistSession, quickAdd } = timer;

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
    persistSession(undefined, { force: true });
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
    setExerciseProgress((prev) => toggleSetProgress(prev, exerciseIdx, setIdx));
  }, []);

  const handleToggleExercise = useCallback((exerciseIdx) => {
    haptic('heavy');
    setExerciseProgress((prev) => toggleExerciseProgress(prev, exerciseIdx));
  }, []);

  const handleQuickAdd = useCallback((seconds) => {
    haptic();
    quickAdd(seconds);
  }, [quickAdd]);

  const mainButtonLabel = {
    idle: 'START',
    countdown: 'STARTING...',
    running: 'PAUSE',
    paused: 'RESUME',
  }[timer.status] || 'START';

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
            <h1 className={`header-main ${isWarmupPhase ? 'phase-warmup' : 'phase-workout'}`}>
              {phaseLabel}
            </h1>
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

      {/* Timer Circle */}
      <TimerCircle
        remainingSeconds={timer.intervalRemaining}
        circleColor={timer.circleColor}
        progress={timer.intervalProgress}
        countdownNumber={timer.countdownNumber}
        timerMode={getTimerMode(timer.circleColor, timer.status)}
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
          onQuickAdd={handleQuickAdd}
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
