// YouTube pack for the Omarchy web-app theming engine — declarative plus one
// root-canvas escape hatch (see apply() below).
//
// YouTube crossed over to Material 3 (2026): the old --yt-spec-* surface tokens
// no longer exist on <html>, and the whole app (watch page, browse feed, live
// chat, guide) is painted from the MD3 "baseline scheme" roles —
// --yt-sys-color-baseline-*. Verified against the live DOM (2026-09-14): ~200
// such tokens defined on <html>, and every one of the roles mapped below holds a
// REAL color — the audit found zero triplet composition (no
// rgb(var(--yt-sys-color-baseline-…)) anywhere in the stylesheets or in inline
// styles). So this pack is a plain var→surface table; there is no toTriplet()
// call, and a bare color fed into each slot is exactly what the app expects.
//
// Light/dark needs no automation: YouTube stamps/unstamps the `dark` attribute
// on <html> from a prefers-color-scheme listener (its "device theme" appearance
// setting, the default). The MAIN-world shim (inject-prefers-color-scheme.js)
// drives that listener, so the attribute flips with the omarchy theme, and the
// engine's inline-important redefinition of each token on html, html * wins over
// whichever value the attribute resolves — the pack behaves identically in both
// polarities with zero onColorMode code.
//
// What is deliberately NOT mapped:
//  - The "-inverse", "--overlay-*", "--solid-*" and "--static-*" families.
//    Those are YouTube's polarity-INVERTING surfaces, floated above video
//    (scrims, minimize-preview cards, marker chips): a light sheet with forced
//    dark ink is their entire design, and retinting the sheet to the omarchy
//    surfaces would land dark ink on a dark sheet. Same note outlook.js makes
//    about --white/--black.
//  - The raw primitive scales (--blue-N, --grey-N, --purple-N, --green-6,
//    --red-3/4): brand steps, not semantic slots.
//  - The brand gates (--genai-*, --feed-vibrant-gradient-*, --assistive-*-*,
//    --add-on-magenta/purple, --keyboard-*, --static-ad-yellow, --status-bar,
//    --system-bar): decorative, mode-aggressive or OS chrome; HEY's
//    --colorize-* is the same call in the same place.
//
// Requires YouTube Settings → Appearance → "device theme" (the default). Pinned
// Light/Dark schemes are a local choice that breaks the shim's polarity swap.
//
// NOT loaded as a bare pack entry: unlike the other sites, this content-script
// entry lists the ENGINE files first (omarchy-colors.js, omarchy-surfaces.js,
// omarchy-runtime.js) and then youtube.js. Chromium 152 injected separate
// document_start content-script entries in arbitrary order — the pack entry ran
// before the shared engine entry and died with "OmarchyTheme is not defined".
// Within one entry, files execute in listed order in one isolated world, so the
// engine is guaranteed present here. If the manifest is ever refactored to a
// shared engine entry + per-site pack entries, move the engine files first AND
// keep youtube.js in the SAME entry as them, or the pack crashes again.
//
// One escape hatch past the token tier: YouTube paints <html> (the canvas
// behind overscroll and the pre-hydration skeleton) from the hardcoded literal
// #0f0f0f rather than the base-background token — the live-DOM probe showed
// background-color: rgb(15,15,15) with that token already redefined by this
// pack. The tiny apply() hook below paints the root canvas from the derived
// background, which also stops every load flashing YouTube's grey.
// (It is not an onColorMode: the shim already drives the `dark` attribute.)

