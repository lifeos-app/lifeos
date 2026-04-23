#!/usr/bin/env bash
# ADB helper for ARM64 Jetson → Pendo
# Handles the qemu self-fork issue by pre-starting the server manually.

QEMU=/mnt/data/tmp/android-sdk/qemu-x86_64-static
ADB_REAL=/mnt/data/tmp/android-sdk/platform-tools/adb.x86_64
ADB_WRAP=/mnt/data/tmp/android-sdk/platform-tools/adb
SYSROOT=/mnt/data/tmp/x86-sysroot
export QEMU_LD_PREFIX=$SYSROOT

# Ensure server is running
if ! ss -tlnp 2>/dev/null | grep -q ':5037'; then
  echo "[adb] Starting ADB server..."
  "$QEMU" "$ADB_REAL" fork-server server 2>/dev/null &
  sleep 1
fi

# Pass all args to the adb wrapper client
"$ADB_WRAP" "$@"
