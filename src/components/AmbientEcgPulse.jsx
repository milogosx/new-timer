import { useId } from 'react';
import { createDeterministicEcgWaveform } from '../utils/ecgWaveform';

const ECG_GEOMETRY = createDeterministicEcgWaveform();
const ECG_PATH = ECG_GEOMETRY.path;
const ECG_VIEWBOX_WIDTH = ECG_GEOMETRY.viewbox.width;
const ECG_VIEWBOX_HEIGHT = ECG_GEOMETRY.viewbox.height;
const MAIN_SPIKE_CENTER_X = ECG_GEOMETRY.bloomAnchor.x;
const MAIN_SPIKE_CENTER_Y = ECG_GEOMETRY.bloomAnchor.y;

export default function AmbientEcgPulse() {
  const id = useId().replace(/:/g, '');
  const baseGradientId = `home-ecg-base-${id}`;
  const coreGradientId = `home-ecg-core-${id}`;
  const bloomGradientAId = `home-ecg-bloom-a-${id}`;
  const bloomGradientBId = `home-ecg-bloom-b-${id}`;
  const softGlowFilterId = `home-ecg-glow-filter-${id}`;
  const bloomFilterId = `home-ecg-bloom-filter-${id}`;

  return (
    <svg
      className="home-ecg-pulse"
      viewBox={`0 0 ${ECG_VIEWBOX_WIDTH} ${ECG_VIEWBOX_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={baseGradientId} x1="0" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#63E9FF" stopOpacity="0.04" />
          <stop offset="0.12" stopColor="#63E9FF" stopOpacity="0.26" />
          <stop offset="0.5" stopColor="#63E9FF" stopOpacity="0.42" />
          <stop offset="0.88" stopColor="#63E9FF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#63E9FF" stopOpacity="0.03" />
        </linearGradient>

        <linearGradient id={coreGradientId} x1="0" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E2FCFF" stopOpacity="0.04" />
          <stop offset="0.12" stopColor="#E2FCFF" stopOpacity="0.82" />
          <stop offset="0.5" stopColor="#E2FCFF" stopOpacity="1" />
          <stop offset="0.88" stopColor="#E2FCFF" stopOpacity="0.74" />
          <stop offset="1" stopColor="#E2FCFF" stopOpacity="0.04" />
        </linearGradient>

        <radialGradient id={bloomGradientAId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EBFFFF" stopOpacity="0.95" />
          <stop offset="38%" stopColor="#71ECFF" stopOpacity="0.58" />
          <stop offset="100%" stopColor="#71ECFF" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={bloomGradientBId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EAFFF9" stopOpacity="0.92" />
          <stop offset="38%" stopColor="#75F7D8" stopOpacity="0.56" />
          <stop offset="100%" stopColor="#75F7D8" stopOpacity="0" />
        </radialGradient>

        {/* Split blur taps keep a bright core and a soft halo without a harsh neon edge. */}
        <filter id={softGlowFilterId} x="-22%" y="-220%" width="146%" height="520%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="soft" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.8" result="spread" />
          <feMerge>
            <feMergeNode in="spread" />
            <feMergeNode in="soft" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id={bloomFilterId} x="-280%" y="-280%" width="660%" height="660%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
        </filter>
      </defs>

      <g>
        <path
          d={ECG_PATH}
          pathLength="1000"
          className="home-ecg-base-glow"
          stroke={`url(#${baseGradientId})`}
          filter={`url(#${softGlowFilterId})`}
        />
        <path
          d={ECG_PATH}
          pathLength="1000"
          className="home-ecg-base-core"
          stroke={`url(#${coreGradientId})`}
        />
      </g>

      {/* Moving dash windows create traveling energy while the waveform stays fixed. */}
      <g className="home-ecg-energy home-ecg-energy--a">
        <path
          d={ECG_PATH}
          pathLength="1000"
          className="home-ecg-trail-glow"
          filter={`url(#${softGlowFilterId})`}
        />
        <path d={ECG_PATH} pathLength="1000" className="home-ecg-trail-core" />
      </g>

      {/* Same geometry, offset cadence + color phase preserves clean troughs while avoiding loop monotony. */}
      <g className="home-ecg-energy home-ecg-energy--b">
        <path
          d={ECG_PATH}
          pathLength="1000"
          className="home-ecg-trail-glow"
          filter={`url(#${softGlowFilterId})`}
        />
        <path d={ECG_PATH} pathLength="1000" className="home-ecg-trail-core" />
      </g>

      {/* Spike bloom gently peaks and decays at the main high-amplitude spike. */}
      <circle
        cx={MAIN_SPIKE_CENTER_X}
        cy={MAIN_SPIKE_CENTER_Y}
        r="18"
        className="home-ecg-bloom home-ecg-bloom--a"
        fill={`url(#${bloomGradientAId})`}
        filter={`url(#${bloomFilterId})`}
      />
      <circle
        cx={MAIN_SPIKE_CENTER_X + 2}
        cy={MAIN_SPIKE_CENTER_Y + 2}
        r="18"
        className="home-ecg-bloom home-ecg-bloom--b"
        fill={`url(#${bloomGradientBId})`}
        filter={`url(#${bloomFilterId})`}
      />
    </svg>
  );
}
