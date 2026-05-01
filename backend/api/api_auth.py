"""
LifeOS Public API — Authentication Middleware

API key generation, validation, scope-based permissions,
key rotation, and usage tracking / rate limiting.
"""

import hashlib
import hmac
import os
import json
import time
import uuid
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g

# ── Constants ──────────────────────────────────────────────────────────

API_KEYS_FILE = os.path.join(os.path.expanduser('~'), '.lifeos', 'api_keys.json')

# Rate limit: 100 requests per minute per key
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 100

# Valid scopes
VALID_SCOPES = {'read', 'write', 'admin'}

# Scope hierarchy: admin > write > read
SCOPE_LEVEL = {'read': 1, 'write': 2, 'admin': 3}


# ── API Key Generation ────────────────────────────────────────────────

def generate_api_key(prefix='lk_live'):
    """Generate a new API key with a readable prefix.

    Format: {prefix}_{32_random_hex_chars}
    Example: lk_live_a1b2c3d4e5f6...
    """
    random_part = uuid.uuid4().hex + uuid.uuid4().hex
    return f'{prefix}_{random_part[:32]}'


def generate_key_secret():
    """Generate a secret key for HMAC webhook verification.

    This is a separate secret from the API key itself —
    used for signing webhook payloads.
    """
    return 'whsec_' + uuid.uuid4().hex + uuid.uuid4().hex


# ── Key Storage ───────────────────────────────────────────────────────

