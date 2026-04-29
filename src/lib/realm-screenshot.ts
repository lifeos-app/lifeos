/**
 * Realm Screenshot — Capture and share realm view as PNG
 *
 * Uses native canvas.toDataURL() since the Realm renders to an HTML5 Canvas.
 * No html2canvas dependency needed.
 */

// ── Types ──────────────────────────────────────────

export interface RealmScreenshotOptions {
  /** Output width in pixels (default: canvas actual width) */
  width?: number;
  /** Output height in pixels (default: canvas actual height) */
  height?: number;
  /** JPEG quality 0-1 (default: 1.0 for PNG) */
  quality?: number;
  /** Image format (default: 'image/png') */
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: Required<RealmScreenshotOptions> = {
  width: 0,   // 0 = use canvas native width
  height: 0,  // 0 = use canvas native height
  quality: 1.0,
  format: 'image/png',
};

// ── Local Storage ──────────────────────────────────

const STORAGE_KEY = 'lifeos_realm_screenshots';
const MAX_STORED = 5;

interface StoredScreenshot {
  dataUrl: string;
  timestamp: number;
}

function getStoredScreenshots(): StoredScreenshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeScreenshot(dataUrl: string): void {
  try {
    const shots = getStoredScreenshots();
    shots.unshift({ dataUrl, timestamp: Date.now() });
    // Keep only last MAX_STORED
    while (shots.length > MAX_STORED) {
      shots.pop();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shots));
  } catch {
    // localStorage may be full — silently ignore
  }
}

// ── Watermark ──────────────────────────────────────

/**
 * Adds a subtle watermark at the bottom of the image:
 * "LifeOS * Level {level} * {date}"
 */
function addWatermark(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  level: number,
): void {
  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const text = `LifeOS \u2022 Level ${level} \u2022 ${date}`;

  const fontSize = Math.max(12, Math.floor(canvas.height * 0.022));
  const padding = Math.max(8, Math.floor(canvas.height * 0.015));

  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.font = `${fontSize}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const textX = canvas.width / 2;
  const textY = canvas.height - padding;

  // Semi-transparent background bar
  const barHeight = fontSize + padding * 1.5;
  ctx.fillStyle = 'rgba(5, 14, 26, 0.6)';
  ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

  // Text
  ctx.fillStyle = '#00D4FF';
  ctx.fillText(text, textX, textY);
  ctx.restore();
}

// ── Capture ────────────────────────────────────────

/**
 * Capture the realm canvas as a PNG data URL with watermark overlay.
 *
 * @param canvasSelector CSS selector for the realm <canvas> element
 * @param level Player level for the watermark
 * @param options Screenshot options (width, height, quality, format)
 * @returns Promise<string> data URL of the screenshot
 */
export async function captureRealmScreenshot(
  canvasSelector: string,
  level: number = 1,
  options?: RealmScreenshotOptions,
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Find the source canvas
  const sourceCanvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
  if (!sourceCanvas) {
    throw new Error(`[realm-screenshot] Canvas not found: ${canvasSelector}`);
  }

  // Ensure the canvas has rendered content
  const srcWidth = sourceCanvas.width || sourceCanvas.clientWidth;
  const srcHeight = sourceCanvas.height || sourceCanvas.clientHeight;
  if (srcWidth === 0 || srcHeight === 0) {
    throw new Error('[realm-screenshot] Canvas has zero dimensions');
  }

  // Create an offscreen canvas for the final image
  const outWidth = opts.width || srcWidth;
  const outHeight = opts.height || srcHeight;

  const offscreen = document.createElement('canvas');
  offscreen.width = outWidth;
  offscreen.height = outHeight;

  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    throw new Error('[realm-screenshot] Could not get 2d context');
  }

  // Draw the game canvas
  ctx.drawImage(sourceCanvas, 0, 0, outWidth, outHeight);

  // Add watermark
  addWatermark(offscreen, ctx, level);

  // Export to data URL
  const format = opts.format;
  const quality = format === 'image/png' ? undefined : opts.quality;
  const dataUrl = offscreen.toDataURL(format, quality);

  // Store in recent screenshots
  storeScreenshot(dataUrl);

  return dataUrl;
}

// ── Share ──────────────────────────────────────────

/**
 * Share a screenshot using the Web Share API.
 * Falls back to copy-to-clipboard if Web Share is not available.
 *
 * @returns 'shared' | 'copied' | 'failed'
 */
export async function shareScreenshot(dataUrl: string): Promise<'shared' | 'copied' | 'failed'> {
  // Convert data URL to File for Web Share API
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return 'failed';

  const file = new File([blob], 'realm-screenshot.png', { type: 'image/png' });

  // Try Web Share API with files
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'My LifeOS Realm',
        text: 'Check out my Realm in LifeOS!',
      });
      return 'shared';
    } catch (err) {
      // User cancelled or share failed — fall through to clipboard
      if (err instanceof Error && err.name === 'AbortError') {
        return 'failed';
      }
    }
  }

  // Fallback: copy image to clipboard
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return 'copied';
  } catch {
    return 'failed';
  }
}

// ── Download ───────────────────────────────────────

/**
 * Download a screenshot as a PNG file.
 */
export function downloadScreenshot(
  dataUrl: string,
  filename?: string,
): void {
  const name = filename || `lifeos-realm-${Date.now()}.png`;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── Recent Screenshots ─────────────────────────────

/**
 * Get the list of recent screenshot data URLs (up to 5).
 */
export function getRecentScreenshots(): Array<{ dataUrl: string; timestamp: number }> {
  return getStoredScreenshots();
}

/**
 * Clear all stored screenshots from localStorage.
 */
export function clearRecentScreenshots(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Helpers ────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',');
    const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/png';
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}