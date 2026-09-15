#!/bin/bash
# Quick dev helper: restart Chromium with the extension from this checkout.
# Usage:
#   ./dev.sh          – kill chromium, relaunch
#   ./dev.sh -r       – kill, relaunch + open chrome://extensions for reload
#   ./dev.sh -d       – kill, relaunch with remote debugging (port 9222)

set -euo pipefail
cd "$(dirname "$0")"

EXT_PATH="$PWD/extension"
DEBUG_PORT=""
EXTRA_FLAGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -r|--reload)   EXTRA_FLAGS+=("chrome://extensions"); shift ;;
    -d|--debug)    DEBUG_PORT=9222; shift ;;
    *)             echo "Usage: $0 [-r|--reload] [-d|--debug]" >&2; exit 1 ;;
  esac
done

echo "Killing Chromium..."
pkill -x chromium 2>/dev/null || true
sleep 2

if [[ -n "$DEBUG_PORT" ]]; then
  echo "Relaunching with remote debugging on port $DEBUG_PORT..."
  chromium \
    --remote-debugging-port="$DEBUG_PORT" \
    --disable-features=DisableLoadExtensionCommandLineSwitch \
    "${EXTRA_FLAGS[@]}" &>/dev/null &
else
  echo "Relaunching..."
  chromium "${EXTRA_FLAGS[@]}" &>/dev/null &
fi

echo "PID: $!"
echo "Extension path: $EXT_PATH"
echo "→ DevTools Console → filter 'omarchy' to see logs"
