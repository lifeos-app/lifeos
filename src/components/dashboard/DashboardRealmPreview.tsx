/**
 * Dashboard Realm Preview — The Realm gateway card on the Dashboard
 *
 * Shows a live mini-canvas preview of the user's town,
 * current weather/time, and a "Enter Realm →" CTA.
 * This is what draws users in — it should look magical.
 */

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Castle, Sparkles, TreePine, Moon, Sun, Cloud, CloudRain } from 'lucide-react';
import './DashboardRealmPreview.css';
import { useHealthStore } from '../../stores/useHealthStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useGamificationContext } from '../../lib/gamification/context';
import { LightingSystem } from '../../realm/renderer/LightingSystem';

/** Mood to weather mapping */
function getWeatherInfo(moodScore: number): { label: string; Icon: typeof Sun; color: string } {
  if (moodScore >= 5) return { label: 'Clear Skies', Icon: Sun, color: '#FFD700' };
  if (moodScore >= 4) return { label: 'Fair', Icon: Sun, color: '#FFA500' };
  if (moodScore >= 3) return { label: 'Overcast', Icon: Cloud, color: '#8BA4BE' };
  if (moodScore >= 2) return { label: 'Rain', Icon: CloudRain, color: '#5A7A9A' };
  return { label: 'Storms', Icon: CloudRain, color: '#4A5A6A' };
}

/** Time of day to greeting */
function getTimeGreeting(tod: string): string {
  switch (tod) {
    case 'dawn': return 'Dawn breaks over';
    case 'morning': return 'Morning light in';
    case 'day': return 'The sun shines on';
    case 'golden': return 'Golden hour in';
    case 'dusk': return 'Dusk settles over';
    case 'evening': return 'Evening falls on';
    case 'night': return 'Stars watch over';
    default: return 'Welcome to';
  }
}

