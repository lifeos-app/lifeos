/**
 * Lighting System — The Realm
 *
 * Dynamic day/night cycle based on user's local time.
 * Point lights for buildings, lamps, and effects.
 */

export interface PointLight {
  worldX: number;
  worldY: number;
  radius: number;
  color: string;
  intensity: number;
  /** Optional flicker effect */
  flicker?: boolean;
}

export type TimeOfDay = 'dawn' | 'morning' | 'day' | 'golden' | 'dusk' | 'evening' | 'night';

interface LightingState {
  timeOfDay: TimeOfDay;
  /** 0-1, global ambient brightness */
  ambientBrightness: number;
  /** Tint colour overlay */
  tintColor: string;
  /** Tint alpha */
  tintAlpha: number;
  /** Whether to render point lights */
  showLights: boolean;
  /** Stars visible? */
  showStars: boolean;
}

const TIME_CONFIGS: Record<TimeOfDay, Omit<LightingState, 'timeOfDay'>> = {
  dawn: {
    ambientBrightness: 0.6,
    tintColor: '#FF8C42',
    tintAlpha: 0.15,
    showLights: true,
    showStars: false,
  },
  morning: {
    ambientBrightness: 0.85,
    tintColor: '#FFF8E1',
    tintAlpha: 0.05,
    showLights: false,
    showStars: false,
  },
  day: {
    ambientBrightness: 1.0,
    tintColor: '#FFFFFF',
    tintAlpha: 0,
    showLights: false,
    showStars: false,
  },
  golden: {
    ambientBrightness: 0.85,
    tintColor: '#FFB347',
    tintAlpha: 0.15,
    showLights: false,
    showStars: false,
  },
  dusk: {
    ambientBrightness: 0.55,
    tintColor: '#9B59B6',
    tintAlpha: 0.2,
    showLights: true,
    showStars: false,
  },
  evening: {
    ambientBrightness: 0.35,
    tintColor: '#1A1A3E',
    tintAlpha: 0.35,
    showLights: true,
    showStars: true,
  },
  night: {
    ambientBrightness: 0.2,
    tintColor: '#0D0D2B',
    tintAlpha: 0.5,
    showLights: true,
    showStars: true,
  },
};

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class LightingSystem {
  private state: LightingState;
  private pointLights: PointLight[] = [];
  private stars: { x: number; y: number; size: number; phase: number }[] = [];
  private frameCount = 0;

  // Celestial state
  private moonPhase = 0;
  private seasonAmbientBoost = 0;
  private meteorActive = false;
  private shootingStars: ShootingStar[] = [];

  // XP-driven vibrancy
  private xpVibrancy = 0.6; // default: dim (no activity)
  private streakMultiplier = 1;

  constructor() {
    this.state = { timeOfDay: 'day', ...TIME_CONFIGS.day };
    // Pre-generate stars
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.5, // Top half only
        size: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Determine time of day from current hour
   */
  static getTimeOfDay(hour?: number): TimeOfDay {
    const h = hour ?? new Date().getHours();
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 10) return 'morning';
    if (h >= 10 && h < 16) return 'day';
    if (h >= 16 && h < 18) return 'golden';
    if (h >= 18 && h < 20) return 'dusk';
    if (h >= 20 && h < 22) return 'evening';
    return 'night';
  }

  /**
   * Set moon phase and meteor state from celestial module
   */
  setCelestialState(moonPhase: number, meteorActive: boolean, seasonAmbientBoost: number): void {
    this.moonPhase = moonPhase;
    this.meteorActive = meteorActive;
    this.seasonAmbientBoost = seasonAmbientBoost;
  }

  /**
   * Set XP-driven vibrancy: productive days make the world brighter.
   * xpVibrancy (0.6–1.0) acts as a floor for ambientBrightness.
   * streakMultiplier (1–3) scales particle effect intensity.
   */
  setVibrancy(xpVibrancy: number, streakMultiplier: number): void {
    this.xpVibrancy = Math.max(0.6, Math.min(1.0, xpVibrancy));
    this.streakMultiplier = Math.max(1, Math.min(3, streakMultiplier));

    // Apply vibrancy as a floor to ambientBrightness immediately
    // so even in dim times-of-day, productive activity lifts the world
    if (this.state.ambientBrightness < this.xpVibrancy) {
      this.state = {
        ...this.state,
        ambientBrightness: this.xpVibrancy,
      };
    }
  }

  /**
   * Get the current streak multiplier (for particle scaling)
   */
  getStreakMultiplier(): number {
    return this.streakMultiplier;
  }

  getMoonPhase(): number {
    return this.moonPhase;
  }

  /**
   * Update lighting state based on current time
   */
  update(): void {
    this.frameCount++;
    const tod = LightingSystem.getTimeOfDay();
    if (tod !== this.state.timeOfDay) {
      const config = { ...TIME_CONFIGS[tod] };
      config.ambientBrightness = Math.max(0, Math.min(1,
        config.ambientBrightness + this.seasonAmbientBoost,
      ));
      // Apply XP vibrancy as a floor — productive days stay brighter
      if (config.ambientBrightness < this.xpVibrancy) {
        config.ambientBrightness = this.xpVibrancy;
      }
      this.state = { timeOfDay: tod, ...config };
    }

    // Update shooting stars
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life--;
      if (s.life <= 0) {
        this.shootingStars.splice(i, 1);
      }
    }

    // Spawn shooting stars during meteor events
    if (this.meteorActive && this.state.showStars && this.frameCount % 180 === 0) {
      if (Math.random() < 0.2 && this.shootingStars.length < 2) {
        this.shootingStars.push({
          x: Math.random() * 0.8 + 0.1,
          y: Math.random() * 0.2,
          vx: (0.005 + Math.random() * 0.005) * (Math.random() < 0.5 ? -1 : 1),
          vy: 0.008 + Math.random() * 0.006,
          life: 30,
          maxLife: 30,
        });
      }
    }
  }

  /**
   * Set point lights (call when zone loads or buildings change)
   */
  setPointLights(lights: PointLight[]): void {
    this.pointLights = lights;
  }

  /**
   * Add a single point light
   */
  addPointLight(light: PointLight): void {
    this.pointLights.push(light);
  }

  /**
   * Get current state
   */
  getState(): LightingState {
    return this.state;
  }

  /**
   * Render sky background with time-of-day gradient
   */
  renderSky(ctx: CanvasRenderingContext2D, width: number, height: number, skyTop: string, skyBottom: string): void {
    // Base sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);

    // Blend sky colours with time tint
    grad.addColorStop(0, this.blendColor(skyTop, this.state.tintColor, this.state.tintAlpha));
    grad.addColorStop(1, this.blendColor(skyBottom, this.state.tintColor, this.state.tintAlpha * 0.5));

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    if (this.state.showStars) {
      for (const star of this.stars) {
        const twinkle = Math.sin(this.frameCount * 0.03 + star.phase) * 0.3 + 0.7;
        ctx.globalAlpha = twinkle * (1 - this.state.ambientBrightness);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(
          star.x * width,
          star.y * height,
          star.size,
          star.size,
        );
      }
      ctx.globalAlpha = 1;

      // Moon
      this.drawMoon(ctx, width, height);

      // Shooting stars
      for (const s of this.shootingStars) {
        const alpha = s.life / s.maxLife;
        const sx = s.x * width;
        const sy = s.y * height;
        const tailLen = 20;
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - s.vx * tailLen * width, sy - s.vy * tailLen * height);
        ctx.stroke();
        // Bright head
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /**
   * Draw the moon based on current phase
   */
  private drawMoon(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const mx = width * 0.85;
    const my = height * 0.08;
    const r = 14;
    const phase = this.moonPhase;

    // Full moon glow halo
    const isNearFull = Math.abs(phase - 0.5) < 0.1;
    if (isNearFull) {
      const glow = ctx.createRadialGradient(mx, my, r, mx, my, r * 3);
      glow.addColorStop(0, 'rgba(255,255,230,0.15)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(mx - r * 3, my - r * 3, r * 6, r * 6);
    }

    // Moon base (full white circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFDE7';
    ctx.fill();

    // Shadow overlay for phases
    // phase 0 = new (all shadow), 0.5 = full (no shadow)
    if (Math.abs(phase - 0.5) > 0.03) {
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.clip();

      // Determine shadow side and coverage
      // 0-0.5: right side illuminated (shadow on left fading)
      // 0.5-1: left side illuminated (shadow on right growing)
      const illumination = phase < 0.5
        ? phase * 2          // 0→1 as phase goes 0→0.5
        : (1 - phase) * 2;   // 1→0 as phase goes 0.5→1

      // Shadow ellipse offset
      const offset = (1 - illumination) * r * 2;
      const shadowX = phase < 0.5 ? mx - offset : mx + offset;

      ctx.beginPath();
      ctx.ellipse(shadowX, my, r * (1 - illumination * 0.8), r, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,10,30,0.85)';
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render ambient tint overlay (call after all world rendering)
   */
  renderAmbientOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.state.tintAlpha <= 0) return;

    ctx.globalAlpha = this.state.tintAlpha;
    ctx.fillStyle = this.state.tintColor;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  /**
   * Render point lights (additive blend)
   */
  renderPointLights(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    zoom: number,
  ): void {
    if (!this.state.showLights || this.pointLights.length === 0) return;

    // Use 'lighter' blend mode for additive light
    ctx.globalCompositeOperation = 'lighter';

    for (const light of this.pointLights) {
      const sx = (light.worldX - cameraX) * zoom;
      const sy = (light.worldY - cameraY) * zoom;
      const sr = light.radius * zoom;

      // Flicker
      let intensity = light.intensity;
      if (light.flicker) {
        intensity *= 0.85 + Math.sin(this.frameCount * 0.1 + light.worldX) * 0.15;
      }

      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      grad.addColorStop(0, this.colorWithAlpha(light.color, intensity * 0.6));
      grad.addColorStop(0.5, this.colorWithAlpha(light.color, intensity * 0.2));
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Helpers ────────────────────────────────────

  private blendColor(base: string, tint: string, alpha: number): string {
    if (alpha <= 0) return base;
    const b = this.hexToRGB(base);
    const t = this.hexToRGB(tint);
    const r = Math.round(b.r * (1 - alpha) + t.r * alpha);
    const g = Math.round(b.g * (1 - alpha) + t.g * alpha);
    const bl = Math.round(b.b * (1 - alpha) + t.b * alpha);
    return `rgb(${r},${g},${bl})`;
  }

  private colorWithAlpha(hex: string, alpha: number): string {
    const { r, g, b } = this.hexToRGB(hex);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
  }

  private hexToRGB(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16) || 0,
      g: parseInt(h.slice(2, 4), 16) || 0,
      b: parseInt(h.slice(4, 6), 16) || 0,
    };
  }
}
