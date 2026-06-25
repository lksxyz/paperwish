const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const TIP_INDICES = new Set([4, 8, 12, 16, 20]);
const FINGER_TIP = {
  thumb: 4,
  index: 8,
  middle: 12,
  ring: 16,
  pinky: 20,
};

const COLOR_EXTENDED = "#6ee7b7";
const COLOR_FOLDED = "#9aa3ad";
const COLOR_RING_PINKY_FOLDED = "#fb7185";
const COLOR_SKELETON = "rgba(110, 231, 183, 0.65)";
const COLOR_INDEX_HIGHLIGHT = "#fde047";

export function resizeCanvasToElement(canvas, target) {
  const dpr = window.devicePixelRatio || 1;
  const w = target.clientWidth;
  const h = target.clientHeight;
  const pxW = Math.round(w * dpr);
  const pxH = Math.round(h * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

export function clearCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function computeFit(sourceSize, displaySize) {
  const scale = Math.min(
    displaySize.width / sourceSize.width,
    displaySize.height / sourceSize.height,
  );
  const drawnW = sourceSize.width * scale;
  const drawnH = sourceSize.height * scale;
  return {
    scale,
    offsetX: (displaySize.width - drawnW) / 2,
    offsetY: (displaySize.height - drawnH) / 2,
  };
}

export function normalizedToDisplay(nx, ny, sourceSize, displaySize) {
  const { scale, offsetX, offsetY } = computeFit(sourceSize, displaySize);
  return {
    x: offsetX + nx * sourceSize.width * scale,
    y: offsetY + ny * sourceSize.height * scale,
  };
}

export function drawHandSkeleton(canvas, landmarks, fingers, sourceSize, displaySize) {
  const ctx = canvas.getContext("2d");
  if (!landmarks || !sourceSize.width || !displaySize.width) return;

  const { scale, offsetX, offsetY } = computeFit(sourceSize, displaySize);
  const toX = (lm) => offsetX + lm.x * sourceSize.width * scale;
  const toY = (lm) => offsetY + lm.y * sourceSize.height * scale;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.lineWidth = 2.5 / scale;
  ctx.lineCap = "round";
  ctx.strokeStyle = COLOR_SKELETON;
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    ctx.beginPath();
    ctx.moveTo(pa.x * sourceSize.width, pa.y * sourceSize.height);
    ctx.lineTo(pb.x * sourceSize.width, pb.y * sourceSize.height);
    ctx.stroke();
  }

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const x = lm.x * sourceSize.width;
    const y = lm.y * sourceSize.height;
    let color = "#cbd5e1";
    if (i === FINGER_TIP.thumb) color = fingers?.thumb ? COLOR_EXTENDED : COLOR_FOLDED;
    else if (i === FINGER_TIP.index) color = fingers?.index ? COLOR_EXTENDED : COLOR_FOLDED;
    else if (i === FINGER_TIP.middle) color = fingers?.middle ? COLOR_EXTENDED : COLOR_FOLDED;
    else if (i === FINGER_TIP.ring) color = fingers?.ring ? COLOR_EXTENDED : COLOR_RING_PINKY_FOLDED;
    else if (i === FINGER_TIP.pinky) color = fingers?.pinky ? COLOR_EXTENDED : COLOR_RING_PINKY_FOLDED;

    let radius = 3 / scale;
    if (TIP_INDICES.has(i)) radius = 5 / scale;
    if (i === FINGER_TIP.index) radius = 9 / scale;

    ctx.fillStyle = color;
    if (i === FINGER_TIP.index) {
      ctx.shadowColor = COLOR_INDEX_HIGHLIGHT;
      ctx.shadowBlur = 12 / scale;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

const FLAME_COLORS = ["#fde047", "#fbbf24", "#f97316", "#ef4444"];

export class FlameSystem {
  constructor() {
    this.particles = [];
  }

  emit(displayX, displayY, angle) {
    for (let i = 0; i < 20; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 6;
      this.particles.push({
        x: displayX,
        y: displayY,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        life: 1.0,
        decay: 0.022 + Math.random() * 0.022,
        size: 4 + Math.random() * 6,
        color: FLAME_COLORS[(Math.random() * FLAME_COLORS.length) | 0],
      });
    }
  }

  update() {
    this.particles = this.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      p.size *= 0.96;
      return p.life > 0;
    });
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.particles.length = 0;
  }
}

const BULLET_SPEED = 28;
const BULLET_TRAIL_LEN = 22;
const BULLET_MARGIN = 80;
const BULLET_GRAVITY = 0.18;

export class BulletSystem {
  constructor() {
    this.bullets = [];
  }

  emit(displayX, displayY, angle) {
    this.bullets.push({
      x: displayX,
      y: displayY,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      trail: [],
    });
  }

  update(bounds) {
    for (const b of this.bullets) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > BULLET_TRAIL_LEN) b.trail.shift();
      b.x += b.vx;
      b.vy += BULLET_GRAVITY;
      b.y += b.vy;
    }
    this.bullets = this.bullets.filter(
      (b) =>
        b.x >= -BULLET_MARGIN &&
        b.x <= bounds.width + BULLET_MARGIN &&
        b.y >= -BULLET_MARGIN &&
        b.y <= bounds.height + BULLET_MARGIN,
    );
  }

  draw(ctx) {
    for (const b of this.bullets) {
      const points = b.trail.length > 0 ? b.trail : [{ x: b.x, y: b.y }];
      const all = points.concat([{ x: b.x, y: b.y }]);

      if (all.length > 1) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 14;

        for (let i = 1; i < all.length; i++) {
          const t = i / (all.length - 1);
          ctx.globalAlpha = 0.18 + 0.82 * t;
          ctx.strokeStyle = "#fde047";
          ctx.lineWidth = 1.2 + 2.6 * t;
          ctx.beginPath();
          ctx.moveTo(all[i - 1].x, all[i - 1].y);
          ctx.lineTo(all[i].x, all[i].y);
          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = "#fff7ed";
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.bullets.length = 0;
  }
}

const HIT_PADDING = 32;
const BULLET_HIT_RADIUS = 10;
const ENEMY_LERP = 0.35;

export class EnemySystem {
  constructor() {
    this.enemies = [];
  }

  spawn(x, size, speed) {
    this.enemies.push({
      x,
      y: -size,
      vy: speed,
      size,
      displayX: x,
      displayY: -size,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  update(dt) {
    for (const e of this.enemies) {
      e.y += e.vy * dt;
      e.wobble += dt * 2.4;
      const wobbleX = Math.sin(e.wobble) * 6;
      e.displayX += (e.x + wobbleX - e.displayX) * ENEMY_LERP;
      e.displayY += (e.y - e.displayY) * ENEMY_LERP;
    }
  }

  reachedBottom(displayHeight) {
    const passed = [];
    this.enemies = this.enemies.filter((e) => {
      if (e.displayY - e.size / 2 > displayHeight) {
        passed.push(e);
        return false;
      }
      return true;
    });
    return passed;
  }

  hitBy(bullet, radius = BULLET_HIT_RADIUS) {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const dx = bullet.x - e.displayX;
      const dy = bullet.y - e.displayY;
      if (Math.hypot(dx, dy) < e.size / 2 + radius + HIT_PADDING) {
        const killed = e;
        this.enemies.splice(i, 1);
        return killed;
      }
    }
    return null;
  }

  draw(ctx) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.displayX, e.displayY);

      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#dc2626";
      ctx.shadowBlur = 16;

      ctx.beginPath();
      ctx.moveTo(0, e.size / 2);
      ctx.lineTo(e.size / 3, -e.size / 2);
      ctx.lineTo(0, -e.size / 4);
      ctx.lineTo(-e.size / 3, -e.size / 2);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(0, -e.size / 6, e.size / 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.enemies.length = 0;
  }
}

export class HitRingSystem {
  constructor() {
    this.rings = [];
  }

  emit(x, y, color = "#fde047") {
    this.rings.push({ x, y, radius: 8, maxRadius: 56, life: 1.0, color });
  }

  update() {
    this.rings = this.rings.filter((r) => {
      r.life -= 0.05;
      r.radius += (r.maxRadius - r.radius) * 0.25;
      return r.life > 0;
    });
  }

  draw(ctx) {
    for (const r of this.rings) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  clear() {
    this.rings.length = 0;
  }
}

const CANNON_BARREL_LEN = 60;
const CANNON_MUZZLE_LEN = 10;
const CANNON_TIP_DIST = CANNON_BARREL_LEN + CANNON_MUZZLE_LEN;

export class CannonSystem {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetAngle = 0;
    this.angle = 0;
    this.recoil = 0;
    this.intensity = 0;
    this.targetIntensity = 0;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
  }

  setTargetX(x) {
    this.targetX = x;
  }

  setY(y) {
    this.y = y;
  }

  snapTo(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
  }

  setTargetAngle(angle) {
    if (Number.isFinite(angle)) this.targetAngle = angle;
  }

  setIntensityTarget(value) {
    this.targetIntensity = Math.max(0, Math.min(1, value));
  }

  fire() {
    this.recoil = 20;
  }

  reset() {
    this.recoil = 0;
    this.intensity = 0;
    this.targetIntensity = 0;
  }

  update() {
    this.x += (this.targetX - this.x) * 0.2;

    let delta = this.targetAngle - this.angle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    this.angle += delta * 0.22;

    this.recoil *= 0.82;
    if (this.recoil < 0.2) this.recoil = 0;

    this.intensity += (this.targetIntensity - this.intensity) * 0.12;
  }

  getTipPosition() {
    const tipDist = CANNON_TIP_DIST - this.recoil;
    return {
      x: this.x + Math.cos(this.angle) * tipDist,
      y: this.y + Math.sin(this.angle) * tipDist,
    };
  }

  getAngle() {
    return this.angle;
  }

  draw(ctx, showAimLine) {
    const i = this.intensity;
    const baseAlpha = 0.55 + 0.45 * i;
    const pulse = 0.88 + 0.12 * Math.sin(performance.now() / 600);
    const coreGlow = (0.45 + 0.55 * i) * pulse;

    ctx.save();
    ctx.globalAlpha = baseAlpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.translate(-this.recoil, 0);

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 32, 32, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0b1220";
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(110, 231, 183, ${0.4 + 0.5 * i})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();

    const coreGradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
    coreGradient.addColorStop(0, `rgba(167, 243, 208, ${coreGlow})`);
    coreGradient.addColorStop(0.5, `rgba(110, 231, 183, ${coreGlow * 0.85})`);
    coreGradient.addColorStop(1, `rgba(14, 116, 144, ${coreGlow * 0.3})`);
    ctx.fillStyle = coreGradient;
    ctx.shadowColor = `rgba(110, 231, 183, ${0.6 * coreGlow})`;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#334155";
    ctx.fillRect(0, -10, CANNON_BARREL_LEN, 20);

    ctx.fillStyle = "#475569";
    ctx.fillRect(0, -10, CANNON_BARREL_LEN, 3);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 8, CANNON_BARREL_LEN, 2);

    ctx.fillStyle = `rgba(110, 231, 183, ${0.4 + 0.5 * i})`;
    ctx.fillRect(6, -6, CANNON_BARREL_LEN - 12, 1.5);

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(CANNON_BARREL_LEN, -14, CANNON_MUZZLE_LEN, 28);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(CANNON_BARREL_LEN + 4, -10, 6, 20);

    ctx.restore();

    if (showAimLine && i > 0.4) {
      ctx.save();
      ctx.globalAlpha = baseAlpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = `rgba(110, 231, 183, ${0.32 * i})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -performance.now() / 50;
      ctx.beginPath();
      ctx.moveTo(CANNON_TIP_DIST + 2, 0);
      ctx.lineTo(900, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}
