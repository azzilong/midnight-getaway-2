#!/bin/sh
# Launch the local Chromium for Midnight Getaway dev work: headless with the
# Hatch WebGL policy (allow-list file + sha), file:// access for the game's
# ES modules, and a remote-debugging port for the CDP tools.
# Usage: tools/chrome.sh [url] [port]
set -e
URL="${1:-file://$HOME/workspace/makefun/repos/midnight-getaway-2/game/index.html}"
PORT="${2:-9333}"
ALLOW_FILE=/tmp/hatch-webgl-allowed-domains.txt
if [ ! -f "$ALLOW_FILE" ]; then
  cp "$HOME/workspace/makefun/webgl-domains.txt" "$ALLOW_FILE"
fi
SHA="$(sha256sum "$ALLOW_FILE" | cut -d' ' -f1)"
exec /opt/meta-chromium/chrome \
  --headless=new --no-sandbox --disable-gpu-sandbox \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --disable-dev-shm-usage --disable-features=LocalNetworkAccessChecks \
  --allow-file-access-from-files \
  --user-data-dir="/tmp/chrome-mg-shell-$(date +%s)" \
  --hatch-webgl-allowed-domains-file="$ALLOW_FILE" \
  --hatch-webgl-allowed-domains-sha256="$SHA" \
  --remote-debugging-port="$PORT" \
  --window-size=1280,720 \
  "$URL"
