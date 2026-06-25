# Pistol Hand Sign Detection (Parcel)

Real-time right-hand pistol gesture detection in the browser. Detects the
two-finger pistol shape (thumb up, index + middle extended, ring + pinky folded),
plays a procedural **cock** sound when ring + pinky fold, and plays a **recoil**
sound with a flame burst when the index tip lifts up.

Built with MediaPipe Tasks Vision `HandLandmarker` + Parcel 2. No model files
in the repo — both the hand model and WASM fileset load from public CDNs.

## Features

- Right-hand-only detection with hand skeleton overlay
- Two-finger pistol shape classifier (rule-based, no training)
- Per-finger state indicators (↑ extended / ⊙ folded)
- Index-tip lift detection → recoil event
- Procedural Web Audio sound effects (cock = high clicks, recoil = low boom)
- Flame particle burst on the index tip when recoil fires
- Live event log of last 5 events
- Webcam + image upload modes

## Run

```bash
npm install
npm start
```

Opens <http://localhost:1234>. First load downloads the hand landmarker model
(~5 MB) and the WASM fileset from Google's CDN.

## Build

```bash
npm run build
```

Outputs static files to `dist/`.

## Layout

```
index.html              Parcel entry, gesture card UI
src/
├── index.js            Hand loop, webcam lifecycle, sound init
├── overlay.js          drawHandSkeleton + FlameSystem
├── hand-detector.js    HandLandmarker wrapper
├── sound.js            Procedural cock + recoil via Web Audio
├── movement.js         RecoilDetector (index-tip lift)
├── style.css
└── gestures/
    ├── index.js        Gesture state machine
    ├── finger-state.js isExtended() per finger
    └── pistol.js       Two-finger pistol shape classifier
```

## How it works

1. `HandLandmarker` runs on the video stream and returns 21 landmarks for the
   right hand.
2. `classifyPistol(landmarks)` checks 5 conditions:
   - thumb extended
   - index extended
   - middle extended
   - ring folded
   - pinky folded
   Plus a bonus for index/middle alignment.
3. The state machine tracks frame-to-frame transitions and emits:
   - `fold` (ring+pinky go from extended to folded) → plays **cock**
   - `pistol_enter` / `pistol_exit` (visual state)
   - `recoil` (index tip lifts > 0.04 in normalized coords) → plays **recoil** + emits flame particles
4. Each event has a cooldown (cock 600 ms, recoil 700 ms) to avoid spam.

## Tuning

All thresholds live in `src/movement.js` and `src/gestures/index.js`:

- `LIFT_THRESHOLD = 0.04` — minimum index-tip lift to trigger recoil
- `COOLDOWN_MS = 700` — recoil cooldown
- `COCK_COOLDOWN_MS = 600` — cock cooldown
- `FIRING_DURATION_MS = 220` — how long the FIRING badge stays orange
