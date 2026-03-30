import { useState, useEffect, useCallback, useRef } from 'react';
import './PianoAcademy.css';

// --- Types ---
interface NoteRef { note: string; octave: number }
interface NoteHistory extends NoteRef { t: number }

export interface PianoAcademyProps {
  onStepComplete?: (stepId: string) => void;
  completedSteps?: string[];
}

// --- AudioContext polyfill ---
const AudioCtx = typeof window !== 'undefined'
  ? ((window as any).AudioContext || (window as any).webkitAudioContext)
  : null;

// --- CONSTANTS ---
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const KEY_MAP: Record<string, NoteRef> = {
  z: { note: 'C', octave: 3 }, x: { note: 'D', octave: 3 }, c: { note: 'E', octave: 3 },
  v: { note: 'F', octave: 3 }, b: { note: 'G', octave: 3 }, n: { note: 'A', octave: 3 },
  m: { note: 'B', octave: 3 },
  s: { note: 'C#', octave: 3 }, d: { note: 'D#', octave: 3 },
  g: { note: 'F#', octave: 3 }, h: { note: 'G#', octave: 3 }, j: { note: 'A#', octave: 3 },
  q: { note: 'C', octave: 4 }, w: { note: 'D', octave: 4 }, e: { note: 'E', octave: 4 },
  r: { note: 'F', octave: 4 }, t: { note: 'G', octave: 4 }, y: { note: 'A', octave: 4 },
  u: { note: 'B', octave: 4 },
  '2': { note: 'C#', octave: 4 }, '3': { note: 'D#', octave: 4 },
  '5': { note: 'F#', octave: 4 }, '6': { note: 'G#', octave: 4 }, '7': { note: 'A#', octave: 4 },
  i: { note: 'C', octave: 5 }, o: { note: 'D', octave: 5 }, p: { note: 'E', octave: 5 },
  '9': { note: 'C#', octave: 5 }, '0': { note: 'D#', octave: 5 },
};

// Bug 4 fix: compute REVERSE_KEY_MAP once at module level
const REVERSE_KEY_MAP: Record<string, string> = {};
Object.entries(KEY_MAP).forEach(([k, v]) => {
  REVERSE_KEY_MAP[noteId(v.note, v.octave)] = k;
});

function noteToFreq(note: string, octave: number): number {
  const idx = NOTE_NAMES.indexOf(note);
  const midi = (octave + 1) * 12 + idx;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function noteId(note: string, octave: number): string {
  return `${note}${octave}`;
}

// --- SYNTH ---
function useSynth() {
  const ctxRef = useRef<AudioContext | null>(null);
  const activeRef = useRef<Record<string, { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; gain2: GainNode }>>({});

  const initAudio = useCallback(() => {
    if (!ctxRef.current && AudioCtx) ctxRef.current = new AudioCtx();
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
  }, []);

  const stopNote = useCallback((note: string, octave: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const id = noteId(note, octave);
    const active = activeRef.current[id];
    if (!active) return;
    const t = ctx.currentTime;
    active.gain.gain.setTargetAtTime(0, t, 0.08);
    active.gain2.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => { try { active.osc.stop(); active.osc2.stop(); } catch { /* already stopped */ } }, 200);
    delete activeRef.current[id];
  }, []);

  const playNote = useCallback((note: string, octave: number, duration: number | null = null) => {
    initAudio();
    const ctx = ctxRef.current;
    if (!ctx) return;
    const id = noteId(note, octave);
    if (activeRef.current[id]) return;
    const freq = noteToFreq(note, octave);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq;
    gain.gain.value = 0.3;
    gain2.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc2.connect(gain2).connect(ctx.destination);
    osc.start();
    osc2.start();
    activeRef.current[id] = { osc, osc2, gain, gain2 };
    if (duration) {
      setTimeout(() => stopNote(note, octave), duration);
    }
  }, [initAudio, stopNote]);

  return { playNote, stopNote, initAudio };
}

