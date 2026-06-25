import { isFingerExtended } from "./gestures/finger-state.js";

const COOLDOWN_MS = 700;

export class TriggerDetector {
  constructor() {
    this.indexExtended = null;
    this.lastTriggerAt = 0;
  }

  reset() {
    this.indexExtended = null;
  }

  currentLift(landmarks) {
    if (!landmarks) return 0;
    return isFingerExtended(landmarks, "index") ? 1 : 0;
  }

  update(landmarks, timestamp) {
    if (!landmarks) return null;

    const extended = isFingerExtended(landmarks, "index");

    if (this.indexExtended === null) {
      this.indexExtended = extended;
      return null;
    }

    const folded = this.indexExtended && !extended;
    this.indexExtended = extended;

    if (!folded) return null;

    const cooled = timestamp - this.lastTriggerAt > COOLDOWN_MS;
    if (!cooled) return null;

    this.lastTriggerAt = timestamp;

    return { x: 0, y: 0, angle: 0 };
  }
}

export const RECOIL_CONSTANTS = { COOLDOWN_MS };
