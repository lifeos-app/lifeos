import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies before importing
vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('../../utils/error', () => ({
  getErrorMessage: (e: unknown) => {
    if (e instanceof Error) return e.message
    if (typeof e === 'string') return e
    if (e && typeof e === 'object' && 'message' in e) return String((e as any).message)
    return 'An unknown error occurred'
  },
}))

import { classifyError, handleError, handleErrorWithRetry } from '../error-handler'
import { logger } from '../../utils/logger'

// ── classifyError ─────────────────────────────────────────────

describe('classifyError', () => {
  it('classifies TypeError with network message as network error', () => {
    const err = new TypeError('Failed to fetch')
    const result = classifyError(err)
    expect(result.category).toBe('network')
    expect(result.message).toBe('Connection lost. Trying again automatically.')
    expect(result.retryCount).toBe(0)
    expect(result.maxRetries).toBe(3)
  })

  it('classifies TypeError with timeout message as network error', () => {
    const err = new TypeError('Request timed out')
    const result = classifyError(err)
    expect(result.category).toBe('network')
  })

  it('classifies TypeError with other message as unknown (no network pattern match)', () => {
    const err = new TypeError('Cannot read properties of undefined')
    const result = classifyError(err)
    expect(result.category).toBe('unknown')
  })

  it('classifies Supabase code 42501 as permission error', () => {
    const err = { code: '42501', message: 'Insufficient privilege' }
    const result = classifyError(err)
    expect(result.category).toBe('permission')
    expect(result.message).toBe('You do not have permission for this action.')
  })

  it('classifies Supabase code 23505 as validation error', () => {
    const err = { code: '23505', message: 'Unique violation' }
    const result = classifyError(err)
    expect(result.category).toBe('validation')
    expect(result.message).toBe('Please check the highlighted fields.')
  })

  it('classifies Supabase code PGRST301 as permission error', () => {
    const err = { code: 'PGRST301', message: 'RLS policy violation' }
    const result = classifyError(err)
    expect(result.category).toBe('permission')
  })

  it('classifies HTTP status 401 as auth error', () => {
    const err = { status: 401, message: 'Unauthorized' }
    const result = classifyError(err)
    expect(result.category).toBe('auth')
    expect(result.message).toBe('Session expired. Redirecting to login.')
  })

  it('classifies HTTP status 403 as permission error', () => {
    const err = { status: 403, message: 'Forbidden' }
    const result = classifyError(err)
    expect(result.category).toBe('permission')
  })

  it('classifies HTTP status 429 as network error', () => {
    const err = { status: 429, message: 'Too many requests' }
    const result = classifyError(err)
    expect(result.category).toBe('network')
  })

  it('classifies HTTP status 500 as network error', () => {
    const err = { statusCode: 500, message: 'Internal server error' }
    const result = classifyError(err)
    expect(result.category).toBe('network')
  })

  it('classifies string message with auth pattern', () => {
    const err = new Error('JWT expired')
    const result = classifyError(err)
    expect(result.category).toBe('auth')
  })

  it('classifies string message with validation pattern', () => {
    const err = new Error('Required field missing')
    const result = classifyError(err)
    expect(result.category).toBe('validation')
  })

  it('classifies string message with save pattern', () => {
    const err = new Error('Save failed for record')
    const result = classifyError(err)
    expect(result.category).toBe('save')
    expect(result.maxRetries).toBe(3)
  })

  it('classifies string message with permission pattern', () => {
    const err = new Error('Access denied for this resource')
    const result = classifyError(err)
    expect(result.category).toBe('permission')
  })

  it('classifies string message with network pattern (non-TypeError)', () => {
    const err = new Error('Network connection lost')
    const result = classifyError(err)
    expect(result.category).toBe('network')
  })

  it('classifies string error as unknown', () => {
    const result = classifyError('something went wrong')
    expect(result.category).toBe('unknown')
    expect(result.message).toBe('An unexpected error occurred.')
  })

  it('classifies plain objects without known codes as unknown', () => {
    const err = { message: 'custom error', code: 'UNKNOWN_CODE' }
    const result = classifyError(err)
    expect(result.category).toBe('unknown')
  })

  it('classifies nested Supabase error code via error.code path', () => {
    const err = { error: { code: '23503' }, message: 'Foreign key violation' }
    const result = classifyError(err)
    expect(result.category).toBe('validation')
  })

  it('prioritizes Supabase code over message pattern', () => {
    // Code says validation, message might match network pattern
    const err = { code: '23502', message: 'Network error but code says validation' }
    const result = classifyError(err)
    expect(result.category).toBe('validation')
  })

  it('prioritizes HTTP status over message pattern', () => {
    const err = { status: 401, message: 'Could not save the data' }
    const result = classifyError(err)
    expect(result.category).toBe('auth')
  })
})

// ── handleError ────────────────────────────────────────────────

