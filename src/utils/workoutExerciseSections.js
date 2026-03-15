import { loadCardios, loadWarmups } from './workoutStorage.js';

export function getWarmupExercisesForWorkout(workout) {
  if (!workout?.warmupIds || workout.warmupIds.length === 0) return [];

  const warmups = loadWarmups();
  const exercises = [];

  workout.warmupIds.forEach((warmupId) => {
    const warmup = warmups.find((entry) => entry.id === warmupId);
    if (!warmup) return;

    warmup.exercises.forEach((exercise) => {
      exercises.push({ ...exercise, _isWarmup: true, _warmupName: warmup.name });
    });
  });

  return exercises;
}

export function getCardioExercisesForWorkout(workout) {
  if (!workout?.cardioIds || workout.cardioIds.length === 0) return [];

  const cardios = loadCardios();
  const exercises = [];

  workout.cardioIds.forEach((cardioId) => {
    const cardio = cardios.find((entry) => entry.id === cardioId);
    if (!cardio) return;

    cardio.exercises.forEach((exercise) => {
      exercises.push({ ...exercise, _isCardio: true, _cardioName: cardio.name });
    });
  });

  return exercises;
}

export function getWorkoutExerciseSections(workout) {
  const warmupExercises = workout ? getWarmupExercisesForWorkout(workout) : [];
  const cardioExercises = workout ? getCardioExercisesForWorkout(workout) : [];
  const mainExercises = (workout?.exercises || []).map((exercise) => ({
    ...exercise,
    _isWarmup: false,
    _isCardio: false,
  }));

  return {
    warmupExercises,
    cardioExercises,
    mainExercises,
    exercises: [...warmupExercises, ...cardioExercises, ...mainExercises],
  };
}
