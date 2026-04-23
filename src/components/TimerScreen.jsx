import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TimerCircle from './TimerCircle';
import QuickAddButtons from './QuickAddButtons';
import ExerciseChecklist from './ExerciseChecklist';
import { useTimer } from '../hooks/useTimer';
import { formatTime } from '../utils/timerLogic';
import {
  createExerciseProgress,
  toggleExerciseProgress,
  toggleSetProgress,
} from '../utils/exerciseProgress';
import {
  doesWorkoutStructureMatchSavedSession,
  choosePreferredSavedSession,
  doesWorkoutMatchSavedSession,
  getInitialSavedSession,
  resolveResumeExerciseProgress,
} from '../utils/sessionResumePolicy';
import { loadSessionState, clearSessionState, saveSessionState } from '../utils/storage';
import { isWakeLockActive, isWakeLockSupported } from '../utils/wakeLock';
import { buildSessionMetadata } from '../utils/sessionSnapshot';
import { getWorkoutExerciseSections } from '../utils/workoutExerciseSections';
import { buildCoachingSchedule, getSessionPhase, getSpeechMilestones, shouldPlaySpeechCues } from '../utils/timerPhase';
import {
  clearMirroredActiveSession,
  playSpeechCue,
  readMirroredActiveSession,
  isRuntimeMuted,
  setRuntimeMuted,
} from '../platform/intervalRuntimeBridge';
import { traceRuntime } from '../utils/runtimeTrace';
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

