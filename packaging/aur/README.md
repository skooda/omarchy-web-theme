# AUR packaging

The `omarchy-web-theme` AUR package. This directory is a straight copy of
what lives in the AUR git repo, so publishing is `cp` + `git push`.

> **Renamed from `omarchy-slack-theme` after 0.2.x**, when the extension grew
> packs for more sites than Slack. The PKGBUILD carries
> `replaces/conflicts/provides=('omarchy-slack-theme')` so pacman migrates
> existing installs, and `omarchy-web-theme-setup` cleans up the old name's
> per-user wiring. The old AUR package should get a final pinned comment
> pointing here and then be orphaned/deleted.

## What the package does and doesn't do

Installs the native-messaging host to `/usr/bin`, the extension and hook to
`/usr/share/omarchy-web-theme`, and native-messaging manifests **system-wide**:

| Path | Covers |
| --- | --- |
| `/etc/chromium/native-messaging-hosts` | Chromium **and** Brave |
| `/etc/opt/chrome/native-messaging-hosts` | Google Chrome |
| `/etc/opt/edge/native-messaging-hosts` | Edge (untested — inferred from convention) |

Those paths came from the shipped binaries' compiled-in search list, not from
docs. Brave reading Chromium's directory is why two files replace the
twelve-directory per-user fan-out that `install.sh` does in a git checkout.

Everything else lives under `$HOME` and so can't come from a package — the
omarchy `theme-set` hook and the browser `--load-extension` flag. Those are the
job of `omarchy-web-theme-setup`, which is `install.sh` installed under a
second name. It detects that it's running packaged by *not* finding the repo
layout beside itself, and skips the host manifests the package owns.

## Cutting a release

The checksum can't be computed until the tag is published, so the order matters:

1. Bump `version` in `extension/manifest.json` and `pkgver` here. Keep them equal.
2. Merge to `main`, then tag and push:
   ```sh
   git tag -a v0.3.0 -m "v0.3.0 — ..." && git push origin v0.3.0
   ```
3. Update the checksum from the now-published archive:
   ```sh
   curl -sSL -o /tmp/v0.3.0.tar.gz \
     https://github.com/skooda/omarchy-web-theme/archive/refs/tags/v0.3.0.tar.gz
   sha256sum /tmp/v0.3.0.tar.gz
   ```
4. **Regenerate `.SRCINFO`** — the AUR rejects pushes where it disagrees with the
   PKGBUILD, and it's the easiest thing to forget:
   ```sh
   cd packaging/aur && makepkg --printsrcinfo > .SRCINFO
   ```
5. Verify a real build end to end (downloads from GitHub, validates the sum):
   ```sh
   cd packaging/aur && makepkg --noconfirm --clean
   namcap ./*.pkg.tar.zst
   ```
6. Copy `PKGBUILD`, `.SRCINFO` and `omarchy-web-theme.install` into the AUR
   repo and push (first release under this name creates the package):
   ```sh
   git clone ssh://aur@aur.archlinux.org/omarchy-web-theme.git
   ```

## Notes

- Do **not** bump the extension's signing key. The ID it pins
  (`egagnaecglnnmbbnpbbccgajinplhckp`) is hardcoded in the native-messaging
  manifest; regenerating it breaks every existing install — including everyone
  who installed under the old package name.
- The package is `arch=any` — pure bash and static assets, nothing compiled.
- `.SRCINFO` is checked in so this directory can be copied wholesale, which
  means it goes stale silently if step 4 is skipped. It is generated, never
  hand-edited.
