# AMO listing copy

Paste-ready text for the addons.mozilla.org submission form. Keep this in sync
with `extension/manifest.json`'s `name`/`description` when they change.

## Name

```
Omarchy Web Theme
```

## Summary (max 250 characters)

```
Make any website follow your Omarchy theme: palette, light/dark, and accent. Requires Omarchy 4+ on Linux and a small companion native host.
```

## Description (Markdown)

```markdown
Omarchy Web Theme recolors the web to match your current
[Omarchy](https://omarchy.org/) theme, so pages blend into the rest of your
desktop instead of fighting it.

- **Any site, one engine.** Backgrounds, borders and shadows are drawn from the
  theme's surfaces; text, icons and links from its inks. Saturated colors
  (links, buttons, status) keep their hue by matching the theme's chromatic
  slots.
- **Readable by construction.** Every mapped pair is checked and repaired to at
  least 4.5:1 (WCAG AA), preferring the theme's own colors over literal
  black/white.
- **Follows light/dark.** Switching Omarchy themes repaints open tabs
  immediately: a small native-messaging host is signalled by Omarchy's own
  `theme-set` hook.
- **Role-aware.** A page's background stays a background and its text stays
  text, even when the site's own light/dark mode disagrees with the theme.

### Requirements

- **Omarchy 4+ on Arch Linux.** The extension reads the active theme from
  `~/.local/state/omarchy/current/` through a companion native-messaging host.
- The **native host**, installed by this project's installer or the
  `omarchy-web-theme` AUR package (`omarchy-web-theme-setup`).

Without Omarchy and the native host the extension installs and injects
cleanly, but has no theme to read and does nothing.

### Install

```sh
yay -S omarchy-web-theme      # native host + extension
omarchy-web-theme-setup       # per-user hook + browser wiring
```

Then fully quit and restart Firefox. Full source and setup instructions:
<https://github.com/skooda/omarchy-web-theme>

### Privacy

The extension collects nothing and sends nothing. It reads your local theme
through the native host and makes no network requests of its own.
```

## Categories

- Appearance only. AMO rejects `other` combined with any other category, and a
  single primary category is all this needs.

## Tags

```
omarchy, theme, theming, dark mode, light mode, colors, recoloring, linux, arch
```

## License

MIT

## Privacy policy

Not required — the add-on collects no data. If AMO insists on a URL, point it at
<https://github.com/skooda/omarchy-web-theme#readme> and note "no data
collection" in the submission form.

## Support / homepage

- Homepage: <https://github.com/skooda/omarchy-web-theme>
- Support site: <https://github.com/skooda/omarchy-web-theme/issues>
- Support email: `addons@v3l.cz`

## Notes for reviewers

```
This is the Firefox build of a Linux desktop tool for Omarchy
(https://omarchy.org/). It themes pages from the active Omarchy theme through a
companion native-messaging host.

With no native host present (a stock review environment) the extension installs
and injects its content script but does nothing visible — there is no theme to
read. `background.js` calls connectNative("com.omarchy.web_theme") and retries;
that is expected.

The native host is a short, dependency-free bash script and its manifest is
install.sh in the repository:
https://github.com/skooda/omarchy-web-theme

No data is collected or transmitted.
```

## Release notes (per version)

```
0.4.0 — First public release. One site-agnostic recoloring engine replaces the
previous per-site packs: palette roles (surfaces/inks/chromatic), hue-preserving
color matching, polarity-aware neutrals, a 4.5:1 contrast pass, and instant
repaints on theme switches via the Omarchy theme-set hook.
```
