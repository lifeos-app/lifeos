#!/usr/bin/env bash
# LifeOS — Android APK build script
# Installs Android SDK if needed, then builds a debug APK.
# Run from the lifeos project root on any Linux machine.
#
# Usage:
#   ./build-android.sh          # first-time: installs SDK + builds
#   ./build-android.sh --build  # skip SDK install, just build
#   ./build-android.sh --release # build release APK (requires signing)

set -e
cd "$(dirname "$0")"

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/.android-sdk}"
CMDLINE_TOOLS_VERSION="11076708"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"
BUILD_TOOLS_VERSION="34.0.0"
PLATFORM="android-34"

echo "=== LifeOS Android Build ==="
echo "SDK root: $ANDROID_SDK_ROOT"

# ── Step 1: Install Java if missing ─────────────────────────────────────────
if ! command -v java &>/dev/null; then
  echo "[+] Installing OpenJDK 17..."
  sudo apt-get update -q && sudo apt-get install -y openjdk-17-jdk
fi
echo "[✓] Java: $(java -version 2>&1 | head -1)"

# ── Step 2: Install Android SDK command-line tools ──────────────────────────
if [ "$1" != "--build" ] && [ ! -d "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin" ]; then
  echo "[+] Downloading Android command-line tools..."
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  TMP=$(mktemp -d)
  curl -fsSL "$CMDLINE_TOOLS_URL" -o "$TMP/cmdline-tools.zip"
  unzip -q "$TMP/cmdline-tools.zip" -d "$TMP"
  mv "$TMP/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  rm -rf "$TMP"
  echo "[✓] Command-line tools installed"
fi

export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"

# ── Step 3: Accept licenses + install build tools ──────────────────────────
if [ "$1" != "--build" ] && [ ! -d "$ANDROID_SDK_ROOT/build-tools/$BUILD_TOOLS_VERSION" ]; then
  echo "[+] Installing Android SDK components..."
  yes | sdkmanager --licenses >/dev/null 2>&1 || true
  sdkmanager "platform-tools" "platforms;${PLATFORM}" "build-tools;${BUILD_TOOLS_VERSION}"
  echo "[✓] SDK components installed"
fi

# ── Step 4: Build the web app ────────────────────────────────────────────────
echo "[+] Building web app (CAPACITOR_ENV=1)..."
CAPACITOR_ENV=1 npm run build

# ── Step 5: Sync Capacitor ───────────────────────────────────────────────────
echo "[+] Syncing Capacitor..."
npx cap sync android

# ── Step 6: Build APK ───────────────────────────────────────────────────────
cd android
if [ "$1" = "--release" ]; then
  echo "[+] Building RELEASE APK..."
  ./gradlew assembleRelease
  APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
  echo ""
  echo "=== Release APK built ==="
  echo "Path: android/$APK_PATH"
  echo "NOTE: Sign with: apksigner sign --ks your-keystore.jks $APK_PATH"
else
  echo "[+] Building DEBUG APK..."
  ./gradlew assembleDebug
  APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
  echo ""
  echo "=== Debug APK built ==="
  APK_FULL="$(dirname "$0")/android/$APK_PATH"
  echo "Path: $APK_FULL"
  echo ""
  echo "Install on Pendo via ADB:"
  echo "  adb devices"
  echo "  adb install -r \"$APK_FULL\""
fi
