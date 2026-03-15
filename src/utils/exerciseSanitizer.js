function normalizeFieldNumber(value, fallback, minimum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(minimum, parsed);
}

export function sanitizeExercisesForSave(exercises, defaults) {
  return exercises
    .filter((exercise) => exercise.name.trim() !== '')
    .map((exercise) => ({
      ...exercise,
      name: exercise.name.trim(),
      sets: normalizeFieldNumber(exercise.sets, defaults.sets, 1),
      reps: exercise.reps.trim() || defaults.reps,
      rest: normalizeFieldNumber(exercise.rest, defaults.rest, 0),
      rpe: exercise.rpe.trim() || defaults.rpe,
      note: (exercise.note || '').trim(),
    }));
}
