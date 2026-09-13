/* ==========================================================
   Procedural Web Audio API Sound Generator & Synthesizer
   Zero external audio files needed!
   ========================================================== */

import { storage } from './storage.js';

class AudioManager {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;
    this.ambientGain = null;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.isInitialized = true;
      this.setupAmbientWater();
      this.setupAmbientWind();
      this.scheduleAmbientBirds();
      this.setupBackgroundMusic();
      this.setupRainSound();
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  ensureContext() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isEnabled() {
    return storage.state.soundEnabled && this.isInitialized;
  }

  playButtonClick() {
    if (!this.isEnabled()) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  playCast() {
    if (!this.isEnabled()) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playSplash() {
    if (!this.isEnabled()) return;
    this.ensureContext();
    
    // Create white noise buffer for splash
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.3);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  playBiteAlert() {
    if (!this.isEnabled()) return;
    this.ensureContext();

    const now = this.ctx.currentTime;
    [880, 1320].forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.1);

      gain.gain.setValueAtTime(0.3, now + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + index * 0.1);
      osc.stop(now + index * 0.1 + 0.15);
    });
  }

  playReelTick() {
    if (!this.isEnabled()) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  playLineBreak() {
    if (!this.isEnabled()) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playCatchFanfare() {
    if (!this.isEnabled()) return;
    this.ensureContext();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  }

  playCoinSound() {
    if (!this.isEnabled()) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    [987.77, 1318.51].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.15, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.2);
    });
  }

  setupAmbientWater() {
    if (!this.ctx) return;
    // Ambient pink noise loop
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = storage.state.soundEnabled ? 0.04 : 0.0;

    noise.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);

    noise.start();
  }

  setupAmbientWind() {
    if (!this.ctx) return;
    // Soft filtered noise for a gentle breeze under the water hush
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.015 * white)) / 1.015;
      lastOut = data[i];
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = storage.state.soundEnabled ? 0.015 : 0.0;

    noise.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);

    noise.start();
  }

  scheduleAmbientBirds() {
    const delay = 4000 + Math.random() * 8000;
    this.birdTimeout = setTimeout(() => {
      if (this.isEnabled()) this.playBirdChirp();
      this.scheduleAmbientBirds();
    }, delay);
  }

  playBirdChirp() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < notes; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startFreq = 1800 + Math.random() * 800;
      const t = now + i * 0.12;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 1.4, t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.8, t + 0.12);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    }
  }

  setupBackgroundMusic() {
    if (!this.ctx) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = storage.state.soundEnabled ? 0.09 : 0.0;
    this.musicGain.connect(this.ctx.destination);

    // Chill, relaxing lo-fi style loop: slow-attack chord pads that
    // breathe in and out, plus a sparse wandering pentatonic pluck melody.
    // Original composition, not a cover of any existing soundtrack.
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 349.23], // Fmaj7
      [196.00, 246.94, 293.66, 392.00]  // G6/add9
    ];
    const chordDuration = 4.4;
    this.musicChordIndex = 0;

    const playChord = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const chord = chords[this.musicChordIndex % chords.length];

      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const peak = i === 0 ? 0.08 : 0.04;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 1.4);       // slow swell in
        gain.gain.setValueAtTime(peak, now + chordDuration - 1.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration); // slow fade out

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + chordDuration + 0.1);
      });

      this.musicChordIndex++;
    };

    playChord();
    this.musicInterval = setInterval(playChord, chordDuration * 1000);

    this.scheduleAmbientPluck();
  }

  scheduleAmbientPluck() {
    const delay = 2200 + Math.random() * 3200;
    this.pluckTimeout = setTimeout(() => {
      if (this.isEnabled()) this.playAmbientPluck();
      this.scheduleAmbientPluck();
    }, delay);
  }

  playAmbientPluck() {
    if (!this.ctx || !this.musicGain) return;
    const pentatonic = [523.25, 587.33, 659.25, 784.00, 880.00]; // C D E G A
    const now = this.ctx.currentTime;
    const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + 1.9);
  }

  setupRainSound() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1400;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.0;
    this.isRainActive = false;

    noise.connect(filter);
    filter.connect(this.rainGain);
    this.rainGain.connect(this.ctx.destination);
    noise.start();
  }

  setRainActive(active) {
    this.isRainActive = active;
    if (!this.rainGain || !this.ctx) return;
    const target = (active && storage.state.soundEnabled) ? 0.06 : 0.0;
    this.rainGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 1.5);
  }

  updateSoundState() {
    const enabled = storage.state.soundEnabled;
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.ambientGain) {
      this.ambientGain.gain.setValueAtTime(enabled ? 0.04 : 0.0, now);
    }
    if (this.windGain) {
      this.windGain.gain.setValueAtTime(enabled ? 0.015 : 0.0, now);
    }
    if (this.musicGain) {
      this.musicGain.gain.setValueAtTime(enabled ? 0.09 : 0.0, now);
    }
    if (this.rainGain) {
      this.rainGain.gain.setValueAtTime((this.isRainActive && enabled) ? 0.06 : 0.0, now);
    }
  }
}

export const audio = new AudioManager();