OmarchyTheme.register({
  id: "youtube",

  cssVars(theme, s) {
    // Theme-coherent status inks. The LIKE button, the "liked" state and the
    // subscribe button are YouTube's red, carried by three separate tokens;
    // repoint all of them at the theme's danger color so they stay thematic,
    // and let statusColor() fall back to YouTube's own red where the palette
    // has nothing honest to offer (white, vantablack, lumon — red must still
    // read as "liked/subscribed").
    const danger = statusColor(theme.colors || {}, "danger", [], "#f57");
    const attention = statusColor(theme.colors || {}, "attention", [], "#ffcd97");

    return {
      // App frame. base-background is the whole-page canvas (<html>/<ytd-app>
      // resolve to it); masthead and page-manager are transparent on top.
      "--yt-sys-color-baseline--base-background": s.bg,
      // Floating/elevated surfaces (menus, popovers, date-picker, pill badges).
      "--yt-sys-color-baseline--raised-background": s.sidebarBg,
      "--yt-sys-color-baseline--menu-background": s.sidebarBg,
      // Frosted glass: the masthead / expandable panels tint their backdrop
      // with these rgba() copies of the canvas; re-derive from our own bg so
      // the tint stops being a brown-grey on non-black themes.
      "--yt-sys-color-baseline--frosted-glass-desktop": withAlpha(s.bg, 0.82),
      "--yt-sys-color-baseline--frosted-glass-mobile": withAlpha(s.bg, 0.7),

      // Ink ladder. text-secondary is the real-copy level (titles' metadata,
      // subscriber counts) so it gets the contrast-targeted sidebarMuted, not a
      // flat fraction of fg. text-disabled is deliberately fainter than the
      // AA floor would demand — disabled controls are allowed to be quiet.
      "--yt-sys-color-baseline--text-primary": s.fg,
      "--yt-sys-color-baseline--text-secondary": s.sidebarMuted,
      "--yt-sys-color-baseline--text-disabled": withAlpha(s.fg, 0.35),
      "--yt-sys-color-baseline--wordmark-text": s.fg,

      // Accent: links, inline CTAs ("Join", "Surf"), the sync/verify buttons.
      // The active/liked states stay on the red family below instead of being
      // pulled onto the accent, so "liked" never shares a hue with "link".
      "--yt-sys-color-baseline--call-to-action": s.accent,
      "--yt-sys-color-baseline--call-to-action-hover": shade(s.accent, s.dir * 0.08),

      // Status inks.
      "--yt-sys-color-baseline--error-indicator": danger,
      "--yt-sys-color-baseline--red-indicator": danger,
      "--yt-sys-color-baseline--static-brand-red": danger,
      "--yt-sys-color-baseline--text-error": danger,
      "--yt-sys-color-baseline--text-warning": attention,

      // Borders. outline is the hairline consumers (search pill, chips, cards)
      // spend everywhere; outline-rim is the softer inner variant; the opaque
      // pair are the "solid hairline" fallbacks used where alpha borders would
      // double up on an already-translucent fill.
      "--yt-sys-color-baseline--outline": withAlpha(s.fg, 0.22),
      "--yt-sys-color-baseline--outline-rim": withAlpha(s.fg, 0.15),
      "--yt-sys-color-baseline--outline-opaque": mix(s.bg, s.fg, 0.26),
      "--yt-sys-color-baseline--outline-inverse-opaque": mix(s.bg, s.fg, 0.24),

      // Tonal fills: the neutral pill/chip surfaces (filter chips, "Add to",
      // share buttons). Neutral washes of fg, not hoverBg — those controls are
      // chrome, and an accent wash everywhere would flood the page.
      "--yt-sys-color-baseline--additive-background": withAlpha(s.fg, 0.08),
      "--yt-sys-color-baseline--tonal-background": withAlpha(s.fg, 0.1),
      "--yt-sys-color-baseline--tonal-wash": withAlpha(s.fg, 0.05),
      "--yt-sys-color-baseline--tonal-rim": withAlpha(s.fg, 0.1),
      "--yt-sys-color-baseline--button-chip-background-hover": withAlpha(s.fg, 0.12),

      // Press/hover state overlays on the standard (unfilled) controls.
      "--yt-sys-color-baseline--state-mono-standard-hovered": withAlpha(s.fg, 0.06),
      "--yt-sys-color-baseline--state-mono-standard-pressed": withAlpha(s.fg, 0.1),
    };
  },

  apply(theme, s) {
    // Root canvas — see the header note. Inline-important beats YouTube's
    // literal; everything above ytd-app resolves the themed token anyway.
    document.documentElement.style.setProperty("background-color", s.bg, "important");
  },
});