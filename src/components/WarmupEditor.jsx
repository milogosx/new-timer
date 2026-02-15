import { useState } from 'react';
import { createWarmup, updateWarmup, createExercise } from '../utils/workoutStorage';
import './WarmupEditor.css';

export default function WarmupEditor({ warmup, onSave, onCancel }) {
  const isEditing = !!warmup;

  const [name, setName] = useState(warmup?.name || '');
  const [exercises, setExercises] = useState(
    warmup?.exercises?.length ? warmup.exercises : [createExercise()]
  );

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

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Please enter a warm-up name');
      return;
    }

    const validExercises = exercises.filter((e) => e.name.trim() !== '');
    if (validExercises.length === 0) {
      alert('Add at least one exercise');
      return;
    }

    const cleanExercises = validExercises.map((e) => ({
      ...e,
      name: e.name.trim(),
      sets: Math.max(1, parseInt(e.sets) || 2),
      reps: e.reps.trim() || '10',
      rest: Math.max(0, parseInt(e.rest) || 15),
      rpe: e.rpe.trim() || 'RPE 3',
      note: (e.note || '').trim(),
    }));

    if (isEditing) {
      updateWarmup(warmup.id, {
        name: trimmedName,
        exercises: cleanExercises,
      });
    } else {
      createWarmup({
        name: trimmedName,
        exercises: cleanExercises,
      });
    }

    onSave();
  }

  return (
    <div className="warmup-editor">
      <header className="editor-header">
        <button className="back-btn" onClick={onCancel}>←</button>
        <h1 className="editor-title">{isEditing ? 'EDIT WARM-UP' : 'NEW WARM-UP'}</h1>
        <button className="editor-save-btn" onClick={handleSave}>
          ✓
        </button>
      </header>

      {/* Warmup Info */}
      <div className="editor-section warmup-section">
        <label className="editor-label">WARM-UP NAME</label>
        <input
          type="text"
          className="editor-text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Upper Body Warm-up"
        />
      </div>

      {/* Exercises */}
      <div className="editor-section warmup-section">
        <h2 className="editor-section-title">EXERCISES</h2>

        {exercises.map((exercise, idx) => (
          <div key={exercise.id} className="editor-exercise-card warmup-exercise-card">
            <div className="editor-exercise-header">
              <span className="editor-exercise-num warmup-num">#{idx + 1}</span>
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
                  max={10}
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
                  max={120}
                />
              </div>
              <div className="editor-field editor-field-sm">
                <label className="editor-field-label">RPE</label>
                <input
                  type="text"
                  className="editor-field-input"
                  value={exercise.rpe}
                  onChange={(e) => handleExerciseChange(idx, 'rpe', e.target.value)}
                  placeholder="3"
                />
              </div>
            </div>

            <div className="editor-exercise-row editor-note-row">
              <input
                type="text"
                className="editor-note-input"
                value={exercise.note || ''}
                onChange={(e) => handleExerciseChange(idx, 'note', e.target.value)}
                placeholder="Note: each side, slow tempo..."
                maxLength={80}
              />
            </div>
          </div>
        ))}

        <button className="editor-add-btn warmup-add-btn" onClick={addExercise}>
          + ADD EXERCISE
        </button>
      </div>
    </div>
  );
}
