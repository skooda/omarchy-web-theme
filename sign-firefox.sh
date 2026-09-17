#!/bin/bash
# Build, package, and (with AMO API credentials) sign the Firefox add-on.
#
# Two AMO channels:
#   unlisted (default) — AMO signs it but never lists it; you host the XPI and
#                        its updates.json yourself. Works on stock Firefox.
#   listed             — published on addons.mozilla.org and updated by AMO.
#
# The channel changes what AMO accepts: a custom `gecko.update_url` is forbidden
# on listed add-ons (MANIFEST_UPDATE_URL), so `--listed` drops it and relies on
# AMO for updates; `unlisted` keeps the self-hosted updates.json.
#
# One-time setup (both channels):
#   1. Create an AMO account:  https://addons.mozilla.org/
#   2. Create the add-on once through the web UI (web-ext cannot create an MV3
#      add-on itself, only submit new versions):
#        unlisted: https://addons.mozilla.org/developers/addon/submit/on-your-own
#        listed:   https://addons.mozilla.org/developers/addon/submit/
#      Upload the UNSIGNED XPI this script writes to dist/ and finish the form.
#      AMO reads the gecko id from the manifest, so it matches the native host.
#   3. Generate API keys:  https://addons.mozilla.org/en-US/developers/addon/api/key/
#      export WEB_EXT_API_KEY=... WEB_EXT_API_SECRET=...
#
# Usage:
#   ./sign-firefox.sh              # unlisted: build, package, sign, updates.json
#   ./sign-firefox.sh --listed     # listed:   build, package, sign (AMO updates)
#   ./sign-firefox.sh --package    # build + package only, no keys needed
#
# Env:
#   WEB_EXT_API_KEY, WEB_EXT_API_SECRET   AMO credentials (required to sign)
#   FX_UPDATE_URL   unlisted only: override the self-hosted updates.json URL
#                   (default: <repo>/releases/latest/download/updates.json)
#   FX_APPROVAL_TIMEOUT   ms to wait for review before giving up (listed; 0
#                         submits without waiting). Default: web-ext's.

set -euo pipefail
cd "$(dirname "$0")"

REPO_SLUG="skooda/omarchy-web-theme"
ASSET_NAME="omarchy-web-theme.xpi"
DEFAULT_UPDATE_URL="https://github.com/${REPO_SLUG}/releases/latest/download/updates.json"

CHANNEL="unlisted"
PACKAGE_ONLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --listed) CHANNEL="listed" ;;
    --unlisted) CHANNEL="unlisted" ;;
    --package) PACKAGE_ONLY=1 ;;
    *)
      echo "Usage: $0 [--listed|--unlisted] [--package]" >&2
      exit 2
      ;;
  esac
  shift
done

# AMO forbids update_url on listed add-ons; there it also owns updates. `-` (not
# `:-`) so `FX_UPDATE_URL=` can force it off for unlisted too.
if [[ $CHANNEL == listed ]]; then
  FX_UPDATE_URL=""
else
  FX_UPDATE_URL="${FX_UPDATE_URL-$DEFAULT_UPDATE_URL}"
fi

VERSION=$(python3 -c 'import json;print(json.load(open("extension/manifest.json"))["version"])')
ADDON_ID=$(python3 -c 'import json;print(json.load(open("extension/manifest.json"))["browser_specific_settings"]["gecko"]["id"])')

BUILD_DIR="build/firefox"
DIST_DIR="dist"
SIGN_DIR="$DIST_DIR/web-ext-artifacts"

rm -rf "$BUILD_DIR" "$SIGN_DIR"
mkdir -p "$DIST_DIR"
FX_UPDATE_URL="$FX_UPDATE_URL" ./build-firefox.sh "$BUILD_DIR" >/dev/null

# Self-hosted lint only when we actually ship a self-hosted update_url — that is
# the mode AMO uses to validate an unlisted submission. A listed build has no
# update_url and must pass the plain (Mozilla-hosted) lint instead.
if [[ $CHANNEL == listed ]]; then
  echo "Validating (listed / Mozilla-hosted)..."
  LINT_ARGS=()
else
  echo "Validating (unlisted / self-hosted)..."
  LINT_ARGS=(--self-hosted)
fi
npx --yes web-ext lint "${LINT_ARGS[@]}" --source-dir "$BUILD_DIR" --output text 2>&1 | tail -20

