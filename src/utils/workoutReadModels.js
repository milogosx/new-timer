import { loadCardios, loadWarmups, loadWorkouts } from './workoutStorage.js';

export function sortWorkouts(workouts) {
  return [...workouts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.createdAt - a.createdAt;
  });
}

export function loadWorkoutLibraryData() {
  return {
    workouts: sortWorkouts(loadWorkouts()),
    warmups: loadWarmups(),
    cardios: loadCardios(),
  };
}

export function loadWorkoutAttachmentOptions() {
  return {
    warmups: loadWarmups(),
    cardios: loadCardios(),
  };
}
