#!/bin/bash
# LifeOS — Jetson Desktop Launcher
# Builds frontend, starts Flask API + Chromium (bypasses WebKitGTK)
#
# Usage:
#   ./start-jetson.sh              # Build + launch
#   ./start-jetson.sh --no-build   # Skip build, just launch
#   ./start-jetson.sh --no-open    # Launch server only (no browser)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Build frontend (unless --no-build) ──
if [[ "$*" != *"--no-build"* ]]; then
    if [ ! -f dist/index.html ] || [[ "$*" == *"--force-build"* ]]; then
        echo "Building frontend..."
        npm run build
        echo "Build complete."
    else
        echo "Frontend already built (dist/index.html exists). Use --force-build to rebuild."
    fi
fi

# ── Launch Flask backend + Chromium ──
echo "Starting LifeOS..."
exec python3 backend/serve.py "$@"
