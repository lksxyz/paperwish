import { createHandDetector, pickRightHand } from "./hand-detector.js";
import { GestureStateMachine } from "./gestures/index.js";
import { SoundManager } from "./sound.js";
import {
  drawHandSkeleton,
  FlameSystem,
  BulletSystem,
  EnemySystem,
  HitRingSystem,
  CannonSystem,
  resizeCanvasToElement,
  clearCanvas,
} from "./overlay.js";

const MAX_LIVES = 10;
const DIFFICULTY_PERIOD_MS = 80_000;
const BASE_SPAWN_INTERVAL = 2.6;
const SPAWN_ACCEL = 0.92;
const BASE_ENEMY_SPEED = 90;
const SPEED_PER_LEVEL = 16;
const BASE_ENEMY_SIZE = 44;
const SIZE_PER_LEVEL = 3;

const FPS_SAMPLE_MS = 250;

const els = {
  video: document.getElementById("webcam"),
  gameCanvas: document.getElementById("gameCanvas"),
  status: document.getElementById("status"),
  latency: document.getElementById("latency"),
  fps: document.getElementById("fps"),
  startWebcam: document.getElementById("startWebcam"),
  stopWebcam: document.getElementById("stopWebcam"),
  soundToggle: document.getElementById("soundToggle"),
  stateBadge: document.getElementById("stateBadge"),
  fingerThumb: document.getElementById("fingerThumb"),
  fingerIndex: document.getElementById("fingerIndex"),
  fingerMiddle: document.getElementById("fingerMiddle"),
  fingerRing: document.getElementById("fingerRing"),
  fingerPinky: document.getElementById("fingerPinky"),
  liftFill: document.getElementById("liftFill"),
  liftValue: document.getElementById("liftValue"),
  gameScore: document.getElementById("gameScore"),
  gameLives: document.getElementById("gameLives"),
  gameDifficulty: document.getElementById("gameDifficulty"),
  gameOver: document.getElementById("gameOver"),
  finalScore: document.getElementById("finalScore"),
  restartBtn: document.getElementById("restartBtn"),
};

const sound = new SoundManager();
const stateMachine = new GestureStateMachine(sound);
const flames = new FlameSystem();
const bullets = new BulletSystem();
const enemies = new EnemySystem();
const hitRings = new HitRingSystem();
const cannon = new CannonSystem();

const state = {
  detector: null,
  stream: null,
  mode: "idle",
  videoFrameId: null,
  rafId: null,
  lastVideoTime: -1,
};

const game = {
  score: 0,
  lives: MAX_LIVES,
  difficulty: 1,
  gameOver: false,
  spawnTimer: 0,
  difficultyTimer: 0,
  lastFrameMs: 0,
  startedAt: 0,
};

const fps = {
  frames: 0,
  lastSampleAt: performance.now(),
  value: 0,
};

setStatus("Loading model…", "loading");

(async () => {
  try {
    const detector = await createHandDetector(1);
    state.detector = detector;
    setStatus("Ready", "ready");
    hookUpControls();
  } catch (err) {
    console.error(err);
    setStatus(`Model error: ${err.message ?? err}`, "error");
  }
})();

async function startWebcam() {
  if (state.mode === "webcam") return;
  stopAll();
  await sound.init();
  setStatus("Requesting camera…", "loading");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 1280, height: 720 },
      audio: false,
    });
    state.stream = stream;
    els.video.srcObject = stream;
    els.video.hidden = false;
    await els.video.play();

    state.mode = "webcam";
    resizeCanvasToElement(els.gameCanvas, els.gameCanvas.parentElement);
    cannon.snapTo(els.gameCanvas.clientWidth / 2, els.gameCanvas.clientHeight - 50);
    state.lastVideoTime = -1;
    els.startWebcam.disabled = true;
    els.stopWebcam.disabled = false;
    setStatus("Running", "ready");
    resetGame();
    runWebcamLoop();
  } catch (err) {
    console.error(err);
    setStatus(`Camera error: ${err.message ?? err}`, "error");
  }
}

function stopWebcam() {
  stopAll();
  setStatus("Stopped", "idle");
}

function stopAll() {
  cancelAnimationFrame(state.rafId);
  if (state.videoFrameId && els.video.cancelVideoFrameCallback) {
    els.video.cancelVideoFrameCallback(state.videoFrameId);
  }
  state.rafId = null;
  state.videoFrameId = null;

  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }

  els.video.pause();
  els.video.srcObject = null;
  els.video.hidden = true;
  els.startWebcam.disabled = false;
  els.stopWebcam.disabled = true;
  clearCanvas(els.gameCanvas);
  flames.clear();
  bullets.clear();
  enemies.clear();
  hitRings.clear();
  cannon.reset();
  state.mode = "idle";
  state.lastVideoTime = -1;
  hideGameOver();
}

