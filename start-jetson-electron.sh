#!/bin/bash
# LifeOS — Jetson Electron Desktop Launcher
# Builds frontend with ELECTRON_ENV, then launches Electron.
# Falls back to Flask + Chromium if Electron fails.
#
# Usage:
#   ./start-jetson-electron.sh              # Build + launch Electron
#   ./start-jetson-electron.sh --no-build   # Skip build, just launch
#   ./start-jetson-electron.sh --fallback   # Force Flask + Chromium mode

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Parse args ──
NO_BUILD=false
FORCE_FALLBACK=false
for arg in "$@"; do
  case "$arg" in
    --no-build)   NO_BUILD=true ;;
    --fallback)   FORCE_FALLBACK=true ;;
  esac
done

# ── Fallback to Flask + Chromium ──
if [ "$FORCE_FALLBACK" = true ]; then
  echo "Launching LifeOS (Flask + Chromium fallback)..."
  exec bash start-jetson.sh "$@"
fi

# ── Build frontend with Electron env ──
if [ "$NO_BUILD" = false ]; then
  if [ ! -f dist/index.html ] || [ "$1" = "--force-build" ]; then
    echo "Building frontend for Electron..."
    ELECTRON_ENV=1 npm run build:desktop
    echo "Build complete."
  else
    echo "Frontend already built. Use --force-build to rebuild."
  fi
fi

# ── Launch Electron ──
echo "Starting LifeOS (Electron)..."
echo "═══════════════════════════════════════"
echo "  Database: ~/.lifeos/data.db"
echo "  Press Ctrl+C to stop"
echo "═══════════════════════════════════════"

# Try Electron first
if command -v electron >/dev/null 2>&1; then
  exec electron .
elif npx --no-install electron --version >/dev/null 2>&1; then
  exec npx --no-install electron .
else
  echo "Electron not found. Falling back to Flask + Chromium..."
  exec bash start-jetson.sh --no-build "$@"
fi
