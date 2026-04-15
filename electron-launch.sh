#!/bin/bash
# LifeOS Electron Launcher — Jetson Orin Nano
# Starts LifeOS as an Electron desktop app with GPU workarounds for ARM.
# Also registers the lifeos:// protocol handler for OAuth deep links.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure frontend is built
if [ ! -f dist/index.html ]; then
  echo "[lifeos] Building frontend for Electron..."
  ELECTRON_ENV=1 npm run build:desktop
fi

# Register lifeos:// protocol handler (needed for Google OAuth deep link)
DESKTOP_FILE="$HOME/.local/share/applications/lifeos.desktop"
mkdir -p "$HOME/.local/share/applications"

cat > "$DESKTOP_FILE" << 'DESKTOP_EOF'
[Desktop Entry]
Name=LifeOS
Comment=LifeOS Command Center — Your life, gamified
Exec=/mnt/data/tmp/lifeos/electron-launch.sh %u
Icon=/home/tewedros/.local/share/icons/lifeos.png
Type=Application
Categories=Productivity;Utility;
MimeType=x-scheme-handler/lifeos;
StartupNotify=true
SingleInstance=true
DESKTOP_EOF

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
xdg-mime default lifeos.desktop x-scheme-handler/lifeos 2>/dev/null || true

echo "[lifeos] Starting LifeOS Electron..."
echo "═══════════════════════════════════════"
echo "  Database: ~/.lifeos/data.db"
echo "  Press Ctrl+C to stop"
echo "═══════════════════════════════════════"

# Launch Electron with Jetson ARM GPU flags
exec npx electron . --no-sandbox "$@"