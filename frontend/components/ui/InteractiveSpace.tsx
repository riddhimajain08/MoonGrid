'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number; // Depth factor (0.1 to 1)
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  thickness: number;
  decay: number;
  color: string;
  tail: { x: number; y: number; alpha: number; size: number }[];
}

interface ShockwaveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

export default function InteractiveSpace() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    // Generate Stars
    const numStars = Math.min(Math.floor((width * height) / 3500), 250);
    const starColors = ['#ffffff', '#e0f2fe', '#ddd6fe', '#bae6fd', '#fef08a'];
    const stars: Star[] = Array.from({ length: numStars }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 0.9 + 0.1,
      size: Math.random() * 1.8 + 0.4,
      baseAlpha: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.03 + 0.008,
      twinklePhase: Math.random() * Math.PI * 2,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));

    // Meteors list
    const meteors: Meteor[] = [];
    const shockwaves: ShockwaveParticle[] = [];

    // Spawn a meteor
    const spawnMeteor = (forcedX?: number, forcedY?: number) => {
      const angle = (Math.PI / 4) + (Math.random() * 0.2 - 0.1); // ~45 deg downward right
      const startX = forcedX !== undefined ? forcedX : (Math.random() * (width * 1.2) - width * 0.2);
      const startY = forcedY !== undefined ? forcedY : (Math.random() * (height * 0.4) - height * 0.2);

      const colors = ['#60a5fa', '#a78bfa', '#38bdf8', '#f43f5e', '#ffffff'];
      meteors.push({
        x: startX,
        y: startY,
        length: Math.random() * 120 + 80,
        speed: Math.random() * 14 + 10,
        angle: angle,
        alpha: 1,
        thickness: Math.random() * 2 + 1.2,
        decay: Math.random() * 0.015 + 0.008,
        color: colors[Math.floor(Math.random() * colors.length)],
        tail: [],
      });
    };

    // Auto meteor timer
    let meteorTimer = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    const handleClick = (e: MouseEvent) => {
      // Create cosmic shockwave burst on click
      const colors = ['#38bdf8', '#818cf8', '#c084fc', '#67e8f9', '#ffffff'];
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        shockwaves.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          size: Math.random() * 3 + 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      // Also spawn a meteor nearby
      spawnMeteor(e.clientX - 200, e.clientY - 200);
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);

    // Initial meteors
    for (let i = 0; i < 3; i++) {
      spawnMeteor();
    }

    let time = 0;
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse inertia
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      const offsetX = (mouseX - width / 2) * 0.03;
      const offsetY = (mouseY - height / 2) * 0.03;

      // Render Stars with Depth Parallax
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.twinklePhase += star.twinkleSpeed;
        const currentAlpha = star.baseAlpha + Math.sin(star.twinklePhase) * 0.3;
        const clampedAlpha = Math.max(0.1, Math.min(1, currentAlpha));

        const px = star.x + offsetX * star.z;
        const py = star.y + offsetY * star.z;

        ctx.save();
        ctx.globalAlpha = clampedAlpha;
        ctx.fillStyle = star.color;
        ctx.shadowColor = star.color;
        ctx.shadowBlur = star.size * 2;

        ctx.beginPath();
        ctx.arc(px, py, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Spawn periodic meteors
      meteorTimer++;
      if (meteorTimer > 120 && Math.random() < 0.04) {
        spawnMeteor();
        meteorTimer = 0;
      }

      // Render & Update Meteors
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.alpha -= m.decay;

        // Tail particle emission
        if (Math.random() < 0.6) {
          m.tail.push({
            x: m.x - Math.cos(m.angle) * (Math.random() * 20),
            y: m.y - Math.sin(m.angle) * (Math.random() * 20),
            alpha: m.alpha,
            size: Math.random() * m.thickness * 1.2,
          });
        }

        // Draw meteor trail string
        const tailX = m.x - Math.cos(m.angle) * m.length;
        const tailY = m.y - Math.sin(m.angle) * m.length;

        ctx.save();
        ctx.globalAlpha = Math.max(0, m.alpha);
        
        // Gradient for meteor beam
        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, m.color);
        grad.addColorStop(1, 'transparent');

        ctx.strokeStyle = grad;
        ctx.lineWidth = m.thickness;
        ctx.lineCap = 'round';
        ctx.shadowColor = m.color;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Glowing nucleus head
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.thickness * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Tail fragments
        for (let j = m.tail.length - 1; j >= 0; j--) {
          const t = m.tail[j];
          t.alpha -= 0.04;
          if (t.alpha <= 0) {
            m.tail.splice(j, 1);
            continue;
          }
          ctx.fillStyle = m.color;
          ctx.globalAlpha = t.alpha;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Remove dead meteor
        if (m.alpha <= 0 || m.x > width + 200 || m.y > height + 200) {
          meteors.splice(i, 1);
        }
      }

      // Render Shockwave Particles
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const p = shockwaves[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.alpha -= 0.02;

        if (p.alpha <= 0) {
          shockwaves.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-90"
    />
  );
}
