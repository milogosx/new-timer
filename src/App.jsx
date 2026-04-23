import { useEffect, useState } from 'react';
import HomeScreen from './components/HomeScreen';
import TimerScreen from './components/TimerScreen';
import WorkoutLibrary from './components/WorkoutLibrary';
import WorkoutEditor from './components/WorkoutEditor';
import WarmupEditor from './components/WarmupEditor';
import CardioEditor from './components/CardioEditor';
import { bindCloudSyncLifecycle, bootstrapCloudProfile } from './utils/cloudProfileSync';
import { getIntervalRuntimeCapabilities, initializeIntervalRuntime } from './platform/intervalRuntimeBridge';
import { SCREENS, EDITOR_RETURN } from './constants/appState';
import { logBuildInfoOnce } from './config/buildInfo';
import './App.css';

function App() {
  // Theme: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('er-timer-theme') || 'dark';
  });

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('er-timer-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      // Update theme-color meta tag for mobile browsers
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = next === 'dark' ? '#0A0A0F' : '#FFBF00';
      return next;
    });
  }

  const [screen, setScreen] = useState(SCREENS.HOME);
  const [timerConfig, setTimerConfig] = useState({
    sessionMinutes: 60,
    intervalSeconds: 30,
    workout: null,
  });
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [editingWarmup, setEditingWarmup] = useState(null);
  const [editingCardio, setEditingCardio] = useState(null);
  // Track where editor should return to ('home' or 'library')
  const [editorReturnTo, setEditorReturnTo] = useState(EDITOR_RETURN.LIBRARY);
  const [profileRevision, setProfileRevision] = useState(0);

  // Detect PWA standalone mode (iOS uses navigator.standalone, Android uses matchMedia)
  useEffect(() => {
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      document.documentElement.classList.add('is-pwa');
    }
  }, []);

  useEffect(() => {
    let hasHandledFirstInteraction = false;

    const handleFirstInteraction = () => {
      if (hasHandledFirstInteraction) return;
      hasHandledFirstInteraction = true;
      void initializeIntervalRuntime();
      removeListeners();
    };

    const removeListeners = () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstInteraction);

    return removeListeners;
  }, []);

  useEffect(() => {
    logBuildInfoOnce();
  }, []);

  useEffect(() => {
    let cancelled = false;
    bindCloudSyncLifecycle();

    async function initializeCloudProfile() {
      const capabilities = getIntervalRuntimeCapabilities();
      const result = await bootstrapCloudProfile();
      if (!cancelled && result?.status === 'hydrated') {
        setProfileRevision((previous) => previous + 1);
      }
      if (!cancelled && capabilities.nativeShell) {
        document.documentElement.classList.add('is-native-shell');
      }
    }

    void initializeCloudProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleStartTimer(sessionMinutes, intervalSeconds, workout) {
    setTimerConfig({
      sessionMinutes,
      intervalSeconds,
      workout,
    });
    setScreen(SCREENS.TIMER);
  }

  function handleBackToHome() {
    setScreen(SCREENS.HOME);
  }

  function handleManageWorkouts() {
    setScreen(SCREENS.LIBRARY);
  }

  function handleEditWorkout(workout) {
    setEditingWorkout(workout);
    setEditorReturnTo(EDITOR_RETURN.LIBRARY);
    setScreen(SCREENS.EDITOR);
  }

  // From library
  function handleCreateWorkoutFromLibrary() {
    setEditingWorkout(null);
    setEditorReturnTo(EDITOR_RETURN.LIBRARY);
    setScreen(SCREENS.EDITOR);
  }

  // From home screen (+ CREATE NEW WORKOUT)
  function handleCreateWorkoutFromHome() {
    setEditingWorkout(null);
    setEditorReturnTo(EDITOR_RETURN.HOME);
    setScreen(SCREENS.EDITOR);
  }

  function handleEditorDone() {
    setScreen(editorReturnTo);
  }

  function handleEditWarmup(warmup) {
    setEditingWarmup(warmup);
    setScreen(SCREENS.WARMUP_EDITOR);
  }

  function handleCreateWarmup() {
    setEditingWarmup(null);
    setScreen(SCREENS.WARMUP_EDITOR);
  }

  function handleEditCardio(cardio) {
    setEditingCardio(cardio);
    setScreen(SCREENS.CARDIO_EDITOR);
  }

  function handleCreateCardio() {
    setEditingCardio(null);
    setScreen(SCREENS.CARDIO_EDITOR);
  }

  function handleReturnToLibrary() {
    setScreen(SCREENS.LIBRARY);
  }

  function handleLibraryBack() {
    setScreen(SCREENS.HOME);
  }

  function handleProfileChanged() {
    setProfileRevision((previous) => previous + 1);
  }

  return (
    <div className="app">
      {screen === SCREENS.HOME && (
        <HomeScreen
          key={`home-${profileRevision}`}
          onStartTimer={handleStartTimer}
          onManageWorkouts={handleManageWorkouts}
          onCreateWorkout={handleCreateWorkoutFromHome}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      {screen === SCREENS.TIMER && (
        <TimerScreen
          sessionMinutes={timerConfig.sessionMinutes}
          intervalSeconds={timerConfig.intervalSeconds}
          workout={timerConfig.workout}
          onBack={handleBackToHome}
        />
      )}
      {screen === SCREENS.LIBRARY && (
        <WorkoutLibrary
          key={`library-${profileRevision}`}
          onBack={handleLibraryBack}
          onEdit={handleEditWorkout}
          onCreate={handleCreateWorkoutFromLibrary}
          onCreateWarmup={handleCreateWarmup}
          onEditWarmup={handleEditWarmup}
          onCreateCardio={handleCreateCardio}
          onEditCardio={handleEditCardio}
          onProfileChanged={handleProfileChanged}
        />
      )}
      {screen === SCREENS.EDITOR && (
        <WorkoutEditor
          workout={editingWorkout}
          onProfileChanged={handleProfileChanged}
          onSave={handleEditorDone}
          onCancel={handleEditorDone}
        />
      )}
      {screen === SCREENS.WARMUP_EDITOR && (
        <WarmupEditor
          warmup={editingWarmup}
          onProfileChanged={handleProfileChanged}
          onSave={handleReturnToLibrary}
          onCancel={handleReturnToLibrary}
        />
      )}
      {screen === SCREENS.CARDIO_EDITOR && (
        <CardioEditor
          cardio={editingCardio}
          onProfileChanged={handleProfileChanged}
          onSave={handleReturnToLibrary}
          onCancel={handleReturnToLibrary}
        />
      )}
    </div>
  );
}

export default App;
