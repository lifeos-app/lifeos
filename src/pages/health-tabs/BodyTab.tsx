/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Check, TrendingUp, TrendingDown, Scale, Activity, AlertTriangle, Edit3, Trash2, Camera, X } from 'lucide-react';
import { SparkLine, AreaChart } from '../../components/charts';
import { DataTooltip } from '../../components/ui/DataTooltip';
import type { DataTooltipData } from '../../components/ui/DataTooltip';
import { BodyMapSVG } from './components';
import type { BodyMarker, CSSVarStyle } from './types';
import { logger } from '../../utils/logger';
import { validateHealth } from '../../utils/health-validation';

// ── Progress Photo types ──
interface BodyPhoto {
  date: string;
  dataUrl: string;
}

const STORAGE_KEY = 'lifeos_body_photos';
const MAX_PHOTOS = 8;

function loadPhotos(): BodyPhoto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePhotos(photos: BodyPhoto[]) {
  // Keep max photos, purge oldest
  const trimmed = photos.slice(-MAX_PHOTOS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // localStorage full — remove oldest until it fits
    let arr = [...trimmed];
    while (arr.length > 1) {
      arr.shift();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); return; } catch { /* keep trying */ }
    }
    logger.error('[BodyPhotos] localStorage full', e);
  }
}

