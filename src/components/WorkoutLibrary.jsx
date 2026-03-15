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
        <h1 className="lib-title">MANAGE WORKOUTS</h1>
        <div style={{ width: 44 }} />
      </header>

      <button className="lib-create-btn" onClick={onCreate}>
        + CREATE NEW WORKOUT
      </button>

      <div className="lib-list">
        {workouts.map((workout) => (
          <div key={workout.id} className={`lib-card ${workout.pinned ? 'lib-card-pinned' : ''}`}>
            <div className="lib-card-header">
              <div className="lib-card-info">
                <h3 className="lib-card-name">{workout.name}</h3>
                <span className="lib-card-meta">
                  {workout.exercises.length} exercises
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
              <div className="lib-card-info">
                <h3 className="lib-card-name">{warmup.name}</h3>
                <span className="lib-card-meta">
                  {warmup.exercises.length} exercises
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
              <div className="lib-card-info">
                <h3 className="lib-card-name">{cardio.name}</h3>
                <span className="lib-card-meta">
                  {cardio.exercises.length} exercises
                  <span className="lib-card-type-badge lib-warmup-type-badge" style={{ background: 'var(--cardio-accent)', color: 'var(--black)' }}>CARDIO</span>
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