# Package the unsigned XPI. Needed for the one-time web submission, and it is
# what gets replaced by the signed artifact below.
UNSIGNED="$DIST_DIR/$ASSET_NAME"
ABS_UNSIGNED="$PWD/$UNSIGNED"
rm -f "$UNSIGNED"
(cd "$BUILD_DIR" && zip -q -r -X "$ABS_UNSIGNED" .)
echo "Unsigned XPI: $UNSIGNED"

if ((PACKAGE_ONLY)) || [[ -z "${WEB_EXT_API_KEY:-}" || -z "${WEB_EXT_API_SECRET:-}" ]]; then
  if [[ $CHANNEL == listed ]]; then
    SUBMIT_URL="https://addons.mozilla.org/developers/addon/submit/"
    SUBMIT_CHOICE="On this site"
  else
    SUBMIT_URL="https://addons.mozilla.org/developers/addon/submit/on-your-own"
    SUBMIT_CHOICE="On your own"
  fi
  cat <<EOF

No AMO credentials (WEB_EXT_API_KEY / WEB_EXT_API_SECRET) set — packaged only.

First release ($CHANNEL):
  1. Submit  $UNSIGNED  at
     $SUBMIT_URL
     choosing "$SUBMIT_CHOICE". Fill in the listing from amo-listing.md, then
     submit for review.
  2. Export the API keys and re-run to automate further versions.
EOF
  exit 0
fi

SIGN_ARGS=(
  --channel "$CHANNEL"
  --source-dir "$BUILD_DIR"
  --artifacts-dir "$SIGN_DIR"
  --api-key "$WEB_EXT_API_KEY"
  --api-secret "$WEB_EXT_API_SECRET"
)
[[ -n "${FX_APPROVAL_TIMEOUT:-}" ]] && SIGN_ARGS+=(--approval-timeout "$FX_APPROVAL_TIMEOUT")
# The API's PUT /addons/addon/{guid}/ creates the add-on when the guid is new, so
# a listed add-on can be created and submitted in one shot — but only with the
# required listing metadata (name, summary, categories, version license).
[[ -n "${FX_AMO_METADATA:-}" ]] && SIGN_ARGS+=(--amo-metadata "$FX_AMO_METADATA")

mkdir -p "$SIGN_DIR"
SIGN_LOG="$DIST_DIR/web-ext-sign.log"
echo "Signing $ADDON_ID $VERSION as $CHANNEL..."
set +e
npx --yes web-ext sign "${SIGN_ARGS[@]}" 2>&1 | tee "$SIGN_LOG"
sign_status=${PIPESTATUS[0]}
set -e
if ((sign_status != 0)); then
  # With FX_APPROVAL_TIMEOUT=0 (or a review that outlasts the timeout) web-ext
  # exits non-zero on "Approval: timeout exceeded" even though the version WAS
  # submitted. Any other failure — a rejected manifest, bad metadata (HTTP 400),
  # auth error — must not be dressed up as "submitted".
  if [[ $CHANNEL == listed ]] && grep -qi "timeout exceeded" "$SIGN_LOG"; then
    echo
    echo "Submitted — a listed version waits for AMO review before it is signed." >&2
    echo "Track it at https://addons.mozilla.org/developers/addons/" >&2
    exit 0
  fi
  echo "Signing failed (full log: $SIGN_LOG)." >&2
  exit 1
fi

SIGNED=$(ls -t "$SIGN_DIR"/*.xpi 2>/dev/null | head -1 || true)
if [[ -z "$SIGNED" ]]; then
  if [[ $CHANNEL == listed ]]; then
    echo
    echo "Submitted — a listed version waits for AMO review before it is signed." >&2
    echo "Build and serve nothing: AMO lists and updates it. Track review at" >&2
    echo "https://addons.mozilla.org/developers/addons/" >&2
    exit 0
  fi
  echo "No signed XPI produced." >&2
  exit 1
fi
cp -f "$SIGNED" "$UNSIGNED"

echo
echo "Signed XPI: $UNSIGNED"

if [[ $CHANNEL == listed ]]; then
  echo "Listed on AMO, updated by AMO automatically. No release assets needed."
  exit 0
fi

# Self-hosted update manifest (unlisted only). update_hash is verified by
# Firefox after the download, and update_link uses release/latest/download/ so
# both URLs stay stable across versions — only this file's contents change.
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

echo "Updates:    $DIST_DIR/updates.json   (update_url: $FX_UPDATE_URL)"
echo
echo "Publish (must not be a draft/prerelease, or /latest/ won't resolve):"
echo "  gh release create \"v$VERSION\" \"$UNSIGNED\" \"$DIST_DIR/updates.json\" \\"
echo "    --title \"v$VERSION\" --notes \"...\""
