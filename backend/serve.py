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

    @app.route('/test')
    def serve_test():
        from flask import Response
        html = """<!DOCTYPE html><html><head><meta charset=UTF-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<style>body{background:#0a1628;color:#e0e0e0;font-family:monospace;padding:20px;font-size:15px}
.ok{color:#4ade80}.fail{color:#f87171}.warn{color:#fbbf24}
h2{color:#60a5fa;margin-top:20px}pre{white-space:pre-wrap;word-break:break-all}</style>
</head><body>
<h2>Browser Capability Test</h2>
<div id=ua></div><div id=out></div>
<script>
document.getElementById('ua').textContent = navigator.userAgent;
var out = document.getElementById('out');
function row(name, ok, detail) {
  var el = document.createElement('div');
  el.className = ok ? 'ok' : 'fail';
  el.textContent = (ok ? '✓ ' : '✗ ') + name + (detail ? ' — ' + detail : '');
  out.appendChild(el);
}
// Feature tests
row('Promises', typeof Promise !== 'undefined');
row('fetch', typeof fetch !== 'undefined');
row('async/await', (function(){try{eval('(async function(){})()');return true}catch(e){return false}})());
row('Optional chaining ?.', (function(){try{eval('({})?.x');return true}catch(e){return false}})(), 'needed for app');
row('Nullish coalescing ??', (function(){try{eval('null??1');return true}catch(e){return false}})(), 'needed for app');
row('WeakRef', typeof WeakRef !== 'undefined', 'needed by React 19');
row('FinalizationRegistry', typeof FinalizationRegistry !== 'undefined');
row('Object spread', (function(){try{eval('var x={...{}}');return true}catch(e){return false}})());
row('ES modules type=module', (function(){try{var s=document.createElement('script');return 'noModule' in s}catch(e){return false}})());
row('CSS custom properties', (function(){try{var s=document.createElement('style');s.textContent=':root{--x:1}';document.head.appendChild(s);var ok=getComputedStyle(document.documentElement).getPropertyValue('--x').trim()==='1';document.head.removeChild(s);return ok}catch(e){return false}})());
row('localStorage', (function(){try{localStorage.setItem('_t','1');localStorage.removeItem('_t');return true}catch(e){return false}})());
row('ServiceWorker', 'serviceWorker' in navigator);
// Try loading the actual legacy bundle
var h2=document.createElement('h2'); h2.textContent='Legacy Bundle Load Test'; out.appendChild(h2);
var start=Date.now();
window.onerror=function(m,s,l,c,e){
  row('LEGACY BUNDLE ERROR', false, m + ' at line ' + l);
};
window.addEventListener('unhandledrejection',function(e){
  row('UNHANDLED REJECTION', false, String(e.reason).slice(0,120));
});
</script>
<script nomodule crossorigin src="/assets/polyfills-legacy-CLaWmHYi.js"
  onerror="document.getElementById('out').innerHTML+='<div class=fail>✗ polyfills-legacy failed to load</div>'">
</script>
</body></html>"""
        return Response(html, mimetype='text/html')

    @app.route('/debug')
    def serve_debug():
        """Index.html with a visible JS error overlay — for diagnosing old-browser issues."""
        from flask import Response
        html = open(str(DIST_DIR / 'index.html')).read()
        overlay = """
<style>#_err{position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0a0a;color:#ff6b6b;
font-family:monospace;font-size:14px;padding:20px;overflow:auto;z-index:99999;display:none;
white-space:pre-wrap;word-break:break-all}</style>
<div id="_err"><b>JS ERRORS:</b>\n</div>
<script>
window.onerror=function(m,s,l,c,e){
  var d=document.getElementById('_err');d.style.display='block';
  d.innerText+=m+'\\nat '+s+':'+l+'\\n\\n';return false;
};
window.addEventListener('unhandledrejection',function(e){
  var d=document.getElementById('_err');d.style.display='block';
  d.innerText+='UNHANDLED: '+(e.reason||e)+'\\n\\n';
});
</script>"""
        html = html.replace('<div id="root">', overlay + '<div id="root">', 1)
        return Response(html, mimetype='text/html')
    
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
