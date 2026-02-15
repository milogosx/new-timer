/**
 * ECG Waveform — Realistic heartbeat (P-QRS-T pattern)
 *
 * Each cardiac cycle consists of:
 *   1. P-wave  — small upward bump (atrial depolarization)
 *   2. Flat    — PR segment  
 *   3. Q-dip   — small downward dip
 *   4. R-spike — tall sharp upward spike (ventricular depolarization)
 *   5. S-dip   — small downward dip
 *   6. Flat    — ST segment
 *   7. T-wave  — medium upward bump (ventricular repolarization)
 *   8. Flat    — TP baseline until next beat
 *
 * The waveform repeats 3 complete cardiac cycles to tile across the view.
 */

const ECG_VIEWBOX_WIDTH = 1000;
const ECG_VIEWBOX_HEIGHT = 180;
const BASELINE_Y = 110;

// One cardiac cycle as segments { dx, dy } (relative moves)
// dx = horizontal span, dy = vertical offset from baseline (negative = up)
function buildOneBeat(beatWidth) {
  // Proportional widths (should sum to 1.0)
  const P_WIDTH = 0.08;
  const PR_FLAT = 0.05;
  const Q_WIDTH = 0.025;
  const R_WIDTH = 0.04;
  const S_WIDTH = 0.025;
  const ST_FLAT = 0.07;
  const T_WIDTH = 0.10;
  const U_WIDTH = 0.10;    // U-wave: prominent secondary spike after T-wave
  const TP_FLAT = 1 - P_WIDTH - PR_FLAT - Q_WIDTH - R_WIDTH - S_WIDTH - ST_FLAT - T_WIDTH - U_WIDTH;

  // Amplitudes (in SVG units, negative = up from baseline)
  const P_AMP = -14;
  const Q_AMP = 10;
  const R_AMP = -70;
  const S_AMP = 16;
  const T_AMP = -20;
  const U_AMP = -55;  // Big upward spike, mirrors left side

  const segments = [];

  // P-wave: smooth bump up and back
  const pw = beatWidth * P_WIDTH;
  segments.push(
    { x: pw * 0.5, y: P_AMP },
    { x: pw * 0.5, y: 0 }
  );

  // PR flat segment
  segments.push({ x: beatWidth * PR_FLAT, y: 0 });

  // Q dip
  const qw = beatWidth * Q_WIDTH;
  segments.push(
    { x: qw * 0.5, y: Q_AMP },
    { x: qw * 0.5, y: 0 }
  );

  // R spike — sharp and tall
  const rw = beatWidth * R_WIDTH;
  segments.push(
    { x: rw * 0.5, y: R_AMP },
    { x: rw * 0.5, y: 0 }
  );

  // S dip
  const sw = beatWidth * S_WIDTH;
  segments.push(
    { x: sw * 0.5, y: S_AMP },
    { x: sw * 0.5, y: 0 }
  );

  // ST flat segment
  segments.push({ x: beatWidth * ST_FLAT, y: 0 });

  // T-wave: broader bump
  const tw = beatWidth * T_WIDTH;
  segments.push(
    { x: tw * 0.5, y: T_AMP },
    { x: tw * 0.5, y: 0 }
  );

  // Longer flat before U-wave so spike appears further right
  segments.push({ x: beatWidth * TP_FLAT * 0.55, y: 0 });

  // U-wave: subtle secondary bump (visible on the right side)
  const uw = beatWidth * U_WIDTH;
  segments.push(
    { x: uw * 0.5, y: U_AMP },
    { x: uw * 0.5, y: 0 }
  );

  // TP baseline rest until next beat
  segments.push({ x: beatWidth * TP_FLAT * 0.45, y: 0 });

  return segments;
}

function fmt(v) {
  return Math.round(v * 100) / 100;
}

function buildFullPath() {
  const NUM_BEATS = 3;
  const BEAT_WIDTH = ECG_VIEWBOX_WIDTH / NUM_BEATS;

  const allSegments = [];
  for (let i = 0; i < NUM_BEATS; i++) {
    allSegments.push(...buildOneBeat(BEAT_WIDTH));
  }

  // Convert segments to SVG path using quadratic curves for smooth look
  let x = 0;
  const points = [{ x: 0, y: BASELINE_Y }];

  for (const seg of allSegments) {
    x += seg.x;
    const y = BASELINE_Y + seg.y;
    points.push({ x: fmt(x), y: fmt(y) });
  }

  // Build path with smooth quadratic bezier curves
  const commands = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // For sharp spikes (R, Q, S), use straight lines to keep them crisp
    const dy = Math.abs(curr.y - BASELINE_Y);
    if (dy > 30) {
      commands.push(`L ${curr.x} ${curr.y}`);
    } else {
      // For smoother waves (P, T, baselines), use quadratic curves
      const cpX = fmt((prev.x + curr.x) / 2);
      const cpY = fmt(prev.y);
      commands.push(`Q ${cpX} ${cpY} ${curr.x} ${curr.y}`);
    }
  }

  const path = commands.join(' ');

  // Find the strongest R-spike for bloom anchor
  let strongestR = { x: 0, y: ECG_VIEWBOX_HEIGHT };
  for (const pt of points) {
    if (pt.y < strongestR.y) {
      strongestR = pt;
    }
  }

  return { path, bloomAnchor: strongestR, points };
}

export function createDeterministicEcgWaveform() {
  const { path, bloomAnchor } = buildFullPath();

  return {
    path,
    baselineY: BASELINE_Y,
    bloomAnchor: {
      x: bloomAnchor.x,
      y: bloomAnchor.y,
      extremumIndex: 0,
    },
    viewbox: {
      width: ECG_VIEWBOX_WIDTH,
      height: ECG_VIEWBOX_HEIGHT,
    },
  };
}
