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
    thumb: fingers.thumb,
    index: fingers.index,
  };

  const passed = (checks.thumb ? 1 : 0) + (checks.index ? 1 : 0);
  const total = 2;
  const score = passed / total;

  return {
    isPistol: passed === total,
    score,
    fingers,
    checks,
  };
}
