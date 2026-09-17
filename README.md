# omarchy-web-theme

A browser extension that makes **any website** follow your
[Omarchy](https://omarchy.org/) theme — repainting its surfaces with your
terminal's palette, keeping text readable, and switching light/dark whenever you
switch omarchy themes.

Built and tested on Brave and Firefox on Arch Linux + Omarchy. Works on Chromium,
Chrome, Brave Origin, Edge, and Firefox.

```sh
./install.sh          # Chromium-family: host + hook + --load-extension
./sign-firefox.sh     # Firefox: signed, self-distributed XPI
```

## Provenance

This is a fork of Scott Jones' **`omarchy-webapp-theme`** (originally
`omarchy-slack-theme`), which showed the way: a tiny native-messaging host can
hook omarchy's own `theme-set` event and push the new theme into a browser
extension the moment it lands. That project themed a curated list of web apps
with one small "pack" per site — Slack, WhatsApp Web, GitHub, Linear, Discord,
Outlook, Notion, HEY.

We wanted that engine to work on the **whole web**, not just those apps, so this
fork throws the per-site packs away and replaces them with one site-agnostic
recoloring engine. The native host, the hook, and the ID-pinning scheme are
Scott's design; the universal recolor engine is ours. Huge thanks to him.

## What it does

- **Recolors any page** from your current omarchy palette: backgrounds, borders
  and shadows come from the theme's surfaces; text, icons and links from its
  inks; saturated colors (links, buttons, status) keep their hue by matching
  against the theme's chromatic slots.
- **Preserves roles and polarity.** A page's background stays a background and
  its text stays text, even when the page's own light/dark mode disagrees with
  the theme (sites that switch on the CSS `prefers-color-scheme` query, which no
  content script can spoof).
- **Enforces a contrast floor.** After mapping, every element's ink is checked
  against the surface it actually sits on and repaired to at least 4.5:1
  (WCAG AA), preferring the theme's own colors over literal black/white.
- **Pushes updates instantly.** A native-messaging host reads the active theme
  and is signalled by omarchy's `theme-set` hook, so switching themes repaints
  open tabs immediately — no reload, no polling.
- **Can be turned off.** The options page has a single master switch; disabled
  sites are left exactly as they ship.

## How it works

```
  omarchy-theme-set ──omarchy-hook theme-set──► hooks/omarchy-web-theme
                                                          │ SIGUSR1
                                                          ▼
┌──────────────┐   length-prefixed JSON   ┌────────────────────┐
│  native host │ ────────────────────────►│  Browser service   │
│  (bash)      │   push-only, never read  │  worker (MV3 bg)   │
│              │                          └────────┬───────────┘
└──────────────┘                                   │ tabs.sendMessage
   reads (Omarchy 4):                              ▼
   ~/.local/state/omarchy/current/  ┌────────────────────────────────┐
     theme.name                     │  Content script on every page  │
     theme/alacritty.toml           │  • maps CSSOM + inline colors  │
     theme/colors.toml              │  • ensures contrast            │
     theme/chromium.theme           └────────────────────────────────┘
```

The host is **push-only** — it never parses inbound messages. It emits once on
connect, then again whenever omarchy's `theme-set` hook signals it with SIGUSR1
(the hook `install.sh` symlinks into `hooks/theme-set.d/`). Omarchy 4+ only.

Dark vs. light is decided by the **WCAG relative luminance** of the terminal
background, so it's robust to themes that don't use the obvious day/night naming.

### The recoloring engine, briefly

`extension/omarchy-universal.js` is the whole thing (no build step, vanilla JS):

- The theme palette is split into three disjoint target sets: **surfaces**
  (background/selection/chrome + derived `mix(bg, fg)` elevation rungs), **inks**
  (foreground/muted + derived muting rungs), and **chromatic** (ANSI + accent).
- A declaration's **property** picks the neutral group (`color` → ink,
  `background`/`border`/`shadow` → surface). Custom properties have no declared
  role, so their **name** is read back (`--bg*`, `--*-surface`, `--*-border` vs
  `--fg*`, `--*-text`, `--*-icon`); only truly nameless ones fall back to a
  neutral union.
- A saturated source color is matched within the **chromatic** set by **hue**, so
  blue stays blue-ish even when the palette has no blue.
