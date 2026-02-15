import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * SVG lightning arcs that occasionally jump across the title.
 * Fires every 3-5 seconds, each strike visible for ~400ms.
 */
export default function ElectricArc({ width = 390, height = 70 }) {
  const [paths, setPaths] = useState([]);
  const timerRef = useRef(null);
  const keyRef = useRef(0);

  // Generate a jagged lightning path between two random x positions
  const generateLightning = useCallback(() => {
    const x1 = 20 + Math.random() * (width * 0.3);
    const x2 = width * 0.6 + Math.random() * (width * 0.35);
    const y = 15 + Math.random() * (height - 30);
    const segments = 6 + Math.floor(Math.random() * 5);
    const dx = (x2 - x1) / segments;

    let d = `M ${x1} ${y}`;
    for (let i = 1; i <= segments; i++) {
      const nx = x1 + dx * i;
      const ny = y + (Math.random() - 0.5) * 30;
      d += ` L ${nx} ${ny}`;
    }

    // Sometimes generate a branch
    let branch = null;
    if (Math.random() > 0.5) {
      const branchStart = Math.floor(segments * 0.4);
      const bx1 = x1 + dx * branchStart;
      const by1 = y + (Math.random() - 0.5) * 15;
      const bx2 = bx1 + 30 + Math.random() * 40;
      const by2 = by1 + (Math.random() - 0.5) * 25;
      const bx3 = bx2 + 15 + Math.random() * 20;
      const by3 = by2 + (Math.random() - 0.5) * 20;
      branch = `M ${bx1} ${by1} L ${bx2} ${by2} L ${bx3} ${by3}`;
    }

    return { main: d, branch, id: keyRef.current++ };
  }, [width, height]);

  const strike = useCallback(() => {
    const lightning = generateLightning();
    setPaths([lightning]);

    // Clear after animation completes
    setTimeout(() => setPaths([]), 450);
  }, [generateLightning]);

  useEffect(() => {
    function scheduleNext() {
      const delay = 3000 + Math.random() * 2000; // 3-5 seconds
      timerRef.current = setTimeout(() => {
        strike();
        scheduleNext();
      }, delay);
    }

    // First strike after a short delay
    timerRef.current = setTimeout(() => {
      strike();
      scheduleNext();
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [strike]);

  return (
    <svg
      className="electric-arc"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 3,
        opacity: 0.6,
      }}
    >
      <defs>
        <linearGradient id="lightning-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00FFFF" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#9D00FF" />
        </linearGradient>
        <filter id="lightning-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {paths.map((p) => (
        <g key={p.id} filter="url(#lightning-glow)">
          {/* Thick glow layer */}
          <path
            d={p.main}
            fill="none"
            stroke="rgba(0, 255, 255, 0.4)"
            strokeWidth="6"
            strokeLinecap="round"
            className="lightning-path"
          />
          {/* Main bolt */}
          <path
            d={p.main}
            fill="none"
            stroke="url(#lightning-grad)"
            strokeWidth="2"
            strokeLinecap="round"
            className="lightning-path"
          />
          {/* Branch if present */}
          {p.branch && (
            <>
              <path
                d={p.branch}
                fill="none"
                stroke="rgba(0, 255, 255, 0.3)"
                strokeWidth="4"
                strokeLinecap="round"
                className="lightning-path"
              />
              <path
                d={p.branch}
                fill="none"
                stroke="url(#lightning-grad)"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="lightning-path"
              />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
