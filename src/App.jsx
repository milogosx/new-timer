import { useEffect, useState } from 'react';
import HomeScreen from './components/HomeScreen';
import TimerScreen from './components/TimerScreen';
import WorkoutLibrary from './components/WorkoutLibrary';
import WorkoutEditor from './components/WorkoutEditor';
import WarmupEditor from './components/WarmupEditor';
import CardioEditor from './components/CardioEditor';
import { initBackgroundMusic, startBackgroundMusic } from './utils/audioManager';
import { bindCloudSyncLifecycle, bootstrapCloudProfile } from './utils/cloudProfileSync';
import { SCREENS, EDITOR_RETURN } from './constants/appState';
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
    batterySaverMode: false,
  });
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [editingWarmup, setEditingWarmup] = useState(null);
  const [editingCardio, setEditingCardio] = useState(null);
  // Track where editor should return to ('home' or 'library')
  const [editorReturnTo, setEditorReturnTo] = useState(EDITOR_RETURN.LIBRARY);
  const [storageRevision, setStorageRevision] = useState(0);

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
    initBackgroundMusic();

    let hasHandledFirstInteraction = false;

    const handleFirstInteraction = () => {
      if (hasHandledFirstInteraction) return;
      hasHandledFirstInteraction = true;
      startBackgroundMusic();
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
    let cancelled = false;
    bindCloudSyncLifecycle();

    async function initializeCloudProfile() {
      const result = await bootstrapCloudProfile();
      if (!cancelled && result?.status === 'hydrated') {
        setStorageRevision((previous) => previous + 1);
      }
    }

    void initializeCloudProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleStartTimer(sessionMinutes, intervalSeconds, workout, options = {}) {
    setTimerConfig({
      sessionMinutes,
      intervalSeconds,
      workout,
      batterySaverMode: Boolean(options.batterySaverMode),
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

  function handleEditorSave() {
    setScreen(editorReturnTo);
  }

  function handleEditorCancel() {
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

  function handleWarmupEditorSave() {
    setScreen(SCREENS.LIBRARY);
  }

  function handleWarmupEditorCancel() {
    setScreen(SCREENS.LIBRARY);
  }

  function handleEditCardio(cardio) {
    setEditingCardio(cardio);
    setScreen(SCREENS.CARDIO_EDITOR);
  }

  function handleCreateCardio() {
    setEditingCardio(null);
    setScreen(SCREENS.CARDIO_EDITOR);
  }

  function handleCardioEditorSave() {
    setScreen(SCREENS.LIBRARY);
  }

  function handleCardioEditorCancel() {
    setScreen(SCREENS.LIBRARY);
  }

  function handleLibraryBack() {
    setScreen(SCREENS.HOME);
  }

  return (
    <div className="app">
      {screen === SCREENS.HOME && (
        <HomeScreen
          key={`home-${storageRevision}`}
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
          batterySaverMode={timerConfig.batterySaverMode}
          onBack={handleBackToHome}
        />
      )}
      {screen === SCREENS.LIBRARY && (
        <WorkoutLibrary
          key={`library-${storageRevision}`}
          onBack={handleLibraryBack}
          onEdit={handleEditWorkout}
          onCreate={handleCreateWorkoutFromLibrary}
          onCreateWarmup={handleCreateWarmup}
          onEditWarmup={handleEditWarmup}
          onCreateCardio={handleCreateCardio}
          onEditCardio={handleEditCardio}
        />
      )}
      {screen === SCREENS.EDITOR && (
        <WorkoutEditor
          workout={editingWorkout}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
      {screen === SCREENS.WARMUP_EDITOR && (
        <WarmupEditor
          warmup={editingWarmup}
          onSave={handleWarmupEditorSave}
          onCancel={handleWarmupEditorCancel}
        />
      )}
      {screen === SCREENS.CARDIO_EDITOR && (
        <CardioEditor
          cardio={editingCardio}
          onSave={handleCardioEditorSave}
          onCancel={handleCardioEditorCancel}
        />
      )}
    </div>
  );
}

export default App;
