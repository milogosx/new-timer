import { useState, useRef, useCallback, useEffect } from 'react';
import {
  deriveResumedIntervalState,
  resolveResumedSessionStatus,
} from '../utils/timerLogic';
import { playBell, playCountdown, initAudio } from '../utils/audioManager';
import { saveSessionState, clearSessionState } from '../utils/storage';
import { requestWakeLock, releaseWakeLock } from '../utils/wakeLock';
import { buildSessionSnapshot } from '../utils/sessionSnapshot';
import { advanceIntervalState } from '../utils/timerTickMath';
import { shouldPersistRunningSession } from '../utils/sessionPersistenceCadence';

const RUNNING_PERSIST_MIN_INTERVAL_MS = 1000;
const MIN_COARSE_TICK_MS = 100;

function monotonicNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function safeMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function normalizeTickIntervalMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(MIN_COARSE_TICK_MS, Math.floor(parsed));
}

export function useTimer(
  sessionMinutes,
  intervalSeconds,
  sessionMetadata = null,
  tickIntervalMs = 0
) {
  const sessionDurationSec = sessionMinutes * 60;
  const defaultIntervalSec = intervalSeconds;

  // Refs for values used inside tick to avoid stale closures when React re-renders
  const sessionDurationSecRef = useRef(sessionDurationSec);
  const defaultIntervalSecRef = useRef(defaultIntervalSec);
  sessionDurationSecRef.current = sessionDurationSec;
  defaultIntervalSecRef.current = defaultIntervalSec;

  // Timer state
  // Timer state
  const [status, setStatus] = useState('idle'); // idle | countdown | running | paused
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [intervalRemaining, setIntervalRemaining] = useState(defaultIntervalSec);
  const [intervalCount, setIntervalCount] = useState(0);
  const [circleColor, setCircleColor] = useState('black');
  const [countdownNumber, setCountdownNumber] = useState(null);
  const [currentIntervalDuration, setCurrentIntervalDuration] = useState(defaultIntervalSec);
  const [isQuickAdd, setIsQuickAdd] = useState(false);
  const [completedElapsedSeconds, setCompletedElapsedSeconds] = useState(0);

  // Refs for monotonic runtime timing and wall-clock persistence
  const sessionStartWallRef = useRef(null);
  const intervalStartWallRef = useRef(null);
  const sessionRunStartMonoRef = useRef(null);
  const intervalRunStartMonoRef = useRef(null);
  const sessionElapsedBeforeRunRef = useRef(0);
  const intervalElapsedBeforeRunRef = useRef(0);

  const rafRef = useRef(null);
  const timeoutRef = useRef(null);
  const tickRef = useRef(null);
  const intervalCountRef = useRef(0);
  const circleColorRef = useRef('black');
  const currentIntervalDurationRef = useRef(defaultIntervalSec);
  const isQuickAddRef = useRef(false);
  const statusRef = useRef('idle');
  const countdownTimeoutsRef = useRef([]);
  const countdownTokenRef = useRef(0);
  const sessionMetadataRef = useRef(sessionMetadata);
  const lastRunningPersistAtRef = useRef(0);
  const tickIntervalMsRef = useRef(normalizeTickIntervalMs(tickIntervalMs));

  // Keep refs in sync
  useEffect(() => {
    currentIntervalDurationRef.current = currentIntervalDuration;
  }, [currentIntervalDuration]);
  useEffect(() => {
    isQuickAddRef.current = isQuickAdd;
  }, [isQuickAdd]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    sessionMetadataRef.current = sessionMetadata;
  }, [sessionMetadata]);
  useEffect(() => {
    tickIntervalMsRef.current = normalizeTickIntervalMs(tickIntervalMs);
  }, [tickIntervalMs]);

  const clearCountdownTimeouts = useCallback(() => {
    countdownTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    countdownTimeoutsRef.current = [];
    countdownTokenRef.current += 1;
  }, []);

  const getSessionElapsedMs = useCallback(() => {
    const base = safeMs(sessionElapsedBeforeRunRef.current);
    if (statusRef.current === 'running' && sessionRunStartMonoRef.current !== null) {
      return base + Math.max(0, monotonicNow() - sessionRunStartMonoRef.current);
    }
    return base;
  }, []);

  const getIntervalElapsedMs = useCallback(() => {
    const base = safeMs(intervalElapsedBeforeRunRef.current);
    if (statusRef.current === 'running' && intervalRunStartMonoRef.current !== null) {
      return base + Math.max(0, monotonicNow() - intervalRunStartMonoRef.current);
    }
    return base;
  }, []);

  const persistSession = useCallback((overrideStatus = statusRef.current, options = {}) => {
    const force = options.force === true;
    if (overrideStatus !== 'running' && overrideStatus !== 'paused') return false;
    if (sessionStartWallRef.current === null || intervalStartWallRef.current === null) return false;

    const nowWall = Date.now();
    if (
      overrideStatus === 'running'
      && !force
      && !shouldPersistRunningSession({
        lastPersistAtMs: lastRunningPersistAtRef.current,
        nowMs: nowWall,
        minIntervalMs: RUNNING_PERSIST_MIN_INTERVAL_MS,
      })
    ) {
      return false;
    }

    const elapsedMs = getSessionElapsedMs();
    const intervalElapsedMs = getIntervalElapsedMs();

    saveSessionState(buildSessionSnapshot({
      overrideStatus,
      nowWall,
      sessionStartTime: sessionStartWallRef.current,
      sessionDuration: sessionDurationSec,
      intervalDuration: defaultIntervalSec,
      currentIntervalStartTime: intervalStartWallRef.current,
      currentIntervalDuration: currentIntervalDurationRef.current,
      intervalCount: intervalCountRef.current,
      intervalState: circleColorRef.current,
      elapsedMs,
      intervalElapsedMs,
      isQuickAdd: isQuickAddRef.current,
      metadata: sessionMetadataRef.current,
    }));
    if (overrideStatus === 'running') {
      lastRunningPersistAtRef.current = nowWall;
    }
    return true;
  }, [defaultIntervalSec, getIntervalElapsedMs, getSessionElapsedMs, sessionDurationSec]);

  const stopTicking = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Stable function that always calls the latest tick via ref
  const scheduleTick = useCallback(() => {
    const delayMs = tickIntervalMsRef.current;
    if (delayMs > 0) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (tickRef.current) tickRef.current();
      }, delayMs);
      return;
    }

    rafRef.current = requestAnimationFrame(() => {
      if (tickRef.current) tickRef.current();
    });
  }, []);

  const tick = useCallback(() => {
    if (statusRef.current !== 'running') {
      stopTicking();
      return;
    }

    try {
      const elapsedMs = getSessionElapsedMs();
      const elapsed = Math.floor(elapsedMs / 1000);
      setElapsedSeconds(elapsed);

      // Check if session is over — read from ref to always use current value
      if (elapsed >= sessionDurationSecRef.current) {
        playBell();
        setCompletedElapsedSeconds(elapsed);
        stopTicking();
        releaseWakeLock();
        clearCountdownTimeouts();
        setStatus('idle');
        statusRef.current = 'idle';
        clearSessionState();
        return;
      }

      // Calculate interval remaining and process completions robustly if device wakes late.
      let intervalElapsedMs = getIntervalElapsedMs();
      let activeDurationMs = Math.max(1, currentIntervalDurationRef.current * 1000);

      if (intervalElapsedMs >= activeDurationMs) {
        playBell();
        const nextState = advanceIntervalState({
          intervalElapsedMs,
          activeDurationMs,
          intervalCount: intervalCountRef.current,
          circleColor: circleColorRef.current,
          currentIntervalDurationSec: currentIntervalDurationRef.current,
          defaultIntervalSec: defaultIntervalSecRef.current,
        });

        intervalElapsedMs = nextState.intervalElapsedMs;
        activeDurationMs = nextState.activeDurationMs;
        intervalCountRef.current = nextState.intervalCount;
        circleColorRef.current = nextState.circleColor;
        currentIntervalDurationRef.current = nextState.currentIntervalDurationSec;
        isQuickAddRef.current = false;

        setIntervalCount(nextState.intervalCount);
        setCircleColor(nextState.circleColor);
        setCurrentIntervalDuration(nextState.currentIntervalDurationSec);
        setIsQuickAdd(false);

        // Reset the monotonic baseline for the new interval
        // We preserve the "overflow" time (intervalElapsedMs) into the new interval
        intervalElapsedBeforeRunRef.current = intervalElapsedMs;
        intervalRunStartMonoRef.current = monotonicNow();
        intervalStartWallRef.current = Date.now() - intervalElapsedMs;

        const remaining = Math.max(0, Math.ceil((activeDurationMs - intervalElapsedMs) / 1000));
        setIntervalRemaining(remaining);
      } else {
        const intRemaining = currentIntervalDurationRef.current - (intervalElapsedMs / 1000);
        setIntervalRemaining(Math.max(0, Math.ceil(intRemaining)));
      }

      persistSession('running');

      // Schedule next frame via stable ref — prevents stale closure when React re-renders
      scheduleTick();
    } catch (e) {
      console.error('Timer tick error:', e);
      // Try to recover next frame
      scheduleTick();
    }
  }, [
    clearCountdownTimeouts,
    getIntervalElapsedMs,
    getSessionElapsedMs,
    persistSession,
    scheduleTick,
    stopTicking,
  ]);

  // Keep tickRef in sync so scheduleTick always calls the latest tick
  tickRef.current = tick;

  const startTicking = useCallback(() => {
    stopTicking();
    // Call via ref to ensure we always use the latest tick function
    if (tickRef.current) tickRef.current();
  }, [stopTicking]);

  const startTimers = useCallback(() => {
    const nowWall = Date.now();
    const nowMono = monotonicNow();

    sessionStartWallRef.current = nowWall;
    intervalStartWallRef.current = nowWall;
    sessionRunStartMonoRef.current = nowMono;
    intervalRunStartMonoRef.current = nowMono;
    sessionElapsedBeforeRunRef.current = 0;
    intervalElapsedBeforeRunRef.current = 0;

    intervalCountRef.current = 1;
    circleColorRef.current = 'teal';
    currentIntervalDurationRef.current = defaultIntervalSec;
    isQuickAddRef.current = false;

    setIntervalCount(1);
    setCircleColor('teal');
    setCurrentIntervalDuration(defaultIntervalSec);
    setIntervalRemaining(defaultIntervalSec);
    setElapsedSeconds(0);
    setIsQuickAdd(false);
    setCompletedElapsedSeconds(0);

    setStatus('running');
    statusRef.current = 'running';

    requestWakeLock();
    startTicking();
    persistSession('running', { force: true });
  }, [defaultIntervalSec, persistSession, startTicking]);

  // Handle visibility change to immediately catch up if we fell behind
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'running') {
        // Force an immediate tick update via ref to always use latest tick
        if (tickRef.current) tickRef.current();
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const start = useCallback(() => {
    initAudio();
    clearCountdownTimeouts();
    const countdownToken = countdownTokenRef.current;

    // Safety start time for fallback
    const countdownStartTime = Date.now();

    const finalizeCountdown = () => {
      if (countdownToken !== countdownTokenRef.current) return;
      if (statusRef.current !== 'countdown') return;
      setCountdownNumber(null);
      startTimers();
    };

    setStatus('countdown');
    statusRef.current = 'countdown';
    setCountdownNumber(3);

    playCountdown(() => {
      finalizeCountdown();
    });

    // Visual countdown using timeouts (still fine for visual updates, but we need robust fallback)
    countdownTimeoutsRef.current.push(
      setTimeout(() => {
        if (countdownToken === countdownTokenRef.current && statusRef.current === 'countdown') {
          setCountdownNumber(2);
        }
      }, 1000)
    );
    countdownTimeoutsRef.current.push(
      setTimeout(() => {
        if (countdownToken === countdownTokenRef.current && statusRef.current === 'countdown') {
          setCountdownNumber(1);
        }
      }, 2000)
    );
    // Explicitly set null at 3s so "GO" or empty state is brief before start
    countdownTimeoutsRef.current.push(
      setTimeout(() => {
        if (countdownToken === countdownTokenRef.current && statusRef.current === 'countdown') {
          setCountdownNumber(null);
        }
      }, 3000)
    );

    // ROBUST FALLBACK LOOP:
    // Instead of a single queued timeout, check every frame if we've passed the safety threshold
    // This ensures that even if the browser throttles heavily, the moment it wakes up,
    // we see that time has passed and start the timer immediately.
    const checkCountdownFallback = () => {
      if (countdownToken !== countdownTokenRef.current) return;
      if (statusRef.current !== 'countdown') return;

      const elapsed = Date.now() - countdownStartTime;
      if (elapsed >= 3400) {
        finalizeCountdown();
      } else {
        requestAnimationFrame(checkCountdownFallback);
      }
    };
    requestAnimationFrame(checkCountdownFallback);

  }, [startTimers, clearCountdownTimeouts]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return;

    // Settle elapsed accumulators before stopping.
    sessionElapsedBeforeRunRef.current = getSessionElapsedMs();
    intervalElapsedBeforeRunRef.current = getIntervalElapsedMs();
    sessionRunStartMonoRef.current = null;
    intervalRunStartMonoRef.current = null;

    setStatus('paused');
    statusRef.current = 'paused';
    stopTicking();
    persistSession('paused', { force: true });
  }, [getIntervalElapsedMs, getSessionElapsedMs, persistSession, stopTicking]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;

    const nowMono = monotonicNow();
    sessionRunStartMonoRef.current = nowMono;
    intervalRunStartMonoRef.current = nowMono;

    setStatus('running');
    statusRef.current = 'running';
    requestWakeLock();
    startTicking();
    persistSession('running', { force: true });
  }, [persistSession, startTicking]);

  const stopTimers = useCallback(() => {
    stopTicking();
    clearCountdownTimeouts();
    releaseWakeLock();
  }, [clearCountdownTimeouts, stopTicking]);

  const reset = useCallback(() => {
    stopTimers();
    clearSessionState();

    sessionStartWallRef.current = null;
    intervalStartWallRef.current = null;
    sessionRunStartMonoRef.current = null;
    intervalRunStartMonoRef.current = null;
    sessionElapsedBeforeRunRef.current = 0;
    intervalElapsedBeforeRunRef.current = 0;

    intervalCountRef.current = 0;
    circleColorRef.current = 'black';
    currentIntervalDurationRef.current = defaultIntervalSec;
    isQuickAddRef.current = false;
    lastRunningPersistAtRef.current = 0;

    setStatus('idle');
    statusRef.current = 'idle';
    setElapsedSeconds(0);
    setIntervalRemaining(defaultIntervalSec);
    setIntervalCount(0);
    setCircleColor('black');
    setCountdownNumber(null);
    setCurrentIntervalDuration(defaultIntervalSec);
    setIsQuickAdd(false);
    setCompletedElapsedSeconds(0);
  }, [defaultIntervalSec, stopTimers]);

  const quickAdd = useCallback((seconds) => {
    if (statusRef.current !== 'running') return;

    const nowWall = Date.now();
    const nowMono = monotonicNow();

    currentIntervalDurationRef.current = seconds;
    setCurrentIntervalDuration(seconds);
    isQuickAddRef.current = true;
    setIsQuickAdd(true);

    // Switch to rest mode (green) for rest periods
    circleColorRef.current = 'rest';
    setCircleColor('rest');

    intervalElapsedBeforeRunRef.current = 0;
    intervalRunStartMonoRef.current = nowMono;
    intervalStartWallRef.current = nowWall;
    setIntervalRemaining(seconds);

    persistSession('running', { force: true });
  }, [persistSession]);

  // Resume from saved session on mount
  const resumeSession = useCallback((savedState) => {
    initAudio();

    if (!savedState || !savedState.sessionActive) return false;

    const nowWall = Date.now();
    const resumeState = deriveResumedIntervalState(savedState, nowWall);

    if (resumeState.elapsed >= savedState.sessionDuration) {
      clearSessionState();
      return false;
    }

    const persistedElapsedMs = safeMs(savedState.elapsedMs);
    const persistedIntervalElapsedMs = safeMs(savedState.intervalElapsedMs);
    const resumedElapsedMs = persistedElapsedMs > 0 ? persistedElapsedMs : (resumeState.elapsed * 1000);
    const resumedIntervalElapsedMs = persistedIntervalElapsedMs > 0
      ? persistedIntervalElapsedMs
      : (resumeState.timeIntoCurrentInterval * 1000);

    sessionStartWallRef.current = nowWall - resumedElapsedMs;
    intervalStartWallRef.current = nowWall - resumedIntervalElapsedMs;
    sessionElapsedBeforeRunRef.current = resumedElapsedMs;
    intervalElapsedBeforeRunRef.current = resumedIntervalElapsedMs;
    intervalCountRef.current = resumeState.intervalCount;
    circleColorRef.current = resumeState.intervalState;
    currentIntervalDurationRef.current = resumeState.currentIntervalDuration;
    isQuickAddRef.current = resumeState.isQuickAdd;

    const resumedStatus = resolveResumedSessionStatus(savedState);
    if (resumedStatus === 'running') {
      const nowMono = monotonicNow();
      sessionRunStartMonoRef.current = nowMono;
      intervalRunStartMonoRef.current = nowMono;
    } else {
      sessionRunStartMonoRef.current = null;
      intervalRunStartMonoRef.current = null;
    }

    setElapsedSeconds(resumeState.elapsed);
    setIntervalRemaining(resumeState.intervalRemaining);
    setIntervalCount(resumeState.intervalCount);
    setCircleColor(resumeState.intervalState);
    setCurrentIntervalDuration(resumeState.currentIntervalDuration);
    setIsQuickAdd(resumeState.isQuickAdd);
    setCompletedElapsedSeconds(0);

    if (resumedStatus === 'paused') {
      setStatus('paused');
      statusRef.current = 'paused';
      stopTicking();
      releaseWakeLock();
      persistSession('paused', { force: true });
    } else {
      setStatus('running');
      statusRef.current = 'running';
      requestWakeLock();
      startTicking();
      persistSession('running', { force: true });
    }

    return true;
  }, [persistSession, startTicking, stopTicking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTicking();
      clearCountdownTimeouts();
      releaseWakeLock();
    };
  }, [clearCountdownTimeouts, stopTicking]);

  const totalIntervals = defaultIntervalSec > 0
    ? Math.ceil(sessionDurationSec / defaultIntervalSec)
    : 0;

  // Progress (0 to 1) for the interval circle
  const intervalProgress = currentIntervalDuration > 0
    ? 1 - (intervalRemaining / currentIntervalDuration)
    : 0;

  return {
    status,
    elapsedSeconds,
    intervalRemaining,
    intervalCount,
    totalIntervals,
    circleColor,
    countdownNumber,
    currentIntervalDuration,
    isQuickAdd,
    completedElapsedSeconds,
    intervalProgress,
    start,
    pause,
    resume,
    reset,
    quickAdd,
    resumeSession,
    persistSession,
  };
}
