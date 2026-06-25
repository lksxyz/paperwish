const FINGER_LANDMARKS = {
  thumb: { mcp: 1, ip: 2, tip: 4, ref: 5 },
  index: { mcp: 5, pip: 6, tip: 8 },
  middle: { mcp: 9, pip: 10, tip: 12 },
  ring: { mcp: 13, pip: 14, tip: 16 },
  pinky: { mcp: 17, pip: 18, tip: 20 },
};

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isFingerExtended(landmarks, finger) {
  const { mcp, pip, tip } = FINGER_LANDMARKS[finger];
  const extendedDist = dist(landmarks[tip], landmarks[mcp]);
  const foldedDist = dist(landmarks[pip], landmarks[mcp]);
  if (foldedDist < 0.001) return false;
  return extendedDist / foldedDist > 1.45;
}

export { isFingerExtended };

function isThumbExtended(landmarks) {
  const { tip, ip, ref } = FINGER_LANDMARKS.thumb;
  const tipToRef = dist(landmarks[tip], landmarks[ref]);
  const ipToRef = dist(landmarks[ip], landmarks[ref]);
  return tipToRef > ipToRef * 1.1 && tipToRef > 0.08;
}

export function getFingerState(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return null;
  }
  return {
    thumb: isThumbExtended(landmarks, "thumb"),
    index: isFingerExtended(landmarks, "index"),
    middle: isFingerExtended(landmarks, "middle"),
    ring: isFingerExtended(landmarks, "ring"),
    pinky: isFingerExtended(landmarks, "pinky"),
  };
}

export function indexTipAngle(landmarks) {
  if (!landmarks) return 0;
  const pip = landmarks[6];
  const tip = landmarks[8];
  return Math.atan2(tip.y - pip.y, tip.x - pip.x);
}
