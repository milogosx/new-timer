import { memo, useEffect, useRef } from 'react';

function FireParticles({ width = 390, height = 80 }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    function spawnParticle() {
      return {
        x: Math.random() * width,
        y: height - 5 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1.2 - Math.random() * 1.5,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.012,
        size: 2 + Math.random() * 4,
      };
    }

    // Seed initial particles
    for (let i = 0; i < 15; i++) {
      const p = spawnParticle();
      p.life = Math.random(); // random starting life
      p.y = height - Math.random() * height * 0.7;
      particlesRef.current.push(p);
    }

    let lastSpawn = 0;
    const SPAWN_INTERVAL = 120; // ms between spawns

    function animate(time) {
      ctx.clearRect(0, 0, width, height);

      // Spawn new particles
      if (time - lastSpawn > SPAWN_INTERVAL) {
        if (particlesRef.current.length < 30) {
          particlesRef.current.push(spawnParticle());
        }
        lastSpawn = time;
      }

      // Update & draw
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) return false;

        const alpha = p.life;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(255, 140, 0, ${alpha * 0.9})`);
        gradient.addColorStop(0.4, `rgba(255, 69, 0, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="fire-canvas"
      style={{ width, height }}
    />
  );
}

export default memo(FireParticles);
