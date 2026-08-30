'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number; y: number; z: number;
  size: number; baseAlpha: number;
  twinkleSpeed: number; twinklePhase: number;
  color: string; orbitAngle: number; orbitRadius: number; orbitSpeed: number;
}

interface Meteor {
  x: number; y: number; length: number; speed: number;
  angle: number; alpha: number; thickness: number; decay: number;
  color: string; tail: { x: number; y: number; alpha: number; size: number }[];
}

interface ShockwaveParticle {
  x: number; y: number; vx: number; vy: number;
  alpha: number; size: number; color: string;
}

interface NebulaRing {
  cx: number; cy: number; rx: number; ry: number;
  rotation: number; rotationSpeed: number;
  color1: string; color2: string;
  alpha: number; lineWidth: number;
}

interface AuroraArc {
  points: { x: number; y: number }[];
  color: string; alpha: number; phase: number; speed: number; width: number;
}

interface GalaxyDust {
  x: number; y: number; vx: number; vy: number;
  alpha: number; size: number; color: string; life: number; maxLife: number;
}

interface LunarRipple {
  cx: number; cy: number;
  radius: number; maxRadius: number;
  alpha: number; speed: number; lineWidth: number;
  r: number; g: number; b: number;
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
    let mouseVX = 0;
    let mouseVY = 0;

