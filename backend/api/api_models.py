"""
LifeOS Public API — Request/Response Models

Pydantic-like models using dataclasses with validation,
defaults, and transformation to LifeOS internal format.
Each model validates incoming API requests and converts
them to the format expected by LifeOS's SQLite data layer.
"""

import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from typing import Optional, List, Dict, Any


# ── Validation Helpers ─────────────────────────────────────────────────

def validate_range(value, name, min_val, max_val):
    """Validate a numeric value is within a range."""
    if value is not None and (value < min_val or value > max_val):
        raise ValueError(f'{name} must be between {min_val} and {max_val}, got {value}')


def validate_nonempty(value, name):
    """Validate a string is non-empty after stripping."""
    if value is not None and not str(value).strip():
        raise ValueError(f'{name} cannot be empty')


def validate_date_format(value, name='%Y-%m-%d'):
    """Validate a date string format."""
    if value is None:
        return True
    try:
        datetime.strptime(value.split('T')[0], '%Y-%m-%d')
        return True
    except (ValueError, AttributeError):
        raise ValueError(f'Invalid date format. Expected YYYY-MM-DD or ISO 8601')


def sanitize_string(value, max_length=10000):
    """Sanitize a string input — trim, limit length."""
    if value is None:
        return None
    s = str(value).strip()
    return s[:max_length] if len(s) > max_length else s


# ── Health Models ──────────────────────────────────────────────────────

@dataclass
class HealthLogRequest:
    """Log health data — mood, energy, sleep, weight, exercise.

    Maps to the health_metrics table and optionally creates
    a habit completion for the 'exercise' field.
    """
    date: str = field(default_factory=lambda: date.today().isoformat())
    mood_score: Optional[float] = None       # 1-10
    energy_score: Optional[float] = None      # 1-10
    stress_score: Optional[float] = None      # 1-10
    sleep_hours: Optional[float] = None       # 0-24
    sleep_quality: Optional[float] = None     # 1-10
    water_glasses: Optional[int] = None       # 0-50
    weight_kg: Optional[float] = None        # 20-500
    exercise_minutes: Optional[int] = None    # 0-1440
    exercise_type: Optional[str] = None       # running, cycling, gym, etc.
    notes: Optional[str] = None
    source: str = 'api'

    def validate(self):
        validate_range(self.mood_score, 'mood_score', 1, 10)
        validate_range(self.energy_score, 'energy_score', 1, 10)
        validate_range(self.stress_score, 'stress_score', 1, 10)
        validate_range(self.sleep_hours, 'sleep_hours', 0, 24)
        validate_range(self.sleep_quality, 'sleep_quality', 1, 10)
        validate_range(self.water_glasses, 'water_glasses', 0, 50)
        validate_range(self.weight_kg, 'weight_kg', 20, 500)
        validate_range(self.exercise_minutes, 'exercise_minutes', 0, 1440)

    def to_internal(self, user_id: str) -> dict:
        """Convert to LifeOS internal format (health_metrics table)."""
        result = {
            'user_id': user_id,
            'date': self.date,
            'source': self.source,
        }
        # Only include non-None fields
        for attr in ('mood_score', 'energy_score', 'stress_score',
                     'sleep_hours', 'sleep_quality', 'water_glasses',
                     'weight_kg', 'exercise_minutes', 'notes'):
            val = getattr(self, attr)
            if val is not None:
                result[attr] = val

        # Add exercise notes
        if self.exercise_type:
            exercise_note = f'{self.exercise_type}'
            if self.exercise_minutes:
                exercise_note += f' ({self.exercise_minutes} min)'
            if result.get('notes'):
                result['notes'] = f'{result["notes"]}; Exercise: {exercise_note}'
            else:
                result['notes'] = f'Exercise: {exercise_note}'

        return result


