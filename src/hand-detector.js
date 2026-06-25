import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

let visionPromise = null;

export function getVisionFileset() {
  if (!visionPromise) {
    visionPromise = FilesetResolver.forVisionTasks(WASM_BASE_URL);
  }
  return visionPromise;
}

export async function createHandDetector(numHands = 1) {
  const fileset = await getVisionFileset();
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export function pickRightHand(result) {
  if (!result?.landmarks?.length) return null;
  for (let i = 0; i < result.landmarks.length; i++) {
    const hand = result.handednesses?.[i]?.[0]?.categoryName;
    if (hand === "Right") return result.landmarks[i];
  }
  return null;
}
