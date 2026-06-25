import { classifyPistol } from "./pistol.js";
import { TriggerDetector } from "../movement.js";

const FIRING_DURATION_MS = 220;
const MAX_EVENTS = 5;

export class GestureStateMachine {
  constructor(sound) {
    this.sound = sound;
    this.trigger = new TriggerDetector();
    this.lastFingers = null;
    this.inPistol = false;
    this.state = "idle";
    this.firingUntil = 0;
    this.events = [];
    this.newRecoil = null;
    this.lastScore = 0;
  }

  update(landmarks, timestamp) {
    this.newRecoil = null;

    if (!landmarks) {
      if (this.inPistol) {
        this._emit({ type: "pistol_exit", timestamp });
        this.inPistol = false;
      }
      this.lastFingers = null;
      this._updateState(timestamp, false);
      this.lastScore = 0;
      return this._snapshot(0, 0);
    }

    const wasInPistol = this.inPistol;
    const classification = classifyPistol(landmarks);
    const { isPistol, score, fingers } = classification;
    this.lastScore = score;

    if (isPistol && !this.inPistol) {
      this.inPistol = true;
      this._emit({ type: "pistol_enter", timestamp });
    } else if (!isPistol && this.inPistol) {
      this.inPistol = false;
      this._emit({ type: "pistol_exit", timestamp });
    }

    if (this.lastFingers && fingers) {
      const ringFolded = this.lastFingers.ring && !fingers.ring;
      const pinkyFolded = this.lastFingers.pinky && !fingers.pinky;
      const requiredExtended = fingers.thumb && fingers.index;
      if (ringFolded && pinkyFolded && requiredExtended) {
        this.sound?.playCock(timestamp);
        this._emit({ type: "fold", timestamp });
      }
    }

    if (wasInPistol) {
      const peak = this.trigger.update(landmarks, timestamp);
      if (peak) {
        this.sound?.playRecoil();
        this._emit({ type: "recoil", timestamp, x: peak.x, y: peak.y, angle: peak.angle });
        this.firingUntil = timestamp + FIRING_DURATION_MS;
        this.newRecoil = peak;
      }
    }

    this._updateState(timestamp, isPistol);
    this.lastFingers = fingers ? { ...fingers } : null;

    const lift = this.trigger.currentLift(landmarks);
    return this._snapshot(score, lift);
  }

  _updateState(timestamp, isPistol) {
    if (timestamp < this.firingUntil) {
      this.state = "firing";
    } else {
      this.state = isPistol ? "pistol" : "idle";
    }
  }

  _snapshot(score, lift) {
    return {
      state: this.state,
      score,
      lift,
      fingers: this.lastFingers,
      events: this.events,
      newRecoil: this.newRecoil,
    };
  }

  _emit(event) {
    this.events.unshift(event);
    if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS;
  }
}
