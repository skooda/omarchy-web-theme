# CLAUDE.md

Guidance for working in this repo. Keep it short; update it when the architecture changes.

## What this is

A small **Manifest V3 browser extension** (Brave/Chrome/Chromium/Edge and
Firefox 128+) that makes **any website** follow the current
[Omarchy](https://omarchy.org/) theme. One **site-agnostic engine** recolors every
page from the active palette; a **bash native-messaging host** reads the theme
from `~/.local/state/omarchy/current/` and pushes changes the moment the
`theme-set` hook fires. **Requires Omarchy 4+.**

This is a fork of Scott Jones' `omarchy-webapp-theme`, which themed a curated list
of web apps with one "pack" per site. This fork removes the packs and replaces
them with a single universal engine. The host, hook, and ID-pinning scheme are his
design; keep the provenance in the README and LICENSE.

There is no build step, no package manager, and no test suite for the extension —
it's plain JS plus a dependency-free bash script.

## Layout

- `extension/` — the unpacked extension
  - `manifest.json` — MV3 manifest; pins the Chrome/Chromium ID with `key` (never
    regenerate it — it's baked into the host manifest and users' installs) and
    carries `browser_specific_settings.gecko` for the Firefox ID.
  - `background.js` — service worker. Holds the native-messaging port and
    rebroadcasts pushed themes to tabs. Cross-browser via `api` = `browser.*` when
    present else `chrome.*`; calls must satisfy **both** shapes (pass the callback
    AND attach `.then` — Firefox's `browser.tabs.query` ignores the callback).
  - `omarchy-universal.js` — **the whole engine.** See below.
  - `inject-prefers-color-scheme.js` — MAIN-world `matchMedia` shim so apps that
    follow `prefers-color-scheme` in JS flip with the theme.
  - `options.html` / `options.js` — the single master on/off switch
    (`chrome.storage.sync.disabledSites.universal`).
  - `icon-{16,32,48,128}.png`.
- `native-host/` — `omarchy-web-theme-host` (bash; length-prefixed JSON over
  stdio) + `com.omarchy.web_theme.json.template`.
- `hooks/omarchy-web-theme` — omarchy `theme-set` hook; SIGUSR1s every running
  host via pidfiles in `$XDG_RUNTIME_DIR/omarchy-web-theme/`.
- `install.sh` — writes host manifests to every Chromium-family profile dir,
  symlinks the hook into `hooks/theme-set.d/`, adds `--load-extension` to the
  flags confs of installed browsers. Also the packaged `omarchy-web-theme-setup`.
  `--no-flags`, `--uninstall`. Braew Origin etc. are separate browsers.
- `build-firefox.sh` / `dev-firefox.sh` / `sign-firefox.sh` — Firefox variants.
- `packaging/aur/` — PKGBUILD for the Arch package.

## The engine (`extension/omarchy-universal.js`)

Everything is one file walked once at `document_start`. It rewrites the CSSOM and
inline styles, then repairs contrast. The pieces that matter:

- **Palette groups.** The theme palette is split into three disjoint sets —
  **surfaces** (`*background`, `selection`, `chrome` + derived `mix(bg,fg)`
  elevation rungs), **inks** (`*foreground`, `cursor`, `muted` + derived muting
  rungs), **chromatic** (ANSI + accent). `slotGroup()` decides by **name**, never
  chroma (a cream foreground is chromatic-looking yet is every text's ink slot).
- **Declaration role** (`declGroup`). The CSS property picks the neutral group
  (`color`/fill/stroke → ink; background/border/shadow → surface). Custom
  properties have no declared role, so their **name** is read back via
  `SURFACE_HINT` / `INK_HINT` (`--bg*`, `--*-surface`, `--*-border` vs `--fg*`,
  `--*-text`, `--*-icon`); only truly nameless vars fall back to the neutral
  `union`.
- **Source classification** (`mapColorToken`). A source is "vivid" only when
  `chroma >= VIVID_CHROMA` **and** mid-lightness — chroma alone misfiled dark
  tinted surfaces (`#05182e`, chroma 17) and the theme's own cream fg. Vivid
  colors match within **chromatic** by **hue** (`nearestChromatic`), not Lab
  distance (the palette usually has no blue; distance sent GitHub's `#0969da` to
  magenta).
- **Polarity** (`mapNeutral`). A background's lightness gives the page's polarity,
  an ink's gives the inverse. When the page's implied polarity opposes the
  theme's, the color is anchored on the theme's own `bg`/`fg` instead of the far
  end of the ladder — this is what stops a dark page under a light theme from
  inverting. Same polarity keeps the elevation rungs.
- **Color parsing** (`resolveColor`). Canvas `fillStyle` parses any syntax, but
  the getter only returns legacy syntaxes as sRGB — modern functions
  (`oklab()`/`color()`) come back in their own space, so those are **rasterized to
  a pixel** and read back. Parsing the decimals as RGB bytes silently invents a
  color (Tailwind v4). `color-mix()`-style nested functions and cross-origin
  sheets are skipped.
- **Apply** (`applyTheme`). Sets `color-scheme`, paints `html` background and the
  omarchy font important, updates `meta[name=theme-color]`, and dispatches
  `omarchy:set-color-scheme` for the MAIN-world shim. First apply sweeps; a theme
  switch `remapAll()`s (restore snapshots, then re-map from true originals).
- **Contrast pass** (`contrastNode` / `contrastPass`). For every element that
  paints text (`paintsText`), the computed ink is checked against its first opaque
  painted ancestor and repaired to **4.5:1** (WCAG AA) via the ink ladder, then
  `theme.bg` as the on-fill ink, then white/black. Repairs are flagged
  `data-omarchy-ink` so sweeps never re-map them.
  - `contrastWalked` is a WeakMap of the last `(ink|surface)` checked, not a
    WeakSet: a node can be checked while it still holds the SITE's colors.
  - The observer maps (`sweep()`) **before** contrasting its burst, and `sweep()`
    itself schedules the pass. That schedule is a **throttle (≤1 pass/800 ms), not
    a debounce** — resetting on every mutation starves it on an app that mutates
    continuously (Tailwind's code blocks sat cyan-on-dark).
- `window.__omarchyRecolorDebug` exposes `state`, `mapValue`, `mapNeutral`,
  `nearestChromatic`, `contrastNode`, `contrastPass`, `contrastSubtree`,
  `effectiveSurface` for CDP probing.

## Host design (why it looks like this)

The host is **push-only** — it never parses inbound messages, and `background.js`
never writes to the port. Reading Chromium's length-prefixed framing in bash means
blocking in `head -c4`, which a trap can't interrupt; going push-only removes the
need entirely. Consequences to preserve when editing:

- **Omarchy 4+ only.** The host reads `~/.local/state/omarchy/current/` and is
  driven entirely by SIGUSR1 from the theme-set hook — no polling fallback.
  `install.sh` symlinks the hook into `hooks/theme-set.d/`.
- The main loop `wait`s on the stdin watchdog; a SIGUSR1 interrupts the `wait`, the
  trap pushes the new theme, and the loop resumes. No `sleep` timers.
- The stdin watchdog **must** read via an explicit `<&3` dup. Bash gives every
  background job `/dev/null` as stdin, so a bare read loop EOFs instantly and kills
  the host right after its first push.

## Firefox

`build-firefox.sh` makes a Firefox-ready copy: swaps `background.service_worker`
for event-page `background.scripts`, drops the Chrome `key`, and adds
`data_collection_permissions` (AMO requires it). `FX_UPDATE_URL` adds
`browser_specific_settings.gecko.update_url` for self-hosted updates.
`sign-firefox.sh` builds, runs `web-ext lint --self-hosted`, signs as **unlisted**
(`--channel unlisted`), and writes `dist/updates.json`. Unlisted add-ons cannot
create themselves via the API (MV3) — the first submission is done once through
the AMO web UI; the script's `--package` mode produces the XPI for that.

A custom `update_url` is only valid in the **self-hosted** linter mode; plain
`web-ext lint` reports it as `MANIFEST_UPDATE_URL`. If AMO ever rejects a
submission with that error, build with `FX_UPDATE_URL= ` (empty) and ship without
self-hosted updates.

## Dev / test workflow

Chromium is driven through a scratch profile over CDP; Brave normally runs without
a debugging port, so an automated browser can't attach to the user's own session.

```sh
chromium --user-data-dir=/tmp/omarchy-exp --remote-debugging-port=9229 \
  --load-extension=<repo>/extension --no-first-run \
  --disable-features=DisableLoadExtensionCommandLineSwitch https://example.com/
```

Then `require("playwright-core").chromium.connectOverCDP("http://localhost:9229")`
and drive `ctx.pages()` / `ctx.serviceWorkers()`. Gotchas, learned the hard way:

- Never `browser.close()` — it kills the externally launched window. `process.exit(0)`.
- `chrome.runtime.reload()` is unreliable for unpacked extensions; **restart
  chromium** to pick up edited files. Kill by pid from `pgrep -f <profile>` while
  filtering out your own shell (a `pkill -f` whose pattern is in your command line
  self-kills it).
- With no native host in that profile, the extension gets **no theme**. Push one
  from the service worker instead:
  `chrome.tabs.sendMessage(tabId, {type:"omarchy-theme", theme})`. A full
  navigation loses it — re-push after every reload.
- **Screenshots hang** when the window is occluded (no frames are composited);
  assert on `getComputedStyle` instead — more precise anyway.
- To test the engine's isolated-world state, attach CDP, `Runtime.enable`, and
  evaluate in the execution context whose `origin` starts with
  `chrome-extension://` (the page's MAIN world can't see it).

Audit recipe: resolve computed colors through a **canvas** (the `fillStyle` getter
returns hex for rgb inputs — do **not** regex the digits out of `#81b8a8`, that
reads `81,8,8` and invents a color; the engine's `parseResolved` decodes hex
properly). Then walk every element that has a text node and compare its resolved
`color` to its first opaque ancestor background.

The **native host and install.sh** are testable headlessly — do that rather than
asking the user to click through a browser. Both honor `$HOME` and
`$XDG_RUNTIME_DIR`:

```sh
# host: hold stdin open, or the watchdog exits immediately
( sleep 5 ) | HOME=/tmp/fake XDG_RUNTIME_DIR=/tmp/run ./native-host/omarchy-web-theme-host > out.bin
head -c4 out.bin | od -An -v -tu4 --endian=little   # must equal the JSON byte length

# install.sh: sandbox the whole thing
HOME=/tmp/fake ./install.sh && HOME=/tmp/fake ./install.sh --uninstall
```

Point `~/.local/state/omarchy/current/theme` at any dir under
`/usr/share/omarchy/themes/` to exercise a specific palette. For Firefox, `web-ext
lint --self-hosted` and `web-ext run` validate without signing (`npx --yes
web-ext`).

Run `node --check extension/*.js` and validate `manifest.json` as JSON after edits.

## Conventions

- Vanilla JS only (no framework, no bundler). Keep the heavy inline comments —
  they explain *why* an approach beats a site's cascade; preserve that context.
- Don't open PRs or push without confirming with the user.
- The project name and identifiers are spread across several files (extension
  name, `gecko.id`, host name `com.omarchy.web_theme`, runtime dir, hook, share
  dir, AUR pkgname). Rename consistently or not at all.
