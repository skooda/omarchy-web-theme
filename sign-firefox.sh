#!/bin/bash
# Build, package, and — with AMO API credentials — sign the Firefox add-on as an
# UNLISTED (self-distributed) add-on.
#
# "Unlisted" means AMO signs it but never publishes it: it is not searchable in
# the marketplace and you host the XPI yourself. That is what lets a normal
# (non-Developer-Edition) Firefox install it permanently without the extension
# ever appearing on addons.mozilla.org.
#
# One-time setup:
#   1. Create an AMO account:            https://addons.mozilla.org/
#   2. Create the add-on:                https://addons.mozilla.org/developers/addon/submit/on-your-own
#      Upload the UNSIGNED XPI this script writes to dist/ and choose
#      "On your own" (self-distributed). AMO reads the gecko id from the
#      manifest, so it becomes the same id the native host allows.
#      (web-ext cannot create an MV3 add-on itself — only submit new versions.)
#   3. Generate API keys:                https://addons.mozilla.org/en-US/developers/addon/api/key/
#      export WEB_EXT_API_KEY=... WEB_EXT_API_SECRET=...
#
# Usage:
#   ./sign-firefox.sh            # rebuild, package, sign (keys required)
#   ./sign-firefox.sh --package  # build + package only, no keys needed
#
# Env:
#   WEB_EXT_API_KEY, WEB_EXT_API_SECRET   AMO credentials (required to sign)
#   FX_UPDATE_URL   override the self-hosted updates.json URL
#                   (default: <repo>/releases/latest/download/updates.json)

set -euo pipefail
cd "$(dirname "$0")"

REPO_SLUG="skooda/omarchy-web-theme"
ASSET_NAME="omarchy-web-theme.xpi"
DEFAULT_UPDATE_URL="https://github.com/${REPO_SLUG}/releases/latest/download/updates.json"
# `-` (not `:-`) so an explicitly empty FX_UPDATE_URL disables self-hosted
# updates — needed if AMO ever rejects a submission with MANIFEST_UPDATE_URL.
FX_UPDATE_URL="${FX_UPDATE_URL-$DEFAULT_UPDATE_URL}"

PACKAGE_ONLY=0
[[ "${1:-}" == "--package" ]] && PACKAGE_ONLY=1

VERSION=$(python3 -c 'import json;print(json.load(open("extension/manifest.json"))["version"])')
ADDON_ID=$(python3 -c 'import json;print(json.load(open("extension/manifest.json"))["browser_specific_settings"]["gecko"]["id"])')

BUILD_DIR="build/firefox"
DIST_DIR="dist"
SIGN_DIR="$DIST_DIR/web-ext-artifacts"

rm -rf "$BUILD_DIR" "$SIGN_DIR"
mkdir -p "$DIST_DIR"
FX_UPDATE_URL="$FX_UPDATE_URL" ./build-firefox.sh "$BUILD_DIR" >/dev/null

# Lint as self-hosted: that is how AMO validates an unlisted submission, and it
# is the only mode in which a custom update_url is allowed. Plain `web-ext lint`
# would flag our update_url as a MANIFEST_UPDATE_URL error.
echo "Validating (self-hosted)..."
npx --yes web-ext lint --self-hosted --source-dir "$BUILD_DIR" --output text 2>&1 | tail -20

# Package the unsigned XPI. Needed for the one-time AMO submission above, and
# it is what gets replaced by the signed artifact below.
UNSIGNED="$DIST_DIR/$ASSET_NAME"
ABS_UNSIGNED="$PWD/$UNSIGNED"
rm -f "$UNSIGNED"
(cd "$BUILD_DIR" && zip -q -r -X "$ABS_UNSIGNED" .)
echo "Unsigned XPI: $UNSIGNED"

if ((PACKAGE_ONLY)) || [[ -z "${WEB_EXT_API_KEY:-}" || -z "${WEB_EXT_API_SECRET:-}" ]]; then
  cat <<EOF

No AMO credentials (WEB_EXT_API_KEY / WEB_EXT_API_SECRET) set — packaged only.

First release:
  1. Submit  $UNSIGNED  at
     https://addons.mozilla.org/developers/addon/submit/on-your-own
     choosing "On your own". Download the SIGNED .xpi AMO gives you.
  2. Re-run this script with the API keys exported to automate further versions.
  3. Publish $DIST_DIR/$ASSET_NAME and $DIST_DIR/updates.json as release assets so
     the update_url resolves (see the gh command this script prints when signing).
EOF
  exit 0
fi

mkdir -p "$SIGN_DIR"
echo "Signing $ADDON_ID $VERSION as unlisted..."
npx --yes web-ext sign \
  --channel unlisted \
  --source-dir "$BUILD_DIR" \
  --artifacts-dir "$SIGN_DIR" \
  --api-key "$WEB_EXT_API_KEY" \
  --api-secret "$WEB_EXT_API_SECRET"

SIGNED=$(ls -t "$SIGN_DIR"/*.xpi 2>/dev/null | head -1 || true)
[[ -n "$SIGNED" ]] || { echo "No signed XPI produced." >&2; exit 1; }
cp -f "$SIGNED" "$UNSIGNED"

# Self-hosted update manifest. update_hash is verified by Firefox after the
# download, and the update_link uses release/latest/download/ so both URLs stay
# stable across versions — only this file's contents change.
HASH=$(sha256sum "$UNSIGNED" | cut -d' ' -f1)
LINK="https://github.com/${REPO_SLUG}/releases/latest/download/${ASSET_NAME}"
cat >"$DIST_DIR/updates.json" <<EOF
{
  "addons": {
    "$ADDON_ID": {
      "updates": [
        {
          "version": "$VERSION",
          "update_link": "$LINK",
          "update_hash": "sha256:$HASH"
        }
      ]
    }
  }
}
EOF

echo
echo "Signed XPI: $UNSIGNED"
echo "Updates:    $DIST_DIR/updates.json   (update_url: $FX_UPDATE_URL)"
echo
echo "Publish (must not be a draft/prerelease, or /latest/ won't resolve):"
echo "  gh release create \"v$VERSION\" \"$UNSIGNED\" \"$DIST_DIR/updates.json\" \\"
echo "    --title \"v$VERSION\" --notes \"...\""
