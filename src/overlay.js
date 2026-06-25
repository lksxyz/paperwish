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

const BULLET_SPEED = 22;
const BULLET_TRAIL_LEN = 1;
const BULLET_MARGIN = 40;

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
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fde047";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      if (b.trail.length > 0) {
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "#fff7ed";
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.bullets.length = 0;
  }
}

const HIT_PADDING = 15;

export class EnemySystem {
  constructor() {
    this.enemies = [];
  }

  spawn(y, size, speed) {
    this.enemies.push({
      x: -size,
      y,
      vx: speed,
      size,
    });
  }

  update(dt) {
    for (const e of this.enemies) {
      e.x += e.vx * dt;
    }
  }

  reachedSide(displayWidth) {
    const passed = [];
    this.enemies = this.enemies.filter((e) => {
      if (e.x > displayWidth) {
        passed.push(e);
        return false;
      }
      return true;
    });
    return passed;
  }

  hitBy(bullet, radius = 3) {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const dx = bullet.x - e.x;
      const dy = bullet.y - e.y;
      if (Math.hypot(dx, dy) < e.size / 2 + radius + HIT_PADDING) {
        this.enemies.splice(i, 1);
        return e;
      }
    }
    return null;
  }

  draw(ctx) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#dc2626";
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(e.size / 2, 0);
      ctx.lineTo(-e.size / 2, -e.size / 3);
      ctx.lineTo(-e.size / 4, 0);
      ctx.lineTo(-e.size / 2, e.size / 3);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(e.size / 6, 0, e.size / 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.enemies.length = 0;
  }
}
