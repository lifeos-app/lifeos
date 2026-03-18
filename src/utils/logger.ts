/**
 * logger.ts — Conditional Logging Utility
 *
 * Provides logging functions that only output in development mode.
 * Reduces production bundle size and prevents log spam.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.log('[component] Doing something');
 *   logger.warn('[component] Warning message');
 *   logger.error('[component] Error:', error); // Always logs
 */

const isDev = import.meta.env.DEV;

/**
 * Development-only console.log
 * Stripped from production builds
 */
export function log(...args: unknown[]): void {
  if (isDev) {
    console.log(...args);
  }
}

/**
 * Development-only console.warn
 * Use logger.warnProd() for production warnings
 */
export function warn(...args: unknown[]): void {
  if (isDev) {
    console.warn(...args);
  }
}

/**
 * Production-safe console.warn
 * Always logs, even in production
 */
export function warnProd(...args: unknown[]): void {
  console.warn(...args);
}

/**
 * Production-safe console.error
 * Always logs, even in production (errors should be visible)
 */
export function error(...args: unknown[]): void {
  console.error(...args);
}

/**
 * Development-only console.info
 */
export function info(...args: unknown[]): void {
  if (isDev) {
    console.info(...args);
  }
}

/**
 * Development-only console.debug
 */
export function debug(...args: unknown[]): void {
  if (isDev) {
    console.debug(...args);
  }
}

/**
 * Development-only console.table
 */
export function table(data: unknown): void {
  if (isDev) {
    console.table(data);
  }
}

/**
 * Logger object with all methods
 */
export const logger = {
  log,
  warn,
  warnProd,
  error,
  info,
  debug,
  table,
};

/**
 * Default export
 */
export default logger;
