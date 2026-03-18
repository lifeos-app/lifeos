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

  // Tone.js nodes
  private droneSynth: any = null;
  private melodySynth: any = null;
  private rhythmSynth: any = null;
  private ambientSynth: any = null;

  private droneGain: any = null;
  private melodyGain: any = null;
  private rhythmGain: any = null;
  private ambientGain: any = null;

  private melodyLoop: any = null;
  private rhythmLoop: any = null;
  private ambientLoop: any = null;

  private masterFilter: any = null;
  private masterGain: any = null;

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

    // Mood 1-2: drone only
    // Mood 3: drone + quiet melody
    // Mood 4-5: all layers
    if (this.mood <= 2) {
      this.melodyGain.gain.rampTo(0, 1);
      this.rhythmGain.gain.rampTo(0, 1);
      this.droneGain.gain.rampTo(0.35, 1);
    } else if (this.mood === 3) {
      this.melodyGain.gain.rampTo(0.12, 1);
      this.rhythmGain.gain.rampTo(0, 1);
      this.droneGain.gain.rampTo(0.3, 1);
    } else {
      this.melodyGain.gain.rampTo(0.2, 1);
      this.rhythmGain.gain.rampTo(0.08, 1);
      this.droneGain.gain.rampTo(0.25, 1);
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