    // ── Stars ─────────────────────────────────────────────────────────────
    const numStars = Math.min(Math.floor((width * height) / 5000), 180);
    const starColors = ['#ffffff', '#e0f2fe', '#ddd6fe', '#bae6fd', '#fef08a', '#fbcfe8'];
    const stars: Star[] = Array.from({ length: numStars }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 0.9 + 0.1,
      size: Math.random() * 1.5 + 0.3,
      baseAlpha: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      orbitAngle: Math.random() * Math.PI * 2,
      orbitRadius: Math.random() * 0.5,
      orbitSpeed: (Math.random() * 0.0002 + 0.00005) * (Math.random() < 0.5 ? 1 : -1),
    }));

    // ── Nebula Rings ──────────────────────────────────────────────────────
    const nebulaRings: NebulaRing[] = [
      { cx: width * 0.5, cy: height * 0.5, rx: width * 0.55, ry: height * 0.3,  rotation: 0,           rotationSpeed:  0.0003,  color1: 'rgba(56,189,248,',  color2: 'rgba(148,163,184,', alpha: 0.08, lineWidth: 80 },
      { cx: width * 0.5, cy: height * 0.5, rx: width * 0.38, ry: height * 0.22, rotation: Math.PI / 3, rotationSpeed: -0.0005,  color1: 'rgba(2,132,199,',   color2: 'rgba(226,232,240,', alpha: 0.06, lineWidth: 60 },
      { cx: width * 0.5, cy: height * 0.5, rx: width * 0.68, ry: height * 0.42, rotation: Math.PI / 6, rotationSpeed:  0.00018, color1: 'rgba(148,163,184,',  color2: 'rgba(56,189,248,',  alpha: 0.05, lineWidth: 100 },
      { cx: width * 0.5, cy: height * 0.5, rx: width * 0.28, ry: height * 0.16, rotation: Math.PI / 2, rotationSpeed: -0.00035, color1: 'rgba(203,213,225,',  color2: 'rgba(14,165,233,',  alpha: 0.04, lineWidth: 40 },
    ];

    // ── Aurora Arcs ───────────────────────────────────────────────────────
    const auroraColors = [
      ['rgba(56,189,248,', 'rgba(148,163,184,'],
      ['rgba(14,165,233,', 'rgba(226,232,240,'],
      ['rgba(125,211,252,', 'rgba(56,189,248,'],
    ];
    const auroraArcs: AuroraArc[] = Array.from({ length: 5 }, (_, i) => {
      const cols = auroraColors[i % auroraColors.length];
      return {
        points: Array.from({ length: 8 }, (__, j) => ({
          x: (j / 7) * width,
          y: height * (0.3 + Math.random() * 0.4),
        })),
        color: cols[0],
        alpha: Math.random() * 0.08 + 0.02,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.006 + 0.002,
        width: Math.random() * 80 + 40,
      };
    });

    // ── Galaxy dust emitter ───────────────────────────────────────────────
    const galaxyDust: GalaxyDust[] = [];
    const dustColors = ['#38bdf8', '#7dd3fc', '#94a3b8', '#cbd5e1', '#e2e8f0', '#ffffff'];

    const emitDust = () => {
      if (galaxyDust.length > 50) return;  // reduced cap
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * Math.max(width, height) * 0.6;
      const cx = width / 2, cy = height / 2;
      const speed = Math.random() * 0.3 + 0.08;
      const life = Math.random() * 160 + 80;
      galaxyDust.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: Math.cos(angle + Math.PI / 2) * speed * (Math.random() < 0.5 ? 1 : -1),
        vy: Math.sin(angle + Math.PI / 2) * speed * (Math.random() < 0.5 ? 1 : -1),
        alpha: Math.random() * 0.3 + 0.05,
        size: Math.random() * 1.5 + 0.5,
        color: dustColors[Math.floor(Math.random() * dustColors.length)],
        life, maxLife: life,
      });
    };
    for (let i = 0; i < 50; i++) emitDust();

    // ── Meteors ───────────────────────────────────────────────────────────
    const meteors: Meteor[] = [];
    const shockwaves: ShockwaveParticle[] = [];

    const spawnMeteor = (forcedX?: number, forcedY?: number) => {
      const angle = Math.PI / 4 + (Math.random() * 0.3 - 0.15);
      const startX = forcedX ?? Math.random() * width * 1.2 - width * 0.2;
      const startY = forcedY ?? Math.random() * height * 0.4 - height * 0.2;
      const colors = ['#ffffff', '#bae6fd', '#7dd3fc', '#38bdf8', '#e2e8f0'];
      meteors.push({
        x: startX, y: startY,
        length: Math.random() * 140 + 80,
        speed: Math.random() * 14 + 10,
        angle, alpha: 1,
        thickness: Math.random() * 2 + 1,
        decay: Math.random() * 0.012 + 0.007,
        color: colors[Math.floor(Math.random() * colors.length)],
        tail: [],
      });
    };
    for (let i = 0; i < 3; i++) spawnMeteor();

    let meteorTimer = 0;
    let dustTimer = 0;
    let isDragging = false;
    let dragIntensity = 0;
    const lunarRipples: LunarRipple[] = [];
    let rippleTimer = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    const handleClick = (e: MouseEvent) => {
      // Moon-themed glitter: silver, white, pale gold, icy blue, lunar grey
      const colors = ['#ffffff', '#f4f4ee', '#eaeae0', '#f5f0c8', '#c8d4e8', '#d0d0c8', '#b8b4a8', '#e8e4d8'];
      for (let i = 0; i < 72; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 1.5;
        shockwaves.push({
          x: e.clientX, y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 0.85 + Math.random() * 0.15,
          size: Math.random() * 2.5 + 0.5,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      // Spawn an expanding ring at the click point
      lunarRipples.push({ cx: e.clientX, cy: e.clientY, radius: 0, maxRadius: 110, alpha: 0.55, speed: 3.5, lineWidth: 1.2, r: 200, g: 215, b: 245 });
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      nebulaRings.forEach((r, i) => {
        r.cx = width * 0.5; r.cy = height * 0.5;
        r.rx = [0.55, 0.38, 0.68, 0.28][i] * width;
        r.ry = [0.3, 0.22, 0.42, 0.16][i] * height;
      });
    };

    const handleMouseDown = () => { isDragging = true; };
    const handleMouseUp   = () => { isDragging = false; };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    let time = 0;

    // ── Draw a single nebula ring (no per-frame radial gradient — use flat stroke) ──
    const drawNebulaRing = (ring: NebulaRing) => {
      ctx.save();
      ctx.translate(ring.cx, ring.cy);
      ctx.rotate(ring.rotation);
      ctx.scale(1, ring.ry / ring.rx);
      ctx.globalAlpha = ring.alpha;
      ctx.strokeStyle = ring.color1 + ring.alpha + ')';
      ctx.lineWidth = ring.lineWidth;
      ctx.beginPath();
      ctx.arc(0, 0, ring.rx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // ── Drag intensity (ramps up on mousedown, fades on mouseup) ─────
      dragIntensity += isDragging ? 0.06 : -0.04;
      dragIntensity = Math.max(0, Math.min(1, dragIntensity));

      // Spawn expanding lunar ripples from moon center while rotating
      if (dragIntensity > 0.15) {
        rippleTimer++;
        if (rippleTimer > 18) {
          const ripplePalette = [
            [160, 195, 230], [170,  90, 255], [60, 215, 245],
            [210, 175, 255], [140, 210, 250], [255, 200, 180],
          ];
          const rc = ripplePalette[Math.floor(Math.random() * ripplePalette.length)];
          lunarRipples.push({
            cx: width / 2, cy: height / 2,
            radius: 0,
            maxRadius: Math.random() * 260 + 130,
            alpha: 0.32 * dragIntensity,
            speed: 1.4 + Math.random() * 1.8,
            lineWidth: 0.6 + Math.random() * 1.1,
            r: rc[0], g: rc[1], b: rc[2],
          });
          rippleTimer = 0;
        }
      }

      // Smooth mouse + velocity tracking
      const _pmx = mouseX;
      const _pmy = mouseY;
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;
      mouseVX = mouseX - _pmx;
      mouseVY = mouseY - _pmy;
      const mx = (mouseX - width / 2) / width;  // -0.5 to 0.5
      const my = (mouseY - height / 2) / height;

      // ── 1. Rotating nebula rings ──────────────────────────────────────
      nebulaRings.forEach(ring => {
        ring.rotation += (ring.rotationSpeed + mx * 0.0002) * (1 + dragIntensity * 4.5);
        // Subtle mouse parallax on ring center
        ring.cx = width * 0.5 + mx * 30;
        ring.cy = height * 0.5 + my * 20;
        // Temporarily boost alpha & lineWidth during drag
        const savedAlpha = ring.alpha;
        const savedLW    = ring.lineWidth;
        ring.alpha    = Math.min(ring.alpha * (1 + dragIntensity * 2.8), 0.6);
        ring.lineWidth = ring.lineWidth * (1 + dragIntensity * 1.2);
        drawNebulaRing(ring);
        ring.alpha    = savedAlpha;
        ring.lineWidth = savedLW;
      });

      // ── 2. Aurora arcs — pulse intensity during drag ──────────────────
      auroraArcs.forEach(arc => {
        arc.phase += arc.speed * (1 + dragIntensity * 1.5);
        const pts = arc.points.map((p, i) => ({
          x: p.x + mx * 30 * (i % 2 === 0 ? 1 : -1),
          y: p.y + Math.sin(arc.phase + i * 0.8) * (28 + dragIntensity * 30) + my * 20,
        }));
        ctx.save();
        ctx.globalAlpha = arc.alpha * (0.6 + Math.sin(arc.phase) * 0.25) * (1 + dragIntensity * 1.5);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 2; i++) {
          const cpx = (pts[i].x + pts[i + 1].x) / 2;
          const cpy = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, cpx, cpy);
        }
        ctx.lineWidth = arc.width * 0.6 * (1 + dragIntensity * 0.8);
        ctx.strokeStyle = arc.color + arc.alpha + ')';
        ctx.stroke();
        ctx.restore();
      });

      // ── 3. Galaxy dust (no shadowBlur) ────────────────────────────────
      dustTimer++;
      if (dustTimer > 12) { emitDust(); dustTimer = 0; }

      for (let i = galaxyDust.length - 1; i >= 0; i--) {
        const d = galaxyDust[i];
        d.x += d.vx + mx * 0.1;
        d.y += d.vy + my * 0.1;
        d.life--;
        const a = d.alpha * Math.sin((d.life / d.maxLife) * Math.PI);
        ctx.globalAlpha = a;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
        if (d.life <= 0) galaxyDust.splice(i, 1);
      }
      ctx.globalAlpha = 1;

      // ── 4. Stars — motion trails + brightness boost on drag ───────────
      ctx.save();
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.twinklePhase += s.twinkleSpeed;
        s.orbitAngle += s.orbitSpeed;
        const alpha = Math.max(0.05, Math.min(1, s.baseAlpha + Math.sin(s.twinklePhase) * 0.3));
        const parallaxMult = 0.02 + dragIntensity * 0.08;
        const px = s.x + (mouseX - width / 2) * parallaxMult * s.z + Math.cos(s.orbitAngle) * s.orbitRadius;
        const py = s.y + (mouseY - height / 2) * parallaxMult * s.z + Math.sin(s.orbitAngle) * s.orbitRadius;
        // Motion trail during drag
        const vMag = Math.abs(mouseVX) + Math.abs(mouseVY);
        if (dragIntensity > 0.08 && vMag > 0.002) {
          const trailLen = dragIntensity * 28 * s.z;
          const tg = ctx.createLinearGradient(px, py, px - mouseVX * trailLen, py - mouseVY * trailLen);
          tg.addColorStop(0, s.color);
          tg.addColorStop(1, 'transparent');
          ctx.globalAlpha = alpha * dragIntensity * 0.7;
          ctx.strokeStyle = tg;
          ctx.lineWidth  = s.size * 1.3;
          ctx.lineCap    = 'round';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - mouseVX * trailLen, py - mouseVY * trailLen);
          ctx.stroke();
        }
        ctx.globalAlpha = Math.min(1, alpha * (1 + dragIntensity * 0.55));
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px, py, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ── 5. Lunar Ripples + Central Energy Glow ───────────────────────
      for (let i = lunarRipples.length - 1; i >= 0; i--) {
        const rp = lunarRipples[i];
        rp.radius += rp.speed;
        rp.alpha  -= 0.005;
        if (rp.alpha <= 0 || rp.radius >= rp.maxRadius) { lunarRipples.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = rp.alpha;
        ctx.strokeStyle = `rgba(${rp.r}, ${rp.g}, ${rp.b}, ${rp.alpha})`;
        ctx.lineWidth = rp.lineWidth;
        ctx.shadowColor = `rgba(${rp.r}, ${rp.g}, ${rp.b}, 0.6)`;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(rp.cx, rp.cy, rp.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Pulsing central energy glow
      if (dragIntensity > 0) {
        const pulse = 0.65 + Math.sin(time * 0.12) * 0.35;
        const grd = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.min(width, height) * 0.5);
        grd.addColorStop(0,   `rgba(110, 160, 255, ${0.11 * dragIntensity * pulse})`);
        grd.addColorStop(0.3, `rgba(150,  80, 255, ${0.06 * dragIntensity * pulse})`);
        grd.addColorStop(0.6, `rgba( 60, 200, 240, ${0.04 * dragIntensity})`);
        grd.addColorStop(1,   'transparent');
        ctx.globalAlpha = 1;
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, width, height);
      }

      // ── 6. Meteors ────────────────────────────────────────
      meteorTimer++;
      if (meteorTimer > 110 && Math.random() < 0.045) { spawnMeteor(); meteorTimer = 0; }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.alpha -= m.decay;

        if (Math.random() < 0.6) {
          m.tail.push({ x: m.x - Math.cos(m.angle) * Math.random() * 20, y: m.y - Math.sin(m.angle) * Math.random() * 20, alpha: m.alpha, size: Math.random() * m.thickness * 1.2 });
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, m.alpha);
        const tailX = m.x - Math.cos(m.angle) * m.length;
        const tailY = m.y - Math.sin(m.angle) * m.length;
        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, m.color);
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth = m.thickness;
        ctx.lineCap = 'round';
        ctx.shadowColor = m.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.thickness * 1.5, 0, Math.PI * 2);
        ctx.fill();

        for (let j = m.tail.length - 1; j >= 0; j--) {
          const t = m.tail[j];
          t.alpha -= 0.04;
          if (t.alpha <= 0) { m.tail.splice(j, 1); continue; }
          ctx.fillStyle = m.color;
          ctx.globalAlpha = t.alpha;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        if (m.alpha <= 0 || m.x > width + 200 || m.y > height + 200) meteors.splice(i, 1);
      }

      // ── 7. Glitter particles (moon-themed sparkle shapes) ──────────────
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const p = shockwaves[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.97; p.vy *= 0.97;
        p.alpha -= 0.012;
        if (p.alpha <= 0) { shockwaves.splice(i, 1); continue; }
        const sz = p.size;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = sz * 6;
        // 4-pointed sparkle star
        ctx.beginPath();
        ctx.moveTo(p.x,          p.y - sz * 2.8);
        ctx.lineTo(p.x + sz * 0.35, p.y - sz * 0.35);
        ctx.lineTo(p.x + sz * 2.8, p.y);
        ctx.lineTo(p.x + sz * 0.35, p.y + sz * 0.35);
        ctx.lineTo(p.x,          p.y + sz * 2.8);
        ctx.lineTo(p.x - sz * 0.35, p.y + sz * 0.35);
        ctx.lineTo(p.x - sz * 2.8, p.y);
        ctx.lineTo(p.x - sz * 0.35, p.y - sz * 0.35);
        ctx.closePath();
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
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-95"
    />
  );
}

