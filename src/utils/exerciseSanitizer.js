export function sanitizeExercisesForSave(exercises, defaults) {
  return exercises
    .filter((exercise) => exercise.name.trim() !== '')
    .map((exercise) => ({
      ...exercise,
      name: exercise.name.trim(),
      sets: Math.max(1, parseInt(exercise.sets) || defaults.sets),
      reps: exercise.reps.trim() || defaults.reps,
      rest: Math.max(0, parseInt(exercise.rest) || defaults.rest),
      rpe: exercise.rpe.trim() || defaults.rpe,
      note: (exercise.note || '').trim(),
    }));
}