function resetGame() {
  game.score = 0;
  game.lives = MAX_LIVES;
  game.difficulty = 1;
  game.gameOver = false;
  game.spawnTimer = 0;
  game.difficultyTimer = 0;
  game.lastFrameMs = 0;
  game.startedAt = performance.now();
  enemies.clear();
  hitRings.clear();
  updateGameUI();
  hideGameOver();
}

function runWebcamLoop() {
  const tick = () => {
    if (state.mode !== "webcam") return;
    detectOnVideo();
    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      state.videoFrameId = els.video.requestVideoFrameCallback(tick);
    } else {
      state.rafId = requestAnimationFrame(tick);
    }
  };
  tick();
}

function getSourceSize() {
  if (state.mode === "webcam") {
    return {
      width: els.video.videoWidth || 1280,
      height: els.video.videoHeight || 720,
    };
  }
  return { width: 0, height: 0 };
}

function getDisplaySize() {
  return {
    width: els.gameCanvas.clientWidth,
    height: els.gameCanvas.clientHeight,
  };
}

function detectOnVideo() {
  if (!state.detector || els.video.readyState < 2) return;
  const t0 = performance.now();
  const result = state.detector.detectForVideo(els.video, t0);
  const rightHand = pickRightHand(result);
  renderAndUpdate(rightHand, t0);
}

function currentSpawnInterval() {
  return BASE_SPAWN_INTERVAL * Math.pow(SPAWN_ACCEL, game.difficulty - 1);
}

function currentEnemySpeed() {
  return BASE_ENEMY_SPEED + (game.difficulty - 1) * SPEED_PER_LEVEL;
}

function currentEnemySize() {
  return BASE_ENEMY_SIZE + (game.difficulty - 1) * SIZE_PER_LEVEL;
}

function stepGame(dt, displaySize) {
  if (game.gameOver) return;

  game.difficultyTimer += dt * 1000;
  if (game.difficultyTimer >= DIFFICULTY_PERIOD_MS) {
    game.difficultyTimer -= DIFFICULTY_PERIOD_MS;
    game.difficulty++;
    updateGameUI();
  }

  game.spawnTimer += dt;
  if (game.spawnTimer >= currentSpawnInterval()) {
    game.spawnTimer -= currentSpawnInterval();
    const margin = 50;
    const x = margin + Math.random() * (displaySize.width - margin * 2);
    enemies.spawn(x, currentEnemySize(), currentEnemySpeed());
  }

  enemies.update(dt);

  const passed = enemies.reachedBottom(displaySize.height);
  if (passed.length > 0) {
    game.lives -= passed.length;
    if (game.lives <= 0) {
      game.lives = 0;
      game.gameOver = true;
      showGameOver();
    }
    updateGameUI();
  }
}

function checkBulletHits() {
  for (let i = bullets.bullets.length - 1; i >= 0; i--) {
    const b = bullets.bullets[i];
    const hit = enemies.hitBy(b);
    if (hit) {
      hitRings.emit(hit.displayX, hit.displayY, "#fde047");
      bullets.bullets.splice(i, 1);
      game.score++;
      sound?.playRecoil();
      updateGameUI();
    }
  }
}

function updateFps(timestamp) {
  fps.frames += 1;
  const elapsed = timestamp - fps.lastSampleAt;
  if (elapsed >= FPS_SAMPLE_MS) {
    fps.value = (fps.frames * 1000) / elapsed;
    fps.frames = 0;
    fps.lastSampleAt = timestamp;
    els.fps.textContent = `${fps.value.toFixed(0)} fps`;
  }
}