describe('handleError', () => {
  it('returns a HandledError with correct category and message', () => {
    const err = new Error('Unauthorized access')
    const result = handleError(err)
    expect(result.category).toBe('auth')
    expect(result.message).toBe('Session expired. Redirecting to login.')
  })

  it('includes context in logging', () => {
    const err = new Error('Unauthorized')
    handleError(err, 'AuthCheck')
    // Should have called logger.error (auth is non-validation)
    expect(logger.error).toHaveBeenCalled()
  })

  it('uses logger.log for validation errors', () => {
    ;(logger.log as ReturnType<typeof vi.fn>).mockClear()
    ;(logger.error as ReturnType<typeof vi.fn>).mockClear()
    const err = new Error('Validation failed for input')
    handleError(err)
    expect(logger.log).toHaveBeenCalled()
  })

  it('passes through all HandledError fields', () => {
    const err = new TypeError('Failed to fetch')
    const result = handleError(err)
    expect(result.category).toBe('network')
    expect(result.retryCount).toBe(0)
    expect(result.maxRetries).toBe(3)
    expect(result.detail).toBeDefined()
  })
})

// ── handleErrorWithRetry ────────────────────────────────────────

describe('handleErrorWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(logger.log as ReturnType<typeof vi.fn>).mockClear()
    ;(logger.warn as ReturnType<typeof vi.fn>).mockClear()
    ;(logger.error as ReturnType<typeof vi.fn>).mockClear()
  })

  // Reset timers after each test to avoid state leakage
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns immediately for validation errors without retrying', async () => {
    const err = new Error('Validation failed')
    const retryFn = vi.fn()
    const result = await handleErrorWithRetry(err, retryFn)
    expect(result.category).toBe('validation')
    expect(retryFn).not.toHaveBeenCalled()
  })

  it('returns immediately for unknown errors without retrying', async () => {
    const err = new Error('Something totally unexpected')
    const result = await handleErrorWithRetry(err, vi.fn())
    expect(result.category).toBe('unknown')
  })

  it('redirects to login for auth errors', async () => {
    const err = new Error('JWT expired')
    const mockLocation = { href: '' }
    Object.defineProperty(globalThis, 'window', {
      value: { location: mockLocation },
      writable: true,
      configurable: true,
    })
    const result = await handleErrorWithRetry(err, vi.fn())
    expect(result.category).toBe('auth')
  })

  it('returns immediately for permission errors without retrying', async () => {
    const err = new Error('Permission denied')
    const retryFn = vi.fn()
    const result = await handleErrorWithRetry(err, retryFn)
    expect(result.category).toBe('permission')
    expect(retryFn).not.toHaveBeenCalled()
  })

  it('retries network error and succeeds on first attempt', async () => {
    const err = new TypeError('Failed to fetch')
    const retryFn = vi.fn().mockResolvedValue(undefined)
    const promise = handleErrorWithRetry(err, retryFn)
    // Advance timers for first retry delay (1000ms)
    await vi.advanceTimersByTimeAsync(1500)
    const result = await promise
    expect(retryFn).toHaveBeenCalledTimes(1)
    expect(result.retryCount).toBe(1)
    expect(result.message).toBe('Connection restored.')
  })

  it('retries network error with exponential backoff and exhausts retries', async () => {
    const err = new TypeError('Failed to fetch')
    const retryFn = vi.fn().mockRejectedValue(new Error('Still offline'))
    const promise = handleErrorWithRetry(err, retryFn)
    // Advance through all 3 retry delays (1s, 2s, 4s)
    await vi.advanceTimersByTimeAsync(10000)
    const result = await promise
    expect(retryFn).toHaveBeenCalledTimes(3)
    expect(result.retryCount).toBe(3)
    expect(result.message).toContain('Could not reconnect')
  })

  it('retries save error and succeeds on second attempt', async () => {
    const err = new Error('Save failed for record')
    let callCount = 0
    const retryFn = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('Still failing'))
      return Promise.resolve()
    })
    const promise = handleErrorWithRetry(err, retryFn)
    // First retry delay 1s
    await vi.advanceTimersByTimeAsync(2000)
    // Second retry delay 2s
    await vi.advanceTimersByTimeAsync(3000)
    const result = await promise
    expect(result.message).toBe('Save succeeded on retry.')
    expect(result.retryCount).toBe(2)
  })

  it('stops retrying if reclassified as auth on retry', async () => {
    const err = new TypeError('Failed to fetch')
    const retryFn = vi.fn().mockRejectedValue(new Error('JWT expired'))
    const mockLocation = { href: '' }
    Object.defineProperty(globalThis, 'window', {
      value: { location: mockLocation },
      writable: true,
      configurable: true,
    })
    const promise = handleErrorWithRetry(err, retryFn)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result.category).toBe('auth')
    expect(retryFn).toHaveBeenCalledTimes(1) // stopped after auth detected
  })

  it('stops retrying if reclassified as permission on retry', async () => {
    const err = new TypeError('Failed to fetch')
    const retryFn = vi.fn().mockRejectedValue(new Error('Permission denied'))
    const promise = handleErrorWithRetry(err, retryFn)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result.category).toBe('permission')
    expect(retryFn).toHaveBeenCalledTimes(1) // stopped after permission detected
  })

  it('includes retry function in result when all retries exhausted', async () => {
    const err = new TypeError('Failed to fetch')
    const retryFn = vi.fn().mockRejectedValue(new Error('Still offline'))
    const promise = handleErrorWithRetry(err, retryFn)
    await vi.advanceTimersByTimeAsync(10000)
    const result = await promise
    expect(result.retry).toBe(retryFn)
  })
})