/**
 * SettingsAbout — App version, build ID, links, and feedback
 */
import type { JSX } from 'react';
import { Info, ExternalLink, Github, MessageCircle } from 'lucide-react';

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
// Build ID derived from app version + timestamp — stable within a session
const BUILD_ID = (() => {
  try {
    const stored = sessionStorage.getItem('lifeos_build_id');
    if (stored) return stored;
    const id = `v${APP_VERSION}-${Date.now().toString(36).slice(-4)}`;
    sessionStorage.setItem('lifeos_build_id', id);
    return id;
  } catch {
    return `v${APP_VERSION}-local`;
  }
})();

export function SettingsAbout(): JSX.Element {
  return (
    <section className="set-section">
      <div className="set-section-header">
        <Info size={18} />
        <h2>About</h2>
      </div>
      <div className="set-about">
        <div className="set-about-row">
          <span>Version</span>
          <span className="set-about-value">{APP_VERSION}</span>
        </div>
        <div className="set-about-row">
          <span>Build ID</span>
          <span className="set-about-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>{BUILD_ID}</span>
        </div>
        <div className="set-about-row">
          <span>Built with</span>
          <span className="set-about-value">React 19 + Supabase + Love</span>
        </div>
        <div className="set-about-row">
          <span>Source</span>
          <a href="https://github.com" className="set-about-link" target="_blank" rel="noopener noreferrer">
            <Github size={12} /> GitHub <ExternalLink size={10} />
          </a>
        </div>
        <div className="set-about-row">
          <span>Feedback</span>
          <a href="mailto:feedback@lifeos.app" className="set-about-link" target="_blank" rel="noopener noreferrer">
            <MessageCircle size={12} /> Send Feedback <ExternalLink size={10} />
          </a>
        </div>
        <div className="set-about-row">
          <span>Help</span>
          <a href="https://lifeos.app/help" className="set-about-link" target="_blank" rel="noopener noreferrer">
            Help Center <ExternalLink size={10} />
          </a>
        </div>
      </div>
      <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
        "Know thyself." — The Oracle of Delphi
      </p>
    </section>
  );
}