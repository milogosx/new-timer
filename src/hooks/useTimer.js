import { useState, useRef, useCallback, useEffect } from 'react';
import {
  deriveResumedIntervalState,
  resolveResumedSessionStatus,
} from '../utils/timerLogic';
import {
  clearMirroredActiveSession,
  ensureIntervalCueingReady,
  getIntervalRuntimeCapabilities,
  initializeIntervalRuntime,
  mirrorActiveSession,
  playCountdownCue,
  playIntervalCue,
  readMirroredActiveSession,
  recoverIntervalCueing,
  startIntervalKeepAlive,
  stopIntervalKeepAlive,
} from '../platform/intervalRuntimeBridge';
import { saveSessionState, clearSessionState } from '../utils/storage';
import { requestWakeLock, releaseWakeLock } from '../utils/wakeLock';
import { buildSessionSnapshot } from '../utils/sessionSnapshot';
import { advanceIntervalState } from '../utils/timerTickMath';
import { shouldPersistRunningSession } from '../utils/sessionPersistenceCadence';
import { traceRuntime } from '../utils/runtimeTrace';

const RUNNING_PERSIST_MIN_INTERVAL_MS = 1000;
const TICK_INTERVAL_MS = 500;

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

export function useTimer(
  sessionMinutes,
  intervalSeconds,
  sessionMetadata = null,
) {
  const sessionDurationSec = sessionMinutes * 60;

  // Refs for values used inside tick to avoid stale closures when React re-renders
  const sessionDurationSecRef = useRef(sessionDurationSec);
  const defaultIntervalSecRef = useRef(intervalSeconds);
  sessionDurationSecRef.current = sessionDurationSec;
  defaultIntervalSecRef.current = intervalSeconds;

  // Timer state
  const [status, setStatus] = useState('idle'); // idle | countdown | running | paused
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [intervalRemaining, setIntervalRemaining] = useState(intervalSeconds);
  const [intervalCount, setIntervalCount] = useState(0);
  const [circleColor, setCircleColor] = useState('black');
  const [countdownNumber, setCountdownNumber] = useState(null);
  const [currentIntervalDuration, setCurrentIntervalDuration] = useState(intervalSeconds);
  const [isQuickAdd, setIsQuickAdd] = useState(false);
  const [completedElapsedSeconds, setCompletedElapsedSeconds] = useState(0);

  const isOvertime = elapsedSeconds >= sessionDurationSec;

  // Refs for monotonic runtime timing and wall-clock persistence
  const sessionStartWallRef = useRef(null);
  const intervalStartWallRef = useRef(null);
  const sessionRunStartMonoRef = useRef(null);
  const intervalRunStartMonoRef = useRef(null);
  const sessionElapsedBeforeRunRef = useRef(0);
  const intervalElapsedBeforeRunRef = useRef(0);

  const timeoutRef = useRef(null);
  const tickRef = useRef(null);
  const intervalCountRef = useRef(0);
  const circleColorRef = useRef('black');
  const currentIntervalDurationRef = useRef(intervalSeconds);
  const isQuickAddRef = useRef(false);
  const statusRef = useRef('idle');
  const countdownTimeoutsRef = useRef([]);
  const countdownTokenRef = useRef(0);
  const sessionMetadataRef = useRef(sessionMetadata);
  const lastRunningPersistAtRef = useRef(0);
  const overtimeBellPlayedRef = useRef(false);

  const nativeRuntimeOwnsCueScheduling = useCallback(() => {
    const capabilities = getIntervalRuntimeCapabilities();
    return capabilities.nativeShell && capabilities.nativePluginAvailable;
  }, []);

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

    const sessionSnapshot = buildSessionSnapshot({
      overrideStatus,
      nowWall,
      sessionStartTime: sessionStartWallRef.current,
      sessionDuration: sessionDurationSec,
      intervalDuration: intervalSeconds,
      currentIntervalStartTime: intervalStartWallRef.current,
      currentIntervalDuration: currentIntervalDurationRef.current,
      intervalCount: intervalCountRef.current,
      intervalState: circleColorRef.current,
      elapsedMs,
      intervalElapsedMs,
      isQuickAdd: isQuickAddRef.current,
      metadata: sessionMetadataRef.current,
    });

    saveSessionState(sessionSnapshot);
    void mirrorActiveSession(sessionSnapshot);
    if (overrideStatus === 'running') {
      lastRunningPersistAtRef.current = nowWall;
    }
    return true;
  }, [intervalSeconds, getIntervalElapsedMs, getSessionElapsedMs, sessionDurationSec]);

  const stopTicking = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Stable function that always calls the latest tick via ref
  const scheduleTick = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (tickRef.current) tickRef.current();
    }, TICK_INTERVAL_MS);
  }, []);

  const tick = useCallback(() => {
    if (statusRef.current !== 'running') {
      stopTicking();
      return;
    }

    try {
      const nativeSchedulingOwnsCueing = nativeRuntimeOwnsCueScheduling();
      const elapsedMs = getSessionElapsedMs();
        const elapsed = Math.floor(elapsedMs / 1000);
        setElapsedSeconds(elapsed);

        // Check if session has crossed into overtime (use >= so throttled ticks can't skip it)
        if (!overtimeBellPlayedRef.current && elapsed >= sessionDurationSecRef.current && elapsed > 0) {
          overtimeBellPlayedRef.current = true;
          if (!nativeSchedulingOwnsCueing) {
            void playIntervalCue();
          }
        }

      // Calculate interval remaining and process completions robustly if device wakes late.
      let intervalElapsedMs = getIntervalElapsedMs();
      let activeDurationMs = Math.max(1, currentIntervalDurationRef.current * 1000);

      if (intervalElapsedMs >= activeDurationMs) {
        if (!nativeSchedulingOwnsCueing) {
          void playIntervalCue();
        }
        const previousIntervalCount = intervalCountRef.current;
        const previousColor = circleColorRef.current;
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
        traceRuntime('timer.interval_transition', {
          previousIntervalCount,
          nextIntervalCount: nextState.intervalCount,
          previousColor,
          nextColor: nextState.circleColor,
          nextIntervalDurationSec: nextState.currentIntervalDurationSec,
        });

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
    getIntervalElapsedMs,
    getSessionElapsedMs,
    nativeRuntimeOwnsCueScheduling,
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

  const applyPersistedSession = useCallback((savedState, options = {}) => {
    if (!savedState || !savedState.sessionActive) return false;

    const nowWall = Date.now();
    const resumeState = deriveResumedIntervalState(savedState, nowWall);

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
    overtimeBellPlayedRef.current = Boolean(savedState.nativeOvertimeCuePlayed);

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

    traceRuntime('timer.session_applied', {
      source: options.source ?? 'unknown',
      resumedStatus,
      elapsedSeconds: resumeState.elapsed,
      intervalCount: resumeState.intervalCount,
      intervalRemaining: resumeState.intervalRemaining,
      currentIntervalDuration: resumeState.currentIntervalDuration,
    });

    if (options.syncLocalStorage) {
      saveSessionState(savedState);
    }

    if (resumedStatus === 'paused') {
      setStatus('paused');
      statusRef.current = 'paused';
      stopTicking();
      releaseWakeLock();
      if (options.rePersist !== false) {
        persistSession('paused', { force: true });
      }
    } else {
      setStatus('running');
      statusRef.current = 'running';
      requestWakeLock();
      void startIntervalKeepAlive();
      void ensureIntervalCueingReady();
      startTicking();
      if (options.rePersist !== false) {
        persistSession('running', { force: true });
      }
    }

    return true;
  }, [persistSession, startTicking, stopTicking]);

  const syncNativeSession = useCallback(async () => {
    if (!nativeRuntimeOwnsCueScheduling()) {
      return false;
    }

    const nativeSession = await readMirroredActiveSession();
    if (!nativeSession?.sessionActive) {
      return false;
    }

    const didApply = applyPersistedSession(nativeSession, {
      rePersist: false,
      syncLocalStorage: true,
      source: 'native-mirror',
    });
    if (didApply) {
      traceRuntime('timer.native_sync_applied', {
        sessionStatus: nativeSession.sessionStatus ?? null,
        intervalCount: nativeSession.intervalCount ?? 0,
        elapsedMs: Math.round(safeMs(nativeSession.elapsedMs)),
      });
    }

    return didApply;
  }, [applyPersistedSession, nativeRuntimeOwnsCueScheduling]);

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
    currentIntervalDurationRef.current = intervalSeconds;
    isQuickAddRef.current = false;
    overtimeBellPlayedRef.current = false;

    setIntervalCount(1);
    setCircleColor('teal');
    setCurrentIntervalDuration(intervalSeconds);
    setIntervalRemaining(intervalSeconds);
    setElapsedSeconds(0);
    setIsQuickAdd(false);
    setCompletedElapsedSeconds(0);

    setStatus('running');
    statusRef.current = 'running';

    requestWakeLock();
    void startIntervalKeepAlive();
    startTicking();
    persistSession('running', { force: true });
    traceRuntime('timer.started', {
      sessionDurationSec,
      intervalSeconds,
      intervalCount: 1,
    });
  }, [intervalSeconds, persistSession, sessionDurationSec, startTicking]);

  // Handle visibility change to immediately catch up if we fell behind
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible'
        && (statusRef.current === 'running' || statusRef.current === 'paused')
      ) {
        traceRuntime('timer.visibility_visible', {
          status: statusRef.current,
        });
        void (async () => {
          if (statusRef.current === 'running') {
            traceRuntime('timer.native_sync_requested', {
              status: statusRef.current,
            });
            await syncNativeSession();
            await startIntervalKeepAlive();
          }

          await ensureIntervalCueingReady();
          if (statusRef.current === 'running' && tickRef.current) {
            tickRef.current();
          }
          requestWakeLock();
        })();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncNativeSession]);

  const start = useCallback(() => {
    void initializeIntervalRuntime();
    // iOS fallback wake-lock strategies require a direct user gesture.
    // Request once on START tap, then keep requesting during active session lifecycle.
    void requestWakeLock();
    clearCountdownTimeouts();
    const countdownToken = countdownTokenRef.current;
    traceRuntime('timer.start_requested', {
      sessionDurationSec,
      intervalSeconds,
      ownsCueScheduling: nativeRuntimeOwnsCueScheduling(),
    });

    // Safety start time for fallback
    const countdownStartTime = Date.now();

    const finalizeCountdown = () => {
      if (countdownToken !== countdownTokenRef.current) return;
      if (statusRef.current !== 'countdown') return;
      traceRuntime('timer.countdown_completed');
      setCountdownNumber(null);
      startTimers();
    };

    setStatus('countdown');
    statusRef.current = 'countdown';
    setCountdownNumber(3);
    traceRuntime('timer.countdown_started', {
      initialValue: 3,
    });

    playCountdownCue(() => {
      finalizeCountdown();
    });

    // Visual countdown using timeouts (still fine for visual updates, but we need robust fallback)
    countdownTimeoutsRef.current.push(
      setTimeout(() => {
        if (countdownToken === countdownTokenRef.current && statusRef.current === 'countdown') {
          setCountdownNumber(2);
          traceRuntime('timer.countdown_tick', { value: 2 });
        }
      }, 1000)
    );
    countdownTimeoutsRef.current.push(
      setTimeout(() => {
        if (countdownToken === countdownTokenRef.current && statusRef.current === 'countdown') {
          setCountdownNumber(1);
          traceRuntime('timer.countdown_tick', { value: 1 });
        }
      }, 2000)
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

  }, [
    clearCountdownTimeouts,
    intervalSeconds,
    nativeRuntimeOwnsCueScheduling,
    sessionDurationSec,
    startTimers,
  ]);

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
    void stopIntervalKeepAlive();
    persistSession('paused', { force: true });
    traceRuntime('timer.paused', {
      elapsedSeconds: Math.floor(sessionElapsedBeforeRunRef.current / 1000),
      intervalCount: intervalCountRef.current,
    });
  }, [getIntervalElapsedMs, getSessionElapsedMs, persistSession, stopTicking]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;

    const nowMono = monotonicNow();
    sessionRunStartMonoRef.current = nowMono;
    intervalRunStartMonoRef.current = nowMono;

    setStatus('running');
    statusRef.current = 'running';
    requestWakeLock();
    void startIntervalKeepAlive();
    void ensureIntervalCueingReady();
    startTicking();
    persistSession('running', { force: true });
    traceRuntime('timer.resumed', {
      elapsedSeconds: Math.floor(sessionElapsedBeforeRunRef.current / 1000),
      intervalCount: intervalCountRef.current,
    });
  }, [persistSession, startTicking]);

  const stopTimers = useCallback(() => {
    stopTicking();
    clearCountdownTimeouts();
    releaseWakeLock();
    void stopIntervalKeepAlive();
  }, [clearCountdownTimeouts, stopTicking]);

  const reset = useCallback(() => {
    const statusBeforeReset = statusRef.current;
    const elapsedBeforeReset = Math.floor(getSessionElapsedMs() / 1000);
    const sessionDurBeforeReset = sessionDurationSecRef.current;
    const completedInOvertime =
      sessionDurBeforeReset > 0 && elapsedBeforeReset >= sessionDurBeforeReset;
    stopTimers();
    clearSessionState();
    void clearMirroredActiveSession();

    sessionStartWallRef.current = null;
    intervalStartWallRef.current = null;
    sessionRunStartMonoRef.current = null;
    intervalRunStartMonoRef.current = null;
    sessionElapsedBeforeRunRef.current = 0;
    intervalElapsedBeforeRunRef.current = 0;

    intervalCountRef.current = 0;
    circleColorRef.current = 'black';
    currentIntervalDurationRef.current = intervalSeconds;
    isQuickAddRef.current = false;
    lastRunningPersistAtRef.current = 0;
    overtimeBellPlayedRef.current = false;

    setStatus('idle');
    statusRef.current = 'idle';
    setElapsedSeconds(0);
    setIntervalRemaining(intervalSeconds);
    setIntervalCount(0);
    setCircleColor('black');
    setCountdownNumber(null);
    setCurrentIntervalDuration(intervalSeconds);
    setIsQuickAdd(false);
    setCompletedElapsedSeconds(completedInOvertime ? elapsedBeforeReset : 0);
    traceRuntime('timer.reset', {
      statusBeforeReset,
      completedInOvertime,
      elapsedBeforeReset,
    });
  }, [getSessionElapsedMs, intervalSeconds, stopTimers]);

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
    traceRuntime('timer.quick_add', {
      seconds,
      intervalCount: intervalCountRef.current,
    });
  }, [persistSession]);

  const recoverAudio = useCallback(async () => {
    const currentStatus = statusRef.current;
    if (currentStatus !== 'running' && currentStatus !== 'paused') return false;
    traceRuntime('timer.audio_recovery_requested', {
      status: currentStatus,
    });

    void initializeIntervalRuntime();

    if (currentStatus === 'running') {
      requestWakeLock();
      void startIntervalKeepAlive();
    }

    return recoverIntervalCueing();
  }, []);

  // Resume from saved session on mount
  const resumeSession = useCallback((savedState) => {
    void initializeIntervalRuntime();

    return applyPersistedSession(savedState, {
      rePersist: true,
      syncLocalStorage: true,
      source: 'saved-session',
    });
  }, [applyPersistedSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTicking();
      clearCountdownTimeouts();
      releaseWakeLock();
      void stopIntervalKeepAlive();
    };
  }, [clearCountdownTimeouts, stopTicking]);

  const totalIntervals = intervalSeconds > 0
    ? Math.ceil(sessionDurationSec / intervalSeconds)
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
    isOvertime,
    start,
    pause,
    resume,
    reset,
    quickAdd,
    recoverAudio,
    resumeSession,
    persistSession,
  };
}