@dataclass
class HealthLogResponse:
    """Response for health log creation."""
    id: str = ''
    date: str = ''
    mood_score: Optional[float] = None
    energy_score: Optional[float] = None
    stress_score: Optional[float] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[float] = None
    water_glasses: Optional[int] = None
    weight_kg: Optional[float] = None
    exercise_minutes: Optional[int] = None
    notes: Optional[str] = None
    created_at: str = ''

    @classmethod
    def from_internal(cls, data: dict) -> 'HealthLogResponse':
        return cls(
            id=data.get('id', ''),
            date=data.get('date', ''),
            mood_score=data.get('mood_score'),
            energy_score=data.get('energy_score'),
            stress_score=data.get('stress_score'),
            sleep_hours=data.get('sleep_hours'),
            sleep_quality=data.get('sleep_quality'),
            water_glasses=data.get('water_glasses'),
            weight_kg=data.get('weight_kg'),
            exercise_minutes=data.get('exercise_minutes'),
            notes=data.get('notes'),
            created_at=data.get('created_at', ''),
        )


# ── Habit Models ──────────────────────────────────────────────────────

@dataclass
class HabitLogRequest:
    """Log a habit completion.

    Can reference an existing habit by ID or by title.
    If no habit_id is given, we search by title.
    """
    habit_id: Optional[str] = None
    habit_title: Optional[str] = None     # Alternative: match by name
    date: str = field(default_factory=lambda: date.today().isoformat())
    count: int = 1
    value: Optional[float] = None         # Numeric completions (e.g. "8 glasses of water")
    notes: Optional[str] = None
    source: str = 'api'

    def validate(self):
        if not self.habit_id and not self.habit_title:
            raise ValueError('Either habit_id or habit_title is required')
        validate_range(self.count, 'count', 1, 100)

    def to_internal(self, user_id: str) -> dict:
        result = {
            'user_id': user_id,
            'date': self.date,
            'count': self.count,
            'completed': 1,
            'source': self.source,
        }
        if self.habit_id:
            result['habit_id'] = self.habit_id
        if self.value is not None:
            result['value'] = self.value
        if self.notes:
            result['notes'] = sanitize_string(self.notes, 500)
        return result


@dataclass
class HabitLogResponse:
    id: str = ''
    habit_id: str = ''
    date: str = ''
    count: int = 1
    value: Optional[float] = None
    completed: int = 1
    notes: Optional[str] = None
    created_at: str = ''

    @classmethod
    def from_internal(cls, data: dict) -> 'HabitLogResponse':
        return cls(
            id=data.get('id', ''),
            habit_id=data.get('habit_id', ''),
            date=data.get('date', ''),
            count=data.get('count', 1),
            value=data.get('value'),
            completed=data.get('completed', 1),
            notes=data.get('notes'),
            created_at=data.get('created_at', ''),
        )


# ── Finance Models ────────────────────────────────────────────────────

@dataclass
class FinanceLogRequest:
    """Log an income or expense transaction.

    Supports both the older income/expenses tables and the
    newer unified transactions table. Maps to transactions
    by default.
    """
    type: str = 'expense'                  # 'income' or 'expense'
    amount: float = 0.0
    title: Optional[str] = None
    description: Optional[str] = None
    date: str = field(default_factory=lambda: date.today().isoformat())
    category: Optional[str] = None         # Category name (resolved to ID)
    category_id: Optional[str] = None      # Or direct category ID
    source: Optional[str] = None           # Income source name
    recurring: bool = False
    notes: Optional[str] = None
    api_source: str = 'api'

    def validate(self):
        if self.type not in ('income', 'expense'):
            raise ValueError(f'type must be "income" or "expense", got "{self.type}"')
        if not self.amount or self.amount <= 0:
            raise ValueError(f'amount must be positive, got {self.amount}')
        validate_range(self.amount, 'amount', 0.01, 10000000)

    def to_internal(self, user_id: str) -> dict:
        result = {
            'user_id': user_id,
            'type': self.type,
            'amount': self.amount,
            'date': self.date,
            'source': self.api_source,
        }
        if self.title:
            result['title'] = sanitize_string(self.title, 200)
        if self.description:
            result['description'] = sanitize_string(self.description, 2000)
        else:
            result['description'] = sanitize_string(self.title or '', 2000)
        if self.notes:
            result['notes'] = sanitize_string(self.notes, 2000)
        if self.category_id:
            result['category_id'] = self.category_id
        if self.source and self.type == 'income':
            result['source'] = self.source
        if self.recurring:
            result['recurring'] = 1
        return result


