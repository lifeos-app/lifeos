/**
 * Realm Screenshot Button — Camera icon button + preview modal
 *
 * Positioned in the top-right area of RealmEntry HUD.
 * Captures, previews, shares, and downloads realm screenshots.
 */

import { useState, useCallback } from 'react';
import { Camera, Share2, Download, X } from 'lucide-react';
import {
  captureRealmScreenshot,
  shareScreenshot,
  downloadScreenshot,
} from '../lib/realm-screenshot';
import { showToast } from './Toast';

interface RealmScreenshotButtonProps {
  /** Player level for watermark */
  playerLevel: number;
  /** CSS selector for the realm canvas element */
  canvasSelector?: string;
}

export function RealmScreenshotButton({
  playerLevel,
  canvasSelector = '.realm-canvas',
}: RealmScreenshotButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleCapture = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);

    try {
      const dataUrl = await captureRealmScreenshot(
        canvasSelector,
        playerLevel,
      );
      setPreviewUrl(dataUrl);
      setModalOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Capture failed';
      showToast(msg, 'camera', '#FF4444');
    } finally {
      setCapturing(false);
    }
  }, [canvasSelector, playerLevel, capturing]);

  const handleShare = useCallback(async () => {
    if (!previewUrl || sharing) return;
    setSharing(true);

    try {
      const result = await shareScreenshot(previewUrl);
      if (result === 'shared') {
        showToast('Screenshot shared', 'share2', '#00D4FF');
      } else if (result === 'copied') {
        showToast('Copied to clipboard', 'clipboard', '#00D4FF');
      } else {
        showToast('Share not available — try Download', 'alert-circle', '#FF8800');
      }
    } catch {
      showToast('Share failed', 'camera', '#FF4444');
    } finally {
      setSharing(false);
    }
  }, [previewUrl, sharing]);

  const handleDownload = useCallback(() => {
    if (!previewUrl) return;
    downloadScreenshot(previewUrl);
    showToast('Screenshot saved', 'download', '#00D4FF');
  }, [previewUrl]);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setPreviewUrl(null);
  }, []);

  return (
    <>
      {/* Camera button in HUD */}
      <button
        className="realm-hud-btn realm-screenshot-btn"
        onClick={handleCapture}
        disabled={capturing}
        title="Capture realm screenshot"
        aria-label="Capture realm screenshot"
      >
        <Camera size={16} />
        {capturing && <span className="realm-screenshot-spinner" />}
      </button>

      {/* Preview Modal */}
      {modalOpen && previewUrl && (
        <div className="realm-screenshot-overlay" onClick={handleClose}>
          <div
            className="realm-screenshot-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="realm-screenshot-modal-header">
              <span className="realm-screenshot-modal-title">Realm Screenshot</span>
              <button
                className="realm-screenshot-modal-close"
                onClick={handleClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Preview image */}
            <div className="realm-screenshot-modal-preview">
              <img
                src={previewUrl}
                alt="Realm screenshot preview"
                className="realm-screenshot-modal-img"
              />
            </div>

            {/* Actions */}
            <div className="realm-screenshot-modal-actions">
              <button
                className="realm-screenshot-action-btn realm-screenshot-share-btn"
                onClick={handleShare}
                disabled={sharing}
              >
                <Share2 size={16} />
                <span>{sharing ? 'Sharing...' : 'Share'}</span>
              </button>
              <button
                className="realm-screenshot-action-btn realm-screenshot-download-btn"
                onClick={handleDownload}
              >
                <Download size={16} />
                <span>Download</span>
              </button>
              <button
                className="realm-screenshot-action-btn realm-screenshot-cancel-btn"
                onClick={handleClose}
              >
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}