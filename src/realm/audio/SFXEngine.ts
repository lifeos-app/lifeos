/**
 * SFX Engine — The Realm
 *
 * All sound effects use raw Web Audio API oscillators — no external deps.
 * Each sound is a short oscillator burst with ADSR envelope.
 */

import type { TileType } from '../data/tiles';

export class SFXEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainOsc: OscillatorNode | null = null;
  private rainGain: GainNode | null = null;
  private volume = 0.5;

  init(): void {
    if (this.audioCtx) return;
    this.audioCtx = new AudioContext();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.audioCtx.destination);
  }

  private ensureResumed(): void {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /** Play a short tone burst */
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    vol = 0.3,
    detune = 0,
  ): void {
    if (!this.audioCtx || !this.masterGain) return;
    this.ensureResumed();

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;

    // ADSR envelope
    const attack = 0.01;
    const release = duration * 0.4;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.setValueAtTime(vol, now + duration - release);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  playFootstep(tileType: TileType): void {
    switch (tileType) {
      case 'path_stone':
      case 'wall_stone':
        // High click
        this.playTone(800 + Math.random() * 200, 0.05, 'square', 0.08);
        break;
      case 'water':
      case 'water_edge_n':
      case 'water_edge_s':
      case 'water_edge_e':
      case 'water_edge_w':
      case 'bridge':
        // Splash
        this.playTone(200 + Math.random() * 100, 0.12, 'sine', 0.1);
        this.playTone(400, 0.08, 'sine', 0.05);
        break;
      case 'path_dirt':
        // Soft thud
        this.playTone(150 + Math.random() * 50, 0.06, 'triangle', 0.1);
        break;
      default:
        // Grass — soft rustle
        this.playTone(300 + Math.random() * 200, 0.04, 'sine', 0.05);
        break;
    }
  }

  playNPCInteract(): void {
    // Parchment unfold sound
    this.playTone(600, 0.08, 'triangle', 0.15);
    setTimeout(() => this.playTone(800, 0.06, 'triangle', 0.1), 60);
  }

  playXPGain(amount: number): void {
    // Rising chime — more notes for larger amounts
    const notes = Math.min(Math.ceil(amount / 10), 4);
    for (let i = 0; i < notes; i++) {
      setTimeout(() => {
        this.playTone(500 + i * 150, 0.1, 'sine', 0.15);
      }, i * 80);
    }
  }

  playPortalApproach(): void {
    // Ethereal shimmer
    this.playTone(440, 0.3, 'sine', 0.08);
    this.playTone(660, 0.3, 'sine', 0.06);
    this.playTone(880, 0.25, 'sine', 0.04);
  }

  playPlantGrow(stage: number): void {
    // Growing sound — higher pitch for higher stages
    const baseFreq = 300 + stage * 100;
    this.playTone(baseFreq, 0.15, 'triangle', 0.12);
    setTimeout(() => this.playTone(baseFreq * 1.5, 0.1, 'sine', 0.08), 100);
  }

  playMenuOpen(): void {
    this.playTone(500, 0.06, 'triangle', 0.1);
    setTimeout(() => this.playTone(700, 0.06, 'triangle', 0.08), 50);
  }

  playMenuClose(): void {
    this.playTone(700, 0.06, 'triangle', 0.08);
    setTimeout(() => this.playTone(500, 0.06, 'triangle', 0.1), 50);
  }

  playRainAmbient(intensity: number): void {
    if (!this.audioCtx || !this.masterGain) return;
    if (this.rainOsc) return; // Already playing
    this.ensureResumed();

    const now = this.audioCtx.currentTime;

    // White noise via buffer
    const bufferSize = this.audioCtx.sampleRate * 2;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Bandpass filter for rain sound
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;

    this.rainGain = this.audioCtx.createGain();
    this.rainGain.gain.setValueAtTime(0, now);
    this.rainGain.gain.linearRampToValueAtTime(0.05 * intensity, now + 1);

    source.connect(filter);
    filter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    source.start();

    // Store reference for cleanup (using any cast to store BufferSource as OscillatorNode slot)
    this.rainOsc = source as unknown as OscillatorNode;
  }

  stopRainAmbient(): void {
    if (!this.rainOsc || !this.rainGain || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.rainGain.gain.linearRampToValueAtTime(0, now + 1);
    const osc = this.rainOsc;
    setTimeout(() => {
      try { (osc as unknown as AudioBufferSourceNode).stop(); } catch { /* already stopped */ }
    }, 1200);
    this.rainOsc = null;
    this.rainGain = null;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  destroy(): void {
    this.stopRainAmbient();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.masterGain = null;
  }
}