export function BodyTab({ metrics, allMetrics, markers, onUpdateMetrics, onAddMarker, onResolveMarker, onUpdateMarker, onDeleteMarker }: any) {
  const [weight, setWeight] = useState(metrics?.weight_kg?.toString() || '');
  const [height, setHeight] = useState(metrics?.height_cm?.toString() || '');
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [markerForm, setMarkerForm] = useState<Partial<BodyMarker>>({ marker_type: 'pain', severity: 3, date: new Date().toISOString().split('T')[0] });
  const [weightRange, setWeightRange] = useState<'30' | '90'>('30');

  // Progress photos state
  const [photos, setPhotos] = useState<BodyPhoto[]>(loadPhotos);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync photos from localStorage on mount
  useEffect(() => { setPhotos(loadPhotos()); }, []);

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Resize to max 800px wide to save localStorage space
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 800;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const newPhoto: BodyPhoto = { date: new Date().toISOString().split('T')[0], dataUrl };
        const updated = [...photos, newPhoto];
        savePhotos(updated);
        setPhotos(updated.slice(-MAX_PHOTOS));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [photos]);

  const deletePhoto = useCallback((idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    savePhotos(updated);
    setPhotos(updated);
  }, [photos]);

  const weightHistory = allMetrics.filter((m: any) => m.weight_kg)
    .slice(0, weightRange === '30' ? 30 : 90).reverse();

  const weightSeries = weightHistory.length > 1 ? [{
    data: weightHistory.map((m: any) => m.weight_kg as number),
    color: '#00D4FF', label: 'Weight (kg)', fillOpacity: 0.18,
  }] : [];

  const weightLabels = weightHistory.map((m: any) =>
    new Date(m.date + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  );

  const activeMarkers = markers.filter((m: any) => !m.resolved);

  const bmiCategory = metrics?.bmi
    ? metrics.bmi < 18.5 ? { label: 'Underweight', color: '#38BDF8' }
    : metrics.bmi < 25 ? { label: 'Normal', color: '#39FF14' }
    : metrics.bmi < 30 ? { label: 'Overweight', color: '#FACC15' }
    : { label: 'Obese', color: '#F43F5E' }
    : null;

  const weightChange = weightHistory.length >= 2
    ? weightHistory[weightHistory.length - 1].weight_kg! - weightHistory[0].weight_kg!
    : null;

  // Data tooltip state for long-press on chart points
  const [tooltipData, setTooltipData] = useState<DataTooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleWeightPointLongPress = useCallback((idx: number, pos: { x: number; y: number }) => {
    if (idx < 0 || idx >= weightHistory.length) return;
    const entry = weightHistory[idx];
    const value = entry.weight_kg as number;
    const date = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const prevValue = idx > 0 ? (weightHistory[idx - 1].weight_kg as number) : null;
    const weekAgoIdx = idx - 7;
    const weekAgoValue = weekAgoIdx >= 0 ? (weightHistory[weekAgoIdx].weight_kg as number) : null;
    const monthAgoIdx = idx - 30;
    const monthAgoValue = monthAgoIdx >= 0 ? (weightHistory[monthAgoIdx].weight_kg as number) : null;

    setTooltipData({
      value,
      label: 'Weight',
      date,
      unit: 'kg',
      color: '#00D4FF',
      previousValue: prevValue,
      weekAgoValue: weekAgoValue,
      monthAgoValue: monthAgoValue,
      lowerIsBetter: true,
    });
    setTooltipPos(pos);
  }, [weightHistory]);

  const dismissTooltip = useCallback(() => { setTooltipData(null); setTooltipPos(null); }, []);

  // Get last 2 photos for comparison
  const comparisonPhotos = photos.slice(-2);

  return (
    <div className="body-tab h-fade-up">
      {/* Weight Trend Chart */}
      <div className="hv2-section-label">WEIGHT TREND</div>
      <div className="glass-card hv2-chart-card">
        <div className="hv2-chart-header">
          <div className="hv2-chart-title">
            <Scale size={14} className="text-cyan-400" />
            <span className="text-cyan-400">
              {weightHistory[weightHistory.length - 1]?.weight_kg ? `${weightHistory[weightHistory.length - 1].weight_kg}kg` : '—'}
            </span>
            {weightChange !== null && (
              <span className={`hv2-delta ${weightChange < 0 ? 'down' : 'up'}`}>
                {weightChange < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                {Math.abs(weightChange).toFixed(1)}kg
              </span>
            )}
          </div>
          <div className="hv2-range-toggle">
            <button className={weightRange === '30' ? 'active' : ''} onClick={() => setWeightRange('30')}>30d</button>
            <button className={weightRange === '90' ? 'active' : ''} onClick={() => setWeightRange('90')}>90d</button>
          </div>
        </div>
        {weightSeries.length > 0 ? (
          <AreaChart
            series={weightSeries}
            labels={weightLabels.filter((_: string, i: number) => i % Math.ceil(weightLabels.length / 7) === 0)}
            height={120}
            showTrendLine={weightHistory.length >= 7}
            trendLineColor="rgba(0,212,255,0.4)"
            onPointLongPress={handleWeightPointLongPress}
          />
        ) : (
          <div className="hv2-empty-chart"><Scale size={24} className="opacity-20" /><span>Log weight to see trend</span></div>
        )}
      </div>

      {/* Body Metrics Grid */}
      <div className="hv2-section-label">BODY METRICS</div>
      <div className="hv2-body-metrics-grid">
        <div className="glass-card hv2-metric-card" style={{ '--mc-color': '#00D4FF' } as CSSVarStyle}>
          <div className="hv2-mc-header"><Scale size={13} /><span>Weight</span></div>
          <div className="hv2-mc-value text-cyan-400">
            {metrics?.weight_kg ? `${metrics.weight_kg}kg` : '—'}
          </div>
          {weightHistory.length > 1 && (
            <SparkLine data={weightHistory.map((m: any) => m.weight_kg as number).slice(-7)} color="#00D4FF" width="100%" height={28} filled />
          )}
          <div className="hv2-mc-input">
            <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="kg" />
            <button aria-label="Save weight" onClick={() => { if (weight) { if (!validateHealth('weight_kg', parseFloat(weight))) return; onUpdateMetrics({ weight_kg: parseFloat(weight) }); setWeight(''); } }}><Check size={12} /></button>
          </div>
        </div>

        <div className="glass-card hv2-metric-card" style={{ '--mc-color': '#FACC15' } as CSSVarStyle}>
          <div className="hv2-mc-header"><Activity size={13} /><span>BMI</span></div>
          <div className="hv2-mc-value" style={{ color: bmiCategory?.color || '#FACC15' }}>
            {metrics?.bmi ? metrics.bmi.toFixed(1) : '—'}
          </div>
          {bmiCategory && <div className="hv2-mc-tag" style={{ color: bmiCategory.color }}>{bmiCategory.label}</div>}
          <div className="hv2-mc-input">
            <input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} placeholder="height cm" />
            <button aria-label="Save height" onClick={() => { if (height) { if (!validateHealth('height_cm', parseFloat(height))) return; onUpdateMetrics({ height_cm: parseFloat(height) }); setHeight(''); } }}><Check size={12} /></button>
          </div>
        </div>

        {activeMarkers.length > 0 && (
          <div className="glass-card hv2-metric-card" style={{ '--mc-color': '#F43F5E' } as CSSVarStyle}>
            <div className="hv2-mc-header"><AlertTriangle size={13} /><span>Issues</span></div>
            <div className="hv2-mc-value text-rose-500">{activeMarkers.length}</div>
            <div className="hv2-mc-tag text-rose-500">active</div>
          </div>
        )}
      </div>

      {/* ── Progress Photos ── */}
      <div className="hv2-section-label"><Camera size={16} /> PROGRESS PHOTOS</div>
      <div className="glass-card hv2-photos-card">
        <div className="hv2-photos-header">
          <span className="hv2-photos-title">Progress Photos</span>
          <span className="hv2-photos-count">{photos.length}/{MAX_PHOTOS}</span>
        </div>

        {comparisonPhotos.length > 0 ? (
          <div className="hv2-photos-compare">
            {comparisonPhotos.map((photo, i) => (
              <div key={i} className="hv2-photo-slot">
                <div className="hv2-photo-img-wrap">
                  <img src={photo.dataUrl} alt={`Progress ${photo.date}`} className="hv2-photo-img" />
                  <button
                    className="hv2-photo-delete"
                    onClick={() => deletePhoto(photos.length - comparisonPhotos.length + i)}
                    aria-label="Delete photo"
                  >
                    <X size={12} />
                  </button>
                </div>
                <span className="hv2-photo-date">
                  {new Date(photo.date + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {i === 0 && comparisonPhotos.length === 2 && <span className="hv2-photo-label">Before</span>}
                {i === 1 && <span className="hv2-photo-label">After</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="hv2-photos-empty">
            <Camera size={24} className="opacity-20" />
            <span>Take or upload a progress photo</span>
          </div>
        )}

        <button
          className="btn-glow hv2-photos-add-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera size={14} /> Add Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />
        <div className="hv2-photos-hint">Stored locally on your device · Max {MAX_PHOTOS} photos</div>
      </div>

      {/* Body Map */}
      <div className="hv2-section-label">BODY MAP</div>
      <div className="hv2-body-map-row">
        <div className="glass-card hv2-bodymap-card">
          <div className="hv2-card-header"><Activity size={14} /><span>Tap a zone to log pain or injury</span></div>
          <BodyMapSVG markers={markers} onPartClick={(part) => { setSelectedPart(part); setMarkerForm(f => ({ ...f, body_part: part })); }} />
        </div>

        {selectedPart && (
          <div className="glass-card marker-form-card h-fade-up">
            <h3>Log Issue — <span className="text-orange-500">{selectedPart.replace(/_/g, ' ')}</span></h3>
            <div className="marker-form-grid">
              <div className="mf-group">
                <label>Type</label>
                <div className="pill-picker">
                  {(['pain', 'injury', 'tension', 'soreness', 'note'] as const).map(type => (
                    <button key={type} className={`pill ${markerForm.marker_type === type ? 'active' : ''}`}
                      onClick={() => setMarkerForm(f => ({ ...f, marker_type: type }))}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mf-group">
                <label>Severity</label>
                <div className="severity-slider">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} className={`sev-circle ${markerForm.severity === s ? 'active' : ''} s${s}`}
                      onClick={() => setMarkerForm(f => ({ ...f, severity: s }))}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="mf-group full">
                <label>Notes</label>
                <input type="text" placeholder="Describe the issue..." onChange={e => setMarkerForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="mf-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={markerForm.affects_workout || false} onChange={e => setMarkerForm(f => ({ ...f, affects_workout: e.target.checked }))} />
                  Affects workouts
                </label>
              </div>
            </div>
            <div className="mf-actions">
              <button className="btn-glow" onClick={() => { onAddMarker({ ...markerForm, body_part: selectedPart }); setSelectedPart(null); }}>Save Issue</button>
              <button className="btn-ghost" onClick={() => setSelectedPart(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Active Issues */}
      {activeMarkers.length > 0 && (
        <div className="glass-card active-issues-card h-fade-up">
          <div className="hv2-card-header"><AlertTriangle size={14} className="text-rose-500" /><span>Active Issues ({activeMarkers.length})</span></div>
          <div className="issues-list">
            {activeMarkers.map((m: BodyMarker) => (
              <div key={m.id} className="issue-row">
                <span className={`severity-pip s${m.severity}`} />
                <span className="issue-part">{m.body_part.replace(/_/g, ' ')}</span>
                <span className="issue-type">{m.marker_type}</span>
                {m.description && <span className="issue-desc">{m.description}</span>}
                {m.affects_workout && <span className="affects-tag"><AlertTriangle size={10} />workout</span>}
                <div className="issue-actions">
                  <button className="resolve-btn-mini" aria-label="Edit marker" onClick={() => {
                    const newSeverity = prompt(`Edit severity (1-5, current: ${m.severity}):`, String(m.severity));
                    if (newSeverity && parseInt(newSeverity) >= 1 && parseInt(newSeverity) <= 5) {
                      onUpdateMarker(m.id!, { severity: parseInt(newSeverity) });
                    }
                  }} title="Edit"><Edit3 size={12} /></button>
                  <button className="resolve-btn-mini" aria-label="Resolve marker" onClick={() => onResolveMarker(m.id!)} title="Resolve"><Check size={12} /></button>
                  <button className="resolve-btn-mini text-rose-500" onClick={() => {
                    if (confirm(`Delete this ${m.marker_type} marker?`)) onDeleteMarker(m.id!);
                  }} title="Delete" aria-label="Delete marker"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Tooltip for long-press */}
      <DataTooltip data={tooltipData} position={tooltipPos} onDismiss={dismissTooltip} />
    </div>
  );
}
