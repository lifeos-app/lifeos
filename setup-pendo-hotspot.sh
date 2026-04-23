#!/usr/bin/env bash
# setup-pendo-hotspot.sh
# Creates a WiFi hotspot on the Jetson so the Pendo tablet can connect directly.
# Prerequisites: ethernet cable plugged from Jetson into router.
# Run once; NetworkManager remembers the hotspot across reboots.

set -e

WIFI_IF="wlP1p1s0"
ETH_IF="enP8p1s0"
HOTSPOT_SSID="TeddyBot"
HOTSPOT_PASS="lifeos2026"
HOTSPOT_CON="pendo-hotspot"

echo "=== Pendo Hotspot Setup ==="

# ── 1. Verify ethernet has a carrier ────────────────────────────────────────
ETH_STATE=$(cat /sys/class/net/$ETH_IF/carrier 2>/dev/null || echo 0)
if [ "$ETH_STATE" != "1" ]; then
  echo ""
  echo "ERROR: No ethernet cable detected on $ETH_IF"
  echo "Please plug an ethernet cable from the Jetson into your router, then re-run."
  exit 1
fi
echo "[✓] Ethernet carrier detected on $ETH_IF"

# ── 2. Ensure ethernet connection is managed and up ─────────────────────────
nmcli device set "$ETH_IF" managed yes 2>/dev/null || true
nmcli device connect "$ETH_IF" 2>/dev/null || true
sleep 2

# Verify we get an IP via ethernet
ETH_IP=$(ip -4 addr show "$ETH_IF" | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1)
if [ -z "$ETH_IP" ]; then
  echo "[!] Waiting for DHCP on ethernet..."
  sleep 5
  ETH_IP=$(ip -4 addr show "$ETH_IF" | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1)
fi

if [ -z "$ETH_IP" ]; then
  echo "ERROR: Could not get IP via ethernet. Check the cable and router."
  exit 1
fi
echo "[✓] Ethernet IP: $ETH_IP"

# ── 3. Delete old hotspot config if it exists ───────────────────────────────
nmcli connection delete "$HOTSPOT_CON" 2>/dev/null || true

# ── 4. Disconnect WiFi from router ──────────────────────────────────────────
echo "[+] Disconnecting WiFi from router..."
nmcli device disconnect "$WIFI_IF" 2>/dev/null || true
sleep 1

# ── 5. Create the hotspot ────────────────────────────────────────────────────
echo "[+] Creating hotspot '$HOTSPOT_SSID'..."
nmcli device wifi hotspot \
  ifname "$WIFI_IF" \
  con-name "$HOTSPOT_CON" \
  ssid "$HOTSPOT_SSID" \
  password "$HOTSPOT_PASS" \
  band bg

# ── 6. Make hotspot auto-connect on boot ────────────────────────────────────
nmcli connection modify "$HOTSPOT_CON" connection.autoconnect yes
nmcli connection modify "$HOTSPOT_CON" connection.autoconnect-priority 10

sleep 2

# ── 7. Get hotspot IP (usually 10.42.0.1) ───────────────────────────────────
HOTSPOT_IP=$(ip -4 addr show "$WIFI_IF" | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1)
if [ -z "$HOTSPOT_IP" ]; then
  HOTSPOT_IP="10.42.0.1"
fi

echo ""
echo "=== Hotspot Active ==="
echo "  SSID:     $HOTSPOT_SSID"
echo "  Password: $HOTSPOT_PASS"
echo "  Jetson IP on hotspot: $HOTSPOT_IP"
echo ""
echo "On the Pendo:"
echo "  1. Go to Settings → WiFi"
echo "  2. Connect to '$HOTSPOT_SSID' with password '$HOTSPOT_PASS'"
echo "  3. Open browser → http://$HOTSPOT_IP:8080/pendo"
echo ""
echo "To start the dashboard server (if not already running):"
echo "  cd /mnt/data/tmp/lifeos && python3 backend/serve.py &"
echo ""

# ── 8. Enable IP forwarding so Pendo can reach internet via Jetson ───────────
sudo sysctl -w net.ipv4.ip_forward=1 >/dev/null
sudo iptables -t nat -C POSTROUTING -o "$ETH_IF" -j MASQUERADE 2>/dev/null || \
  sudo iptables -t nat -A POSTROUTING -o "$ETH_IF" -j MASQUERADE
echo "[✓] NAT enabled — Pendo will have internet access via Jetson's ethernet"

# Persist ip_forward across reboots
if ! grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf 2>/dev/null; then
  echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf >/dev/null
fi

echo "[✓] Done."
