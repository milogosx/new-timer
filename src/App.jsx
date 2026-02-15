import { useEffect, useState } from 'react';
import HomeScreen from './components/HomeScreen';
import TimerScreen from './components/TimerScreen';
import WorkoutLibrary from './components/WorkoutLibrary';
import WorkoutEditor from './components/WorkoutEditor';
import WarmupEditor from './components/WarmupEditor';
import CardioEditor from './components/CardioEditor';
import { initBackgroundMusic, startBackgroundMusic } from './utils/audioManager';
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

  // Screen: 'home' | 'timer' | 'library' | 'editor' | 'warmup-editor'
  const [screen, setScreen] = useState('home');
  const [timerConfig, setTimerConfig] = useState({
    sessionMinutes: 60,
    intervalSeconds: 30,
    workout: null,
  });
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [editingWarmup, setEditingWarmup] = useState(null);
  const [editingCardio, setEditingCardio] = useState(null);
  // Track where editor should return to ('home' or 'library')
  const [editorReturnTo, setEditorReturnTo] = useState('library');

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

  function handleStartTimer(sessionMinutes, intervalSeconds, workout) {
    setTimerConfig({ sessionMinutes, intervalSeconds, workout });
    setScreen('timer');
  }

  function handleBackToHome() {
    setScreen('home');
  }

  function handleManageWorkouts() {
    setScreen('library');
  }

  function handleEditWorkout(workout) {
    setEditingWorkout(workout);
    setEditorReturnTo('library');
    setScreen('editor');
  }

  // From library
  function handleCreateWorkoutFromLibrary() {
    setEditingWorkout(null);
    setEditorReturnTo('library');
    setScreen('editor');
  }

  // From home screen (+ CREATE NEW WORKOUT)
  function handleCreateWorkoutFromHome() {
    setEditingWorkout(null);
    setEditorReturnTo('home');
    setScreen('editor');
  }

  function handleEditorSave() {
    setScreen(editorReturnTo);
  }

  function handleEditorCancel() {
    setScreen(editorReturnTo);
  }

  function handleEditWarmup(warmup) {
    setEditingWarmup(warmup);
    setScreen('warmup-editor');
  }

  function handleCreateWarmup() {
    setEditingWarmup(null);
    setScreen('warmup-editor');
  }

  function handleWarmupEditorSave() {
    setScreen('library');
  }

  function handleWarmupEditorCancel() {
    setScreen('library');
  }

  function handleEditCardio(cardio) {
    setEditingCardio(cardio);
    setScreen('cardio-editor');
  }

  function handleCreateCardio() {
    setEditingCardio(null);
    setScreen('cardio-editor');
  }

  function handleCardioEditorSave() {
    setScreen('library');
  }

  function handleCardioEditorCancel() {
    setScreen('library');
  }

  function handleLibraryBack() {
    setScreen('home');
  }

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          onStartTimer={handleStartTimer}
          onManageWorkouts={handleManageWorkouts}
          onCreateWorkout={handleCreateWorkoutFromHome}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      {screen === 'timer' && (
        <TimerScreen
          sessionMinutes={timerConfig.sessionMinutes}
          intervalSeconds={timerConfig.intervalSeconds}
          workout={timerConfig.workout}
          onBack={handleBackToHome}
        />
      )}
      {screen === 'library' && (
        <WorkoutLibrary
          onBack={handleLibraryBack}
          onEdit={handleEditWorkout}
          onCreate={handleCreateWorkoutFromLibrary}
          onCreateWarmup={handleCreateWarmup}
          onEditWarmup={handleEditWarmup}
          onCreateCardio={handleCreateCardio}
          onEditCardio={handleEditCardio}
        />
      )}
      {screen === 'editor' && (
        <WorkoutEditor
          workout={editingWorkout}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
      {screen === 'warmup-editor' && (
        <WarmupEditor
          warmup={editingWarmup}
          onSave={handleWarmupEditorSave}
          onCancel={handleWarmupEditorCancel}
        />
      )}
      {screen === 'cardio-editor' && (
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
