import { createHandDetector, pickRightHand } from "./hand-detector.js";
import { GestureStateMachine } from "./gestures/index.js";
import { SoundManager } from "./sound.js";
import {
  drawHandSkeleton,
  FlameSystem,
  BulletSystem,
  resizeCanvasToElement,
  clearCanvas,
  normalizedToDisplay,
} from "./overlay.js";

const els = {
  video: document.getElementById("webcam"),
  canvas: document.getElementById("overlay"),
  placeholder: document.getElementById("placeholder"),
  status: document.getElementById("status"),
  latency: document.getElementById("latency"),
  startWebcam: document.getElementById("startWebcam"),
  stopWebcam: document.getElementById("stopWebcam"),
  soundToggle: document.getElementById("soundToggle"),
  stateBadge: document.getElementById("stateBadge"),
  gestureScore: document.getElementById("gestureScore"),
  fingerThumb: document.getElementById("fingerThumb"),
  fingerIndex: document.getElementById("fingerIndex"),
  fingerMiddle: document.getElementById("fingerMiddle"),
  fingerRing: document.getElementById("fingerRing"),
  fingerPinky: document.getElementById("fingerPinky"),
  liftFill: document.getElementById("liftFill"),
  liftValue: document.getElementById("liftValue"),
  eventLog: document.getElementById("eventLog"),
};

const sound = new SoundManager();
const stateMachine = new GestureStateMachine(sound);
const flames = new FlameSystem();
const bullets = new BulletSystem();

const state = {
  detector: null,
  stream: null,
  mode: "idle",
  videoFrameId: null,
  rafId: null,
  lastVideoTime: -1,
  lastEventsRef: null,
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
    els.placeholder.classList.remove("is-visible");
    await els.video.play();

    state.mode = "webcam";
    state.lastVideoTime = -1;
    els.startWebcam.disabled = true;
    els.stopWebcam.disabled = false;
    setStatus("Running", "ready");
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
  clearCanvas(els.canvas);
  flames.clear();
  bullets.clear();
  els.placeholder.classList.add("is-visible");
  state.mode = "idle";
  state.lastVideoTime = -1;
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

function detectOnVideo() {
  if (!state.detector || els.video.readyState < 2) return;
  const t0 = performance.now();
  const result = state.detector.detectForVideo(els.video, t0);
  const rightHand = pickRightHand(result);
  renderAndUpdate(rightHand, t0);
}

function renderAndUpdate(landmarks, timestamp) {
  resizeCanvasToElement(els.canvas, els.canvas.parentElement);
  const sourceSize = getSourceSize();
  const displaySize = {
    width: els.canvas.clientWidth,
    height: els.canvas.clientHeight,
  };

  clearCanvas(els.canvas);

  const status = stateMachine.update(landmarks, timestamp);

  if (landmarks && status.fingers) {
    drawHandSkeleton(els.canvas, landmarks, status.fingers, sourceSize, displaySize);
  }

  if (status.newRecoil) {
    const r = status.newRecoil;
    const disp = normalizedToDisplay(r.x, r.y, sourceSize, displaySize);
    flames.emit(disp.x, disp.y, r.angle);
    bullets.emit(disp.x, disp.y, r.angle);
  }

  flames.update();
  bullets.update(displaySize);
  const ctx = els.canvas.getContext("2d");
  flames.draw(ctx);
  bullets.draw(ctx);

  updateGestureUI(status);
  els.latency.textContent = "live";
}

function updateGestureUI(status) {
  const badge = els.stateBadge;
  badge.classList.remove("state-badge--idle", "state-badge--pistol", "state-badge--firing");
  if (status.state === "pistol") {
    badge.classList.add("state-badge--pistol");
    badge.textContent = "PISTOL";
  } else if (status.state === "firing") {
    badge.classList.add("state-badge--firing");
    badge.textContent = "FIRING";
  } else {
    badge.classList.add("state-badge--idle");
    badge.textContent = "IDLE";
  }

  els.gestureScore.textContent = (status.score || 0).toFixed(2);

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

  renderEventLog(status.events);
}

function renderEventLog(events) {
  if (!events || !events.length) {
    els.eventLog.innerHTML = '<li class="events__empty">No events yet.</li>';
    return;
  }
  els.eventLog.innerHTML = events
    .map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      const cls = `events__item events__item--${e.type}`;
      const label =
        e.type === "fold" || e.type === "pistol_enter"
          ? "cock"
          : e.type === "recoil"
            ? "recoil"
            : e.type === "pistol_exit"
              ? "exit"
              : e.type;
      return `<li class="${cls}"><span class="events__time">${time}</span><span class="events__type">${label}</span></li>`;
    })
    .join("");
}

function setStatus(text, kind) {
  els.status.textContent = text;
  els.status.className = `hud__pill hud__pill--${kind}`;
}

function hookUpControls() {
  els.startWebcam.addEventListener("click", startWebcam);
  els.stopWebcam.addEventListener("click", stopWebcam);
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
});

window.addEventListener("resize", () => {
  if (state.mode === "idle") return;
  resizeCanvasToElement(els.canvas, els.canvas.parentElement);
});
