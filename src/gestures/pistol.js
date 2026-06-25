import { getFingerState } from "./finger-state.js";

export function classifyPistol(landmarks) {
  if (!landmarks) {
    return { isPistol: false, score: 0, fingers: null, checks: null };
  }

  const fingers = getFingerState(landmarks);
  if (!fingers) {
    return { isPistol: false, score: 0, fingers: null, checks: null };
  }

  const checks = {
    index: fingers.index,
  };

  return {
    isPistol: fingers.index,
    score: fingers.index ? 1 : 0,
    fingers,
    checks,
  };
}