export const DashboardRealmPreview = memo(function DashboardRealmPreview() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  // BUG-081: Track visibility to pause animation when off-screen
  const [isVisible, setIsVisible] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  const moodScore = useHealthStore(s => s.todayMetrics?.mood_score ?? 3);
  const habits = useHabitsStore(s => s.habits);
  const goals = useGoalsStore(s => s.goals);
  const { level, title } = useGamificationContext();

  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted).length;
  const bestStreak = Math.max(0, ...habits.map(h => h.streak_current || 0));
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in_progress').length;

  const tod = LightingSystem.getTimeOfDay();
  const weather = getWeatherInfo(moodScore);
  const greeting = getTimeGreeting(tod);
  const isNight = tod === 'night' || tod === 'evening';

  // BUG-081: IntersectionObserver to pause animation when off-screen
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Mini canvas rendering — tiny animated town preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    function render() {
      // BUG-081: Only animate when visible
      if (!isVisible) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      frameRef.current++;
      const f = frameRef.current;

      ctx.clearRect(0, 0, w, h);

      // Sky gradient (time-aware)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      if (isNight) {
        skyGrad.addColorStop(0, '#0D0D2B');
        skyGrad.addColorStop(1, '#1A1A3E');
      } else if (tod === 'dawn' || tod === 'dusk') {
        skyGrad.addColorStop(0, '#1B2838');
        skyGrad.addColorStop(0.5, '#FF8C42');
        skyGrad.addColorStop(1, '#2C3E50');
      } else {
        skyGrad.addColorStop(0, '#1B2838');
        skyGrad.addColorStop(1, '#2C3E50');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars (night)
      if (isNight) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 15; i++) {
          const sx = (i * 31 + f * 0.01) % w;
          const sy = (i * 17) % (h * 0.4);
          const twinkle = Math.sin(f * 0.03 + i) * 0.3 + 0.7;
          ctx.globalAlpha = twinkle;
          ctx.fillRect(sx, sy, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // Ground
      ctx.fillStyle = '#3D6B4A';
      ctx.fillRect(0, h * 0.65, w, h * 0.35);
      ctx.fillStyle = '#4A7C59';
      ctx.fillRect(0, h * 0.65, w, 2);

      // Path
      ctx.fillStyle = '#8B8B7A';
      ctx.fillRect(w * 0.35, h * 0.65, w * 0.3, h * 0.35);

      // House (scales with level)
      const houseW = 28 + Math.min(level, 50) * 0.3;
      const houseH = 22 + Math.min(level, 50) * 0.3;
      const houseX = w * 0.15;
      const houseY = h * 0.65 - houseH;

      // Walls
      ctx.fillStyle = level >= 15 ? '#A08B70' : level >= 8 ? '#8B8B7A' : '#6B5B3F';
      ctx.fillRect(houseX, houseY + houseH * 0.35, houseW, houseH * 0.65);
      // Roof
      ctx.fillStyle = level >= 15 ? '#8B0000' : '#8B4513';
      ctx.beginPath();
      ctx.moveTo(houseX - 3, houseY + houseH * 0.35);
      ctx.lineTo(houseX + houseW / 2, houseY);
      ctx.lineTo(houseX + houseW + 3, houseY + houseH * 0.35);
      ctx.closePath();
      ctx.fill();
      // Window glow
      if (isNight) {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(houseX + 5, houseY + houseH * 0.5, 5, 4);
        ctx.fillRect(houseX + houseW - 10, houseY + houseH * 0.5, 5, 4);
      }

      // Town hall (larger)
      const thX = w * 0.55;
      const thY = h * 0.65 - 28;
      ctx.fillStyle = '#8B8B7A';
      ctx.fillRect(thX, thY + 10, 35, 18);
      ctx.fillStyle = '#696969';
      ctx.beginPath();
      ctx.moveTo(thX - 2, thY + 10);
      ctx.lineTo(thX + 17, thY);
      ctx.lineTo(thX + 37, thY + 10);
      ctx.closePath();
      ctx.fill();
      // Flag
      ctx.fillStyle = '#FF4500';
      ctx.fillRect(thX + 16, thY - 6, 1, 8);
      const flagWave = Math.sin(f * 0.06) * 1.5;
      ctx.fillRect(thX + 17, thY - 5, 6 + flagWave, 3);

      // Garden plants (based on real habit count)
      const plantCount = Math.min(activeHabits, 6);
      for (let i = 0; i < plantCount; i++) {
        const px = w * 0.75 + (i % 3) * 12;
        const py = h * 0.72 + Math.floor(i / 3) * 10;
        const sway = Math.sin(f * 0.03 + i * 2) * 1;

        // Stem
        ctx.fillStyle = '#3D8B3D';
        ctx.fillRect(px, py - 4 + sway, 1, 5);
        // Bloom (brighter for longer streaks)
        ctx.fillStyle = bestStreak >= 30 ? '#FFD700' : bestStreak >= 7 ? '#4CAF50' : '#8BC34A';
        ctx.beginPath();
        ctx.arc(px, py - 5 + sway, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fireflies (night) or pollen (day)
      if (isNight) {
        for (let i = 0; i < 5; i++) {
          const fx = (i * 47 + f * 0.3) % w;
          const fy = h * 0.3 + Math.sin(f * 0.02 + i * 3) * 15;
          const glow = Math.sin(f * 0.04 + i * 2) * 0.3 + 0.5;
          ctx.globalAlpha = glow;
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(fx, fy, 2, 2);
        }
        ctx.globalAlpha = 1;
      } else {
        for (let i = 0; i < 3; i++) {
          const px = (i * 67 + f * 0.5) % w;
          const py = (i * 37 + f * 0.2) % (h * 0.5);
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = '#FFEEBB';
          ctx.fillRect(px, py, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // Rain (if mood low)
      if (moodScore <= 2) {
        ctx.strokeStyle = 'rgba(150,180,220,0.4)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 20; i++) {
          const rx = (i * 13 + f * 2) % w;
          const ry = (i * 19 + f * 4) % h;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + 1, ry + 4);
          ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isNight, tod, level, activeHabits, bestStreak, moodScore, isVisible]);

  const handleEnter = useCallback(() => {
    navigate('/character?tab=realm');
  }, [navigate]);

  return (
    <section ref={sectionRef} className="dash-card realm-preview-card" onClick={handleEnter}>
      <div className="realm-preview-header">
        <div className="realm-preview-title">
          <Castle size={16} style={{ color: '#FFD700' }} />
          <span>The Realm</span>
        </div>
        <div className="realm-preview-weather">
          <weather.Icon size={13} style={{ color: weather.color }} />
          <span style={{ color: weather.color }}>{weather.label}</span>
        </div>
      </div>

      <div className="realm-preview-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={200}
          height={100}
          className="realm-preview-canvas"
        />
        <div className="realm-preview-overlay">
          <span className="realm-preview-greeting">{greeting}</span>
          <span className="realm-preview-town">Life Town</span>
        </div>
      </div>

      <div className="realm-preview-stats">
        <div className="realm-preview-stat">
          <TreePine size={12} />
          <span>{activeHabits} plants</span>
        </div>
        <div className="realm-preview-stat">
          <Sparkles size={12} />
          <span>{activeGoals} quests</span>
        </div>
        <div className="realm-preview-stat">
          {isNight ? <Moon size={12} /> : <Sun size={12} />}
          <span>Lv.{level}</span>
        </div>
      </div>

      <div className="realm-preview-cta">
        Enter Realm →
      </div>
    </section>
  );
});
