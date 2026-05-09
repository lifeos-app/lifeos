import { useRef, useState, useCallback, useEffect } from 'react';
import { Trash2, Undo2, Send, Loader2, CheckCircle, PenLine } from 'lucide-react';

interface Stroke {
  points: { x: number; y: number; pressure: number }[];
  color: string;
  width: number;
}

interface InkCanvasProps {
  date: string;
  onTranscribed: (text: string) => void;
  onClose: () => void;
}

export function InkCanvas({ date, onTranscribed, onClose }: InkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [transcribed, setTranscribed] = useState('');
  const penColor = '#E2EBF5';

  const redraw = useCallback((allStrokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0D1B2A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let prev = stroke.points[0];
      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineWidth = 1 + pt.pressure * 7;
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        prev = pt;
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redraw(strokes);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return; // finger scrolls, pen draws
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getPos(e);
    currentStroke.current = { points: [pt], color: penColor, width: 2 };
    setIsDrawing(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke.current || e.pointerType === 'touch') return;
    const pt = getPos(e);
    currentStroke.current.points.push(pt);
    // draw only the latest segment for performance
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pts = currentStroke.current.points;
    if (pts.length < 2) return;
    const prev = pts[pts.length - 2];
    ctx.beginPath();
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 1 + pt.pressure * 7;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStroke.current || e.pointerType === 'touch') return;
    const finished = currentStroke.current;
    currentStroke.current = null;
    setIsDrawing(false);
    setStrokes(prev => {
      const next = [...prev, finished];
      return next;
    });
  };

  const undo = () => {
    setStrokes(prev => {
      const next = prev.slice(0, -1);
      redraw(next);
      return next;
    });
  };

  const clear = () => {
    setStrokes([]);
    redraw([]);
    setStatus('idle');
    setTranscribed('');
  };

  const submit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;
    setStatus('sending');
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
      );
      const form = new FormData();
      form.append('image', blob, `ink-${date}.png`);
      form.append('date', date);
      const res = await fetch('/api/journal/ink', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setTranscribed(json.text || '');
      setStatus('done');
      if (json.text) onTranscribed(json.text);
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div className="ink-canvas-overlay">
      <div className="ink-canvas-header">
        <span className="ink-canvas-title"><PenLine size={16} /> S Pen Journal — {date}</span>
        <div className="ink-canvas-tools">
          <button className="ink-tool-btn" onClick={undo} disabled={strokes.length === 0} title="Undo">
            <Undo2 size={18} />
          </button>
          <button className="ink-tool-btn" onClick={clear} title="Clear">
            <Trash2 size={18} />
          </button>
          <button
            className={`ink-submit-btn ${status === 'done' ? 'done' : ''}`}
            onClick={status === 'done' ? onClose : submit}
            disabled={status === 'sending' || strokes.length === 0}
            title={status === 'done' ? 'Close' : 'Transcribe & Save'}
          >
            {status === 'sending' && <><Loader2 size={16} className="spin" /> Transcribing...</>}
            {status === 'done' && <><CheckCircle size={16} /> Done — Close</>}
            {(status === 'idle' || status === 'error') && <><Send size={16} /> Transcribe</>}
          </button>
          <button className="ink-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {status === 'done' && transcribed && (
        <div className="ink-transcription-banner">
          <strong>AI Transcription:</strong> {transcribed.slice(0, 200)}{transcribed.length > 200 ? '…' : ''}
          <span className="ink-transcription-hint"> — added to your journal entry</span>
        </div>
      )}
      {status === 'error' && (
        <div className="ink-error-banner">Transcription failed — check Ollama is running. Your sketch was not lost.</div>
      )}

      <div className="ink-canvas-area">
        <canvas
          ref={canvasRef}
          className="ink-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ touchAction: 'none' }}
        />
        {strokes.length === 0 && (
          <div className="ink-canvas-hint">
            <PenLine size={32} opacity={0.2} />
            <p>Draw with S Pen · Finger to scroll</p>
          </div>
        )}
      </div>
    </div>
  );
}
