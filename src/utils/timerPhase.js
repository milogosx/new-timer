export const FIXED_WARMUP_PHASE_DURATION_SEC = 15 * 60;

export function getSessionPhase(elapsedSeconds, sessionMinutes) {
  const totalSessionSeconds = Math.max(0, Number(sessionMinutes) * 60 || 0);
  const warmupBoundarySec = Math.min(FIXED_WARMUP_PHASE_DURATION_SEC, totalSessionSeconds);
  const isWarmupPhase = elapsedSeconds < warmupBoundarySec;

  return {
    totalSessionSeconds,
    warmupBoundarySec,
    isWarmupPhase,
    phaseLabel: isWarmupPhase ? 'WARM UP' : 'WORKOUT',
  };
}

export function getSpeechMilestones(sessionMinutes) {
  const { totalSessionSeconds, warmupBoundarySec } = getSessionPhase(0, sessionMinutes);

  return [
    { key: 'start_warmup', at: 1, guard: totalSessionSeconds > 0 },
    { key: 'warmup_complete', at: warmupBoundarySec, guard: totalSessionSeconds > warmupBoundarySec },
    {
      key: 'quarter_way',
      at: Math.floor(totalSessionSeconds * 0.25),
      guard: Math.floor(totalSessionSeconds * 0.25) > warmupBoundarySec,
    },
    {
      key: 'halfway',
      at: Math.floor(totalSessionSeconds / 2),
      guard: Math.floor(totalSessionSeconds / 2) > warmupBoundarySec,
    },
    {
      key: 'three_quarters',
      at: Math.floor(totalSessionSeconds * 0.75),
      guard: Math.floor(totalSessionSeconds * 0.75) > warmupBoundarySec,
    },
    {
      key: 'five_minutes',
      at: totalSessionSeconds - 300,
      guard: totalSessionSeconds - 300 > warmupBoundarySec,
    },
    {
      key: 'one_minute',
      at: totalSessionSeconds - 60,
      guard: totalSessionSeconds - 60 > warmupBoundarySec,
    },
    { key: 'workout_complete', at: totalSessionSeconds, guard: totalSessionSeconds > 0 },
  ];
}
