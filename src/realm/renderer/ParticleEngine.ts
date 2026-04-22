/**
 * Particle Engine — The Realm
 *
 * Handles ambient particles (fireflies, pollen, sparks),
 * event particles (XP gains, level ups), and weather particles.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  type: 'dot' | 'glow' | 'text' | 'snowflake' | 'raindrop' | 'petal';
  text?: string;
  gravity?: number;
  /** For fireflies: sinusoidal wobble */
  wobblePhase?: number;
  wobbleSpeed?: number;
}

const MAX_PARTICLES = 300;

export class ParticleEngine {
  private particles: Particle[] = [];
  private pool: Particle[] = [];

  /** Streak multiplier (1–3) scales particle emission frequency and count */
  private streakMult = 1;

  /** Pre-allocate pool */
  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push(this.createBlank());
    }
  }

  private createBlank(): Particle {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0, size: 2,
      color: '#fff', alpha: 1,
      type: 'dot',
    };
  }

  private acquire(): Particle | null {
    if (this.pool.length > 0) return this.pool.pop()!;
    if (this.particles.length >= MAX_PARTICLES) return null;
    return this.createBlank();
  }

  /**
   * Set streak multiplier (1–3). Higher streaks → more particles per emission.
   */
  setStreakMultiplier(mult: number): void {
    this.streakMult = Math.max(1, Math.min(3, mult));
  }

  /**
   * Emit burst of particles at a position
   */
  emit(
    x: number,
    y: number,
    count: number,
    opts: {
      colors?: string[];
      speed?: number;
      life?: number;
      size?: number;
      type?: Particle['type'];
      gravity?: number;
    } = {},
  ): void {
    const {
      colors = ['#FFD700'],
      speed = 2,
      life = 60,
      size = 2,
      type = 'dot',
      gravity = 0,
    } = opts;

    // Scale particle count by streak multiplier (weekly streaks = more visual feedback)
    const scaledCount = Math.round(count * this.streakMult);

    for (let i = 0; i < scaledCount; i++) {
      const p = this.acquire();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.5);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.alpha = 1;
      p.type = type;
      p.gravity = gravity;
      p.wobblePhase = undefined;
      p.wobbleSpeed = undefined;
      p.text = undefined;

      this.particles.push(p);
    }
  }

  /**
   * Emit floating text
   */
  emitText(x: number, y: number, text: string, color = '#FFD700'): void {
    const p = this.acquire();
    if (!p) return;

    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = -1.5;
    p.life = 80;
    p.maxLife = 80;
    p.size = 14;
    p.color = color;
    p.alpha = 1;
    p.type = 'text';
    p.text = text;
    p.gravity = 0;

    this.particles.push(p);
  }

  /**
   * Emit ambient fireflies (call periodically)
   */
  emitFirefly(worldX: number, worldY: number, viewportWidth: number, viewportHeight: number): void {
    if (this.particles.filter(p => p.wobblePhase !== undefined).length > 15) return;

    const p = this.acquire();
    if (!p) return;

    p.x = worldX + Math.random() * viewportWidth;
    p.y = worldY + Math.random() * viewportHeight;
    p.vx = (Math.random() - 0.5) * 0.3;
    p.vy = (Math.random() - 0.5) * 0.3;
    p.life = 200 + Math.random() * 200;
    p.maxLife = p.life;
    p.size = 2 + Math.random() * 2;
    p.color = '#FFD700';
    p.alpha = 0;
    p.type = 'glow';
    p.wobblePhase = Math.random() * Math.PI * 2;
    p.wobbleSpeed = 0.02 + Math.random() * 0.02;

    this.particles.push(p);
  }

  /**
   * Emit pollen particles (daytime ambient)
   */
  emitPollen(worldX: number, worldY: number, viewportWidth: number, viewportHeight: number): void {
    const p = this.acquire();
    if (!p) return;

    p.x = worldX + Math.random() * viewportWidth;
    p.y = worldY - 10;
    p.vx = 0.3 + Math.random() * 0.5;
    p.vy = 0.2 + Math.random() * 0.3;
    p.life = 150 + Math.random() * 100;
    p.maxLife = p.life;
    p.size = 1 + Math.random();
    p.color = Math.random() > 0.5 ? '#FFEEBB' : '#FFCCAA';
    p.alpha = 0.6;
    p.type = 'dot';
    p.wobblePhase = Math.random() * Math.PI * 2;
    p.wobbleSpeed = 0.03;

    this.particles.push(p);
  }

  /**
   * Update all particles
   */
  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life--;

      if (p.life <= 0) {
        // Return to pool
        this.particles.splice(i, 1);
        if (this.pool.length < MAX_PARTICLES) this.pool.push(p);
        continue;
      }

      // Movement
      p.x += p.vx;
      p.y += p.vy;

      // Gravity
      if (p.gravity) p.vy += p.gravity;

      // Wobble (for fireflies, pollen)
      if (p.wobblePhase !== undefined && p.wobbleSpeed) {
        p.wobblePhase += p.wobbleSpeed;
        p.x += Math.sin(p.wobblePhase) * 0.5;
        p.y += Math.cos(p.wobblePhase * 0.7) * 0.3;
      }

      // Fade
      const lifeRatio = p.life / p.maxLife;
      if (p.type === 'glow' && p.wobblePhase !== undefined) {
        // Fireflies: pulse in and out
        p.alpha = Math.sin(lifeRatio * Math.PI) * (0.5 + Math.sin(p.wobblePhase * 3) * 0.3);
      } else if (lifeRatio < 0.3) {
        p.alpha = lifeRatio / 0.3;
      } else if (lifeRatio > 0.8 && p.type !== 'text') {
        p.alpha = (1 - lifeRatio) / 0.2;
      }
    }
  }

  /**
   * Render all particles
   */
  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, zoom: number): void {
    for (const p of this.particles) {
      const sx = (p.x - cameraX) * zoom;
      const sy = (p.y - cameraY) * zoom;
      const sz = p.size * zoom;

      if (sx < -20 || sy < -20 || sx > ctx.canvas.width + 20 || sy > ctx.canvas.height + 20) continue;

      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

      switch (p.type) {
        case 'dot': {
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
          break;
        }
        case 'glow': {
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sz * 3);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(sx - sz * 3, sy - sz * 3, sz * 6, sz * 6);
          // Core dot
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
          break;
        }
        case 'text': {
          ctx.font = `bold ${Math.round(sz)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.strokeText(p.text || '', sx, sy);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text || '', sx, sy);
          break;
        }
        case 'petal': {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(sx, sy, sz, sz / 2, (p.wobblePhase || 0), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'raindrop': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + p.vx * 2, sy + p.vy * 2);
          ctx.stroke();
          break;
        }
        case 'snowflake': {
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, sz, sz);
          break;
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  get count(): number {
    return this.particles.length;
  }

  clear(): void {
    this.pool.push(...this.particles);
    this.particles = [];
  }
}