- Neutral matches are **polarity-aware**: when the page's implied light/dark
  disagrees with the theme's, the color is anchored on the theme's own `bg`/`fg`
  instead of the far end of the ladder — which is what stops a dark page under a
  light theme from inverting.
- A **contrast pass** repairs anything under 4.5:1 via the theme's ink ladder,
  falling back to `theme.bg` on saturated fills and only then to white/black.

Colors are parsed through a canvas `fillStyle`, with modern color functions
(`oklab()`/`color()`) rasterized to a pixel so they resolve to real sRGB.

## Requirements

- Brave, Brave Origin, Chrome, Chromium, or Edge (Manifest V3) — or Firefox 128+
- Bash + coreutils. No Python, no runtime dependencies for the extension itself.
- Linux + [Omarchy](https://omarchy.org/) **4+** — the host reads
  `~/.local/state/omarchy/current/` and is driven by the `theme-set.d` hook.
- An `alacritty.toml` in the active theme dir (the host falls back to
  `colors.toml` if that's missing).

## Install

### From the AUR

```sh
yay -S omarchy-web-theme
omarchy-web-theme-setup
```

The package registers the native-messaging host system-wide, so there's no
per-browser setup. `omarchy-web-theme-setup` does the two things a package can't
— installing the omarchy `theme-set` hook and adding `--load-extension` —
because both live under `$HOME`. It takes the same `--no-flags` and `--uninstall`
flags as `install.sh` below; they're the same script. (Upgrading from
`omarchy-webapp-theme` or `omarchy-slack-theme`? The setup cleans up the old
names' wiring too.)

Then **fully quit your browser** (`pkill brave` — closing the window isn't
enough) and open any website.

### From a git checkout

```sh
./install.sh
```

There's no extension ID to copy. `extension/manifest.json` pins the ID with a
`key`, so it's `egagnaecglnnmbbnpbbccgajinplhckp` on every machine, and
`install.sh` bakes it into the host manifest for you.

The script does three things:

1. Registers the native-messaging host in every Chromium-family profile dir
   (Chromium, Chrome ×3, Brave ×3, Brave Origin ×3, Edge ×2).
2. Symlinks the omarchy `theme-set` hook into `hooks/theme-set.d/` (your own
   hooks there are left alone).
3. Adds `--load-extension` to the flags files of the browsers you actually have
   installed, so the extension loads without Developer mode.

Options:

| Flag | Effect |
| --- | --- |
| `--no-flags` | Skip the flags-file edits; load `extension/` by hand instead. |
| `--uninstall` | Reverse all three steps. |

> **Upgrading from a manual install?** Remove the copy you loaded via
> **Load unpacked** first, then restart. It and the `--load-extension` copy share
> the pinned ID, and only one of the two will load.

### Firefox (signed)

Firefox Release refuses unsigned add-ons, so the Firefox build must be signed by
AMO. `install.sh` already registers the Firefox native-messaging host under
`~/.mozilla/native-messaging-hosts/`. There are two channels:

```sh
./sign-firefox.sh --listed     # publish on addons.mozilla.org (AMO updates it)
./sign-firefox.sh              # unlisted: AMO signs, you self-host the XPI
./sign-firefox.sh --package    # build dist/omarchy-web-theme.xpi (unsigned)
```

`--listed` is the public listing and is forbidden from carrying a custom
`update_url` (AMO handles updates). The default `unlisted` build adds
`gecko.update_url` and emits `dist/updates.json` for self-hosted updates.

**First submission** (either channel) goes through the web UI — AMO cannot create
an MV3 add-on from the API, only new versions:

- listed: <https://addons.mozilla.org/developers/addon/submit/> → **On this site**
- unlisted: <https://addons.mozilla.org/developers/addon/submit/on-your-own> →
  **On your own**

Upload `dist/omarchy-web-theme.xpi`, fill the listing (copy-paste text is in
[`amo-listing.md`](./amo-listing.md)), and submit. Then generate API credentials
at <https://addons.mozilla.org/en-US/developers/addon/api/key/>, `export
WEB_EXT_API_KEY=... WEB_EXT_API_SECRET=...`, and every later version is one
`./sign-firefox.sh [--listed]`.

For **unlisted**, attach the signed XPI and `dist/updates.json` to a GitHub
Release so `releases/latest/download/updates.json` resolves. For **listed**, AMO
serves updates itself — no release assets needed.

To develop without signing, use `./dev-firefox.sh` or
`about:debugging → Load Temporary Add-on` on the `build/firefox` directory.

## Site setup

Most sites need nothing. A few apps have their **own** Light/Dark setting, and
while that's pinned they ignore the extension's `prefers-color-scheme` spoof —
the palette changes, the polarity doesn't. Put those on "system":

| App | Setting | Where |
| --- | --- | --- |
| WhatsApp Web | **System default** | Settings → Theme |
| GitHub | **Sync with system** | Settings → Appearance → Theme |
| Linear | **System preference** | `Ctrl+K` → "Change interface theme" (per-device) |
| Discord | **Sync with computer** | Settings → Appearance → Theme |
| Notion | **Use system setting** | Settings → My settings → Appearance |
| Slack | nothing | its Appearance radio is flipped automatically |

**To turn theming off entirely**, right-click the extension's toolbar icon →
**Options** (or `chrome://extensions` → Details → Extension options) and uncheck
the master switch. Off means off: pages are left exactly as they ship.

## Verifying it works

Open DevTools and filter the console by `omarchy`. The background logs
`[omarchy] theme pushed by native host: …` and the engine logs
`[omarchy-recolor] theme <name> applied; palette surfaces: … inks: … chromatic: …`.
Switching themes while a tab is open should repaint it within a frame or two.

## Customization

Everything lives in `extension/omarchy-universal.js`. The knobs most worth
touching:

- **`CONTRAST_FLOOR`** — the minimum ink/surface contrast the pass enforces
  (default `4.5`, WCAG AA).
- **`VIVID_CHROMA` / `VIVID_L_MIN` / `VIVID_L_MAX`** — when a source color counts
  as a "real color" (keeps its hue) rather than a tinted neutral.
- **`SURFACE_HINT` / `INK_HINT`** — the name patterns used to infer a custom
  property's role.
- **`mapNeutral()`** — the polarity anchor; change it if you'd rather keep the
  theme's elevation ladder even across a polarity mismatch.

After editing Chromium, reload the extension (`brave://extensions` → reload) and
refresh the tab; for Firefox use `./dev-firefox.sh`.

## Limitations / known gotchas

- **The CSS `prefers-color-scheme` media query cannot be spoofed** by a content
  script — only JavaScript's `matchMedia`. A site whose mode is driven purely by
  CSS media queries follows the OS, not omarchy; the polarity-aware mapping keeps
  it readable rather than inverting, but elevation is flattened for those pages.
  Prefer apps' own "system" setting where it exists.
- **Cross-origin stylesheets** (`cssRules` throws `SecurityError`) are skipped;
  their colors stay as authored.
- **`color-mix()`-style nested functions and canvas/WebGL pixels** are out of
  reach.
- **Custom properties with no role-hinting name** fall back to a neutral union
  that preserves lightness, not role — rare, and the contrast pass catches the
  unreadable cases.
- **Large, continuously-mutating pages** cost the most: the contrast pass is
  throttled to at most one full document walk every 800 ms after activity stops.

## Repository layout

```
extension/
├── manifest.json                    # MV3 manifest; pins the extension ID via "key"
├── background.js                    # service worker; native port + tab broadcast
├── omarchy-universal.js             # the recoloring engine (colors, mapping, contrast)
├── inject-prefers-color-scheme.js   # MAIN-world matchMedia shim (light/dark flip)
├── options.html / options.js        # the master on/off switch
└── icon-{16,32,48,128}.png

native-host/
├── omarchy-web-theme-host           # bash; pushes length-prefixed JSON over stdio
└── com.omarchy.web_theme.json.template

hooks/
└── omarchy-web-theme                # theme-set hook; SIGUSR1s every running host

install.sh                           # host manifests + hook + --load-extension wiring
build-firefox.sh                     # Firefox-ready copy of extension/
dev-firefox.sh                       # run the Firefox build temporarily (web-ext)
sign-firefox.sh                      # build + sign the unlisted self-distributed XPI
dev.sh                               # restart Chromium with the checkout extension
packaging/aur/                       # PKGBUILD for the Arch package
```

## License

MIT — see [LICENSE](./LICENSE). Original work © 2026 Scott Jones; universal
engine and fork © 2026 V3L (V3L.cz).
