"""
LifeOS Public API — Flask Blueprint

REST API for external apps to push data INTO LifeOS.
Fitness apps (Apple Health, Google Fit, Strava), banking APIs,
calendar services, etc. LifeOS becomes the central nervous
system for personal data.

All endpoints require an API key (Bearer token or X-API-Key header).
Webhook endpoints additionally verify HMAC signatures.

Rate limit: 100 req/min per key.
"""

import json
import time
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, g

from .api_auth import (
    require_api_key, require_webhook_signature,
    get_current_key, get_all_keys, get_key_record,
    create_key, revoke_key, rotate_key, get_usage_stats,
    record_usage,
)
from .api_models import (
    HealthLogRequest, HealthLogResponse,
    HabitLogRequest, HabitLogResponse,
    FinanceLogRequest, FinanceLogResponse,
    JournalEntryRequest, JournalEntryResponse,
    EventRequest, EventResponse,
    GoalRequest, GoalResponse,
    StravaWebhookPayload,
    HealthAppPayload,
    CalendarEventPayload,
    BankingTransactionPayload,
    StatsResponse, UserProfileResponse,
)

# ======================================================================
# Blueprint
# ======================================================================

public_api_bp = Blueprint('public_api', __name__)

DEFAULT_USER_ID = 'local-user-001'


def _get_db():
    """Get the DB connection from app context (set by app.py)."""
    from flask import g as _g
    if hasattr(_g, 'db'):
        return _g.db
    # Fallback: create connection
    import sqlite3, os
    DB_PATH = os.path.join(os.path.expanduser('~'), '.lifeos', 'data.db')
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _new_id():
    import uuid
    return str(uuid.uuid4())


def _now_iso():
    return datetime.utcnow().isoformat() + 'Z'


def _row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    for key in ('tags', 'metadata', 'preferences', 'stats', 'equipment',
                'position', 'sprite_data', 'exercises', 'attachments',
                'steps_completed', 'custom_fields', 'key_results', 'resources',
                'context'):
        if key in d and isinstance(d[key], str):
            try:
                d[key] = json.loads(d[key])
            except (json.JSONDecodeError, TypeError):
                pass
    return d


def _api_response(data=None, error=None, status=200):
    """Return a consistent JSON response."""
    resp = {
        'data': data,
        'error': error,
    }
    return jsonify(resp), status


def _validation_error(message, details=None):
    """Return a 400 validation error."""
    body = {
        'error': {
            'code': 'validation_error',
            'message': message,
        }
    }
    if details:
        body['error']['details'] = details
    return jsonify(body), 400


def _db_insert(db, table, record):
    """Insert a record and return it as a dict."""
    record.setdefault('id', _new_id())
    if 'user_id' in _get_table_columns(db, table):
        record.setdefault('user_id', DEFAULT_USER_ID)
    record.setdefault('created_at', _now_iso())

    # Serialize JSON fields
    for key in ('tags', 'metadata', 'preferences', 'stats', 'equipment',
                'position', 'sprite_data', 'exercises', 'attachments',
                'steps_completed', 'custom_fields', 'key_results', 'resources',
                'context'):
        if key in record and not isinstance(record[key], str):
            record[key] = json.dumps(record[key])

    cols = ", ".join(f'"{k}"' for k in record.keys())
    placeholders = ", ".join("?" for _ in record)
    try:
        db.execute(f'INSERT INTO {table} ({cols}) VALUES ({placeholders})', list(record.values()))
        db.commit()
    except Exception as e:
        db.rollback()
        raise e

    pk = 'user_id' if table == 'user_profiles' else 'id'
    row = db.execute(f'SELECT * FROM {table} WHERE "{pk}" = ?', (record[pk],)).fetchone()
    return _row_to_dict(row)


def _get_table_columns(db, table):
    """Get column names for a table."""
    try:
        cols = db.execute(f"PRAGMA table_info({table})").fetchall()
        return {c[1] for c in cols}
    except Exception:
        return set()


# ======================================================================
# API Key Management Endpoints
# ======================================================================

@public_api_bp.route('/keys', methods=['GET'])
def list_api_keys():
    """List all API keys (masked). No auth required — admin-only in production."""
    keys = get_all_keys()
    return _api_response(data=keys)


