export function createExerciseProgress(exercises) {
  return exercises.map((exercise) => ({
    completed: false,
    setsCompleted: Array(exercise.sets).fill(false),
  }));
}

export function normalizeExerciseProgress(exercises, savedProgress) {
  if (!Array.isArray(savedProgress)) {
    return createExerciseProgress(exercises);
  }

  return exercises.map((exercise, index) => {
    const fallback = {
      completed: false,
      setsCompleted: Array(exercise.sets).fill(false),
    };
    const saved = savedProgress[index];
    if (!saved || !Array.isArray(saved.setsCompleted)) return fallback;

    const setsCompleted = Array.from({ length: exercise.sets }, (_, setIndex) =>
      Boolean(saved.setsCompleted[setIndex])
    );

    return {
      completed: setsCompleted.every(Boolean),
      setsCompleted,
    };
  });
}

export function toggleSetProgress(progress, exerciseIdx, setIdx) {
  return progress.map((entry, index) => {
    if (index !== exerciseIdx) return entry;
    const newSets = [...entry.setsCompleted];
    newSets[setIdx] = !newSets[setIdx];
    return { completed: newSets.every(Boolean), setsCompleted: newSets };
  });
}

export function toggleExerciseProgress(progress, exerciseIdx) {
  return progress.map((entry, index) => {
    if (index !== exerciseIdx) return entry;
    const completed = !entry.completed;
    return {
      completed,
      setsCompleted: entry.setsCompleted.map(() => completed),
    };
  });
}
