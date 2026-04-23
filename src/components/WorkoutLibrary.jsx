import { useState } from 'react';
import {
  deleteWorkout,
  togglePinWorkout,
  resetAllWorkouts,
  deleteWarmup,
  deleteCardio,
  resetAllWarmups,
  resetAllCardios,
} from '../utils/workoutStorage';
import { loadWorkoutLibraryData, sortWorkouts } from '../utils/workoutReadModels';
import './WorkoutLibrary.css';

const TYPE_LABELS = {
  strength: 'STRENGTH',
  cardio: 'CARDIO',
  mobility: 'MOBILITY',
  hiit: 'HIIT',
  other: 'OTHER',
};

function libIconFor(workout) {
  const name = (workout.name || '').toLowerCase();
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (workout.type === 'cardio' || /engine|run|row|bike|cycle/.test(name)) {
    return <svg {...common}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M8 12h2l1.5-2 1 3 1.5-2H16"/></svg>;
  }
  if (/pull|push|power|bolt|hiit|snatch|clean|jerk/.test(name) || workout.type === 'hiit') {
    return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
  }
  if (/flow|mobility|stretch|prime|yoga/.test(name) || workout.type === 'mobility') {
    return <svg {...common}><path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>;
  }
  return <svg {...common}><line x1="6" y1="19" x2="6" y2="11"/><line x1="12" y1="19" x2="12" y2="6"/><line x1="18" y1="19" x2="18" y2="14"/></svg>;
}

function stopwatchIcon() {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  return <svg {...common}><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9v4.5l2.5 2"/><path d="M9 3h6"/><path d="M19 5l1 1"/></svg>;
}

