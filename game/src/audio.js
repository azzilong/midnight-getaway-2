// Midnight Getaway — synthesised sound. Every effect is built from raw
// WebAudio oscillators and noise, so the game ships no audio files at all.

export class SoundBank {
  constructor() {
    this.context = null;
    this.muted = false;
    this.sirenNodes = null;
    this.engineNodes = null;
  }

  // The browser only lets audio start after a user gesture; call this from
  // the first key or click and every later sound just works.
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
    } catch {
      this.context = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopSiren();
      this.stopEngine();
    }
    return this.muted;
  }

  tone(freq, seconds, type = 'sine', volume = 0.12, slideTo = null, delay = 0) {
    if (!this.context || this.muted) return;
    try {
      const now = this.context.currentTime + delay;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + seconds);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      osc.connect(gain).connect(this.context.destination);
      osc.start(now);
      osc.stop(now + seconds + 0.05);
    } catch {
      // Audio is decoration; a failure here must never break the game.
    }
  }

  noiseBurst(seconds, volume = 0.1, lowpass = 1200) {
    if (!this.context || this.muted) return;
    try {
      const now = this.context.currentTime;
      const length = Math.max(1, Math.floor(this.context.sampleRate * seconds));
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.context.createGain();
      gain.gain.value = volume;
      source.connect(filter).connect(gain).connect(this.context.destination);
      source.start(now);
    } catch {
      // Ignore audio failures.
    }
  }

  click() { this.tone(880, 0.06, 'square', 0.05); }
  step() { this.tone(190, 0.05, 'triangle', 0.04); }
  crackTick() { this.tone(1250, 0.05, 'square', 0.05); }
  vaultOpen() {
    this.tone(523, 0.12, 'triangle', 0.1);
    this.tone(659, 0.12, 'triangle', 0.1, null, 0.1);
    this.tone(784, 0.22, 'triangle', 0.12, null, 0.2);
  }
  smokePop() { this.noiseBurst(0.35, 0.12, 900); }
  jammerZap() { this.tone(1400, 0.25, 'sawtooth', 0.06, 220); }
  spotted() {
    this.tone(660, 0.1, 'square', 0.08);
    this.tone(660, 0.1, 'square', 0.08, null, 0.14);
  }
  busted() {
    this.tone(392, 0.25, 'sawtooth', 0.1, 196);
    this.tone(196, 0.5, 'sawtooth', 0.1, 98, 0.25);
  }
  winJingle() {
    [523, 659, 784, 1047].forEach((freq, i) => this.tone(freq, 0.22, 'triangle', 0.11, null, i * 0.13));
  }
  skid() { this.noiseBurst(0.18, 0.07, 2400); }

  // A two-tone police siren that runs while the getaway is hot.
  startSiren() {
    if (!this.context || this.muted || this.sirenNodes) return;
    try {
      const osc = this.context.createOscillator();
      const lfo = this.context.createOscillator();
      const lfoGain = this.context.createGain();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 750;
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      lfoGain.gain.value = 180;
      gain.gain.value = 0.035;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(gain).connect(this.context.destination);
      osc.start();
      lfo.start();
      this.sirenNodes = { osc, lfo, gain };
    } catch {
      this.sirenNodes = null;
    }
  }

  stopSiren() {
    if (!this.sirenNodes) return;
    try {
      this.sirenNodes.osc.stop();
      this.sirenNodes.lfo.stop();
    } catch {
      // Already stopped.
    }
    this.sirenNodes = null;
  }

  // Engine hum whose pitch follows the getaway car's speed.
  startEngine() {
    if (!this.context || this.muted || this.engineNodes) return;
    try {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      gain.gain.value = 0.03;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      osc.connect(filter).connect(gain).connect(this.context.destination);
      osc.start();
      this.engineNodes = { osc, gain };
    } catch {
      this.engineNodes = null;
    }
  }

  setEngineSpeed(fraction) {
    if (!this.engineNodes || !this.context) return;
    try {
      this.engineNodes.osc.frequency.setTargetAtTime(55 + fraction * 130, this.context.currentTime, 0.08);
    } catch {
      // Ignore.
    }
  }

  stopEngine() {
    if (!this.engineNodes) return;
    try { this.engineNodes.osc.stop(); } catch { /* already stopped */ }
    this.engineNodes = null;
  }
}
