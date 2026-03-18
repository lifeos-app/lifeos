import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import './TimePicker.css';

interface TimePickerProps {
  value: string;       // "HH:MM" in 24h format e.g. "09:00", "14:30"
  onChange: (value: string) => void;
  label?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const ITEM_HEIGHT = 40;

function parse24to12(value: string): { hour12: number; minute: number; ampm: 'AM' | 'PM' } {
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  // snap minute to nearest 5
  const snappedM = MINUTES.reduce((prev, curr) =>
    Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev
  );
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: snappedM, ampm };
}

function to24(hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
  let h = hour12;
  if (ampm === 'AM' && h === 12) h = 0;
  else if (ampm === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function ScrollColumn<T extends number>({
  items,
  selected,
  onSelect,
  format,
}: {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  format: (v: T) => string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const isUserScroll = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToItem = useCallback((value: T, smooth = true) => {
    const idx = items.indexOf(value);
    if (idx < 0 || !listRef.current) return;
    const top = idx * ITEM_HEIGHT;
    listRef.current.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }, [items]);

  // Initial scroll to selected
  useEffect(() => {
    scrollToItem(selected, false);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // When selected changes externally, scroll to it
  useEffect(() => {
    if (!isUserScroll.current) {
      scrollToItem(selected, true);
    }
    isUserScroll.current = false;
  }, [selected, scrollToItem]);

  const handleScroll = () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!listRef.current) return;
      const scrollTop = listRef.current.scrollTop;
      const idx = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIdx = Math.max(0, Math.min(idx, items.length - 1));
      const item = items[clampedIdx];
      if (item !== selected) {
        isUserScroll.current = true;
        onSelect(item);
      }
      // snap
      listRef.current.scrollTo({ top: clampedIdx * ITEM_HEIGHT, behavior: 'smooth' });
    }, 80);
  };

  const handleClick = (item: T) => {
    isUserScroll.current = true;
    onSelect(item);
    scrollToItem(item, true);
  };

  return (
    <div className="tp-scroll-col">
      <div className="tp-scroll-highlight" />
      <div
        className="tp-scroll-list"
        ref={listRef}
        onScroll={handleScroll}
      >
        {/* top padding so first item can center */}
        <div className="tp-scroll-pad" />
        {items.map((item) => (
          <div
            key={item}
            className={`tp-scroll-item ${item === selected ? 'active' : ''}`}
            onClick={() => handleClick(item)}
          >
            {format(item)}
          </div>
        ))}
        {/* bottom padding so last item can center */}
        <div className="tp-scroll-pad" />
      </div>
    </div>
  );
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const parsed = parse24to12(value);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync internal state when external value changes
  useEffect(() => {
    const p = parse24to12(value);
    setHour12(p.hour12);
    setMinute(p.minute);
    setAmpm(p.ampm);
  }, [value]);

  // Emit changes
  const emitChange = useCallback((h: number, m: number, ap: 'AM' | 'PM') => {
    onChange(to24(h, m, ap));
  }, [onChange]);

  const handleHourSelect = (h: number) => {
    setHour12(h);
    emitChange(h, minute, ampm);
  };

  const handleMinuteSelect = (m: number) => {
    setMinute(m);
    emitChange(hour12, m, ampm);
  };

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayTime = `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;

  return (
    <div className="tp-wrapper" ref={wrapperRef}>
      {label && <label className="tp-label">{label}</label>}
      <button
        className="tp-trigger"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Clock size={14} className="tp-trigger-icon" />
        <span className="tp-trigger-text">{displayTime}</span>
      </button>

      {open && (
        <div className="tp-dropdown">
          <div className="tp-columns">
            <ScrollColumn
              items={HOURS}
              selected={hour12}
              onSelect={handleHourSelect}
              format={(v) => String(v).padStart(2, '0')}
            />
            <div className="tp-separator">:</div>
            <ScrollColumn
              items={MINUTES}
              selected={minute}
              onSelect={handleMinuteSelect}
              format={(v) => String(v).padStart(2, '0')}
            />
            <div className="tp-ampm-col">
              <button
                className={`tp-ampm-btn ${ampm === 'AM' ? 'active' : ''}`}
                onClick={() => { setAmpm('AM'); emitChange(hour12, minute, 'AM'); }}
                type="button"
              >
                AM
              </button>
              <button
                className={`tp-ampm-btn ${ampm === 'PM' ? 'active' : ''}`}
                onClick={() => { setAmpm('PM'); emitChange(hour12, minute, 'PM'); }}
                type="button"
              >
                PM
              </button>
            </div>
          </div>
          <button className="tp-done-btn" onClick={() => setOpen(false)} type="button">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
