/**
 * Error Utilities — LifeOS
 *
 * Safe error message extraction for catch (err: unknown) blocks.
 */

/** Extract a human-readable message from an unknown caught value. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'An unknown error occurred';
}

/** Check if an error is an AbortError. */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}
