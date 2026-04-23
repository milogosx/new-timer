export const STRUCTURAL_CUE_KEYS = Object.freeze([
  'start_warmup',
  'warmup_complete',
  'quarter_way',
  'halfway',
  'three_quarters',
  'five_minutes',
  'one_minute',
  'workout_complete',
]);

export const WARMUP_COACH_KEYS = Object.freeze(
  Array.from({ length: 15 }, (_, i) => `warmup_coach_${String(i + 1).padStart(2, '0')}`)
);

export const WORKOUT_COACH_KEYS = Object.freeze(
  Array.from({ length: 30 }, (_, i) => `workout_coach_${String(i + 1).padStart(2, '0')}`)
);

export const ALL_CUE_KEYS = Object.freeze([
  ...STRUCTURAL_CUE_KEYS,
  ...WARMUP_COACH_KEYS,
  ...WORKOUT_COACH_KEYS,
]);

export const SPEECH_ASSET_EXTENSION = 'wav';