def _load_keys():
    """Load API keys from JSON file, creating it if needed."""
    if not os.path.exists(API_KEYS_FILE):
        return []
    try:
        with open(API_KEYS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def _save_keys(keys):
    """Persist API keys to JSON file."""
    os.makedirs(os.path.dirname(API_KEYS_FILE), exist_ok=True)
    with open(API_KEYS_FILE, 'w') as f:
        json.dump(keys, f, indent=2, default=str)


def get_all_keys():
    """Return all API keys (secrets masked)."""
    keys = _load_keys()
    result = []
    for k in keys:
        masked = {**k}
        # Mask the key for display — show first 12 chars + ...
        if 'key' in masked:
            masked['key'] = masked['key'][:12] + '...' + masked['key'][-4:]
        result.append(masked)
    return result


def get_key_record(key_value):
    """Look up a key record by its full key value."""
    keys = _load_keys()
    for k in keys:
        if k.get('key') == key_value:
            return k
    return None


def create_key(name='Default', scopes=None):
    """Create a new API key.

    Args:
        name: Human-readable name for the key
        scopes: List of scope strings (e.g. ['read', 'write'])

    Returns:
        Dict with key info including the full key (only shown once)
    """
    if scopes is None:
        scopes = ['read', 'write']

    # Validate scopes
    scopes = [s for s in scopes if s in VALID_SCOPES]
    if not scopes:
        scopes = ['read']

    key_value = generate_api_key()
    secret = generate_key_secret()
    now = datetime.utcnow().isoformat() + 'Z'

    record = {
        'id': str(uuid.uuid4()),
        'key': key_value,
        'secret': secret,
        'name': name,
        'scopes': scopes,
        'enabled': True,
        'created_at': now,
        'last_used_at': None,
        'request_count': 0,
        'rotated_from': None,
    }

    keys = _load_keys()
    keys.append(record)
    _save_keys(keys)

    return record


def revoke_key(key_id):
    """Disable an API key by its ID."""
    keys = _load_keys()
    for k in keys:
        if k.get('id') == key_id:
            k['enabled'] = False
            k['revoked_at'] = datetime.utcnow().isoformat() + 'Z'
            _save_keys(keys)
            return True
    return False


def rotate_key(key_id):
    """Rotate an API key — creates new key, marks old as rotated.

    Returns the new key record (full key shown once), or None if not found.
    """
    keys = _load_keys()
    old_key = None
    old_idx = None

    for i, k in enumerate(keys):
        if k.get('id') == key_id:
            old_key = k
            old_idx = i
            break

    if old_key is None:
        return None

    # Create new key with same name and scopes
    new_key_value = generate_api_key()
    new_secret = generate_key_secret()
    now = datetime.utcnow().isoformat() + 'Z'

    new_record = {
        'id': str(uuid.uuid4()),
        'key': new_key_value,
        'secret': new_secret,
        'name': old_key.get('name', 'Rotated Key'),
        'scopes': old_key.get('scopes', ['read', 'write']),
        'enabled': True,
        'created_at': now,
        'last_used_at': None,
        'request_count': 0,
        'rotated_from': key_id,
    }

    # Mark old key as disabled
    old_key['enabled'] = False
    old_key['rotated_at'] = now
    old_key['replaced_by'] = new_record['id']

    keys[old_idx] = old_key
    keys.append(new_record)
    _save_keys(keys)

    return new_record


# ── Rate Limiting ──────────────────────────────────────────────────────

# In-memory rate limit tracking: {key_id: [(timestamp, ...), ...]}
_rate_limit_store = {}


def check_rate_limit(key_id):
    """Check if a key is within rate limits.

    Returns (allowed: bool, remaining: int, reset_at: int)
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    # Clean old entries
    if key_id in _rate_limit_store:
        _rate_limit_store[key_id] = [
            ts for ts in _rate_limit_store[key_id] if ts > window_start
        ]
    else:
        _rate_limit_store[key_id] = []

    current_count = len(_rate_limit_store[key_id])

    if current_count >= RATE_LIMIT_MAX:
        # Find when the oldest request in window expires
        oldest = min(_rate_limit_store[key_id]) if _rate_limit_store[key_id] else now
        reset_at = int(oldest + RATE_LIMIT_WINDOW)
        return False, 0, reset_at

    # Record this request
    _rate_limit_store[key_id].append(now)
    remaining = RATE_LIMIT_MAX - current_count - 1
    reset_at = int(now + RATE_LIMIT_WINDOW)

    return True, remaining, reset_at


# ── Usage Tracking ─────────────────────────────────────────────────────

def record_usage(key_id, endpoint, status_code):
    """Record API usage for analytics."""
    keys = _load_keys()
    for k in keys:
        if k.get('id') == key_id:
            k['last_used_at'] = datetime.utcnow().isoformat() + 'Z'
            k['request_count'] = k.get('request_count', 0) + 1
            break
    _save_keys(keys)

    # Also append to usage log file
    usage_log = os.path.join(os.path.expanduser('~'), '.lifeos', 'api_usage.jsonl')
    os.makedirs(os.path.dirname(usage_log), exist_ok=True)
    entry = {
        'key_id': key_id,
        'endpoint': endpoint,
        'status_code': status_code,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
    }
    with open(usage_log, 'a') as f:
        f.write(json.dumps(entry) + '\n')


def get_usage_stats(key_id=None, days=7):
    """Get usage statistics, optionally filtered by key.

    Returns dict with request counts, endpoint breakdown, etc.
    """
    usage_log = os.path.join(os.path.expanduser('~'), '.lifeos', 'api_usage.jsonl')
    if not os.path.exists(usage_log):
        return {
            'total_requests': 0,
            'endpoints': {},
            'status_codes': {},
            'daily': {},
        }

    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat() + 'Z'
    stats = {
        'total_requests': 0,
        'endpoints': {},
        'status_codes': {},
        'daily': {},
    }

    try:
        with open(usage_log, 'r') as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue

                # Filter by date
                if entry.get('timestamp', '') < cutoff:
                    continue
                # Filter by key
                if key_id and entry.get('key_id') != key_id:
                    continue

                stats['total_requests'] += 1

                # Endpoint breakdown
                ep = entry.get('endpoint', 'unknown')
                stats['endpoints'][ep] = stats['endpoints'].get(ep, 0) + 1

                # Status code breakdown
                sc = str(entry.get('status_code', 0))
                stats['status_codes'][sc] = stats['status_codes'].get(sc, 0) + 1

                # Daily breakdown
                day = entry.get('timestamp', '')[:10]
                stats['daily'][day] = stats['daily'].get(day, 0) + 1
    except IOError:
        pass

    return stats


# ── HMAC Signature Verification ────────────────────────────────────────

def verify_webhook_signature(payload_body, signature, secret):
    """Verify HMAC-SHA256 webhook signature.

    Args:
        payload_body: Raw request body bytes
        signature: Value from X-LifeOS-Signature header
        secret: The webhook secret for this key

    Returns:
        True if signature is valid, False otherwise
    """
    if not signature or not secret:
        return False

    expected = hmac.new(
        secret.encode('utf-8'),
        payload_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


# ── Flask Decorators ───────────────────────────────────────────────────

def require_api_key(min_scope='read'):
    """Decorator that requires a valid API key with sufficient scope.

    Extracts key from Authorization header or api_key query param.
    Also enforces rate limiting.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Extract API key
            api_key = None

            # Check Authorization header: Bearer lk_live_...
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                api_key = auth_header[7:].strip()
            elif auth_header.startswith('ApiKey '):
                api_key = auth_header[7:].strip()

            # Check query param
            if not api_key:
                api_key = request.args.get('api_key')

            # Check custom header
            if not api_key:
                api_key = request.headers.get('X-API-Key')

            if not api_key:
                return jsonify({
                    'error': {
                        'code': 'missing_api_key',
                        'message': 'API key required. Send via Authorization header (Bearer {key}), X-API-Key header, or api_key query parameter.',
                    }
                }), 401

            # Look up key
            key_record = get_key_record(api_key)
            if not key_record:
                return jsonify({
                    'error': {
                        'code': 'invalid_api_key',
                        'message': 'The provided API key is not valid.',
                    }
                }), 401

            if not key_record.get('enabled', True):
                return jsonify({
                    'error': {
                        'code': 'api_key_revoked',
                        'message': 'This API key has been revoked.',
                    }
                }), 401

            # Check scope
            key_scopes = key_record.get('scopes', ['read'])
            min_level = SCOPE_LEVEL.get(min_scope, 1)
            if not any(SCOPE_LEVEL.get(s, 0) >= min_level for s in key_scopes):
                return jsonify({
                    'error': {
                        'code': 'insufficient_scope',
                        'message': f'This API key does not have the required scope: {min_scope}. Current scopes: {", ".join(key_scopes)}',
                    }
                }), 403

            # Rate limiting
            allowed, remaining, reset_at = check_rate_limit(key_record['id'])
            if not allowed:
                return jsonify({
                    'error': {
                        'code': 'rate_limit_exceeded',
                        'message': f'Rate limit exceeded. Try again after {reset_at}.',
                    }
                }), 429, {
                    'Retry-After': str(reset_at - int(time.time())),
                    'X-RateLimit-Limit': str(RATE_LIMIT_MAX),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': str(reset_at),
                }

            # Store key info in request context
            g.api_key = key_record

            # Add rate limit headers to response
            response = f(*args, **kwargs)

            # Record usage (after successful request)
            record_usage(key_record['id'], request.path, response.status_code if hasattr(response, 'status_code') else 200)

            if isinstance(response, tuple):
                # Flask response tuple (response, status, headers)
                resp_obj = response[0]
                if hasattr(resp_obj, 'headers'):
                    resp_obj.headers['X-RateLimit-Limit'] = str(RATE_LIMIT_MAX)
                    resp_obj.headers['X-RateLimit-Remaining'] = str(remaining)
                    resp_obj.headers['X-RateLimit-Reset'] = str(reset_at)
                return response

            return response

        return decorated_function
    return decorator


def require_webhook_signature():
    """Decorator that validates webhook HMAC signatures.

    Looks for X-LifeOS-Signature header and validates against
    the key's webhook secret.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get the API key to find the webhook secret
            api_key = request.headers.get('X-API-Key', '')
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                api_key = auth_header[7:].strip()
            elif auth_header.startswith('ApiKey '):
                api_key = auth_header[7:].strip()

            key_record = get_key_record(api_key) if api_key else None

            # Also allow query param for webhooks
            if not api_key:
                api_key = request.args.get('api_key', '')
                key_record = get_key_record(api_key) if api_key else None

            signature = request.headers.get('X-LifeOS-Signature', '')

            # If no key found, check for webhook-specific auth
            # (some webhooks send their own auth headers)
            source = kwargs.get('source', '')

            if key_record:
                secret = key_record.get('secret', '')
                if not verify_webhook_signature(request.get_data(), signature, secret):
                    return jsonify({
                        'error': {
                            'code': 'invalid_signature',
                            'message': 'Webhook signature verification failed.',
                        }
                    }), 401
                g.api_key = key_record
            elif source:
                # For known webhooks (Strava, etc.), allow through for validation
                # The webhook handler itself will verify the source-specific signature
                g.webhook_source = source
            else:
                return jsonify({
                    'error': {
                        'code': 'missing_auth',
                        'message': 'Webhook endpoint requires API key or source-specific verification.',
                    }
                }), 401

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_current_key():
    """Get the current API key record from the request context."""
    return getattr(g, 'api_key', None)