function renderAndUpdate(landmarks, timestamp) {
  resizeCanvasToElement(els.gameCanvas, els.gameCanvas.parentElement);

  const sourceSize = getSourceSize();
  const gameSize = getDisplaySize();

  const dt = game.lastFrameMs ? Math.min(0.1, (timestamp - game.lastFrameMs) / 1000) : 0;
  game.lastFrameMs = timestamp;
  updateFps(timestamp);

  clearCanvas(els.gameCanvas);

  const status = stateMachine.update(landmarks, timestamp);

  // Cannon x slides left/right based on the wrist position.
  // Game canvas IS mirrored (scaleX(-1)), so wrist.x maps directly to cannon x
  // (the user sees the cannon mirror to match the hand position).
  if (landmarks && landmarks.length >= 1) {
    const wristX = landmarks[0].x;
    const margin = 70;
    const targetX = Math.max(
      margin,
      Math.min(wristX * gameSize.width, gameSize.width - margin),
    );
    cannon.setTargetX(targetX);
  }
  // Cannon y is locked at the very bottom of the stage
  cannon.setY(gameSize.height - 50);

  if (landmarks && landmarks.length >= 9) {
    const tip = landmarks[8];
    const mcp = landmarks[5];
    const dx = tip.x - mcp.x;
    const dy = tip.y - mcp.y;
    const mag = Math.hypot(dx, dy);
    if (mag > 0.015) {
      // Game canvas is mirrored, so the raw camera angle is what we want.
      cannon.setTargetAngle(Math.atan2(dy, dx));
    }
  }
  const cannonActive = status.state === "pistol" || status.state === "firing";
  cannon.setIntensityTarget(cannonActive ? 1 : 0.2);
  cannon.update();

  // Draw hand skeleton on the game canvas (overlaid on the video background)
  if (landmarks && status.fingers) {
    drawHandSkeleton(els.gameCanvas, landmarks, status.fingers, sourceSize, gameSize);
  }

  if (status.newRecoil) {
    cannon.fire();
    const tip = cannon.getTipPosition();
    flames.emit(tip.x, tip.y, cannon.getAngle());
    bullets.emit(tip.x, tip.y, cannon.getAngle());
  }

  stepGame(dt, gameSize);
  checkBulletHits();

  flames.update();
  bullets.update(gameSize);
  enemies.update(dt);
  hitRings.update();
  const ctx = els.gameCanvas.getContext("2d");
  flames.draw(ctx);
  enemies.draw(ctx);
  bullets.draw(ctx);
  hitRings.draw(ctx);
  cannon.draw(ctx, cannonActive);

  updateGestureUI(status);
  els.latency.textContent = "live";
}

function updateGestureUI(status) {
  const badge = els.stateBadge;
  badge.classList.remove("state-badge--idle", "state-badge--pistol", "state-badge--firing");
  if (status.state === "pistol") {
    badge.classList.add("state-badge--pistol");
    badge.textContent = "AIM";
  } else if (status.state === "firing") {
    badge.classList.add("state-badge--firing");
    badge.textContent = "FIRING";
  } else {
    badge.classList.add("state-badge--idle");
    badge.textContent = "IDLE";
  }

  const fingerEls = {
    thumb: els.fingerThumb,
    index: els.fingerIndex,
    middle: els.fingerMiddle,
    ring: els.fingerRing,
    pinky: els.fingerPinky,
  };
  for (const [name, node] of Object.entries(fingerEls)) {
    const extended = status.fingers?.[name];
    node.classList.toggle("finger--extended", !!extended);
    node.classList.toggle("finger--folded", extended === false);
    const icon = node.querySelector(".finger__icon");
    if (icon) icon.textContent = extended ? "↑" : "⊙";
  }

  const lift = Math.max(0, status.lift || 0);
  const liftPct = Math.min(100, (lift / 0.12) * 100);
  els.liftFill.style.width = `${liftPct.toFixed(1)}%`;
  els.liftValue.textContent = lift.toFixed(3);
}

function updateGameUI() {
  els.gameScore.textContent = game.score;
  els.gameDifficulty.textContent = game.difficulty;
  const dots = els.gameLives.querySelectorAll(".life");
  dots.forEach((dot, i) => {
    dot.classList.toggle("is-lost", i >= game.lives);
  });
}

function showGameOver() {
  els.finalScore.textContent = game.score;
  els.gameOver.hidden = false;
}

function hideGameOver() {
  els.gameOver.hidden = true;
}

function setStatus(text, kind) {
  els.status.textContent = text;
  els.status.className = `pill pill--${kind}`;
}

function restartGame() {
  resetGame();
}

function hookUpControls() {
  els.startWebcam.addEventListener("click", startWebcam);
  els.stopWebcam.addEventListener("click", stopWebcam);
  els.restartBtn.addEventListener("click", restartGame);
  els.soundToggle.addEventListener("change", async (e) => {
    const muted = !e.target.checked;
    sound.setMuted(muted);
    if (!muted) await sound.init();
  });
}

window.addEventListener("beforeunload", () => {
  stopAll();
  state.detector?.close?.();
  flames.clear();
  bullets.clear();
  enemies.clear();
  hitRings.clear();
});

window.addEventListener("resize", () => {
  resizeCanvasToElement(els.gameCanvas, els.gameCanvas.parentElement);
});
