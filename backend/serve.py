#!/usr/bin/env python3
"""
LifeOS Local Server — Single-process, one-click launcher.

Serves both the Flask API and the built frontend from one process.
No external servers, no internet required.

Usage:
    python3 serve.py              # Start server + open browser
    python3 serve.py --no-open    # Start server only
    python3 serve.py --port 9000  # Custom port
"""

import os
import sys
import time
import signal
import argparse
import subprocess
import threading
from pathlib import Path

# ── Paths ──
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_DIR = SCRIPT_DIR.parent
DIST_DIR = PROJECT_DIR / 'dist'

def build_if_needed():
    """Build the frontend if dist/ doesn't exist or is stale."""
    index = DIST_DIR / 'index.html'
    if not index.exists():
        print("📦 Frontend not built yet. Building...")
        result = subprocess.run(
            ['npm', 'run', 'build'],
            cwd=str(PROJECT_DIR),
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"❌ Build failed:\n{result.stderr[-500:]}")
            sys.exit(1)
        print("✅ Build complete!")
    return True

def patch_app_for_static():
    """Import the Flask app and add static file serving for the built frontend."""
    sys.path.insert(0, str(SCRIPT_DIR))
    from app import app
    
    # Serve built frontend files
    from flask import send_from_directory, send_file
    
    @app.route('/')
    def serve_index():
        return send_file(str(DIST_DIR / 'index.html'))
    
    @app.route('/<path:path>')
    def serve_static(path):
        # Try to serve as static file from dist/
        file_path = DIST_DIR / path
        if file_path.is_file():
            return send_from_directory(str(DIST_DIR), path)
        # SPA fallback — return index.html for all unmatched routes
        # (but not /api/* which are handled by Flask routes above)
        if not path.startswith('api/'):
            return send_file(str(DIST_DIR / 'index.html'))
        # If we get here, it's an unknown API route
        return {"error": "Not found"}, 404
    
    return app

def open_browser(port):
    """Open the app in Chromium app mode (no browser chrome)."""
    time.sleep(2)  # Wait for server to start
    url = f'http://localhost:{port}'
    
    # Try Chromium in app mode first (cleanest experience)
    chromium_paths = [
        '/snap/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
    ]
    for browser in chromium_paths:
        if os.path.exists(browser):
            try:
                subprocess.Popen([
                    browser,
                    f'--app={url}',
                    '--no-first-run',
                    '--disable-default-apps',
                    f'--user-data-dir=/tmp/lifeos-browser',
                    '--window-size=1280,800',
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return
            except Exception:
                continue
    
    # Fallback: xdg-open
    try:
        subprocess.Popen(['xdg-open', url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        print(f"  Open manually: {url}")

def main():
    parser = argparse.ArgumentParser(description='LifeOS Local Server')
    parser.add_argument('--port', type=int, default=8080, help='Port (default: 8080)')
    parser.add_argument('--no-open', action='store_true', help="Don't open browser")
    parser.add_argument('--no-build', action='store_true', help="Skip build check")
    args = parser.parse_args()
    
    print("🎮 LifeOS — Command Center")
    print("═" * 40)
    
    # Build check
    if not args.no_build:
        build_if_needed()
    
    # Patch Flask app to serve frontend
    app = patch_app_for_static()
    
    # Open browser in background
    if not args.no_open:
        threading.Thread(target=open_browser, args=(args.port,), daemon=True).start()
    
    print(f"  URL: http://localhost:{args.port}")
    print(f"  Database: ~/.lifeos/data.db")
    print("=" * 40)
    print("  Press Ctrl+C to stop")
    print()

    # Graceful shutdown on SIGINT/SIGTERM
    def handle_signal(sig, frame):
        print("\nShutting down...")
        sys.exit(0)
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # Run Flask (no debug in production mode)
    app.run(host='0.0.0.0', port=args.port, debug=False)

if __name__ == '__main__':
    main()
