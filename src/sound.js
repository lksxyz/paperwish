const COCK_COOLDOWN_MS = 600;

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastCockAt = 0;
  }

  async init() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch (_) {
        // ignore
      }
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
  }

  playCock(timestamp = performance.now()) {
    if (!this.ctx || this.muted) return;
    if (timestamp - this.lastCockAt < COCK_COOLDOWN_MS) return;
    this.lastCockAt = timestamp;

    const when = this.ctx.currentTime;
    this._click(when, 1500, 30, 0.4);
    this._click(when + 0.06, 2200, 25, 0.35);
  }

  playRecoil() {
    if (!this.ctx || this.muted) return;
    const when = this.ctx.currentTime;
    this._boom(when, 80, 0.6);
    this._sub(when, 60, 0.5);
  }

  _click(when, freq, durMs, gain) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor((sr * durMs) / 1000));
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + durMs / 1000);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(when);
    src.stop(when + durMs / 1000 + 0.05);
  }

  _boom(when, durMs, gain) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor((sr * durMs) / 1000));
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    lp.Q.value = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + durMs / 1000);
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start(when);
    src.stop(when + durMs / 1000 + 0.05);
  }

  _sub(when, durMs, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, when);
    osc.frequency.exponentialRampToValueAtTime(50, when + durMs / 1000);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + durMs / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + durMs / 1000 + 0.05);
  }
}