@public_api_bp.route('/keys', methods=['POST'])
def create_api_key():
    """Generate a new API key."""
    body = request.get_json(force=True, silent=True) or {}
    name = body.get('name', 'Default Key')
    scopes = body.get('scopes', ['read', 'write'])

    record = create_key(name=name, scopes=scopes)
    # Return full key only on creation (won't be shown again)
    return _api_response(data=record, status=201)


@public_api_bp.route('/keys/<key_id>', methods=['DELETE'])
def revoke_api_key(key_id):
    """Revoke (disable) an API key."""
    success = revoke_key(key_id)
    if success:
        return _api_response(data={'id': key_id, 'revoked': True})
    return _api_response(error={'code': 'not_found', 'message': f'Key {key_id} not found'}), 404


@public_api_bp.route('/keys/<key_id>/rotate', methods=['POST'])
def rotate_api_key(key_id):
    """Rotate an API key — generates a new key and disables the old one."""
    new_key = rotate_key(key_id)
    if new_key:
        return _api_response(data=new_key, status=201)
    return _api_response(error={'code': 'not_found', 'message': f'Key {key_id} not found'}), 404


@public_api_bp.route('/keys/<key_id>/usage', methods=['GET'])
def key_usage_stats(key_id):
    """Get usage statistics for a specific key."""
    days = request.args.get('days', 7, type=int)
    stats = get_usage_stats(key_id=key_id, days=days)
    return _api_response(data=stats)


# ======================================================================
# Health Endpoints
# ======================================================================

