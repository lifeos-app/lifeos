/**
 * MapleCreationPanel — Full MapleStory-style character creation UI
 *
 * Live preview canvas + category tabs (Hair, Face, Skin, Top, Bottom, Shoes)
 * with style grids and color swatches. Mobile-first (390x844), touch targets >= 44px.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { drawCharacter } from '../../realm/renderer/drawCharacter';
import {
  SKIN_TONES, HAIR_COLORS, EYE_COLORS,
  HAIR_STYLES, FACE_TYPES, TOP_STYLES, BOTTOM_STYLES, SHOE_STYLES,
  OUTFIT_COLORS, BOTTOM_COLORS, SHOE_COLORS,
} from '../../rpg/data/sprites';
import './MapleCreationPanel.css';

export interface MapleCreationResult {
  skinTone: string;
  hairColor: string;
  bodyColor: string;
  name: string;
  hairStyleIdx: number;
  faceTypeIdx: number;
  eyeColor: string;
  topIdx: number;
  bottomIdx: number;
  shoesIdx: number;
  topColor: string;
  bottomColor: string;
  shoesColor: string;
  capeIdx: number;
  hatIdx: number;
  weaponIdx: number;
}

export interface MapleCreationPanelProps {
  initialClass: string;
  onConfirm: (result: MapleCreationResult) => void;
  onUpdate: (partial: Partial<MapleCreationResult>) => void;
}

type Tab = 'hair' | 'face' | 'skin' | 'top' | 'bottom' | 'shoes';

const TABS: { key: Tab; label: string }[] = [
  { key: 'hair', label: 'HAIR' },
  { key: 'face', label: 'FACE' },
  { key: 'skin', label: 'SKIN' },
  { key: 'top', label: 'TOP' },
  { key: 'bottom', label: 'BOTTOM' },
  { key: 'shoes', label: 'SHOES' },
];

const HAIR_LABELS = ['Short', 'Spiky', 'Long', 'Bowl', 'Twins', 'Swept', 'Messy', 'Flowing'];
const FACE_LABELS = ['Round', 'Almond', 'Cat', 'Happy', 'Stern', 'Sparkle'];
const TOP_LABELS = ['Tee', 'Armor', 'Robe', 'Hoodie'];
const BOTTOM_LABELS = ['Pants', 'Shorts', 'Skirt'];
const SHOE_LABELS = ['Sneakers', 'Boots', 'Sandals'];

export function MapleCreationPanel({ initialClass, onConfirm, onUpdate }: MapleCreationPanelProps) {
  const [tab, setTab] = useState<Tab>('hair');
  const [name, setName] = useState('');

  // Appearance state
  const [skinIdx, setSkinIdx] = useState(2);
  const [hairColorIdx, setHairColorIdx] = useState(0);
  const [hairStyleIdx, setHairStyleIdx] = useState(0);
  const [faceTypeIdx, setFaceTypeIdx] = useState(0);
  const [eyeColorIdx, setEyeColorIdx] = useState(0);
  const [topIdx, setTopIdx] = useState(0);
  const [bottomIdx, setBottomIdx] = useState(0);
  const [shoesIdx, setShoesIdx] = useState(0);
  const [outfitColorIdx, setOutfitColorIdx] = useState(0);
  const [bottomColorIdx, setBottomColorIdx] = useState(0);
  const [shoeColorIdx, setShoeColorIdx] = useState(0);

  // Preview canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const frameRef = useRef(0);

  // Notify parent of initial appearance
  useEffect(() => {
    onUpdate({
      skinTone: SKIN_TONES[skinIdx],
      hairColor: HAIR_COLORS[hairColorIdx],
      bodyColor: OUTFIT_COLORS[outfitColorIdx],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build current appearance for preview
  const getAppearance = useCallback(() => ({
    skinTone: SKIN_TONES[skinIdx],
    hairColor: HAIR_COLORS[hairColorIdx],
    bodyColor: OUTFIT_COLORS[outfitColorIdx],
    hairStyleIdx,
    faceTypeIdx,
    eyeColor: EYE_COLORS[eyeColorIdx],
    topIdx,
    bottomIdx,
    shoesIdx,
    topColor: OUTFIT_COLORS[outfitColorIdx],
    bottomColor: BOTTOM_COLORS[bottomColorIdx],
    shoesColor: SHOE_COLORS[shoeColorIdx],
    capeIdx: -1,
    hatIdx: -1,
    weaponIdx: -1,
  }), [skinIdx, hairColorIdx, hairStyleIdx, faceTypeIdx, eyeColorIdx, topIdx, bottomIdx, shoesIdx, outfitColorIdx, bottomColorIdx, shoeColorIdx]);

  // Preview render loop
  useEffect(() => {
    let running = true;

    const draw = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = (rect?.width ?? 200) * dpr;
      const h = (rect?.height ?? 200) * dpr;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${w / dpr}px`;
        canvas.style.height = `${h / dpr}px`;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);

      // Dark gradient backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, 'rgba(20, 15, 50, 0.9)');
      bg.addColorStop(1, 'rgba(13, 13, 43, 0.5)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      frameRef.current++;
      const app = getAppearance();
      const unit = h * 0.035;
      const charCx = w / 2;
      const charCy = h * 0.58;

      drawCharacter({
        ctx,
        cx: charCx,
        cy: charCy,
        unit,
        skinTone: app.skinTone,
        hairColor: app.hairColor,
        bodyColor: app.bodyColor,
        classIcon: '',
        name: '',
        level: 1,
        direction: 'down',
        isMoving: false,
        mood: 4,
        bestStreak: 0,
        energy: 3,
        walkFrame: 0,
        frameCount: frameRef.current,
        showName: false,
        showClassIcon: false,
        hairStyleIdx: app.hairStyleIdx,
        faceTypeIdx: app.faceTypeIdx,
        eyeColor: app.eyeColor,
        topIdx: app.topIdx,
        bottomIdx: app.bottomIdx,
        shoesIdx: app.shoesIdx,
        capeIdx: app.capeIdx,
        hatIdx: app.hatIdx,
        weaponIdx: app.weaponIdx,
        topColor: app.topColor,
        bottomColor: app.bottomColor,
        shoesColor: app.shoesColor,
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    // Throttle to ~30fps
    let lastTime = 0;
    const throttledDraw = () => {
      if (!running) return;
      const now = performance.now();
      if (now - lastTime >= 33) {
        lastTime = now;
        draw();
      } else {
        rafRef.current = requestAnimationFrame(throttledDraw);
      }
    };
    throttledDraw();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [getAppearance]);

  // Notify parent on changes
  const emitUpdate = useCallback((partial: Partial<MapleCreationResult>) => {
    onUpdate(partial);
  }, [onUpdate]);

  const handleConfirm = useCallback(() => {
    const app = getAppearance();
    onConfirm({
      ...app,
      name: name.trim() || 'Adventurer',
    });
  }, [getAppearance, name, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  }, [handleConfirm]);

  // ── Render tab content ──
  const renderTabContent = () => {
    switch (tab) {
      case 'hair':
        return (
          <>
            <div className="maple-creation__grid">
              {HAIR_LABELS.map((label, i) => (
                <button
                  key={`hair-${i}`}
                  className={`maple-creation__style-btn ${i === hairStyleIdx ? 'maple-creation__style-btn--selected' : ''}`}
                  onClick={() => { setHairStyleIdx(i); emitUpdate({ hairStyleIdx: i }); }}
                  aria-label={`Hair style: ${label}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="maple-creation__colors">
              {HAIR_COLORS.map((color, i) => (
                <button
                  key={`hc-${i}`}
                  className={`maple-creation__color-swatch ${i === hairColorIdx ? 'maple-creation__color-swatch--selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => { setHairColorIdx(i); emitUpdate({ hairColor: HAIR_COLORS[i] }); }}
                  aria-label={`Hair color ${i + 1}`}
                />
              ))}
            </div>
          </>
        );

      case 'face':
        return (
          <>
            <div className="maple-creation__grid">
              {FACE_LABELS.map((label, i) => (
                <button
                  key={`face-${i}`}
                  className={`maple-creation__style-btn ${i === faceTypeIdx ? 'maple-creation__style-btn--selected' : ''}`}
                  onClick={() => { setFaceTypeIdx(i); emitUpdate({ faceTypeIdx: i }); }}
                  aria-label={`Face type: ${label}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="maple-creation__colors">
              {EYE_COLORS.map((color, i) => (
                <button
                  key={`ec-${i}`}
                  className={`maple-creation__color-swatch ${i === eyeColorIdx ? 'maple-creation__color-swatch--selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => { setEyeColorIdx(i); emitUpdate({ eyeColor: EYE_COLORS[i] }); }}
                  aria-label={`Eye color ${i + 1}`}
                />
              ))}
            </div>
          </>
        );

      case 'skin':
        return (
          <div className="maple-creation__colors">
            {SKIN_TONES.map((color, i) => (
              <button
                key={`skin-${i}`}
                className={`maple-creation__color-swatch ${i === skinIdx ? 'maple-creation__color-swatch--selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => { setSkinIdx(i); emitUpdate({ skinTone: SKIN_TONES[i] }); }}
                aria-label={`Skin tone ${i + 1}`}
              />
            ))}
          </div>
        );

      case 'top':
        return (
          <>
            <div className="maple-creation__grid">
              {TOP_LABELS.map((label, i) => (
                <button
                  key={`top-${i}`}
                  className={`maple-creation__style-btn ${i === topIdx ? 'maple-creation__style-btn--selected' : ''}`}
                  onClick={() => { setTopIdx(i); emitUpdate({ topIdx: i }); }}
                  aria-label={`Top style: ${label}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="maple-creation__colors">
              {OUTFIT_COLORS.map((color, i) => (
                <button
                  key={`oc-${i}`}
                  className={`maple-creation__color-swatch ${i === outfitColorIdx ? 'maple-creation__color-swatch--selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => { setOutfitColorIdx(i); emitUpdate({ bodyColor: OUTFIT_COLORS[i], topColor: OUTFIT_COLORS[i] }); }}
                  aria-label={`Outfit color ${i + 1}`}
                />
              ))}
            </div>
          </>
        );

      case 'bottom':
        return (
          <>
            <div className="maple-creation__grid">
              {BOTTOM_LABELS.map((label, i) => (
                <button
                  key={`bot-${i}`}
                  className={`maple-creation__style-btn ${i === bottomIdx ? 'maple-creation__style-btn--selected' : ''}`}
                  onClick={() => { setBottomIdx(i); emitUpdate({ bottomIdx: i }); }}
                  aria-label={`Bottom style: ${label}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="maple-creation__colors">
              {BOTTOM_COLORS.map((color, i) => (
                <button
                  key={`bc-${i}`}
                  className={`maple-creation__color-swatch ${i === bottomColorIdx ? 'maple-creation__color-swatch--selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => { setBottomColorIdx(i); emitUpdate({ bottomColor: BOTTOM_COLORS[i] }); }}
                  aria-label={`Bottom color ${i + 1}`}
                />
              ))}
            </div>
          </>
        );

      case 'shoes':
        return (
          <>
            <div className="maple-creation__grid">
              {SHOE_LABELS.map((label, i) => (
                <button
                  key={`shoe-${i}`}
                  className={`maple-creation__style-btn ${i === shoesIdx ? 'maple-creation__style-btn--selected' : ''}`}
                  onClick={() => { setShoesIdx(i); emitUpdate({ shoesIdx: i }); }}
                  aria-label={`Shoe style: ${label}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="maple-creation__colors">
              {SHOE_COLORS.map((color, i) => (
                <button
                  key={`sc-${i}`}
                  className={`maple-creation__color-swatch ${i === shoeColorIdx ? 'maple-creation__color-swatch--selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => { setShoeColorIdx(i); emitUpdate({ shoesColor: SHOE_COLORS[i] }); }}
                  aria-label={`Shoe color ${i + 1}`}
                />
              ))}
            </div>
          </>
        );
    }
  };

  return (
    <div className="maple-creation">
      {/* Live preview */}
      <div className="maple-creation__preview">
        <canvas ref={canvasRef} />
      </div>

      {/* Category tabs */}
      <div className="maple-creation__tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`maple-creation__tab ${tab === t.key ? 'maple-creation__tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Style selector */}
      <div className="maple-creation__body">
        {renderTabContent()}
      </div>

      {/* Footer: name + confirm */}
      <div className="maple-creation__footer">
        <input
          className="maple-creation__name-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your name..."
          maxLength={20}
          autoComplete="off"
        />
        <button className="maple-creation__confirm" onClick={handleConfirm}>
          Begin My Journey
        </button>
      </div>
    </div>
  );
}
