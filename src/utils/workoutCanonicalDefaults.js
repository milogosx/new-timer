const workoutDefaultsCreatedAt = Date.now();
const warmupDefaultsCreatedAt = Date.now();
const cardioDefaultsCreatedAt = Date.now();

export const DEFAULT_WORKOUTS = [
  {
    id: 'default-foundation',
    name: 'Foundation & Flow',
    type: 'strength',
    exercises: [
      { id: 'e1', name: 'Barbell Back Squats', sets: 3, reps: '5-8', rest: 120, rpe: 'RPE 8', note: '' },
      { id: 'e2', name: 'DB Chest Press', sets: 3, reps: '10-12', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e3', name: 'Lat Pulldowns', sets: 3, reps: '10-12', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e4', name: 'KB Goblet Lunges', sets: 3, reps: '10 per side', rest: 90, rpe: 'RPE 7', note: '' },
      { id: 'e5', name: 'KB Swings', sets: 3, reps: '20', rest: 60, rpe: 'RPE 7', note: '' },
    ],
    warmupIds: ['default-dynamic-primer'],
    cardioIds: [],
    pinned: true,
    createdAt: workoutDefaultsCreatedAt,
  },
  {
    id: 'default-power-pull',
    name: 'The Power Pull',
    type: 'strength',
    exercises: [
      { id: 'e6', name: 'Trap Bar Deadlift', sets: 3, reps: '5', rest: 150, rpe: 'RPE 9', note: '' },
      { id: 'e7', name: 'DB Shoulder Press', sets: 3, reps: '10', rest: 90, rpe: 'RPE 8', note: 'Neutral grip' },
      { id: 'e8', name: 'Seated Cable Rows', sets: 3, reps: '12', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e9', name: 'Leg Press', sets: 3, reps: '15', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e10', name: 'Face Pulls', sets: 3, reps: '15', rest: 60, rpe: 'RPE 7', note: '' },
      { id: 'e11', name: 'Tricep Rope Pushdowns', sets: 3, reps: '12', rest: 60, rpe: 'RPE 7', note: '' },
    ],
    warmupIds: ['default-dynamic-primer'],
    cardioIds: [],
    pinned: false,
    createdAt: workoutDefaultsCreatedAt - 1000,
  },
  {
    id: 'default-full-body',
    name: 'Full Body Volume',
    type: 'strength',
    exercises: [
      { id: 'e12', name: 'DB Incline Bench', sets: 3, reps: '12', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e13', name: 'Single-Arm DB Row', sets: 3, reps: '12 per side', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e14', name: 'Leg Extension / Curl', sets: 3, reps: '15', rest: 60, rpe: 'RPE 8', note: '' },
      { id: 'e15', name: 'KB Goblet Squats', sets: 3, reps: '15', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e16', name: 'DB Lateral Raises', sets: 3, reps: '15', rest: 60, rpe: 'RPE 7', note: '' },
      { id: 'e17', name: 'Plank', sets: 1, reps: 'Max Hold', rest: 60, rpe: 'RPE 9', note: '' },
    ],
    warmupIds: ['default-dynamic-primer'],
    cardioIds: [],
    pinned: false,
    createdAt: workoutDefaultsCreatedAt - 2000,
  },
  {
    id: 'default-engine',
    name: 'The Engine',
    type: 'cardio',
    exercises: [
      { id: 'e18', name: 'Incline Walk', sets: 1, reps: 'Cont.', rest: 0, rpe: 'RPE 5', note: '30 min continuous' },
      { id: 'e19', name: 'HIIT', sets: 1, reps: 'Cont.', rest: 0, rpe: 'RPE 9', note: '15 min (30s on / 90s off)' },
    ],
    warmupIds: ['default-dynamic-primer'],
    cardioIds: ['default-steady-state'],
    pinned: false,
    createdAt: workoutDefaultsCreatedAt - 3000,
  },
];

export const DEFAULT_WORKOUT_ID_SET = new Set(DEFAULT_WORKOUTS.map((workout) => workout.id));
export const LEGACY_WORKOUT_NAME_SET = new Set([
  'push',
  'push day',
  'pull',
  'pull day',
  'legs',
  'leg day',
  'legs day',
  'upper body',
  'lower body',
  'arms',
  'chest day',
  'back day',
  'cardio day',
]);

export const DEFAULT_WARMUPS = [
  {
    id: 'default-dynamic-primer',
    name: 'Dynamic Primer',
    exercises: [
      { id: 'wu1', name: 'Cat-Cow', sets: 1, reps: '10', rest: 15, rpe: 'RPE 4', note: '' },
      { id: 'wu2', name: "World's Greatest Stretch", sets: 1, reps: '5 per side', rest: 15, rpe: 'RPE 4', note: '' },
      { id: 'wu3', name: '90/90 Hip Switches', sets: 1, reps: '5 per side', rest: 15, rpe: 'RPE 4', note: '' },
      { id: 'wu4', name: 'Bird-Dog', sets: 1, reps: '10 per side', rest: 15, rpe: 'RPE 5', note: '' },
      { id: 'wu5', name: 'Scapular Push-ups', sets: 1, reps: '15', rest: 15, rpe: 'RPE 5', note: '' },
      { id: 'wu6', name: 'Bodyweight Squats', sets: 1, reps: '15', rest: 15, rpe: 'RPE 5', note: '' },
      { id: 'wu7', name: 'Wrist Circles', sets: 1, reps: '30s', rest: 15, rpe: 'RPE 3', note: 'Each direction' },
    ],
    createdAt: warmupDefaultsCreatedAt,
  },
];

export const DEFAULT_WARMUP_ID_SET = new Set(DEFAULT_WARMUPS.map((warmup) => warmup.id));
export const LEGACY_WARMUP_NAME_SET = new Set([
  'dynamic warmup',
  'dynamic warm-up',
  'starter warmup',
  'starter warm-up',
  'warmup a',
  'warm-up a',
]);

export const DEFAULT_CARDIOS = [
  {
    id: 'default-steady-state',
    name: 'Steady State Cardio',
    exercises: [
      { id: 'cd1', name: 'Incline Walk', sets: 1, reps: 'Cont.', rest: 0, rpe: 'RPE 5', note: '10 min, 10% incline' },
      { id: 'cd2', name: 'Jump Rope', sets: 3, reps: '2 min', rest: 30, rpe: 'RPE 6', note: '' },
      { id: 'cd3', name: 'Rowing', sets: 1, reps: 'Cont.', rest: 0, rpe: 'RPE 5', note: '10 min steady pace' },
    ],
    createdAt: cardioDefaultsCreatedAt,
  },
];

export const DEFAULT_CARDIO_ID_SET = new Set(DEFAULT_CARDIOS.map((cardio) => cardio.id));
export const LEGACY_CARDIO_NAME_SET = new Set([
  'cardio',
  'steady state',
  'steady state cardio',
  'hiit cardio',
]);
