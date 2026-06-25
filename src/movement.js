const COOLDOWN_MS = 700;
const SMOOTH_ALPHA = 0.35;

function isThumbExtended(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  const tip = landmarks[4];
  const ip = landmarks[2];
  const ref = landmarks[5];
  const tipToRef = Math.hypot(tip.x - ref.x, tip.y - ref.y);
  const ipToRef = Math.hypot(ip.x - ref.x, ip.y - ref.y);
  return tipToRef > ipToRef * 1.1 && tipToRef > 0.08;
}

export class TriggerDetector {
  constructor() {
    this.thumbExtended = null;
    this.lastTriggerAt = 0;
    this.smoothedX = null;
    this.smoothedY = null;
  }

  reset() {
    this.thumbExtended = null;
    this.smoothedX = null;
    this.smoothedY = null;
  }

  currentLift(landmarks) {
    if (!landmarks) return 0;
    return isThumbExtended(landmarks) ? 1 : 0;
  }

  update(landmarks, timestamp) {
    if (!landmarks) {
      return null;
    }

    const extended = isThumbExtended(landmarks);

    if (this.thumbExtended === null) {
      this.thumbExtended = extended;
      return null;
    }

    const folded = this.thumbExtended && !extended;
    this.thumbExtended = extended;

    if (!folded) return null;

    const cooled = timestamp - this.lastTriggerAt > COOLDOWN_MS;
    if (!cooled) return null;

    this.lastTriggerAt = timestamp;

    const tip = landmarks[8];
    const mcp = landmarks[5];
    const rawX = tip.x - mcp.x;
    const rawY = tip.y - mcp.y;
    const rawMag = Math.hypot(rawX, rawY) || 1;

    const dirX = rawX / rawMag;
    const dirY = rawY / rawMag;

    if (this.smoothedX === null) {
      this.smoothedX = dirX;
      this.smoothedY = dirY;
    } else {
      this.smoothedX = this.smoothedX * (1 - SMOOTH_ALPHA) + dirX * SMOOTH_ALPHA;
      this.smoothedY = this.smoothedY * (1 - SMOOTH_ALPHA) + dirY * SMOOTH_ALPHA;
    }

    const sm = Math.hypot(this.smoothedX, this.smoothedY) || 1;
    return {
      x: tip.x,
      y: tip.y,
      angle: Math.atan2(this.smoothedY / sm, this.smoothedX / sm),
    };
  }
}

export const RECOIL_CONSTANTS = { COOLDOWN_MS };