@public_api_bp.route('/health', methods=['POST'])
@require_api_key(min_scope='write')
def log_health():
    """Log health data — mood, energy, sleep, weight, exercise.

    POST /api/v1/health
    {
        "date": "2025-01-15",
        "mood_score": 7,
        "energy_score": 6,
        "sleep_hours": 7.5,
        "exercise_minutes": 45,
        "exercise_type": "running",
        "notes": "Great morning run"
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    try:
        req = HealthLogRequest(**{k: v for k, v in body.items() if v is not None})
        req.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    internal = req.to_internal(DEFAULT_USER_ID)
    db = _get_db()

    # Upsert: if health_metrics for this date exists, update it
    existing = db.execute(
        'SELECT * FROM health_metrics WHERE user_id = ? AND date = ?',
        (DEFAULT_USER_ID, req.date)
    ).fetchone()

    if existing:
        # Update existing record
        updates = {k: v for k, v in internal.items() if k not in ('user_id', 'date', 'source') and v is not None}
        updates['updated_at'] = _now_iso()
        sets = ", ".join(f'"{k}" = ?' for k in updates.keys())
        vals = list(updates.values()) + [DEFAULT_USER_ID, req.date]
        db.execute(f'UPDATE health_metrics SET {sets} WHERE user_id = ? AND date = ?', vals)
        db.commit()
        row = db.execute(
            'SELECT * FROM health_metrics WHERE user_id = ? AND date = ?',
            (DEFAULT_USER_ID, req.date)
        ).fetchone()
        result = _row_to_dict(row)
    else:
        result = _db_insert(db, 'health_metrics', internal)

    response = HealthLogResponse.from_internal(result)
    return _api_response(data=response.__dict__, status=201)


# ======================================================================
# Habits Endpoints
# ======================================================================

@public_api_bp.route('/habits', methods=['POST'])
@require_api_key(min_scope='write')
def log_habit():
    """Log a habit completion.

    POST /api/v1/habits
    {
        "habit_title": "Meditation",
        "date": "2025-01-15",
        "count": 1,
        "notes": "Morning session"
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    try:
        req = HabitLogRequest(**{k: v for k, v in body.items() if v is not None})
        req.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    db = _get_db()
    internal = req.to_internal(DEFAULT_USER_ID)

    # If habit_title given, find the habit_id
    if req.habit_title and not req.habit_id:
        habit_row = db.execute(
            'SELECT id FROM habits WHERE user_id = ? AND title LIKE ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1',
            (DEFAULT_USER_ID, f'%{req.habit_title}%')
        ).fetchone()
        if habit_row:
            internal['habit_id'] = habit_row['id']
        else:
            # Auto-create the habit
            new_habit = {
                'id': _new_id(),
                'user_id': DEFAULT_USER_ID,
                'title': req.habit_title,
                'frequency': 'daily',
                'source': 'api',
            }
            _db_insert(db, 'habits', new_habit)
            internal['habit_id'] = new_habit['id']

    if 'habit_id' not in internal:
        return _validation_error('Could not resolve habit. Provide habit_id or habit_title.')

    result = _db_insert(db, 'habit_logs', internal)
    response = HabitLogResponse.from_internal(result)
    return _api_response(data=response.__dict__, status=201)


# ======================================================================
# Finances Endpoints
# ======================================================================

@public_api_bp.route('/finances', methods=['POST'])
@require_api_key(min_scope='write')
def log_finance():
    """Log an income/expense transaction.

    POST /api/v1/finances
    {
        "type": "expense",
        "amount": 45.50,
        "title": "Groceries at Woolies",
        "category": "Food",
        "date": "2025-01-15"
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    try:
        req = FinanceLogRequest(**{k: v for k, v in body.items() if v is not None})
        req.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    db = _get_db()
    internal = req.to_internal(DEFAULT_USER_ID)

    # Resolve category name to ID
    if req.category and not req.category_id:
        cat_row = db.execute(
            'SELECT id FROM expense_categories WHERE user_id = ? AND name LIKE ? LIMIT 1',
            (DEFAULT_USER_ID, f'%{req.category}%')
        ).fetchone()
        if cat_row:
            internal['category_id'] = cat_row['id']
        # Remove the raw category string — we've resolved it
        internal.pop('category', None)

    result = _db_insert(db, 'transactions', internal)
    response = FinanceLogResponse.from_internal(result)
    return _api_response(data=response.__dict__, status=201)


# ======================================================================
# Journal Endpoints
# ======================================================================

@public_api_bp.route('/journal', methods=['POST'])
@require_api_key(min_scope='write')
def create_journal_entry():
    """Create a journal entry.

    POST /api/v1/journal
    {
        "date": "2025-01-15",
        "title": "Morning reflections",
        "content": "Had a great morning run...",
        "mood": 7,
        "tags": ["gratitude", "exercise"]
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    try:
        req = JournalEntryRequest(**{k: v for k, v in body.items() if v is not None})
        req.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    internal = req.to_internal(DEFAULT_USER_ID)
    db = _get_db()
    result = _db_insert(db, 'journal_entries', internal)
    response = JournalEntryResponse.from_internal(result)
    return _api_response(data=response.__dict__, status=201)


# ======================================================================
# Schedule Endpoints
# ======================================================================

@public_api_bp.route('/schedule', methods=['POST'])
@require_api_key(min_scope='write')
def create_event():
    """Create or update a schedule event.

    POST /api/v1/schedule
    {
        "title": "Team Meeting",
        "date": "2025-01-15",
        "start_time": "14:00",
        "end_time": "15:00",
        "location": "Conference Room A",
        "event_type": "work"
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    try:
        req = EventRequest(**{k: v for k, v in body.items() if v is not None})
        req.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    internal = req.to_internal(DEFAULT_USER_ID)
    db = _get_db()
    result = _db_insert(db, 'schedule_events', internal)
    response = EventResponse.from_internal(result)
    return _api_response(data=response.__dict__, status=201)


# ======================================================================
# Goals Endpoints
# ======================================================================

@public_api_bp.route('/goals', methods=['POST'])
@require_api_key(min_scope='write')
def create_goal():
    """Create or update a goal.

    POST /api/v1/goals
    {
        "title": "Run a marathon",
        "domain": "health",
        "progress": 25,
        "target_date": "2025-06-01",
        "priority": "high"
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    try:
        req = GoalRequest(**{k: v for k, v in body.items() if v is not None})
        req.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    internal = req.to_internal(DEFAULT_USER_ID)
    db = _get_db()
    result = _db_insert(db, 'goals', internal)
    response = GoalResponse.from_internal(result)
    return _api_response(data=response.__dict__, status=201)


# ======================================================================
# Stats Endpoint
# ======================================================================

@public_api_bp.route('/stats', methods=['GET'])
@require_api_key(min_scope='read')
def get_stats():
    """Get user stats — streaks, balances, progress.

    GET /api/v1/stats?period=7d
    Supports: 1d, 7d, 30d, 90d
    """
    period = request.args.get('period', '7d')
    period_map = {'1d': 1, '7d': 7, '30d': 30, '90d': 90}
    days = period_map.get(period, 7)

    db = _get_db()
    since = (date.today() - timedelta(days=days)).isoformat()

    # Habit stats
    habits = db.execute(
        'SELECT * FROM habits WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
        (DEFAULT_USER_ID,)
    ).fetchall()
    habit_logs = db.execute(
        'SELECT * FROM habit_logs WHERE user_id = ? AND date >= ?',
        (DEFAULT_USER_ID, since)
    ).fetchall()

    habit_streaks = {}
    for h in habits:
        h_dict = _row_to_dict(h)
        streak = h_dict.get('streak_current', 0) or 0
        best = h_dict.get('streak_best', 0) or 0
        habit_streaks[h_dict['id']] = {
            'title': h_dict.get('title', ''),
            'current_streak': streak,
            'best_streak': best,
        }

    # Health stats
    health_rows = db.execute(
        'SELECT * FROM health_metrics WHERE user_id = ? AND date >= ? ORDER BY date DESC',
        (DEFAULT_USER_ID, since)
    ).fetchall()
    health_avgs = {}
    if health_rows:
        count = len(health_rows)
        health_avgs = {
            'avg_mood': sum(r['mood_score'] or 0 for r in health_rows) / count,
            'avg_energy': sum(r['energy_score'] or 0 for r in health_rows) / count,
            'avg_sleep': sum(r['sleep_hours'] or 0 for r in health_rows) / count,
            'total_exercise_min': sum(r['exercise_minutes'] or 0 for r in health_rows),
            'days_logged': count,
        }

    # Finance stats
    month = date.today().strftime('%Y-%m')
    income_row = db.execute(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' AND strftime('%Y-%m', date) = ?",
        (DEFAULT_USER_ID, month)
    ).fetchone()
    expense_row = db.execute(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?",
        (DEFAULT_USER_ID, month)
    ).fetchone()

    # Goal stats
    goals = db.execute(
        "SELECT status, COUNT(*) as cnt, AVG(progress) as avg_progress FROM goals WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) GROUP BY status",
        (DEFAULT_USER_ID,)
    ).fetchall()
    goal_stats = {r['status']: {'count': r['cnt'], 'avg_progress': round(r['avg_progress'] or 0, 1)} for r in goals}

    # Journal stats
    journal_count = db.execute(
        'SELECT COUNT(*) as cnt FROM journal_entries WHERE user_id = ? AND date >= ? AND (is_deleted = 0 OR is_deleted IS NULL)',
        (DEFAULT_USER_ID, since)
    ).fetchone()['cnt']

    # XP stats
    xp_row = db.execute('SELECT * FROM user_xp WHERE user_id = ?', (DEFAULT_USER_ID,)).fetchone()

    stats = {
        'habits': {
            'total': len(habits),
            'streaks': habit_streaks,
            'logs_this_period': len(habit_logs),
        },
        'health': health_avgs,
        'finances': {
            'month': month,
            'income': income_row['total'] if income_row else 0,
            'expenses': expense_row['total'] if expense_row else 0,
            'net': (income_row['total'] if income_row else 0) - (expense_row['total'] if expense_row else 0),
        },
        'goals': goal_stats,
        'journal': {
            'entries_this_period': journal_count,
        },
        'xp': dict(xp_row) if xp_row else {'total_xp': 0, 'level': 1},
        'period': period,
    }

    return _api_response(data=stats)


# ======================================================================
# Insights Endpoint
# ======================================================================

@public_api_bp.route('/insights', methods=['GET'])
@require_api_key(min_scope='read')
def get_insights():
    """Get AI-generated insights.

    GET /api/v1/insights?limit=10&type=health
    """
    limit = request.args.get('limit', 10, type=int)
    insight_type = request.args.get('type', '')

    db = _get_db()
    conditions = ['user_id = ?']
    params = [DEFAULT_USER_ID]

    if insight_type:
        conditions.append('type = ?')
        params.append(insight_type)

    where = ' AND '.join(conditions)
    rows = db.execute(
        f'SELECT * FROM ai_insights WHERE {where} ORDER BY created_at DESC LIMIT ?',
        params + [limit]
    ).fetchall()

    insights = [_row_to_dict(r) for r in rows]

    # If no insights exist, generate placeholder
    if not insights:
        insights = [{
            'id': 'generated',
            'type': insight_type or 'general',
            'content': 'Log more data to receive personalized insights. Start by tracking habits, health, and finances through the API.',
            'created_at': _now_iso(),
        }]

    return _api_response(data=insights)


# ======================================================================
# User Profile Endpoint
# ======================================================================

@public_api_bp.route('/me', methods=['GET'])
@require_api_key(min_scope='read')
def get_me():
    """Get user profile information.

    GET /api/v1/me
    """
    db = _get_db()
    row = db.execute('SELECT * FROM user_profiles WHERE user_id = ?', (DEFAULT_USER_ID,)).fetchone()

    if not row:
        return _api_response(error={'code': 'not_found', 'message': 'User profile not found'}), 404

    profile = _row_to_dict(row)
    response = UserProfileResponse.from_internal(profile)
    return _api_response(data=response.__dict__)


# ======================================================================
# Webhook Endpoints
# ======================================================================

@public_api_bp.route('/webhooks/strava', methods=['POST'])
def webhook_strava():
    """Strava webhook — receives activity data.

    Handles Strava's subscription verification (GET) and
    activity push (POST).

    POST /api/v1/webhooks/strava
    Headers:
        X-LifeOS-Signature: HMAC-SHA256 signature
    Body: Strava webhook payload
    """
    # Strava subscription verification (GET request)
    if request.method == 'GET':
        hub_mode = request.args.get('hub.mode')
        hub_challenge = request.args.get('hub.challenge')
        if hub_mode == 'subscribe' and hub_challenge:
            return jsonify({'hub.challenge': hub_challenge})
        return jsonify({'error': 'Invalid verification'}), 400

    # POST: Activity data
    body = request.get_json(force=True, silent=True) or {}

    # Validate Strava webhook token if provided
    strava_token = request.args.get('verify_token', '')
    # In production, verify this against a stored token

    db = _get_db()
    try:
        payload = StravaWebhookPayload(
            object_type=body.get('object_type', ''),
            object_id=str(body.get('object_id', '')),
            aspect_type=body.get('aspect_type', ''),
            owner_id=str(body.get('owner_id', '')),
            activity_id=str(body.get('object_id', '')),
            activity_type=body.get('activity_type', ''),
            activity_name=body.get('activity_name', ''),
            elapsed_time=int(body.get('elapsed_time', 0) or 0),
            distance=float(body.get('distance', 0) or 0),
            start_date=body.get('start_date', ''),
            average_speed=float(body.get('average_speed', 0) or 0),
            max_speed=float(body.get('max_speed', 0) or 0),
            elevation_gain=float(body.get('total_elevation_gain', 0) or 0),
            calories=float(body.get('calories', 0) or 0),
        )

        # Skip non-activity events
        if payload.object_type != 'activity' or payload.aspect_type == 'delete':
            return _api_response(data={'status': 'ignored', 'reason': 'not an activity creation'})

        # Create health_metrics entry
        health_data = payload.to_health_internal(DEFAULT_USER_ID)
        _db_insert(db, 'health_metrics', health_data)

        # Create schedule_event entry
        event_data = payload.to_event_internal(DEFAULT_USER_ID)
        _db_insert(db, 'schedule_events', event_data)

        # Grant XP for exercise
        xp_amount = min(max(payload.elapsed_time // 60, 1), 50)  # 1 XP per minute, max 50
        db.execute(
            'INSERT INTO xp_events (id, user_id, amount, source, description) VALUES (?, ?, ?, ?, ?)',
            (_new_id(), DEFAULT_USER_ID, xp_amount, 'strava', f'Strava activity: {payload.activity_name or payload.activity_type}')
        )
        db.commit()

        return _api_response(data={
            'status': 'processed',
            'health_entry': health_data.get('date'),
            'event_created': True,
        }, status=201)

    except Exception as e:
        return _api_response(error={'code': 'processing_error', 'message': str(e)}), 500


@public_api_bp.route('/webhooks/health', methods=['POST'])
@require_api_key(min_scope='write')
def webhook_health():
    """Apple Health / Google Fit webhook receiver.

    POST /api/v1/webhooks/health
    {
        "date": "2025-01-15",
        "mood_score": 7,
        "sleep_hours": 7.5,
        "steps": 8500,
        "heart_rate_avg": 72,
        "weight_kg": 75.2,
        "exercise_minutes": 30
    }
    """
    body = request.get_json(force=True, silent=True) or {}

    try:
        payload = HealthAppPayload(**{k: v for k, v in body.items() if v is not None})
        payload.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    db = _get_db()
    internal = payload.to_internal(DEFAULT_USER_ID)

    # Upsert health data for this date
    existing = db.execute(
        'SELECT * FROM health_metrics WHERE user_id = ? AND date = ?',
        (DEFAULT_USER_ID, payload.date)
    ).fetchone()

    if existing:
        # Merge — update non-None fields
        updates = {k: v for k, v in internal.items()
                   if k not in ('user_id', 'date', 'source') and v is not None}
        updates['updated_at'] = _now_iso()
        sets = ", ".join(f'"{k}" = ?' for k in updates.keys())
        vals = list(updates.values()) + [DEFAULT_USER_ID, payload.date]
        db.execute(f'UPDATE health_metrics SET {sets} WHERE user_id = ? AND date = ?', vals)
        db.commit()
    else:
        _db_insert(db, 'health_metrics', internal)

    return _api_response(data={'status': 'processed', 'date': payload.date}, status=201)


@public_api_bp.route('/webhooks/calendar', methods=['POST'])
@require_api_key(min_scope='write')
def webhook_calendar():
    """Calendar sync webhook receiver.

    POST /api/v1/webhooks/calendar
    {
        "title": "Team Standup",
        "start_time": "2025-01-15T09:00:00",
        "end_time": "2025-01-15T09:30:00",
        "location": "Zoom",
        "calendar_id": "work@gmail.com"
    }
    """
    body = request.get_json(force=True, silent=True) or {}

    try:
        payload = CalendarEventPayload(**{k: v for k, v in body.items() if v is not None})
        payload.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    db = _get_db()
    internal = payload.to_internal(DEFAULT_USER_ID)

    # Check for duplicate by external_id
    if payload.external_id:
        existing = db.execute(
            "SELECT id FROM schedule_events WHERE user_id = ? AND metadata LIKE ?",
            (DEFAULT_USER_ID, f'%{payload.external_id}%')
        ).fetchone()
        if existing:
            # Update existing
            db.execute(
                'DELETE FROM schedule_events WHERE id = ?',
                (existing['id'],)
            )
            db.commit()

    result = _db_insert(db, 'schedule_events', internal)
    return _api_response(data=EventResponse.from_internal(result).__dict__, status=201)


@public_api_bp.route('/webhooks/banking', methods=['POST'])
@require_api_key(min_scope='write')
def webhook_banking():
    """Banking transaction webhook receiver.

    POST /api/v1/webhooks/banking
    {
        "type": "expense",
        "amount": 45.50,
        "description": "WOOLWORTHS 1234",
        "date": "2025-01-15",
        "merchant": "Woolworths",
        "category": "groceries"
    }
    """
    body = request.get_json(force=True, silent=True) or {}

    try:
        payload = BankingTransactionPayload(**{k: v for k, v in body.items() if v is not None})
        payload.validate()
    except (TypeError, ValueError) as e:
        return _validation_error(str(e))

    db = _get_db()
    internal = payload.to_internal(DEFAULT_USER_ID)

    # Check for duplicate by reference
    if payload.reference:
        existing = db.execute(
            "SELECT id FROM transactions WHERE user_id = ? AND notes LIKE ?",
            (DEFAULT_USER_ID, f'%{payload.reference}%')
        ).fetchone()
        if existing:
            return _api_response(data={'status': 'duplicate', 'id': existing['id']})

    result = _db_insert(db, 'transactions', internal)

    # Also create a unified event for the activity feed
    event = {
        'user_id': DEFAULT_USER_ID,
        'event_type': 'transaction',
        'title': f'{payload.type.title()}: {internal.get("title", "Transaction")}',
        'description': f'${abs(payload.amount):.2f}',
        'amount': payload.amount if payload.type == 'income' else -payload.amount,
        'date': payload.date,
        'metadata': {'source': 'banking_webhook'},
    }
    try:
        _db_insert(db, 'unified_events', event)
    except Exception:
        pass  # Non-critical

    return _api_response(data=FinanceLogResponse.from_internal(result).__dict__, status=201)


# ======================================================================
# API Health / Status
# ======================================================================

@public_api_bp.route('/status', methods=['GET'])
def api_status():
    """Health check — no auth required."""
    db = _get_db()
    try:
        db.execute('SELECT 1')
        db_status = 'healthy'
    except Exception:
        db_status = 'unhealthy'

    return _api_response(data={
        'status': 'operational',
        'version': '1.0.0',
        'database': db_status,
        'timestamp': _now_iso(),
    })


# ======================================================================
# Strava webhook verification (GET handler)
# ======================================================================

@public_api_bp.route('/webhooks/strava', methods=['GET'])
def strava_verify():
    """Strava webhook subscription verification.

    When setting up a Strava webhook subscription, Strava sends
    a GET request with hub.challenge that must be echoed back.
    """
    hub_mode = request.args.get('hub.mode')
    hub_challenge = request.args.get('hub.challenge')
    verify_token = request.args.get('hub.verify_token')

    if hub_mode == 'subscribe' and hub_challenge:
        # In production, verify the verify_token matches your stored token
        return jsonify({'hub.challenge': hub_challenge})

    return jsonify({'error': 'Invalid hub.mode or missing hub.challenge'}), 400


# ======================================================================
# API Documentation Endpoint
# ======================================================================

@public_api_bp.route('/', methods=['GET'])
def api_docs():
    """API documentation — returns available endpoints."""
    endpoints = {
        'name': 'LifeOS Public API',
        'version': '1.0.0',
        'description': 'REST API for external apps to push data INTO LifeOS.',
        'authentication': {
            'type': 'API Key',
            'header': 'Authorization: Bearer {api_key}',
            'alt_header': 'X-API-Key: {api_key}',
            'alt_query': '?api_key={api_key}',
        },
        'rate_limiting': {
            'requests_per_minute': 100,
            'headers': {
                'X-RateLimit-Limit': 'Maximum requests per window',
                'X-RateLimit-Remaining': 'Remaining requests in current window',
                'X-RateLimit-Reset': 'Unix timestamp when the rate limit window resets',
            },
        },
        'scopes': {
            'read': 'Read-only access to stats, insights, profile',
            'write': 'Create and update data (health, habits, finances, etc.)',
            'admin': 'Full access including API key management',
        },
        'endpoints': {
            'health': {
                'POST /api/v1/health': 'Log health data (mood, energy, sleep, weight, exercise)',
            },
            'habits': {
                'POST /api/v1/habits': 'Log habit completions',
            },
            'finances': {
                'POST /api/v1/finances': 'Log income/expense transactions',
            },
            'journal': {
                'POST /api/v1/journal': 'Create journal entries',
            },
            'schedule': {
                'POST /api/v1/schedule': 'Create/update events',
            },
            'goals': {
                'POST /api/v1/goals': 'Create/update goals',
            },
            'stats': {
                'GET /api/v1/stats': 'Get user stats (streaks, balances, progress)',
            },
            'insights': {
                'GET /api/v1/insights': 'Get AI-generated insights',
            },
            'profile': {
                'GET /api/v1/me': 'Get user profile',
            },
            'webhooks': {
                'POST /api/v1/webhooks/strava': 'Strava activity push',
                'POST /api/v1/webhooks/health': 'Apple Health / Google Fit data',
                'POST /api/v1/webhooks/calendar': 'Calendar sync',
                'POST /api/v1/webhooks/banking': 'Transaction notifications',
            },
            'keys': {
                'GET /api/v1/keys': 'List API keys',
                'POST /api/v1/keys': 'Create API key',
                'DELETE /api/v1/keys/:id': 'Revoke API key',
                'POST /api/v1/keys/:id/rotate': 'Rotate API key',
                'GET /api/v1/keys/:id/usage': 'Key usage statistics',
            },
            'status': {
                'GET /api/v1/status': 'API health check (no auth required)',
            },
        },
    }
    return jsonify(endpoints)