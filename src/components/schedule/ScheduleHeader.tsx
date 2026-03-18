import { ChevronLeft, ChevronRight, Plus, List, Grid3x3, Calendar as CalendarIcon, Layers } from 'lucide-react';
import { fmtDisplay, MONTHS } from './utils';
import type { ViewType } from './types';

interface ScheduleHeaderProps {
  view: ViewType;
  selectedDate: Date;
  calMonth: number;
  calYear: number;
  isToday: boolean;
  weekStartDate?: Date;
  onViewChange: (view: ViewType) => void;
  onDayShift: (offset: number) => void;
  onWeekShift: (offset: number) => void;
  onMonthShift: (offset: number) => void;
  onGoToday: () => void;
  onShowForm: () => void;
}

export function ScheduleHeader({
  view,
  selectedDate,
  calMonth,
  calYear,
  isToday,
  weekStartDate,
  onViewChange,
  onDayShift,
  onWeekShift,
  onMonthShift,
  onGoToday,
  onShowForm,
}: ScheduleHeaderProps) {
  return (
    <div className="sched-header animate-fadeUp">
      <div className="sched-nav">
        {(view === 'day' || view === 'timeline') ? (
          <>
            <button 
              className="sched-arrow" 
              onClick={() => onDayShift(-1)} 
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="sched-date-info">
              <h1 className="sched-title">{fmtDisplay(selectedDate)}</h1>
              {!isToday && (
                <button className="sched-today-btn" onClick={onGoToday}>
                  ← Today
                </button>
              )}
            </div>
            <button 
              className="sched-arrow" 
              onClick={() => onDayShift(1)} 
              aria-label="Next day"
            >
              <ChevronRight size={18} />
            </button>
          </>
        ) : view === 'week' ? (
          <>
            <button 
              className="sched-arrow" 
              onClick={() => onWeekShift(-1)} 
              aria-label="Previous week"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="sched-date-info">
              <h1 className="sched-title">
                Week of {weekStartDate?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
              </h1>
              <button className="sched-today-btn" onClick={onGoToday}>
                ← This week
              </button>
            </div>
            <button 
              className="sched-arrow" 
              onClick={() => onWeekShift(1)} 
              aria-label="Next week"
            >
              <ChevronRight size={18} />
            </button>
          </>
        ) : (
          <>
            <button 
              className="sched-arrow" 
              onClick={() => onMonthShift(-1)} 
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="sched-date-info">
              <h1 className="sched-title">{MONTHS[calMonth]} {calYear}</h1>
            </div>
            <button 
              className="sched-arrow" 
              onClick={() => onMonthShift(1)} 
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
      
      <div className="sched-actions">
        <button className="sched-add-btn" onClick={onShowForm} title="Add event">
          <Plus size={16} /> <span>Add</span>
        </button>
        <div className="sched-view-toggle">
          <button 
            className={`sched-view-btn ${view === 'day' ? 'active' : ''}`}
            onClick={() => onViewChange('day')}
            title="Day view"
            aria-label="Day view"
          >
            <List size={15} />
          </button>
          <button 
            className={`sched-view-btn ${view === 'timeline' ? 'active' : ''}`}
            onClick={() => onViewChange('timeline')}
            title="Unified Timeline"
            aria-label="Timeline view"
          >
            <Layers size={15} />
          </button>
          <button 
            className={`sched-view-btn ${view === 'week' ? 'active' : ''}`}
            onClick={() => onViewChange('week')}
            title="Week view"
            aria-label="Week view"
          >
            <CalendarIcon size={15} />
          </button>
          <button 
            className={`sched-view-btn ${view === 'month' ? 'active' : ''}`}
            onClick={() => onViewChange('month')}
            title="Month view"
            aria-label="Month view"
          >
            <Grid3x3 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
