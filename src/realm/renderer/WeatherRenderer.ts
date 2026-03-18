/**
 * Weather Renderer — The Realm
 *
 * Renders weather overlays and emits weather particles.
 */

import type { ParticleEngine } from './ParticleEngine';
import type { Camera } from './Camera';

export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow';

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
}

export class WeatherRenderer {
  private weather: WeatherType = 'sunny';
  private clouds: Cloud[] = [];
  private lightningTimer = 0;
  private lightningFlash = false;

  setWeather(type: WeatherType): void {
    if (this.weather === type) return;
    this.weather = type;

    // Generate clouds for cloudy/rain/storm
    if (type === 'cloudy' || type === 'rain' || type === 'storm') {
      this.clouds = [];
      const count = type === 'storm' ? 4 : type === 'rain' ? 3 : 2;
      for (let i = 0; i < count; i++) {
        this.clouds.push({
          x: Math.random() * 1.5 - 0.25,
          y: 0.05 + Math.random() * 0.1,
          w: 0.15 + Math.random() * 0.2,
          h: 0.04 + Math.random() * 0.03,
          speed: 0.0001 + Math.random() * 0.0002,
        });
      }
    }
  }

  update(frameCount: number): void {
    // Move clouds
    for (const c of this.clouds) {
      c.x += c.speed;
      if (c.x > 1.3) c.x = -0.3;
    }

    // Lightning timing for storms
    if (this.weather === 'storm') {
      this.lightningTimer++;
      if (this.lightningTimer > 180 + Math.random() * 120) {
        this.lightningFlash = true;
        this.lightningTimer = 0;
      } else if (this.lightningFlash && this.lightningTimer > 3) {
        this.lightningFlash = false;
      }
    } else {
      this.lightningFlash = false;
    }
  }

  /**
   * Render weather overlay on top of the scene.
   */
  renderOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, frameCount: number): void {
    switch (this.weather) {
      case 'rain':
        ctx.fillStyle = 'rgba(20,30,60,0.15)';
        ctx.fillRect(0, 0, w, h);
        break;
      case 'storm':
        ctx.fillStyle = 'rgba(10,15,40,0.25)';
        ctx.fillRect(0, 0, w, h);
        if (this.lightningFlash) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(0, 0, w, h);
        }
        break;
      case 'cloudy':
        // Render cloud shadows
        for (const c of this.clouds) {
          ctx.fillStyle = 'rgba(30,30,50,0.08)';
          ctx.beginPath();
          ctx.ellipse(c.x * w, c.y * h, c.w * w, c.h * h, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'snow':
        ctx.fillStyle = 'rgba(200,210,230,0.06)';
        ctx.fillRect(0, 0, w, h);
        break;
      // sunny: no overlay
    }
  }

  /**
   * Emit weather-appropriate particles.
   */
  emitWeatherParticles(particles: ParticleEngine, camera: Camera): void {
    const vw = camera.viewportWidth / camera.zoom;
    const vh = camera.viewportHeight / camera.zoom;

    switch (this.weather) {
      case 'rain':
        // Light rain
        for (let i = 0; i < 3; i++) {
          const x = camera.x + Math.random() * vw;
          const y = camera.y + Math.random() * vh * 0.3;
          particles.emit(x, y, 1, {
            type: 'raindrop',
            colors: ['#6688BB'],
            speed: 0.5,
            life: 40,
            size: 2,
            gravity: 0.3,
          });
        }
        break;
      case 'storm':
        // Heavy rain
        for (let i = 0; i < 8; i++) {
          const x = camera.x + Math.random() * vw;
          const y = camera.y + Math.random() * vh * 0.2;
          particles.emit(x, y, 1, {
            type: 'raindrop',
            colors: ['#5577AA'],
            speed: 1,
            life: 30,
            size: 3,
            gravity: 0.5,
          });
        }
        break;
      case 'snow':
        // Gentle snowflakes
        if (Math.random() < 0.3) {
          const x = camera.x + Math.random() * vw;
          const y = camera.y;
          particles.emit(x, y, 1, {
            type: 'snowflake',
            colors: ['#E8E8F0'],
            speed: 0.2,
            life: 120,
            size: 3,
            gravity: 0.02,
          });
        }
        break;
      case 'sunny':
        // Occasional petal/butterfly
        if (Math.random() < 0.05) {
          const x = camera.x + Math.random() * vw;
          const y = camera.y + Math.random() * vh * 0.5;
          particles.emit(x, y, 1, {
            type: 'petal',
            colors: ['#FFB6C1', '#FFDAB9', '#E6E6FA'],
            speed: 0.3,
            life: 100,
            size: 3,
          });
        }
        break;
    }
  }

  getWeather(): WeatherType {
    return this.weather;
  }
}