function TimerTotalsDisplay({
  elapsedSeconds,
  totalSessionSeconds,
  countdownNumber,
  isOvertime,
  timerMode,
}) {
  const safeTotal = Math.max(0, Math.floor(totalSessionSeconds) || 0);
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds) || 0);
  const remaining = Math.max(0, safeTotal - safeElapsed);
  const progress = safeTotal > 0 ? Math.min(1, safeElapsed / safeTotal) : 0;

  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const modeClass = timerMode === 'idle' ? 'mode-idle' : 'mode-running';

  const tickCount = 90;
  const ticks = [];
  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * 360 - 90;
    const isMajor = i % 15 === 0;
    const inner = 126;
    const outer = isMajor ? 136 : 133;
    const rad = (angle * Math.PI) / 180;
    const x1 = 160 + Math.cos(rad) * inner;
    const y1 = 160 + Math.sin(rad) * inner;
    const x2 = 160 + Math.cos(rad) * outer;
    const y2 = 160 + Math.sin(rad) * outer;
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
        strokeWidth={isMajor ? 2 : 1}
      />
    );
  }

  return (
    <div className={`timer-totals-wrapper ${modeClass}`}>
      <div className="timer-totals-ring">
        <svg className="progress-ring" viewBox="0 0 320 320" aria-hidden="true">
          <defs>
            <linearGradient id="timerAmberArc" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF8C3F" stopOpacity="1" />
              <stop offset="60%" stopColor="#FF6B1A" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#6A2300" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="timerBezel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3A3D44" />
              <stop offset="50%" stopColor="#1C1E24" />
              <stop offset="100%" stopColor="#0A0B0F" />
            </linearGradient>
            <filter id="timerArcGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Thick brushed bezel — outer */}
          <circle cx="160" cy="160" r="145" fill="none" stroke="url(#timerBezel)" strokeWidth="16" />
          {/* inner dark separator */}
          <circle cx="160" cy="160" r="137" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
          {ticks}
          {/* Idle amber-preview right-half glow (under progress ring). */}
          <path
            d="M 160 20 A 140 140 0 0 1 160 300"
            fill="none"
            stroke="url(#timerAmberArc)"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.85"
            filter="url(#timerArcGlow)"
          />
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="6"
          />
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke="url(#timerAmberArc)"
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 160 160)"
            filter="url(#timerArcGlow)"
          />
          {/* Pointer triangle at top */}
          <path d="M 160 18 L 154 32 L 166 32 Z" fill="#FF6B1A" style={{ filter: 'drop-shadow(0 0 4px rgba(255,107,26,0.7))' }} />
        </svg>
        <div className="timer-totals-inner">
          {countdownNumber !== null ? (
            <span className="countdown-number">{countdownNumber}</span>
          ) : (
            <>
              <span className="timer-totals-label">ELAPSED</span>
              <span className={`timer-totals-remaining ${isOvertime ? 'is-overtime' : ''}`}>
                {formatTime(safeElapsed)}
              </span>
              <span className="timer-totals-label timer-totals-label-sub">REMAINING</span>
              <span className={`timer-totals-elapsed ${isOvertime ? 'is-overtime' : ''}`}>
                {formatTime(remaining)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AudioRecoveryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="audio-reset-icon">
      <path
        d="M4.75 10.25V13.75H8.15L11.75 16.75V7.25L8.15 10.25H4.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.4 8.6A4.75 4.75 0 0 1 16.25 16.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M15.6 6.8L18.35 7.2L17.95 9.95"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [audioRepairState, setAudioRepairState] = useState('idle');
  const [muted, setMuted] = useState(() => isRuntimeMuted());

  const { exercises } = useMemo(() => getWorkoutExerciseSections(workout), [workout]);
  const [exerciseProgress, setExerciseProgress] = useState(() =>
    createExerciseProgress(exercises)
  );
  // Seed the coaching-cue schedule once per session run. Fresh seed on start,
  // reuse savedSession.sessionStartTime as seed on resume so cues line up with
  // the original run.
  const [coachingSeed, setCoachingSeed] = useState(null);
  const prevStatusRef = useRef('idle');

  const coachingSchedule = useMemo(() => {
    if (coachingSeed == null) return [];
    if (!shouldPlaySpeechCues(workout)) return [];
    return buildCoachingSchedule(sessionMinutes, coachingSeed);
  }, [coachingSeed, sessionMinutes, workout]);

  const sessionMetadata = useMemo(
    () => ({
      ...buildSessionMetadata(workout, exerciseProgress, exercises),
      coachingSchedule,
    }),
    [workout, exerciseProgress, exercises, coachingSchedule]
  );
  const timer = useTimer(
    sessionMinutes,
    intervalSeconds,
    sessionMetadata,
  );

  useEffect(() => {
    const prev = prevStatusRef.current;
    const next = timer.status;
    if (prev === next) return;
    prevStatusRef.current = next;
    if ((prev === 'idle' || prev === 'countdown') && next === 'running') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seed once per session run on status transition
      setCoachingSeed((current) => current ?? Date.now());
    } else if (next === 'idle') {
      setCoachingSeed(null);
    }
  }, [timer.status]);

  const { isWarmupPhase, phaseLabel } = useMemo(
    () => getSessionPhase(timer.elapsedSeconds, sessionMinutes),
    [timer.elapsedSeconds, sessionMinutes]
  );
  const timerMode = useMemo(
    () => getTimerMode(timer.circleColor, timer.status),
    [timer.circleColor, timer.status]
  );
  const isTimerOnlySession = !workout;
  const headerPhaseLabel = isTimerOnlySession ? 'TIMER ONLY' : phaseLabel;
  const headerPhaseClass = isTimerOnlySession
    ? 'phase-timer-only'
    : isWarmupPhase
      ? 'phase-warmup'
      : 'phase-workout';
  const speechEnabledForSession = useMemo(() => shouldPlaySpeechCues(workout), [workout]);

  const announcedSetRef = useRef(new Set());

  // Reset announced milestones when a new session begins
  useEffect(() => {
    if (timer.status === 'countdown' || timer.status === 'idle') {
      announcedSetRef.current.clear();
    }
  }, [timer.status]);

  useEffect(() => {
    let cancelled = false;

    async function hydratePreferredSavedSession() {
      const localSavedSession = loadSessionState();
      const nativeSavedSession = await readMirroredActiveSession();
      if (cancelled) return;

      const preferredSavedSession = choosePreferredSavedSession(localSavedSession, nativeSavedSession);
      const initialSaved = getInitialSavedSession(
        preferredSavedSession,
        sessionMinutes,
        intervalSeconds
      );

      if (!initialSaved) return;

      if (preferredSavedSession) {
        saveSessionState(preferredSavedSession);
      }

      setSavedSession(initialSaved);
      setShowResumeDialog(true);
    }

    void hydratePreferredSavedSession();

    return () => {
      cancelled = true;
    };
  }, [intervalSeconds, sessionMinutes]);

  // Handle Speech Announcements — uses threshold-crossing (>=) instead of exact-second
  // matching (===) so that announcements still fire even when setTimeout is throttled
  // on iOS and the tick jumps past the target second.
  useEffect(() => {
    if (!speechEnabledForSession) return;
    if (timer.status !== 'running') return;

    const s = Math.floor(timer.elapsedSeconds);
    const announced = announcedSetRef.current;
    const structural = getSpeechMilestones(sessionMinutes);
    const milestones = [...structural, ...coachingSchedule].sort((a, b) => a.at - b.at);

    for (const m of milestones) {
      if (announced.has(m.key)) continue;
      if (m.guard === false) continue;
      if (s >= m.at) {
        announced.add(m.key);
        traceRuntime('timer.speech_milestone', {
          key: m.key,
          at: m.at,
          elapsedSeconds: s,
        });
        void playSpeechCue(m.key);
        break; // one announcement per tick to avoid stacking audio
      }
    }
  }, [speechEnabledForSession, timer.status, timer.elapsedSeconds, sessionMinutes, coachingSchedule]);

  const isActive = timer.status === 'running' || timer.status === 'paused' || timer.status === 'countdown';
  const canRecoverAudio = timer.status === 'running' || timer.status === 'paused';
  const displayedAudioRepairState = canRecoverAudio ? audioRepairState : 'idle';
  const canResumeTiming = Boolean(savedSession?.timingMatches);
  const workoutMatchesSavedSession = doesWorkoutMatchSavedSession(savedSession, workout);
  const workoutStructureMatchesSavedSession = doesWorkoutStructureMatchSavedSession(
    savedSession,
    workout,
    exercises
  );
  const willResetChecklistOnResume = canResumeTiming
    && (!workoutMatchesSavedSession || !workoutStructureMatchesSavedSession);
  const isSessionComplete = timer.completedElapsedSeconds > 0;
  const didCompleteHapticRef = useRef(false);
  const { persistSession, quickAdd, recoverAudio } = timer;

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

  useEffect(() => {
    if (audioRepairState === 'idle') return undefined;

    const timeoutId = window.setTimeout(() => {
      setAudioRepairState('idle');
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [audioRepairState]);

  function handleResume() {
    if (savedSession) {
      if (!savedSession.timingMatches) {
        traceRuntime('timer.resume_discarded_mismatch');
        clearSessionState();
        setShowResumeDialog(false);
        setSavedSession(null);
        return;
      }

      const didResume = timer.resumeSession(savedSession);
      if (didResume) {
        traceRuntime('timer.resume_confirmed', {
          timingMatches: savedSession.timingMatches,
          workoutMatchesSavedSession,
          workoutStructureMatchesSavedSession,
        });
        setExerciseProgress(resolveResumeExerciseProgress(savedSession, workout, exercises));
      }
    }
    setShowResumeDialog(false);
    setSavedSession(null);
  }

  function handleDiscardSession() {
    traceRuntime('timer.resume_discarded');
    clearSessionState();
    void clearMirroredActiveSession();
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

  const handleToggleMute = useCallback(() => {
    haptic();
    const next = !muted;
    setMuted(next);
    void setRuntimeMuted(next);
    traceRuntime('timer.mute_toggled', { muted: next });
  }, [muted]);

  const handleRecoverAudio = useCallback(async () => {
    if (!canRecoverAudio || displayedAudioRepairState === 'working') return;

    haptic();
    setAudioRepairState('working');
    const ready = await recoverAudio();
    setAudioRepairState(ready ? 'ready' : 'failed');
    traceRuntime('timer.audio_recovery_result', {
      ready,
    });
  }, [canRecoverAudio, displayedAudioRepairState, recoverAudio]);

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
            <h1 className={`header-main ${headerPhaseClass}`}>
              {headerPhaseLabel}
            </h1>
          </div>
          <div className="timer-header-controls">
            <button
              type="button"
              className={`mute-btn ${muted ? 'is-muted' : ''}`}
              onClick={handleToggleMute}
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
              aria-pressed={muted}
            >
              {muted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
            {canRecoverAudio ? (
              <button
                type="button"
                className={`audio-reset-btn is-${displayedAudioRepairState}`}
                onClick={handleRecoverAudio}
                disabled={displayedAudioRepairState === 'working'}
                aria-label={
                  displayedAudioRepairState === 'working'
                    ? 'Recovering sound'
                    : displayedAudioRepairState === 'ready'
                      ? 'Sound recovered'
                      : displayedAudioRepairState === 'failed'
                        ? 'Sound recovery failed, try again'
                        : 'Recover sound cues'
                }
              >
                <AudioRecoveryIcon />
              </button>
            ) : (
              <div className="audio-reset-btn audio-reset-placeholder" aria-hidden="true" />
            )}
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

      {/* Main display — workout sessions see the interval circle;
          timer-only sessions see total elapsed + total remaining. */}
      {isTimerOnlySession ? (
        <TimerTotalsDisplay
          elapsedSeconds={timer.elapsedSeconds}
          totalSessionSeconds={sessionMinutes * 60}
          countdownNumber={timer.countdownNumber}
          isOvertime={timer.isOvertime}
          timerMode={timerMode}
        />
      ) : (
        <TimerCircle
          remainingSeconds={timer.intervalRemaining}
          circleColor={timer.circleColor}
          progress={timer.intervalProgress}
          countdownNumber={timer.countdownNumber}
          timerMode={timerMode}
        />
      )}

      {/* Interval & Elapsed Info */}
      <div className="timer-info">
        <QuickAddButtons
          onQuickAdd={handleQuickAdd}
          disabled={timer.status !== 'running'}
          hidden={timer.status === 'idle' || timer.status === 'countdown'}
        />
        {!isTimerOnlySession && (
          <span className={`timer-info-elapsed ${timer.isOvertime ? 'is-overtime' : ''}`}>
            {formatTime(timer.elapsedSeconds)}
          </span>
        )}
      </div>

      {/* Quick Add + Controls in one row */}
      <div className="timer-action-row">
        <div className="timer-controls">
          <button
            className={`ctrl-btn ctrl-btn-main ctrl-btn-${timer.status} ${timer.status === 'idle' ? 'ctrl-btn-pulse' : ''}`}
            onClick={handleMainButton}
            disabled={timer.status === 'countdown'}
          >
            {timer.status === 'idle' && (
              <svg className="ctrl-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <polygon points="7,5 19,12 7,19" fill="currentColor" />
              </svg>
            )}
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
              {canResumeTiming && willResetChecklistOnResume && (
                <>
                  <br />
                  <br />
                  {workoutMatchesSavedSession
                    ? 'The saved workout structure no longer matches the current version. Exercise checklist will reset.'
                    : `Saved workout: ${savedSession?.workoutName || 'Timer Only'}. Exercise checklist will reset.`}
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
