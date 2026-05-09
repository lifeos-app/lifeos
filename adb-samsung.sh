#!/usr/bin/env bash
# adb-samsung.sh — Bridge Samsung SM-P605 to LifeOS via USB ADB
# Usage: ./adb-samsung.sh
#
# Prerequisites on Samsung:
#   Settings → About device → tap Build number 7× (enables Developer Options)
#   Settings → Developer Options → USB Debugging ON
#   Connect USB → accept RSA fingerprint on tablet

set -euo pipefail

FLASK_PORT=8080

echo "=== LifeOS ↔ Samsung ADB Bridge ==="
echo ""

# Install ADB if missing
if ! command -v adb &>/dev/null; then
  echo "[+] Installing android-tools-adb..."
  sudo apt-get install -y android-tools-adb
fi

echo "[+] Waiting for device..."
adb wait-for-device

DEVICE=$(adb devices | grep -v "^List" | grep "device$" | awk '{print $1}' | head -1)
if [ -z "$DEVICE" ]; then
  echo "[!] No authorized device found."
  echo "    Check the tablet — there should be a 'Allow USB debugging?' dialog."
  echo "    Tap 'Allow' then run this script again."
  exit 1
fi

echo "[+] Device: $DEVICE"
MODEL=$(adb -s "$DEVICE" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
ANDROID=$(adb -s "$DEVICE" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r')
echo "    Model: $MODEL  |  Android: $ANDROID"
echo ""

# Forward Jetson Flask port to tablet localhost
echo "[+] Forwarding Jetson :$FLASK_PORT → tablet localhost:$FLASK_PORT"
adb -s "$DEVICE" reverse tcp:$FLASK_PORT tcp:$FLASK_PORT

echo ""
echo "✓ Bridge active. On the Samsung:"
echo "  1. Open Chrome"
echo "  2. Navigate to:  http://localhost:$FLASK_PORT"
echo "  3. Tap the menu → 'Add to Home Screen' for a shortcut"
echo ""
echo "  S Pen tip: In LifeOS → Journal → tap [Ink] button to open the drawing canvas."
echo "  Draw your entry → tap [Transcribe] → AI reads it and adds text to your journal."
echo ""
echo "  Press Ctrl+C to stop the bridge (it persists until USB disconnect anyway)."

# Keep alive so the user sees the output; bridge persists in adb daemon
wait
