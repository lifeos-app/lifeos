/**
 * Music Engine — The Realm
 *
 * Procedural ambient music using Tone.js (lazy-loaded).
 * 4 layers: Drone, Melody, Rhythm, Ambient — cross-faded by mood & time.
 */

import { logger } from '../../utils/logger';

// Tone.js types (loaded dynamically)
type ToneModule = typeof import('tone');
let Tone: ToneModule | null = null;

// C pentatonic scale frequencies
const C_PENTA = [261.63, 293.66, 329.63, 392.00, 523.25]; // C4, D4, E4, G4, C5
const C_PENTA_LOW = [130.81, 146.83, 164.81, 196.00, 261.63]; // C3, D3, E3, G3, C4

export class MusicEngine {
  private initialized = false;
  private playing = false;
  private mood = 3;
  private timeOfDay = 'day';
  private volume = 0.4;
  private streakDays = 0;

  // Tone.js nodes
  private droneSynth: OscillatorNode | null = null;
  private melodySynth: OscillatorNode | null = null;
  private rhythmSynth: OscillatorNode | null = null;
  private ambientSynth: OscillatorNode | null = null;

  private droneGain: GainNode | null = null;
  private melodyGain: GainNode | null = null;
  private rhythmGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private melodyLoop: ReturnType<typeof setInterval> | null = null;
  private rhythmLoop: ReturnType<typeof setInterval> | null = null;
  private ambientLoop: ReturnType<typeof setInterval> | null = null;

  private masterFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;

  /**
   * Lazily load Tone.js and set up all synth layers.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      Tone = await import('tone');
      await Tone.start();

      // Master chain
      this.masterFilter = new Tone.Filter(4000, 'lowpass').toDestination();
      this.masterGain = new Tone.Gain(this.volume).connect(this.masterFilter);

      // ── Layer 1: Drone (always on) ──
      this.droneGain = new Tone.Gain(0.3).connect(this.masterGain);
      this.droneSynth = new Tone.AMSynth({
        harmonicity: 1.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 2, decay: 1, sustain: 0.8, release: 4 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 3, decay: 1, sustain: 1, release: 5 },
      }).connect(this.droneGain);

      // ── Layer 2: Melody (mood-responsive) ──
      this.melodyGain = new Tone.Gain(0).connect(this.masterGain);
      this.melodySynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.2, release: 0.8 },
      }).connect(this.melodyGain);

      // ── Layer 3: Rhythm (mood ≥3) ──
      this.rhythmGain = new Tone.Gain(0).connect(this.masterGain);
      this.rhythmSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 },
      }).connect(this.rhythmGain);

      // ── Layer 4: Ambient swells (time-of-day) ──
      this.ambientGain = new Tone.Gain(0.15).connect(this.masterGain);
      this.ambientSynth = new Tone.FMSynth({
        harmonicity: 2,
        modulationIndex: 3,
        oscillator: { type: 'sine' },
        envelope: { attack: 3, decay: 2, sustain: 0.5, release: 4 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 },
      }).connect(this.ambientGain);

      // ── Melody loop ──
      let melodyStep = 0;
      this.melodyLoop = new Tone.Loop((time: number) => {
        const note = C_PENTA[Math.floor(Math.random() * C_PENTA.length)];
        this.melodySynth.triggerAttackRelease(note, '8n', time);
        melodyStep++;
      }, '2n');

      // ── Rhythm loop (~85 BPM feel via quarter notes at lower transport tempo) ──
      this.rhythmLoop = new Tone.Loop((time: number) => {
        this.rhythmSynth.triggerAttackRelease('16n', time);
      }, '4n');

      // ── Ambient swell loop ──
      this.ambientLoop = new Tone.Loop((time: number) => {
        const note = C_PENTA_LOW[Math.floor(Math.random() * C_PENTA_LOW.length)];
        this.ambientSynth.triggerAttackRelease(note, '2n', time);
      }, '2m');

      Tone.getTransport().bpm.value = 85;

      this.initialized = true;
    } catch (e) {
      logger.warn('[MusicEngine] Failed to init Tone.js:', e);
    }
  }

  play(_zoneId?: string): void {
    if (!this.initialized || !Tone) return;
    if (this.playing) return;

    // Start drone
    this.droneSynth.triggerAttack('C3');

    // Start loops
    this.melodyLoop.start(0);
    this.rhythmLoop.start(0);
    this.ambientLoop.start(0);

    Tone.getTransport().start();
    this.playing = true;
    this.applyMood();
    this.applyTimeOfDay();
  }

  stop(): void {
    if (!this.initialized || !Tone || !this.playing) return;
    Tone.getTransport().stop();
    this.droneSynth.triggerRelease();
    this.melodyLoop.stop();
    this.rhythmLoop.stop();
    this.ambientLoop.stop();
    this.playing = false;
  }

  pause(): void {
    if (!Tone || !this.playing) return;
    Tone.getTransport().pause();
  }

  resume(): void {
    if (!Tone || !this.playing) return;
    Tone.getTransport().start();
  }

  setMood(score: number): void {
    this.mood = score;
    if (this.playing) this.applyMood();
  }

  /**
   * Set current streak length — longer streaks unlock richer music layers.
   * 0-2 days: baseline (drone + sparse melody)
   * 3-6 days: + rhythm layer
   * 7-13 days: + full melody, louder ambient
   * 14+ days: all layers at full vibrancy
   */
  setStreakLength(days: number): void {
    this.streakDays = days;
    if (this.playing) this.applyMood();
  }

