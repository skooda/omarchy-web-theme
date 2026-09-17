#!/bin/bash
# Dev helper: build the Firefox variant of the extension and launch Firefox
# with it temporary-installed via web-ext.
#
# Firefox release builds refuse unsigned *permanent* add-ons, so this is the
# supported way to run the extension from a checkout: web-ext installs it for
# the session (and reloads on source changes). Same flow as `about:debugging →
# Load Temporary Add-on`, just scripted.
#
# Usage:
#   ./dev-firefox.sh                  – temp profile, opens about:blank
#   ./dev-firefox.sh -u <url>         – also open a URL
#   ./dev-firefox.sh -p <profile-dir> – run your own profile (Firefox must be
#                                       fully quit; profile changes are saved)
#
# For a permanent install, use Firefox Developer Edition and set
# xpinstall.signatures.required=false in its profile, then install the XPI that
# ./build-firefox.sh + `zip -r` produce.

set -euo pipefail
cd "$(dirname "$0")"

PROFILE_ARGS=()
URL_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--profile)
      PROFILE_ARGS=(--firefox-profile "$2" --keep-profile-changes --profile-create-if-missing)
      shift 2
      ;;
    -u|--url)
      URL_ARGS=(-u "$2")
      shift 2
      ;;
    *)
      echo "Usage: $0 [-p|--profile <dir>] [-u|--url <url>]" >&2
      exit 1
      ;;
  esac
done

./build-firefox.sh

if [[ ${#PROFILE_ARGS[@]} -eq 0 ]]; then
  echo "→ temp profile: no native-messaging host there, so the extension will"
  echo "  inject but stay unthemed. Use -p <your profile> to test for real."
fi

exec npx --yes web-ext run \
  --source-dir /tmp/omarchy-fx-ext \
  --firefox firefox \
  "${PROFILE_ARGS[@]}" \
  "${URL_ARGS[@]}"