@dataclass
class FinanceLogResponse:
    id: str = ''
    type: str = ''
    amount: float = 0.0
    title: Optional[str] = None
    description: Optional[str] = None
    date: str = ''
    category_id: Optional[str] = None
    created_at: str = ''

    @classmethod
    def from_internal(cls, data: dict) -> 'FinanceLogResponse':
        return cls(
            id=data.get('id', ''),
            type=data.get('type', ''),
            amount=data.get('amount', 0),
            title=data.get('title'),
            description=data.get('description'),
            date=data.get('date', ''),
            category_id=data.get('category_id'),
            created_at=data.get('created_at', ''),
        )


# ── Journal Models ─────────────────────────────────────────────────────

@dataclass
class JournalEntryRequest:
    """Create a journal entry.

    Maps to journal_entries table.
    """
    date: str = field(default_factory=lambda: date.today().isoformat())
    title: Optional[str] = None
    content: str = ''
    mood: Optional[int] = None            # 1-10
    energy: Optional[int] = None           # 1-10
    tags: List[str] = field(default_factory=list)
    source: str = 'api'

    def validate(self):
        validate_nonempty(self.content, 'content')
        if not self.content.strip():
            raise ValueError('content cannot be empty')
        validate_range(self.mood, 'mood', 1, 10)
        validate_range(self.energy, 'energy', 1, 10)
        if len(self.content) > 100000:
            raise ValueError('content exceeds maximum length (100,000 chars)')

    def to_internal(self, user_id: str) -> dict:
        result = {
            'user_id': user_id,
            'date': self.date,
            'content': sanitize_string(self.content, 100000),
            'source': self.source,
        }
        if self.title:
            result['title'] = sanitize_string(self.title, 500)
        if self.mood is not None:
            result['mood'] = self.mood
        if self.energy is not None:
            result['energy'] = self.energy
        if self.tags:
            result['tags'] = self.tags
        return result


@dataclass
class JournalEntryResponse:
    id: str = ''
    date: str = ''
    title: Optional[str] = None
    content: str = ''
    mood: Optional[int] = None
    energy: Optional[int] = None
    tags: List[str] = field(default_factory=list)
    created_at: str = ''

    @classmethod
    def from_internal(cls, data: dict) -> 'JournalEntryResponse':
        tags = data.get('tags', [])
        if isinstance(tags, str):
            try:
                import json
                tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                tags = []
        return cls(
            id=data.get('id', ''),
            date=data.get('date', ''),
            title=data.get('title'),
            content=data.get('content', ''),
            mood=data.get('mood'),
            energy=data.get('energy'),
            tags=tags,
            created_at=data.get('created_at', ''),
        )


# ── Schedule/Event Models ─────────────────────────────────────────────

@dataclass
class EventRequest:
    """Create or update a schedule event.

    Maps to schedule_events table.
    """
    title: str = ''
    description: Optional[str] = None
    date: Optional[str] = None             # YYYY-MM-DD
    start_time: Optional[str] = None        # HH:mm
    end_time: Optional[str] = None          # HH:mm
    all_day: bool = False
    event_type: str = 'custom'              # custom, work, personal, health
    category: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    source: str = 'api'

    def validate(self):
        validate_nonempty(self.title, 'title')
        if not self.title or not self.title.strip():
            raise ValueError('title is required')
        if self.date:
            validate_date_format(self.date)

    def to_internal(self, user_id: str) -> dict:
        result = {
            'user_id': user_id,
            'title': sanitize_string(self.title, 500),
            'event_type': self.event_type,
            'all_day': 1 if self.all_day else 0,
            'source': self.source,
        }
        if self.date:
            result['date'] = self.date
        if self.description:
            result['description'] = sanitize_string(self.description, 5000)
        if self.start_time:
            result['start_time'] = self.start_time
        if self.end_time:
            result['end_time'] = self.end_time
        if self.category:
            result['category'] = self.category
        if self.location:
            result['location'] = sanitize_string(self.location, 500)
        if self.notes:
            result['notes'] = sanitize_string(self.notes, 5000)
        if self.color:
            result['color'] = self.color
        return result