export default function WorkoutLibrary({
  onBack,
  onEdit,
  onCreate,
  onCreateWarmup,
  onEditWarmup,
  onCreateCardio,
  onEditCardio,
  onProfileChanged,
}) {
  const initialLibraryData = loadWorkoutLibraryData();
  const [workouts, setWorkouts] = useState(() => initialLibraryData.workouts);
  const [warmups, setWarmups] = useState(() => initialLibraryData.warmups);
  const [cardios, setCardios] = useState(() => initialLibraryData.cardios);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showDeleteWarmupConfirm, setShowDeleteWarmupConfirm] = useState(null);
  const [showDeleteCardioConfirm, setShowDeleteCardioConfirm] = useState(null);

  function handlePin(id) {
    const updated = togglePinWorkout(id);
    setWorkouts(sortWorkouts(updated));
    onProfileChanged();
  }

  function handleDelete(id) {
    setShowDeleteConfirm(id);
  }

  function confirmDelete() {
    if (showDeleteConfirm) {
      const updated = deleteWorkout(showDeleteConfirm);
      setWorkouts(sortWorkouts(updated));
      onProfileChanged();
    }
    setShowDeleteConfirm(null);
  }

  function handleDeleteWarmup(id) {
    setShowDeleteWarmupConfirm(id);
  }

  function confirmDeleteWarmup() {
    if (showDeleteWarmupConfirm) {
      deleteWarmup(showDeleteWarmupConfirm);
      const nextLibraryData = loadWorkoutLibraryData();
      setWarmups(nextLibraryData.warmups);
      setWorkouts(nextLibraryData.workouts);
      onProfileChanged();
    }
    setShowDeleteWarmupConfirm(null);
  }

  function handleDeleteCardio(id) {
    setShowDeleteCardioConfirm(id);
  }

  function confirmDeleteCardio() {
    if (showDeleteCardioConfirm) {
      deleteCardio(showDeleteCardioConfirm);
      const nextLibraryData = loadWorkoutLibraryData();
      setCardios(nextLibraryData.cardios);
      setWorkouts(nextLibraryData.workouts);
      onProfileChanged();
    }
    setShowDeleteCardioConfirm(null);
  }

  function handleResetAll() {
    setShowResetConfirm(true);
  }

  function confirmResetAll() {
    resetAllWorkouts();
    resetAllWarmups();
    resetAllCardios();
    const nextLibraryData = loadWorkoutLibraryData();
    setWorkouts(nextLibraryData.workouts);
    setWarmups(nextLibraryData.warmups);
    setCardios(nextLibraryData.cardios);
    setShowResetConfirm(false);
    onProfileChanged();
  }

  return (
    <div className="workout-library">
      <header className="lib-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="lib-title-stack">
          <span className="lib-title-kicker">MANAGE</span>
          <h1 className="lib-title">WORKOUTS</h1>
        </div>
        <div style={{ width: 44 }} />
      </header>

      <button className="lib-create-btn" onClick={onCreate}>
        + CREATE NEW WORKOUT
      </button>

      <div className="lib-list">
        {workouts.map((workout) => (
          <div key={workout.id} className={`lib-card ${workout.pinned ? 'lib-card-pinned' : ''}`}>
            <div className="lib-card-header">
              <span className="lib-card-icon">{libIconFor(workout)}</span>
              <div className="lib-card-info">
                <h3 className="lib-card-name">{workout.name}</h3>
                <span className="lib-card-meta">
                  <span className="lib-card-count">{String(workout.exercises.length).padStart(2, '0')} EXERCISES</span>
                  <span className="lib-card-type-badge">
                    {TYPE_LABELS[workout.type] || 'OTHER'}
                  </span>
                </span>
              </div>
              {workout.pinned && <span className="lib-pin-badge">PINNED</span>}
            </div>
            <div className="lib-card-actions">
              <button
                className="lib-action-btn lib-action-pin"
                onClick={() => handlePin(workout.id)}
              >
                {workout.pinned ? 'UNPIN' : 'PIN TOP'}
              </button>
              <button
                className="lib-action-btn lib-action-edit"
                onClick={() => onEdit(workout)}
              >
                EDIT
              </button>
              <button
                className="lib-action-btn lib-action-delete"
                onClick={() => handleDelete(workout.id)}
              >
                DELETE
              </button>
            </div>
          </div>
        ))}

        {workouts.length === 0 && (
          <div className="lib-empty">
            <p>No workouts yet. Create one to get started!</p>
          </div>
        )}
      </div>

      {/* Warm-ups Section */}
      <div className="lib-warmup-divider">
        <span className="lib-warmup-divider-text">WARM-UPS</span>
      </div>

      <button className="lib-create-btn lib-create-warmup-btn" onClick={onCreateWarmup}>
        + CREATE NEW WARM-UP
      </button>

      <div className="lib-list">
        {warmups.map((warmup) => (
          <div key={warmup.id} className="lib-card lib-card-warmup">
            <div className="lib-card-header">
              <span className="lib-card-icon">{stopwatchIcon()}</span>
              <div className="lib-card-info">
                <h3 className="lib-card-name">{warmup.name}</h3>
                <span className="lib-card-meta">
                  <span className="lib-card-count">{String(warmup.exercises.length).padStart(2, '0')} EXERCISES</span>
                  <span className="lib-card-type-badge lib-warmup-type-badge">WARM-UP</span>
                </span>
              </div>
            </div>
            <div className="lib-card-actions">
              <button
                className="lib-action-btn lib-action-edit"
                onClick={() => onEditWarmup(warmup)}
              >
                EDIT
              </button>
              <button
                className="lib-action-btn lib-action-delete"
                onClick={() => handleDeleteWarmup(warmup.id)}
              >
                DELETE
              </button>
            </div>
          </div>
        ))}

        {warmups.length === 0 && (
          <div className="lib-empty">
            <p>No warm-ups yet. Create one to get started!</p>
          </div>
        )}
      </div>

      {/* Cardio Section */}
      <div className="lib-warmup-divider">
        <span className="lib-warmup-divider-text">CARDIO</span>
      </div>

      <button className="lib-create-btn lib-create-warmup-btn" onClick={onCreateCardio}>
        + CREATE NEW CARDIO
      </button>

      <div className="lib-list">
        {cardios.map((cardio) => (
          <div key={cardio.id} className="lib-card lib-card-warmup">
            <div className="lib-card-header">
              <span className="lib-card-icon">{libIconFor({ name: cardio.name, type: 'cardio' })}</span>
              <div className="lib-card-info">
                <h3 className="lib-card-name">{cardio.name}</h3>
                <span className="lib-card-meta">
                  <span className="lib-card-count">{String(cardio.exercises.length).padStart(2, '0')} EXERCISES</span>
                  <span className="lib-card-type-badge">CARDIO</span>
                </span>
              </div>
            </div>
            <div className="lib-card-actions">
              <button
                className="lib-action-btn lib-action-edit"
                onClick={() => onEditCardio(cardio)}
              >
                EDIT
              </button>
              <button
                className="lib-action-btn lib-action-delete"
                onClick={() => handleDeleteCardio(cardio.id)}
              >
                DELETE
              </button>
            </div>
          </div>
        ))}

        {cardios.length === 0 && (
          <div className="lib-empty">
            <p>No cardio routines yet.</p>
          </div>
        )}
      </div>

      <button className="lib-reset-btn" onClick={handleResetAll}>
        RESET ALL DATA
      </button>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">DELETE WORKOUT?</h2>
            <p className="dialog-text">This cannot be undone.</p>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-cancel" onClick={() => setShowDeleteConfirm(null)}>
                CANCEL
              </button>
              <button className="dialog-btn dialog-btn-confirm" onClick={confirmDelete}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Warmup Confirmation */}
      {showDeleteWarmupConfirm && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">DELETE WARM-UP?</h2>
            <p className="dialog-text">This will also remove it from any workouts that use it.</p>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-cancel" onClick={() => setShowDeleteWarmupConfirm(null)}>
                CANCEL
              </button>
              <button className="dialog-btn dialog-btn-confirm" onClick={confirmDeleteWarmup}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Cardio Confirmation */}
      {showDeleteCardioConfirm && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">DELETE CARDIO?</h2>
            <p className="dialog-text">This will also remove it from any workouts that use it.</p>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-cancel" onClick={() => setShowDeleteCardioConfirm(null)}>
                CANCEL
              </button>
              <button className="dialog-btn dialog-btn-confirm" onClick={confirmDeleteCardio}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Confirmation */}
      {showResetConfirm && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">RESET ALL DATA?</h2>
            <p className="dialog-text">All custom workouts will be deleted and replaced with defaults.</p>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-cancel" onClick={() => setShowResetConfirm(false)}>
                CANCEL
              </button>
              <button className="dialog-btn dialog-btn-confirm" onClick={confirmResetAll}>
                RESET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