  setTimeOfDay(tod: string): void {
    this.timeOfDay = tod;
    if (this.playing) this.applyTimeOfDay();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.rampTo(this.volume, 0.5);
    }
  }

  destroy(): void {
    this.stop();
    if (Tone) {
      this.droneSynth?.dispose();
      this.melodySynth?.dispose();
      this.rhythmSynth?.dispose();
      this.ambientSynth?.dispose();
      this.droneGain?.dispose();
      this.melodyGain?.dispose();
      this.rhythmGain?.dispose();
      this.ambientGain?.dispose();
      this.melodyLoop?.dispose();
      this.rhythmLoop?.dispose();
      this.ambientLoop?.dispose();
      this.masterFilter?.dispose();
      this.masterGain?.dispose();
    }
    this.initialized = false;
  }

  // ── Internal ──

  private applyMood(): void {
    if (!this.initialized) return;
    const now = '+0.5';

    // Streak multiplier: gradually unlock layers
    // 0-2 days: drone + sparse melody
    // 3-6 days: + rhythm
    // 7-13 days: richer melody + louder ambient
    // 14+ days: all layers at full vibrancy
    const streakBoost = this.streakDays >= 14 ? 1.0
      : this.streakDays >= 7 ? 0.7
      : this.streakDays >= 3 ? 0.4
      : 0;

    // Mood 1-2: drone only (streak can partially add melody)
    // Mood 3: drone + quiet melody (streak can add rhythm)
    // Mood 4-5: all layers (streak enriches volume)
    if (this.mood <= 2) {
      const melodyVol = Math.min(0.15, 0.05 + streakBoost * 0.1);
      const rhythmVol = streakBoost > 0 ? 0.02 + streakBoost * 0.04 : 0;
      const droneVol = 0.35;
      this.melodyGain.gain.rampTo(melodyVol, 1);
      this.rhythmGain.gain.rampTo(rhythmVol, 1);
      this.droneGain.gain.rampTo(droneVol, 1);
    } else if (this.mood === 3) {
      const melodyVol = 0.12 + streakBoost * 0.08;
      const rhythmVol = streakBoost > 0 ? 0.04 + streakBoost * 0.06 : 0;
      const droneVol = 0.3;
      this.melodyGain.gain.rampTo(melodyVol, 1);
      this.rhythmGain.gain.rampTo(rhythmVol, 1);
      this.droneGain.gain.rampTo(droneVol, 1);
    } else {
      const melodyVol = 0.2 + streakBoost * 0.05;
      const rhythmVol = 0.08 + streakBoost * 0.06;
      const droneVol = 0.25;
      this.melodyGain.gain.rampTo(melodyVol, 1);
      this.rhythmGain.gain.rampTo(rhythmVol, 1);
      this.droneGain.gain.rampTo(droneVol, 1);
    }

    // Streak also enriches ambient layer
    const ambientBoost = 0.12 + streakBoost * 0.1;
    if (this.ambientGain) {
      this.ambientGain.gain.rampTo(Math.min(0.25, ambientBoost), 2);
    }
  }

  private applyTimeOfDay(): void {
    if (!this.masterFilter) return;

    // Night → lower filter cutoff for muffled sound
    switch (this.timeOfDay) {
      case 'night':
      case 'evening':
        this.masterFilter.frequency.rampTo(1500, 2);
        this.ambientGain?.gain.rampTo(0.2, 1);
        break;
      case 'dawn':
      case 'dusk':
        this.masterFilter.frequency.rampTo(3000, 2);
        this.ambientGain?.gain.rampTo(0.18, 1);
        break;
      default:
        this.masterFilter.frequency.rampTo(5000, 2);
        this.ambientGain?.gain.rampTo(0.12, 1);
        break;
    }
  }
}