@dataclass
class EventResponse:
    id: str = ''
    title: str = ''
    description: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: bool = False
    event_type: str = ''
    category: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    source: str = ''
    created_at: str = ''

    @classmethod
    def from_internal(cls, data: dict) -> 'EventResponse':
        return cls(
            id=data.get('id', ''),
            title=data.get('title', ''),
            description=data.get('description'),
            date=data.get('date'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            all_day=bool(data.get('all_day', 0)),
            event_type=data.get('event_type', ''),
            category=data.get('category'),
            location=data.get('location'),
            notes=data.get('notes'),
            color=data.get('color'),
            source=data.get('source', ''),
            created_at=data.get('created_at', ''),
        )


# ── Goal Models ────────────────────────────────────────────────────────

@dataclass
class GoalRequest:
    """Create or update a goal.

    Maps to goals table.
    """
    title: str = ''
    description: Optional[str] = None
    domain: Optional[str] = None           # health, finance, career, personal
    category: Optional[str] = None
    status: str = 'active'                 # active, completed, paused, abandoned
    progress: float = 0                    # 0-100
    target_date: Optional[str] = None
    priority: str = 'medium'               # low, medium, high, critical
    icon: Optional[str] = None
    color: Optional[str] = None
    source: str = 'api'

    def validate(self):
        if not self.title or not self.title.strip():
            raise ValueError('title is required')
        if self.status and self.status not in ('active', 'completed', 'paused', 'abandoned', 'on_hold'):
            raise ValueError(f'Invalid status: {self.status}')
        if self.priority and self.priority not in ('low', 'medium', 'high', 'critical'):
            raise ValueError(f'Invalid priority: {self.priority}')
        validate_range(self.progress, 'progress', 0, 100)

    def to_internal(self, user_id: str) -> dict:
        result = {
            'user_id': user_id,
            'title': sanitize_string(self.title, 500),
            'status': self.status,
            'progress': self.progress,
            'priority': self.priority,
            'source': self.source,
        }
        if self.description:
            result['description'] = sanitize_string(self.description, 5000)
        if self.domain:
            result['domain'] = self.domain
        if self.category:
            result['category'] = self.category
        if self.target_date:
            result['target_date'] = self.target_date
        if self.icon:
            result['icon'] = self.icon
        if self.color:
            result['color'] = self.color
        return result


@dataclass
class GoalResponse:
    id: str = ''
    title: str = ''
    description: Optional[str] = None
    domain: Optional[str] = None
    category: Optional[str] = None
    status: str = ''
    progress: float = 0
    target_date: Optional[str] = None
    priority: str = ''
    icon: Optional[str] = None
    color: Optional[str] = None
    source: str = ''
    created_at: str = ''

    @classmethod
    def from_internal(cls, data: dict) -> 'GoalResponse':
        return cls(
            id=data.get('id', ''),
            title=data.get('title', ''),
            description=data.get('description'),
            domain=data.get('domain'),
            category=data.get('category'),
            status=data.get('status', ''),
            progress=data.get('progress', 0),
            target_date=data.get('target_date'),
            priority=data.get('priority', ''),
            icon=data.get('icon'),
            color=data.get('color'),
            source=data.get('source', ''),
            created_at=data.get('created_at', ''),
        )


# ── Webhook Payload Models ─────────────────────────────────────────────

@dataclass
class StravaWebhookPayload:
    """Strava webhook activity data.

    Maps Strava fields to LifeOS health and schedule data.
    """
    object_type: str = ''                   # 'activity'
    object_id: str = ''
    aspect_type: str = ''                   # 'create', 'update', 'delete'
    owner_id: str = ''
    activity_id: str = ''
    activity_type: str = ''                  # Run, Ride, Swim, etc.
    activity_name: str = ''
    elapsed_time: int = 0                   # seconds
    distance: float = 0                     # meters
    start_date: str = ''
    average_speed: float = 0                # m/s
    max_speed: float = 0                    # m/s
    elevation_gain: float = 0              # meters
    calories: float = 0

    def to_health_internal(self, user_id: str) -> dict:
        """Create health_metrics entry from Strava activity."""
        exercise_min = max(1, self.elapsed_time // 60) if self.elapsed_time else 0
        notes_parts = [f'Strava: {self.activity_name or self.activity_type}']
        if self.distance:
            km = self.distance / 1000
            notes_parts.append(f'Distance: {km:.1f}km')
        if self.elapsed_time:
            minutes = self.elapsed_time // 60
            notes_parts.append(f'Duration: {minutes}min')
        if self.calories:
            notes_parts.append(f'Calories: {self.calories:.0f}')

        return {
            'user_id': user_id,
            'date': self.start_date[:10] if self.start_date else date.today().isoformat(),
            'exercise_minutes': exercise_min,
            'notes': '; '.join(notes_parts),
            'source': 'strava',
        }

    def to_event_internal(self, user_id: str) -> dict:
        """Create schedule_event from Strava activity."""
        return {
            'user_id': user_id,
            'title': f'{self.activity_type}: {self.activity_name or "Activity"}',
            'date': self.start_date[:10] if self.start_date else date.today().isoformat(),
            'start_time': self.start_date[11:16] if len(self.start_date) > 16 else None,
            'event_type': 'exercise',
            'source': 'strava',
            'metadata': {
                'strava_activity_id': self.activity_id,
                'distance_m': self.distance,
                'elapsed_time_s': self.elapsed_time,
                'calories': self.calories,
                'elevation_gain_m': self.elevation_gain,
            },
        }


@dataclass
class HealthAppPayload:
    """Apple Health / Google Fit data payload.

    Handles various health metrics pushed from health apps.
    """
    date: str = field(default_factory=lambda: date.today().isoformat())
    mood_score: Optional[float] = None
    energy_score: Optional[float] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[float] = None
    water_glasses: Optional[int] = None
    weight_kg: Optional[float] = None
    exercise_minutes: Optional[int] = None
    steps: Optional[int] = None
    heart_rate_avg: Optional[int] = None       # bpm
    heart_rate_resting: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    blood_glucose: Optional[float] = None       # mg/dL
    calories_burned: Optional[float] = None
    calories_consumed: Optional[float] = None
    source: str = 'health_app'

    def validate(self):
        validate_range(self.mood_score, 'mood_score', 1, 10)
        validate_range(self.energy_score, 'energy_score', 1, 10)
        validate_range(self.sleep_hours, 'sleep_hours', 0, 24)
        validate_range(self.steps, 'steps', 0, 200000)

    def to_internal(self, user_id: str) -> dict:
        result = {'user_id': user_id, 'date': self.date, 'source': self.source}
        # Map standard fields directly
        for attr in ('mood_score', 'energy_score', 'sleep_hours',
                     'sleep_quality', 'water_glasses', 'weight_kg',
                     'exercise_minutes'):
            val = getattr(self, attr)
            if val is not None:
                result[attr] = val

        # Extra fields go into notes or metadata
        extra = []
        if self.steps is not None:
            extra.append(f'Steps: {self.steps}')
        if self.heart_rate_avg is not None:
            extra.append(f'Avg HR: {self.heart_rate_avg}bpm')
        if self.heart_rate_resting is not None:
            extra.append(f'Resting HR: {self.heart_rate_resting}bpm')
        if self.blood_pressure_systolic is not None:
            extra.append(f'BP: {self.blood_pressure_systolic}/{self.blood_pressure_diastolic}')
        if self.blood_glucose is not None:
            extra.append(f'Glucose: {self.blood_glucose}mg/dL')
        if self.calories_burned is not None:
            extra.append(f'Calories burned: {self.calories_burned}')
        if self.calories_consumed is not None:
            extra.append(f'Calories consumed: {self.calories_consumed}')

        if extra:
            existing_notes = result.get('notes', '')
            result['notes'] = (existing_notes + '; ' if existing_notes else '') + '; '.join(extra)

        return result


@dataclass
class CalendarEventPayload:
    """Calendar sync event payload.

    Generic format for Google Calendar, Outlook, etc.
    """
    title: str = ''
    description: Optional[str] = None
    start_time: str = ''                   # ISO 8601 datetime
    end_time: Optional[str] = None         # ISO 8601 datetime
    all_day: bool = False
    location: Optional[str] = None
    calendar_id: Optional[str] = None
    event_type: str = 'calendar'
    color: Optional[str] = None
    recurrence_rule: Optional[str] = None
    external_id: Optional[str] = None      # ID from source calendar
    source: str = 'calendar'

    def validate(self):
        if not self.title or not self.title.strip():
            raise ValueError('title is required')
        if not self.start_time:
            raise ValueError('start_time is required')

    def to_internal(self, user_id: str) -> dict:
        # Parse date from start_time
        date_str = self.start_time[:10] if len(self.start_time) >= 10 else date.today().isoformat()
        time_str = self.start_time[11:16] if len(self.start_time) >= 16 else None
        end_time_str = self.end_time[11:16] if self.end_time and len(self.end_time) >= 16 else None

        result = {
            'user_id': user_id,
            'title': sanitize_string(self.title, 500),
            'date': date_str,
            'event_type': self.event_type,
            'all_day': 1 if self.all_day else 0,
            'source': self.source,
        }
        if time_str:
            result['start_time'] = time_str
        if end_time_str:
            result['end_time'] = end_time_str
        if self.description:
            result['description'] = sanitize_string(self.description, 5000)
        if self.location:
            result['location'] = sanitize_string(self.location, 500)
        if self.color:
            result['color'] = self.color
        if self.recurrence_rule:
            result['recurrence_rule'] = self.recurrence_rule
            result['is_recurring'] = 1

        metadata = {}
        if self.external_id:
            metadata['external_id'] = self.external_id
        if self.calendar_id:
            metadata['calendar_id'] = self.calendar_id
        if metadata:
            result['metadata'] = metadata

        return result


@dataclass
class BankingTransactionPayload:
    """Banking webhook transaction data.

    Handles transaction notifications from Open Banking
    APIs or CSV import.
    """
    type: str = 'expense'                  # 'income' or 'expense'
    amount: float = 0
    description: str = ''
    date: str = field(default_factory=lambda: date.today().isoformat())
    merchant: Optional[str] = None
    category: Optional[str] = None
    account: Optional[str] = None
    reference: Optional[str] = None
    balance_after: Optional[float] = None
    source: str = 'banking'

    def validate(self):
        if self.type not in ('income', 'expense'):
            raise ValueError(f'type must be "income" or "expense"')
        if self.amount <= 0:
            raise ValueError('amount must be positive')

    def to_internal(self, user_id: str) -> dict:
        notes_parts = []
        if self.merchant:
            notes_parts.append(f'Merchant: {self.merchant}')
        if self.reference:
            notes_parts.append(f'Ref: {self.reference}')
        if self.account:
            notes_parts.append(f'Account: {self.account}')
        if self.balance_after is not None:
            notes_parts.append(f'Balance after: {self.balance_after:.2f}')

        result = {
            'user_id': user_id,
            'type': self.type,
            'amount': abs(self.amount),
            'date': self.date,
            'source': self.source,
        }
        # Title from description or merchant
        result['title'] = sanitize_string(self.description or self.merchant or 'Bank transaction', 200)
        result['description'] = sanitize_string(self.description, 2000)
        if notes_parts:
            result['notes'] = '; '.join(notes_parts)

        return result


# ── Stats Response ────────────────────────────────────────────────────

@dataclass
class StatsResponse:
    """Aggregated stats response — streaks, balances, progress."""
    habits: Dict[str, Any] = field(default_factory=dict)
    health: Dict[str, Any] = field(default_factory=dict)
    finances: Dict[str, Any] = field(default_factory=dict)
    goals: Dict[str, Any] = field(default_factory=dict)
    journal: Dict[str, Any] = field(default_factory=dict)
    xp: Dict[str, Any] = field(default_factory=dict)
    period: str = '7d'

    @classmethod
    def from_internal(cls, data: dict) -> 'StatsResponse':
        return cls(
            habits=data.get('habits', {}),
            health=data.get('health', {}),
            finances=data.get('finances', {}),
            goals=data.get('goals', {}),
            journal=data.get('journal', {}),
            xp=data.get('xp', {}),
            period=data.get('period', '7d'),
        )


# ── User Profile Response ──────────────────────────────────────────────

@dataclass
class UserProfileResponse:
    """User profile response for /me endpoint."""
    id: str = ''
    email: str = ''
    full_name: str = ''
    timezone: str = 'Australia/Melbourne'
    subscription_tier: str = 'free'
    onboarding_complete: bool = False
    created_at: str = ''

    @classmethod
    def from_internal(cls, data: dict) -> 'UserProfileResponse':
        return cls(
            id=data.get('user_id', data.get('id', '')),
            email=data.get('email', ''),
            full_name=data.get('full_name', ''),
            timezone=data.get('timezone', 'Australia/Melbourne'),
            subscription_tier=data.get('subscription_tier', 'free'),
            onboarding_complete=bool(data.get('onboarding_complete', 0)),
            created_at=data.get('created_at', ''),
        )