// --- STAFF RENDERER ---
function Staff({ notes, highlightIndex = -1, clef = 'treble', showNames = true }: {
  notes: NoteRef[];
  highlightIndex?: number;
  clef?: 'treble' | 'bass';
  showNames?: boolean;
}) {
  const lineY = [60, 70, 80, 90, 100];
  const w = Math.max(300, notes.length * 50 + 100);

  const trebleMap: Record<string, number> = {
    C3: 130, D3: 125, E3: 120, F3: 115, G3: 110, A3: 105, B3: 100,
    C4: 95, D4: 90, E4: 85, F4: 80, G4: 75, A4: 70, B4: 65,
    C5: 60, D5: 55, E5: 50, F5: 45, G5: 40, A5: 35, B5: 30,
  };
  const bassMap: Record<string, number> = {
    C2: 90, D2: 85, E2: 80, F2: 75, G2: 70, A2: 65, B2: 60,
    C3: 55, D3: 50, E3: 45, F3: 40, G3: 35, A3: 30, B3: 25,
  };
  const posMap = clef === 'treble' ? trebleMap : bassMap;

  return (
    <svg viewBox={`0 0 ${w} 160`} style={{ width: '100%', maxHeight: 180, display: 'block' }}>
      {lineY.map((y, i) => (
        <line key={i} x1={20} y1={y} x2={w - 20} y2={y} stroke="#8B7355" strokeWidth={1} opacity={0.5} />
      ))}
      <text x={30} y={95} fontSize={42} fill="#D4A574" fontFamily="serif" opacity={0.8}>
        {clef === 'treble' ? '\u{1D11E}' : '\u{1D122}'}
      </text>
      {notes.map((n, i) => {
        const baseNote = n.note.replace('#', '').replace('b', '');
        const key = `${baseNote}${n.octave}`;
        const yPos = posMap[key] || 80;
        const x = 90 + i * 50;
        const isSharp = n.note.includes('#');
        const isHl = i === highlightIndex;
        const needsLedger = yPos <= 55 || yPos >= 105;
        return (
          <g key={i}>
            {needsLedger && (
              <line x1={x - 14} y1={yPos} x2={x + 14} y2={yPos} stroke="#8B7355" strokeWidth={1} opacity={0.4} />
            )}
            <ellipse cx={x} cy={yPos} rx={8} ry={5.5}
              fill={isHl ? '#FFD700' : '#D4A574'}
              stroke={isHl ? '#FFD700' : '#A0845C'} strokeWidth={1}
              transform={`rotate(-15 ${x} ${yPos})`}
              style={{ transition: 'fill 0.15s' }}
            />
            <line x1={x + 7} y1={yPos} x2={x + 7} y2={yPos - 30} stroke={isHl ? '#FFD700' : '#D4A574'} strokeWidth={1.5} />
            {isSharp && <text x={x - 18} y={yPos + 4} fontSize={14} fill="#E8A87C">{'\u266F'}</text>}
            {showNames && (
              <text x={x} y={yPos + 22} textAnchor="middle" fontSize={10} fill={isHl ? '#FFD700' : '#B89A7A'} fontFamily="monospace">
                {n.note}{n.octave}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// --- PIANO KEYBOARD ---
function Piano({ activeNotes, onNoteDown, onNoteUp, startOctave = 3, octaves = 2 }: {
  activeNotes: Set<string>;
  onNoteDown: (note: string, octave: number) => void;
  onNoteUp: (note: string, octave: number) => void;
  startOctave?: number;
  octaves?: number;
}) {
  const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const blackNotes: Record<string, string> = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' };
  const blackOffsets: Record<string, number> = { C: 0.65, D: 1.65, F: 3.65, G: 4.65, A: 5.65 };

  const totalWhite = whiteNotes.length * octaves + 1;
  const ww = Math.min(52, 700 / totalWhite);
  const bw = ww * 0.62;

  const whites: JSX.Element[] = [];
  const blacks: JSX.Element[] = [];
  for (let o = 0; o < octaves; o++) {
    const oct = startOctave + o;
    whiteNotes.forEach((note, i) => {
      const x = (o * 7 + i) * ww;
      const id = noteId(note, oct);
      const active = activeNotes.has(id);
      const kLabel = REVERSE_KEY_MAP[id];
      whites.push(
        <g key={id}
          onMouseDown={() => onNoteDown(note, oct)}
          onMouseUp={() => onNoteUp(note, oct)}
          onMouseLeave={() => onNoteUp(note, oct)}
          style={{ cursor: 'pointer' }}>
          <rect x={x + 1} y={0} width={ww - 2} height={140} rx={3}
            fill={active ? '#FFD700' : '#FAF0E6'}
            stroke="#8B7355" strokeWidth={0.8}
            style={{ transition: 'fill 0.08s' }} />
          <text x={x + ww / 2} y={128} textAnchor="middle" fontSize={9} fill={active ? '#333' : '#A08060'} fontWeight="bold">{note}</text>
          {kLabel && <text x={x + ww / 2} y={115} textAnchor="middle" fontSize={8} fill={active ? '#555' : '#C4A882'} fontFamily="monospace">{kLabel.toUpperCase()}</text>}
        </g>
      );
      if (blackNotes[note]) {
        const bx = (o * 7 + blackOffsets[note]) * ww;
        const bNote = blackNotes[note];
        const bId = noteId(bNote, oct);
        const bActive = activeNotes.has(bId);
        const bkLabel = REVERSE_KEY_MAP[bId];
        blacks.push(
          <g key={bId}
            onMouseDown={() => onNoteDown(bNote, oct)}
            onMouseUp={() => onNoteUp(bNote, oct)}
            onMouseLeave={() => onNoteUp(bNote, oct)}
            style={{ cursor: 'pointer' }}>
            <rect x={bx} y={0} width={bw} height={88} rx={2}
              fill={bActive ? '#FFD700' : '#3E2723'}
              stroke="#1A1A1A" strokeWidth={0.5}
              style={{ transition: 'fill 0.08s' }} />
            {bkLabel && <text x={bx + bw / 2} y={78} textAnchor="middle" fontSize={7} fill={bActive ? '#333' : '#A08060'} fontFamily="monospace">{bkLabel.toUpperCase()}</text>}
          </g>
        );
      }
    });
  }
  // Final C
  const lastX = octaves * 7 * ww;
  const lastOct = startOctave + octaves;
  const lastId = noteId('C', lastOct);
  const lastActive = activeNotes.has(lastId);
  const lastK = REVERSE_KEY_MAP[lastId];
  whites.push(
    <g key={lastId}
      onMouseDown={() => onNoteDown('C', lastOct)}
      onMouseUp={() => onNoteUp('C', lastOct)}
      onMouseLeave={() => onNoteUp('C', lastOct)}
      style={{ cursor: 'pointer' }}>
      <rect x={lastX + 1} y={0} width={ww - 2} height={140} rx={3}
        fill={lastActive ? '#FFD700' : '#FAF0E6'} stroke="#8B7355" strokeWidth={0.8} />
      <text x={lastX + ww / 2} y={128} textAnchor="middle" fontSize={9} fill="#A08060" fontWeight="bold">C</text>
      {lastK && <text x={lastX + ww / 2} y={115} textAnchor="middle" fontSize={8} fill="#C4A882" fontFamily="monospace">{lastK.toUpperCase()}</text>}
    </g>
  );

  return (
    <svg viewBox={`0 0 ${totalWhite * ww + 2} 145`} style={{ width: '100%', maxHeight: 200, display: 'block' }}>
      {whites}
      {blacks}
    </svg>
  );
}

// --- LESSON DATA ---
const LESSONS = [
  {
    id: 'basics', title: 'The Piano Alphabet', icon: '\u{1F392}',
    content: 'Music uses only 7 letters: A B C D E F G \u2014 then it repeats! On a piano, these are the white keys. The pattern repeats every 8 notes (an "octave"). Press the keys shown below to play your first notes.',
    task: 'Play C D E F G A B C going up. Use keys: Q W E R T Y U I',
    targetNotes: [
      { note: 'C', octave: 4 }, { note: 'D', octave: 4 }, { note: 'E', octave: 4 },
      { note: 'F', octave: 4 }, { note: 'G', octave: 4 }, { note: 'A', octave: 4 },
      { note: 'B', octave: 4 }, { note: 'C', octave: 5 },
    ],
    funFact: 'The distance from C to the next C is called an Octave (octa = 8). Ancient Greeks figured this out by plucking strings!',
  },
  {
    id: 'whole-half', title: 'Whole & Half Steps', icon: '\u{1F463}',
    content: 'A HALF STEP is the smallest distance between two notes (like E\u2192F or any key to the very next key). A WHOLE STEP skips one key (like C\u2192D). The black keys fill in the gaps \u2014 they\'re the sharps (#) and flats (\u266D).',
    task: 'Play C then C# (keys Q then 2) \u2014 that\'s a half step. Now C then D (Q then W) \u2014 whole step!',
    targetNotes: [
      { note: 'C', octave: 4 }, { note: 'C#', octave: 4 },
      { note: 'C', octave: 4 }, { note: 'D', octave: 4 },
    ],
    funFact: 'E\u2192F and B\u2192C are the only natural half steps \u2014 there\'s no black key between them!',
  },
  {
    id: 'c-major', title: 'C Major Scale', icon: '\u26F0\uFE0F',
    content: 'A SCALE is a recipe of whole (W) and half (H) steps. Major scales follow: W-W-H-W-W-W-H. C Major is special \u2014 it\'s ALL white keys! It sounds happy and bright.',
    task: 'Play the C major scale: C D E F G A B C (all white keys, Q through I)',
    targetNotes: [
      { note: 'C', octave: 4 }, { note: 'D', octave: 4 }, { note: 'E', octave: 4 },
      { note: 'F', octave: 4 }, { note: 'G', octave: 4 }, { note: 'A', octave: 4 },
      { note: 'B', octave: 4 }, { note: 'C', octave: 5 },
    ],
    funFact: 'Every pop song you\'ve ever hummed probably uses notes from a major or minor scale. Scales are the DNA of melody!',
  },
  {
    id: 'intervals', title: 'Intervals \u2014 The Flavor of Music', icon: '\u{1F9C2}',
    content: 'An INTERVAL is the distance between two notes. Each interval has a distinct emotional flavor:\n\u2022 3rd (C\u2192E): Sweet, happy\n\u2022 4th (C\u2192F): Heroic (Star Wars!)\n\u2022 5th (C\u2192G): Powerful, open',
    task: 'Play C then E (3rd), C then F (4th), C then G (5th). Keys: Q-E, Q-R, Q-T',
    targetNotes: [
      { note: 'C', octave: 4 }, { note: 'E', octave: 4 },
      { note: 'C', octave: 4 }, { note: 'F', octave: 4 },
      { note: 'C', octave: 4 }, { note: 'G', octave: 4 },
    ],
    funFact: 'Jaws uses a minor 2nd (half step) \u2014 the scariest interval. Wedding marches use perfect 4ths and 5ths!',
  },
  {
    id: 'chords', title: 'Chords \u2014 Harmony Unlocked', icon: '\u{1F513}',
    content: 'A CHORD is 3+ notes played together. A MAJOR chord = root + 3rd + 5th (sounds happy). Press multiple keys at once!\n\nC Major chord: C + E + G (Q + E + T)',
    task: 'Play a C major chord: hold Q + E + T together',
    targetNotes: [
      { note: 'C', octave: 4 }, { note: 'E', octave: 4 }, { note: 'G', octave: 4 },
    ],
    funFact: 'With just C, F, and G chords you can play thousands of pop songs. Seriously. Thousands.',
  },
  {
    id: 'rhythm', title: 'Rhythm \u2014 The Heartbeat', icon: '\u{1F493}',
    content: 'Music lives in TIME. Notes have different lengths:\n\u2022 Whole note: 4 beats\n\u2022 Half note: 2 beats\n\u2022 Quarter note: 1 beat\n\u2022 Eighth note: \u00BD beat',
    task: 'Play C four times evenly (steady quarter notes). Key: Q',
    targetNotes: [
      { note: 'C', octave: 4 }, { note: 'C', octave: 4 }, { note: 'C', octave: 4 }, { note: 'C', octave: 4 },
    ],
    funFact: 'Your heartbeat IS a rhythm pattern. Music literally syncs with your body!',
  },
  {
    id: 'reading', title: 'Reading the Staff', icon: '\u{1F4D6}',
    content: 'Sheet music uses 5 lines called a STAFF. The TREBLE CLEF (\u{1D11E}) marks where notes live:\n\nLines (bottom\u2192top): E G B D F \u2014 "Every Good Boy Does Fine"\nSpaces: F A C E \u2014 it spells FACE!',
    task: 'Play the notes shown: E G B D F. Keys: E-T then lower: Z-B',
    targetNotes: [
      { note: 'E', octave: 4 }, { note: 'G', octave: 4 }, { note: 'B', octave: 4 },
      { note: 'D', octave: 5 }, { note: 'F', octave: 4 },
    ],
    funFact: 'The treble clef (\u{1D11E}) is actually a fancy letter G \u2014 its inner curl wraps around the G line!',
  },
  {
    id: 'funny', title: 'Musical Comedy', icon: '\u{1F602}',
    content: 'Time to make people LAUGH with music!\n\n\u2022 The "wrong note" \u2014 play a beautiful phrase then end on a horrible note\n\u2022 The "dramatic pause" \u2014 build tension... then play something absurd\n\u2022 The chromatic slide \u2014 slide all keys for dramatic effect',
    task: 'Play C E G (nice chord)... then mash C# D# F# together (chaos!). Beautiful\u2192ugly = comedy gold!',
    targetNotes: [
      { note: 'C', octave: 4 }, { note: 'E', octave: 4 }, { note: 'G', octave: 4 },
      { note: 'C#', octave: 4 }, { note: 'D#', octave: 4 }, { note: 'F#', octave: 4 },
    ],
    funFact: 'Victor Borge made millions as a \'comedian pianist\' \u2014 his whole act was playing wrong notes on purpose!',
  },
];

const THEORY_TOPICS = [
  { title: 'Key Signatures', icon: '\u{1F511}', body: 'A key signature tells you which notes are sharp or flat throughout a piece. C major has ZERO sharps or flats. G major has one sharp (F#).' },
  { title: 'Time Signatures', icon: '\u23F1\uFE0F', body: 'Written as a fraction: 4/4 means 4 beats per bar (most pop/rock). 3/4 means 3 beats \u2014 that\'s a waltz!' },
  { title: 'Dynamics', icon: '\u{1F4E2}', body: 'How LOUD or soft you play. pp (pianissimo) = very soft, f (forte) = loud, ff (fortissimo) = very loud. Dynamics make music BREATHE.' },
  { title: 'Minor vs Major', icon: '\u{1F313}', body: 'Major = happy, bright. Minor = sad, mysterious. The difference? Just ONE note \u2014 the 3rd is lowered by a half step in minor.' },
  { title: 'The Circle of 5ths', icon: '\u2B55', body: 'Starting from C, go up a 5th (7 half steps) and you get G. Keep going: D\u2192A\u2192E\u2192B\u2192F#\u2192C#. Full circle!' },
  { title: 'Chord Progressions', icon: '\u{1F517}', body: 'The \'magic\' pop progression is I-V-vi-IV (C-G-Am-F in C major). This is in HUNDREDS of hit songs.' },
];

const SONGS = [
  { name: 'Mary Had a Little Lamb', notes: [
    { note: 'E', octave: 4 }, { note: 'D', octave: 4 }, { note: 'C', octave: 4 }, { note: 'D', octave: 4 },
    { note: 'E', octave: 4 }, { note: 'E', octave: 4 }, { note: 'E', octave: 4 },
    { note: 'D', octave: 4 }, { note: 'D', octave: 4 }, { note: 'D', octave: 4 },
    { note: 'E', octave: 4 }, { note: 'G', octave: 4 }, { note: 'G', octave: 4 },
  ]},
  { name: 'Twinkle Twinkle', notes: [
    { note: 'C', octave: 4 }, { note: 'C', octave: 4 }, { note: 'G', octave: 4 }, { note: 'G', octave: 4 },
    { note: 'A', octave: 4 }, { note: 'A', octave: 4 }, { note: 'G', octave: 4 },
    { note: 'F', octave: 4 }, { note: 'F', octave: 4 }, { note: 'E', octave: 4 }, { note: 'E', octave: 4 },
    { note: 'D', octave: 4 }, { note: 'D', octave: 4 }, { note: 'C', octave: 4 },
  ]},
  { name: 'Ode to Joy', notes: [
    { note: 'E', octave: 4 }, { note: 'E', octave: 4 }, { note: 'F', octave: 4 }, { note: 'G', octave: 4 },
    { note: 'G', octave: 4 }, { note: 'F', octave: 4 }, { note: 'E', octave: 4 }, { note: 'D', octave: 4 },
    { note: 'C', octave: 4 }, { note: 'C', octave: 4 }, { note: 'D', octave: 4 }, { note: 'E', octave: 4 },
    { note: 'E', octave: 4 }, { note: 'D', octave: 4 }, { note: 'D', octave: 4 },
  ]},
];

// --- MAIN COMPONENT ---
export default function PianoAcademy({ onStepComplete, completedSteps = [] }: PianoAcademyProps) {
  const [tab, setTab] = useState('play');
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [lessonIdx, setLessonIdx] = useState(0);
  const [lessonProgress, setLessonProgress] = useState<NoteRef[]>([]);
  const [theoryIdx, setTheoryIdx] = useState(0);
  const [songIdx, setSongIdx] = useState(0);
  const [songNoteIdx, setSongNoteIdx] = useState(0);
  const [noteHistory, setNoteHistory] = useState<NoteHistory[]>([]);
  const [streak, setStreak] = useState(0);
  const [showTheoryDetail, setShowTheoryDetail] = useState(false);
  const { playNote, stopNote, initAudio } = useSynth();
  const pressedKeys = useRef<Set<string>>(new Set());
  // Bug 3 fix: containerRef for scoped keyboard handling
  const containerRef = useRef<HTMLDivElement>(null);

  const lesson = LESSONS[lessonIdx];
  const song = SONGS[songIdx];

  const handleNoteOn = useCallback((note: string, octave: number) => {
    initAudio();
    playNote(note, octave);
    const id = noteId(note, octave);
    setActiveNotes(prev => new Set(prev).add(id));
    setNoteHistory(prev => [...prev.slice(-30), { note, octave, t: Date.now() }]);

    if (tab === 'songs') {
      setSongNoteIdx(prev => {
        const target = song.notes[prev];
        if (target && target.note === note && target.octave === octave) {
          const next = prev + 1;
          if (next >= song.notes.length) {
            setStreak(s => s + 1);
            return 0;
          }
          return next;
        }
        return prev;
      });
    }

    if (tab === 'learn') {
      setLessonProgress(prev => {
        const target = lesson.targetNotes[prev.length];
        if (target && target.note === note && target.octave === octave) {
          const next = [...prev, { note, octave }];
          if (next.length >= lesson.targetNotes.length) {
            setStreak(s => s + 1);
            onStepComplete?.(lesson.id);
          }
          return next;
        }
        return prev;
      });
    }
  }, [tab, song, lesson, playNote, initAudio, onStepComplete]);

  const handleNoteOff = useCallback((note: string, octave: number) => {
    stopNote(note, octave);
    const id = noteId(note, octave);
    setActiveNotes(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, [stopNote]);

  // Bug 3 fix: keyboard events scoped to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (KEY_MAP[k] && !pressedKeys.current.has(k)) {
        e.preventDefault();
        e.stopPropagation();
        pressedKeys.current.add(k);
        const { note, octave } = KEY_MAP[k];
        handleNoteOn(note, octave);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (KEY_MAP[k]) {
        e.preventDefault();
        e.stopPropagation();
        pressedKeys.current.delete(k);
        const { note, octave } = KEY_MAP[k];
        handleNoteOff(note, octave);
      }
    };
    container.addEventListener('keydown', onDown);
    container.addEventListener('keyup', onUp);
    return () => {
      container.removeEventListener('keydown', onDown);
      container.removeEventListener('keyup', onUp);
    };
  }, [handleNoteOn, handleNoteOff]);

  const tabs = [
    { id: 'play', label: 'Free Play', icon: '\u{1F3B9}' },
    { id: 'learn', label: 'Lessons', icon: '\u{1F4DA}' },
    { id: 'songs', label: 'Songs', icon: '\u{1F3B5}' },
    { id: 'read', label: 'Read Music', icon: '\u{1F4D6}' },
    { id: 'theory', label: 'Theory', icon: '\u{1F9E0}' },
  ];

  const lessonComplete = lessonProgress.length >= lesson.targetNotes.length;

  return (
    // Bug 3 fix: tabIndex={0} so container can receive keyboard focus
    // Bug 5 fix: no minHeight: 100vh
    <div
      ref={containerRef}
      tabIndex={0}
      className="piano-academy"
      style={{ outline: 'none' }}
      onClick={() => containerRef.current?.focus()}
    >
      {/* HEADER */}
      <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
        <h1 style={{
          fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 300, letterSpacing: '0.1em',
          background: 'linear-gradient(135deg, #FFD700, #D4A574, #FFD700)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 4,
        }}>
          PIANO ACADEMY
        </h1>
        <p style={{ fontSize: 13, color: '#8B7355', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          From Zero to Making People Laugh
        </p>
        {streak > 0 && (
          <div style={{ marginTop: 8, color: '#FFD700', fontSize: 14, animation: 'pa-pulse 2s infinite' }}>
            Streak: {streak}
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(139,115,85,0.2)', margin: '16px 24px 0', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} className={`pa-tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setLessonProgress([]); setSongNoteIdx(0); }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>

        {/* FREE PLAY */}
        {tab === 'play' && (
          <div>
            <div className="pa-card">
              <p style={{ marginBottom: 12, color: '#B89A7A', fontSize: 15 }}>
                Your keyboard is now a piano. Click this area first, then press any key to play!
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#8B7355', marginBottom: 8 }}>
                <span><strong style={{ color: '#D4A574' }}>Lower octave:</strong> Z X C V B N M (white) / S D G H J (black)</span>
                <span><strong style={{ color: '#D4A574' }}>Upper octave:</strong> Q W E R T Y U (white) / 2 3 5 6 7 (black)</span>
                <span><strong style={{ color: '#D4A574' }}>Extra:</strong> I O P / 9 0</span>
              </div>
            </div>
            {noteHistory.length > 0 && (
              <div className="pa-card" style={{ padding: 16 }}>
                <Staff notes={noteHistory.slice(-10)} highlightIndex={noteHistory.slice(-10).length - 1} />
              </div>
            )}
            <div className="pa-card" style={{ padding: '16px 12px' }}>
              <Piano activeNotes={activeNotes} onNoteDown={handleNoteOn} onNoteUp={handleNoteOff} />
            </div>
            <div className="pa-card" style={{ textAlign: 'center', padding: 16, background: 'rgba(40, 25, 15, 0.5)' }}>
              <p style={{ fontSize: 13, color: '#8B7355' }}>Try playing C-E-G together (Q+E+T) — that's a C Major chord!</p>
            </div>
          </div>
        )}

        {/* LESSONS */}
        {tab === 'learn' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
              {LESSONS.map((l, i) => (
                <button key={l.id}
                  className={`pa-btn ${i === lessonIdx ? 'pa-btn-gold' : ''}`}
                  style={{ fontSize: 12, padding: '6px 12px', flexShrink: 0 }}
                  onClick={() => { setLessonIdx(i); setLessonProgress([]); }}>
                  {l.icon} {i + 1}
                  {completedSteps.includes(l.id) && ' \u2713'}
                </button>
              ))}
            </div>

            <div className="pa-card">
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#FFD700', marginBottom: 4 }}>
                {lesson.icon} Lesson {lessonIdx + 1}: {lesson.title}
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: '#D4C4B0', marginBottom: 16, whiteSpace: 'pre-line' }}>
                {lesson.content}
              </p>
              <div style={{ background: 'rgba(255,215,0,0.08)', borderLeft: '3px solid #FFD700', padding: '12px 16px', borderRadius: '0 8px 8px 0', marginBottom: 16 }}>
                <strong style={{ color: '#FFD700', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Task:</strong>
                <p style={{ marginTop: 4, fontSize: 14, color: '#E8D5C0' }}>{lesson.task}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#8B7355', marginRight: 4 }}>Progress:</span>
                {lesson.targetNotes.map((_, i) => (
                  <div key={i} className={`pa-progress-dot ${i < lessonProgress.length ? 'done' : i === lessonProgress.length ? 'current' : ''}`} />
                ))}
              </div>

              <div style={{ background: 'rgba(20, 12, 8, 0.5)', borderRadius: 8, padding: 8 }}>
                <Staff notes={lesson.targetNotes} highlightIndex={lessonProgress.length} />
              </div>

              {lessonComplete && (
                <div style={{ marginTop: 16, textAlign: 'center', animation: 'pa-fadeUp 0.3s ease' }}>
                  <p style={{ fontSize: 20, color: '#FFD700', marginBottom: 8 }}>Lesson Complete!</p>
                  <p style={{ fontSize: 13, color: '#B89A7A', fontStyle: 'italic', marginBottom: 12 }}>
                    {lesson.funFact}
                  </p>
                  {lessonIdx < LESSONS.length - 1 && (
                    <button className="pa-btn pa-btn-gold" onClick={() => { setLessonIdx(i => i + 1); setLessonProgress([]); }}>
                      Next Lesson →
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="pa-card" style={{ padding: '16px 12px' }}>
              <Piano activeNotes={activeNotes} onNoteDown={handleNoteOn} onNoteUp={handleNoteOff} />
            </div>
          </div>
        )}

        {/* SONGS */}
        {tab === 'songs' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {SONGS.map((s, i) => (
                <button key={i} className={`pa-btn ${i === songIdx ? 'pa-btn-gold' : ''}`}
                  style={{ fontSize: 13 }}
                  onClick={() => { setSongIdx(i); setSongNoteIdx(0); }}>
                  {s.name}
                </button>
              ))}
            </div>
            <div className="pa-card">
              <h2 style={{ fontSize: 20, color: '#FFD700', marginBottom: 12 }}>{song.name}</h2>
              <p style={{ fontSize: 13, color: '#8B7355', marginBottom: 12 }}>
                Play each highlighted note in order. Hit the right key to advance!
              </p>
              <div style={{ background: 'rgba(20, 12, 8, 0.5)', borderRadius: 8, padding: 8, marginBottom: 16 }}>
                <Staff notes={song.notes} highlightIndex={songNoteIdx} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 12 }}>
                {song.notes.map((n, i) => {
                  const kLabel = REVERSE_KEY_MAP[noteId(n.note, n.octave)];
                  return (
                    <div key={i} className="pa-song-note" style={{
                      background: i < songNoteIdx ? 'rgba(255,215,0,0.2)' : i === songNoteIdx ? 'rgba(255,215,0,0.4)' : 'rgba(139,115,85,0.1)',
                      border: i === songNoteIdx ? '2px solid #FFD700' : '1px solid rgba(139,115,85,0.2)',
                      color: i === songNoteIdx ? '#FFD700' : i < songNoteIdx ? '#B89A7A' : '#6B5740',
                      animation: i === songNoteIdx ? 'pa-pulse 1s infinite' : 'none',
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div>{n.note}</div>
                        {kLabel && <div style={{ fontSize: 9, opacity: 0.6 }}>{kLabel.toUpperCase()}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {songNoteIdx === 0 && song.notes.length > 0 && (
                <button className="pa-btn" style={{ fontSize: 12 }} onClick={() => setSongNoteIdx(0)}>
                  Reset
                </button>
              )}
            </div>
            <div className="pa-card" style={{ padding: '16px 12px' }}>
              <Piano activeNotes={activeNotes} onNoteDown={handleNoteOn} onNoteUp={handleNoteOff} />
            </div>
          </div>
        )}

        {/* READ MUSIC */}
        {tab === 'read' && (
          <div>
            <div className="pa-card">
              <h2 style={{ fontSize: 22, color: '#FFD700', marginBottom: 12 }}>How to Read Music</h2>
              <div style={{ display: 'grid', gap: 20 }}>
                <div>
                  <h3 style={{ color: '#D4A574', fontSize: 16, marginBottom: 8 }}>The Staff — Your Musical Map</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#B89A7A' }}>
                    Music is written on 5 horizontal lines called a <strong style={{ color: '#E8D5C0' }}>staff</strong>. Higher position = higher pitch.
                  </p>
                </div>
                <div>
                  <h3 style={{ color: '#D4A574', fontSize: 16, marginBottom: 8 }}>Treble Clef Lines: E G B D F</h3>
                  <p style={{ fontSize: 14, color: '#8B7355', marginBottom: 8 }}>"Every Good Boy Does Fine"</p>
                  <div style={{ background: 'rgba(20,12,8,0.5)', borderRadius: 8, padding: 8 }}>
                    <Staff notes={[{ note: 'E', octave: 4 }, { note: 'G', octave: 4 }, { note: 'B', octave: 4 }, { note: 'D', octave: 5 }]} />
                  </div>
                </div>
                <div>
                  <h3 style={{ color: '#D4A574', fontSize: 16, marginBottom: 8 }}>Treble Clef Spaces: F A C E</h3>
                  <p style={{ fontSize: 14, color: '#8B7355', marginBottom: 8 }}>It spells FACE!</p>
                  <div style={{ background: 'rgba(20,12,8,0.5)', borderRadius: 8, padding: 8 }}>
                    <Staff notes={[{ note: 'F', octave: 4 }, { note: 'A', octave: 4 }, { note: 'C', octave: 5 }, { note: 'E', octave: 5 }]} />
                  </div>
                </div>
                <div>
                  <h3 style={{ color: '#D4A574', fontSize: 16, marginBottom: 8 }}>Note Durations</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    {[
                      { name: 'Whole', beats: 4, symbol: '\u{1D15D}' },
                      { name: 'Half', beats: 2, symbol: '\u{1D15E}' },
                      { name: 'Quarter', beats: 1, symbol: '\u2669' },
                      { name: 'Eighth', beats: 0.5, symbol: '\u266A' },
                    ].map(d => (
                      <div key={d.name} style={{ background: 'rgba(139,115,85,0.1)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, marginBottom: 4 }}>{d.symbol}</div>
                        <div style={{ fontSize: 13, color: '#D4A574', fontWeight: 600 }}>{d.name} Note</div>
                        <div style={{ fontSize: 12, color: '#8B7355' }}>{d.beats} beat{d.beats !== 1 ? 's' : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 style={{ color: '#D4A574', fontSize: 16, marginBottom: 8 }}>Sharps & Flats</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#B89A7A' }}>
                    <strong style={{ color: '#E8D5C0' }}>{'\u266F'} Sharp</strong> = raise a note by one half step.
                    <br /><strong style={{ color: '#E8D5C0' }}>{'\u266D'} Flat</strong> = lower a note by one half step.
                    <br /><strong style={{ color: '#E8D5C0' }}>{'\u266E'} Natural</strong> = cancel a sharp or flat.
                  </p>
                </div>
              </div>
            </div>
            <div className="pa-card">
              <h3 style={{ color: '#D4A574', fontSize: 16, marginBottom: 8 }}>Practice: Play what you see on the staff</h3>
              <p style={{ fontSize: 13, color: '#8B7355', marginBottom: 12 }}>Your played notes appear on the staff in real-time!</p>
              {noteHistory.length > 0 && (
                <div style={{ background: 'rgba(20,12,8,0.5)', borderRadius: 8, padding: 8, marginBottom: 12 }}>
                  <Staff notes={noteHistory.slice(-12)} highlightIndex={noteHistory.slice(-12).length - 1} />
                </div>
              )}
              <Piano activeNotes={activeNotes} onNoteDown={handleNoteOn} onNoteUp={handleNoteOff} />
            </div>
          </div>
        )}

        {/* THEORY */}
        {tab === 'theory' && (
          <div>
            <div className="pa-card">
              <h2 style={{ fontSize: 22, color: '#FFD700', marginBottom: 16 }}>Music Theory Essentials</h2>
              <p style={{ fontSize: 14, color: '#B89A7A', marginBottom: 16 }}>
                Theory is the "why" behind the "what." Understanding it means you can create, improvise, and make people laugh with intentionally "wrong" notes.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {THEORY_TOPICS.map((topic, i) => (
                  <div key={i} style={{
                    background: theoryIdx === i ? 'rgba(255,215,0,0.08)' : 'rgba(139,115,85,0.06)',
                    border: theoryIdx === i ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(139,115,85,0.1)',
                    borderRadius: 10, overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer',
                  }} onClick={() => { setTheoryIdx(i); setShowTheoryDetail(theoryIdx === i ? !showTheoryDetail : true); }}>
                    <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{topic.icon}</span>
                        <span style={{ fontSize: 16, fontWeight: 600, color: theoryIdx === i ? '#FFD700' : '#D4A574' }}>{topic.title}</span>
                      </div>
                      <span style={{ color: '#8B7355', transform: theoryIdx === i && showTheoryDetail ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>{'\u25BC'}</span>
                    </div>
                    {theoryIdx === i && showTheoryDetail && (
                      <div style={{ padding: '0 18px 18px', animation: 'pa-fadeUp 0.3s ease' }}>
                        <p style={{ fontSize: 14, lineHeight: 1.8, color: '#C4B09A' }}>{topic.body}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pa-card">
              <h3 style={{ color: '#D4A574', fontSize: 16, marginBottom: 8 }}>The Comedy Connection</h3>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: '#B89A7A' }}>
                Musical comedy works because the audience has <strong style={{ color: '#E8D5C0' }}>expectations</strong>. Theory teaches you what those expectations ARE — so you can <em>deliberately break them</em>.
              </p>
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                {[
                  { trick: 'The Unexpected Resolve', desc: 'Build a dramatic chord progression... then resolve to the wrong key.', keys: 'Try: Q+E+T → Z+C+T → ...' },
                  { trick: 'Tempo Trolling', desc: 'Play a well-known melody perfectly but keep changing speed.', keys: 'Twinkle Twinkle at 3 different speeds' },
                  { trick: 'The One Wrong Note', desc: 'Play everything beautifully, but make ONE note consistently wrong.', keys: 'Play a scale but always hit the wrong 5th note' },
                ].map((t, i) => (
                  <div key={i} style={{ background: 'rgba(139,115,85,0.08)', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#FFD700', marginBottom: 4 }}>{t.trick}</div>
                    <div style={{ fontSize: 13, color: '#B89A7A', marginBottom: 4 }}>{t.desc}</div>
                    <div className="pa-key-hint" style={{ display: 'inline-block' }}>{t.keys}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pa-card" style={{ padding: '16px 12px' }}>
              <p style={{ fontSize: 13, color: '#8B7355', marginBottom: 8, textAlign: 'center' }}>Experiment with theory concepts here:</p>
              <Piano activeNotes={activeNotes} onNoteDown={handleNoteOn} onNoteUp={handleNoteOff} />
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '24px 16px 0', borderTop: '1px solid rgba(139,115,85,0.15)', marginTop: 20 }}>
        <p style={{ fontSize: 12, color: '#5C3D2E', letterSpacing: '0.1em' }}>
          CLICK THE PIANO AREA FIRST TO ENABLE KEYBOARD · THEN USE YOUR KEYBOARD TO PLAY
        </p>
      </div>
    </div>
  );
}
