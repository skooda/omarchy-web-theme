#!/bin/bash

# Build a Firefox-ready copy of the extension.
#
# Chrome and Firefox disagree on the MV3 background in a way Chrome's
# manifest schema can't share: Chrome requires `background.service_worker`
# and rejects `scripts`, Firefox (event pages, no service workers in MV3)
# requires `scripts` and reads `service_worker` as a plain dead key. One
# repo, one manifest carries `browser_specific_settings.gecko` (Chrome
# ignores unknown keys), and this build swaps only the background block.
#
# Usage: ./build-firefox.sh [dest]   (default dest: /tmp/omarchy-fx-ext)
#
# Env:
#   FX_UPDATE_URL  set browser_specific_settings.gecko.update_url (self-hosted
#                  updates.json). Omitted for dev builds, set by sign-firefox.sh.

set -euo pipefail
cd "$(dirname "$0")"

DEST="${1:-/tmp/omarchy-fx-ext}"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r extension/. "$DEST/"

FX_UPDATE_URL="${FX_UPDATE_URL:-}" python3 - "$DEST/manifest.json" <<'PY'
import json, os, sys

path = sys.argv[1]
with open(path) as f:
    manifest = json.load(f)
manifest["background"] = {"scripts": ["background.js"]}
# "key" pins the Chrome/Chromium extension ID; Firefox identifies add-ons by
# browser_specific_settings.gecko.id and has no use for the key.
manifest.pop("key", None)
gecko = manifest.setdefault("browser_specific_settings", {}).setdefault("gecko", {})
# AMO requires a data-collection declaration for every new submission; we
# collect nothing. Chrome ignores browser_specific_settings wholesale, so this
# only ever affects the Firefox listing.
gecko.setdefault("data_collection_permissions", {"required": ["none"]})
# Self-hosted auto-updates: Firefox polls this URL for updates.json. Only the
# release build sets it, so a dev/temporary install never phones home.
update_url = os.environ.get("FX_UPDATE_URL")
if update_url:
    gecko["update_url"] = update_url
with open(path, "w") as f:
    json.dump(manifest, f, indent=2)
print(f"Firefox manifest: event-page background, no Chrome key, gecko.id={gecko.get('id')}"
      + (f", update_url={update_url}" if update_url else ""))
PY

echo "Firefox extension built at $DEST"
