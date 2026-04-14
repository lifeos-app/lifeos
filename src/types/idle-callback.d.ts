/**
 * idle-callback.d.ts — Type declarations for requestIdleCallback
 *
 * requestIdleCallback is well-supported but not in TypeScript's default lib.
 * This provides the types needed for our performance-optimized deferred work.
 */

interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

declare function requestIdleCallback(
  callback: (deadline: IdleDeadline) => void,
  options?: { timeout?: number },
): number;

declare function cancelIdleCallback(handle: number): void;