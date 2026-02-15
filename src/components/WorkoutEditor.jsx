import { useState } from 'react';
import { createWorkout, updateWorkout, createExercise, loadWarmups, loadCardios } from '../utils/workoutStorage';
import './WorkoutEditor.css';

const WORKOUT_TYPES = ['strength', 'cardio', 'mobility', 'hiit', 'other'];

export default function WorkoutEditor({ workout, onSave, onCancel }) {
  const isEditing = !!workout;

  const [name, setName] = useState(workout?.name || '');
  const [type, setType] = useState(workout?.type || 'strength');
  const [exercises, setExercises] = useState(
    workout?.exercises?.length ? workout.exercises : [createExercise()]
  );
  const [selectedWarmupIds, setSelectedWarmupIds] = useState(workout?.warmupIds || []);
  const [selectedCardioIds, setSelectedCardioIds] = useState(workout?.cardioIds || []);
  const [availableWarmups] = useState(() => loadWarmups());
  const [availableCardios] = useState(() => loadCardios());

  function handleExerciseChange(idx, field, value) {
    const updated = [...exercises];
    updated[idx] = { ...updated[idx], [field]: value };
    setExercises(updated);
  }

  function addExercise() {
    setExercises([...exercises, createExercise()]);
  }

  function removeExercise(idx) {
    if (exercises.length <= 1) return;
    setExercises(exercises.filter((_, i) => i !== idx));
  }

  function moveExercise(idx, direction) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= exercises.length) return;
    const updated = [...exercises];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setExercises(updated);
  }

  function toggleWarmup(warmupId) {
    setSelectedWarmupIds((prev) =>
      prev.includes(warmupId) ? prev.filter((id) => id !== warmupId) : [...prev, warmupId]
    );
  }

  function toggleCardio(cardioId) {
    setSelectedCardioIds((prev) =>
      prev.includes(cardioId) ? prev.filter((id) => id !== cardioId) : [...prev, cardioId]
    );
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Please enter a workout name');
      return;
    }

    const validExercises = exercises.filter((e) => e.name.trim() !== '');
    if (validExercises.length === 0) {
      alert('Add at least one exercise');
      return;
    }

    // Ensure all exercises have proper numeric values
    const cleanExercises = validExercises.map((e) => ({
      ...e,
      name: e.name.trim(),
      sets: Math.max(1, parseInt(e.sets) || 3),
      reps: e.reps.trim() || '10',
      rest: Math.max(0, parseInt(e.rest) || 60),
      rpe: e.rpe.trim() || 'RPE 7',
      note: (e.note || '').trim(),
    }));

    if (isEditing) {
      updateWorkout(workout.id, {
        name: trimmedName,
        type,
        exercises: cleanExercises,
        warmupIds: selectedWarmupIds,
        cardioIds: selectedCardioIds,
      });
    } else {
      createWorkout({
        name: trimmedName,
        type,
        exercises: cleanExercises,
        warmupIds: selectedWarmupIds,
        cardioIds: selectedCardioIds,
      });
    }

    onSave();
  }

  return (
    <div className="workout-editor">
      <header className="editor-header">
        <button className="back-btn" onClick={onCancel}>←</button>
        <h1 className="editor-title">{isEditing ? 'EDIT WORKOUT' : 'NEW WORKOUT'}</h1>
        <button className="editor-save-btn" onClick={handleSave}>
          ✓
        </button>
      </header>

      {/* Workout Info */}
      <div className="editor-section">
        <label className="editor-label">WORKOUT NAME</label>
        <input
          type="text"
          className="editor-text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day"
        />

        <label className="editor-label" style={{ marginTop: 16 }}>TYPE</label>
        <div className="editor-type-row">
          {WORKOUT_TYPES.map((t) => (
            <button
              key={t}
              className={`editor-type-btn ${type === t ? 'editor-type-active' : ''}`}
              onClick={() => setType(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Warm-up Picker */}
      {availableWarmups.length > 0 && (
        <div className="editor-section editor-warmup-section">
          <h2 className="editor-section-title">WARM-UPS</h2>
          <p className="editor-warmup-hint">Attach reusable warm-ups that run before your workout</p>
          <div className="editor-warmup-list">
            {availableWarmups.map((wu) => {
              const isSelected = selectedWarmupIds.includes(wu.id);
              return (
                <button
                  key={wu.id}
                  className={`editor-warmup-chip ${isSelected ? 'editor-warmup-chip-active' : ''}`}
                  onClick={() => toggleWarmup(wu.id)}
                >
                  <span className="editor-warmup-chip-check">
                    {isSelected ? '✓' : '○'}
                  </span>
                  <span className="editor-warmup-chip-name">{wu.name}</span>
                  <span className="editor-warmup-chip-count">{wu.exercises.length} ex</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cardio Picker */}
      {availableCardios.length > 0 && (
        <div className="editor-section editor-warmup-section">
          <h2 className="editor-section-title">CARDIO</h2>
          <p className="editor-warmup-hint">Attach cardio routines that run after warm-ups</p>
          <div className="editor-warmup-list">
            {availableCardios.map((cd) => {
              const isSelected = selectedCardioIds.includes(cd.id);
              return (
                <button
                  key={cd.id}
                  className={`editor-warmup-chip ${isSelected ? 'editor-warmup-chip-active' : ''}`}
                  onClick={() => toggleCardio(cd.id)}
                >
                  <span className="editor-warmup-chip-check">
                    {isSelected ? '✓' : '○'}
                  </span>
                  <span className="editor-warmup-chip-name">{cd.name}</span>
                  <span className="editor-warmup-chip-count">{cd.exercises.length} ex</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Exercises */}
      <div className="editor-section">
        <h2 className="editor-section-title">EXERCISES</h2>

        {exercises.map((exercise, idx) => (
          <div key={exercise.id} className="editor-exercise-card">
            <div className="editor-exercise-header">
              <span className="editor-exercise-num">#{idx + 1}</span>
              <div className="editor-exercise-move">
                <button
                  className="editor-move-btn"
                  onClick={() => moveExercise(idx, -1)}
                  disabled={idx === 0}
                >
                  ↑
                </button>
                <button
                  className="editor-move-btn"
                  onClick={() => moveExercise(idx, 1)}
                  disabled={idx === exercises.length - 1}
                >
                  ↓
                </button>
              </div>
              <button
                className="editor-remove-btn"
                onClick={() => removeExercise(idx)}
                disabled={exercises.length <= 1}
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              className="editor-text-input editor-exercise-name"
              value={exercise.name}
              onChange={(e) => handleExerciseChange(idx, 'name', e.target.value)}
              placeholder="Exercise name"
            />

            <div className="editor-exercise-row">
              <div className="editor-field editor-field-sm">
                <label className="editor-field-label">SETS</label>
                <input
                  type="number"
                  className="editor-field-input"
                  value={exercise.sets}
                  onChange={(e) => handleExerciseChange(idx, 'sets', parseInt(e.target.value) || 0)}
                  min={1}
                  max={20}
                />
              </div>
              <div className="editor-field editor-field-md">
                <label className="editor-field-label">REPS</label>
                <input
                  type="text"
                  className="editor-field-input"
                  value={exercise.reps}
                  onChange={(e) => handleExerciseChange(idx, 'reps', e.target.value)}
                  placeholder="10"
                />
              </div>
              <div className="editor-field editor-field-sm">
                <label className="editor-field-label">REST</label>
                <input
                  type="number"
                  className="editor-field-input"
                  value={exercise.rest}
                  onChange={(e) => handleExerciseChange(idx, 'rest', parseInt(e.target.value) || 0)}
                  min={0}
                  max={600}
                />
              </div>
              <div className="editor-field editor-field-sm">
                <label className="editor-field-label">RPE</label>
                <input
                  type="text"
                  className="editor-field-input"
                  value={exercise.rpe}
                  onChange={(e) => handleExerciseChange(idx, 'rpe', e.target.value)}
                  placeholder="7"
                />
              </div>
            </div>

            <div className="editor-exercise-row editor-note-row">
              <input
                type="text"
                className="editor-note-input"
                value={exercise.note || ''}
                onChange={(e) => handleExerciseChange(idx, 'note', e.target.value)}
                placeholder="Note: hold at bottom, each side..."
                maxLength={80}
              />
            </div>
          </div>
        ))}

        <button className="editor-add-btn" onClick={addExercise}>
          + ADD EXERCISE
        </button>
      </div>
    </div>
  );
}
