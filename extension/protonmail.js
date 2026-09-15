// Proton Mail pack for the Omarchy web-app theming engine — declarative.
//
// Proton is one Angular app (mail + calendar + drive) sharing ONE design-token
// family at app.proton.me, named in plain English and consumed everywhere. The
// mailbox editor, list panes and settings all read these; verified against the
// live app (2026-09-15).
//
// Literals the pack is GUARANTEED against, from the live-DOM audit:
//  - real colours only. A scan of every readable stylesheet and inline style
//    found ZERO `rgb(var(--…))` / triplet consumption — feeding a colour into
//    each slot below is exactly the format the app resolves. (Compare HEY's
//    --rgb-* arm, which holds triplets contrary to its name.)
//  - the token block is an inline <style> on `:root,.ui-standard{…}` with no
//    !important, so the engine's inline-important redefinition of each token on
//    html, html * outranks it unconditionally. Flipping the `data-theme-mode`
//    attribute Proton stamps on <html> does NOT re-resolve any value — the
//    theme is delivered as the stylesheet itself, not as attribute selectors —
//    so the mode attribute is informational and the pack leaves it alone.
//  - `--primary`, `--interaction-norm` and `--link-norm` all ship the same
//    purple (#6d4aff = Proton's brand). They are repointed at the theme accent
//    together, so the "primary" control family (buttons, active nav, focus)
//    flips as one.
//
// What is deliberately NOT mapped:
//  - The polarity-INVERTING core: `--background-invert`, `--text-invert`,
//    `--interaction-norm-contrast`, `--interaction-weak-contrast` and every
//    `--signal-*-contrast` (the forced-light/dark ink Proton rides on inverted
//    pills and on tv/story headers — same call outlook.js makes about --white).
//  - The `--primary-*-major/minor` and `--signal-*-minor/major` scales: brand
//    steps and alert-background tint ladders (a red callout is a semantic
//    choice, the same line notion.js draws around block colours).
//  - `--interaction-default`: literally `transparent` — the unfilled chip. The
//    `-hover`/`-active` states of it ARE mapped (they are the actual washes).
//  - `--optional-*`, `--promotion-*`, `--main-*`, `--space-*`,
//    `--border-radius*`: legacy fallbacks, marketing chrome, geometry — not
//    colour semantics.
//
// No light/dark automation and no user setting: every surface, ink, border and
// signal the app paints resolves through the mapped tokens, so the pack renders
// the omarchy surfaces regardless of which Proton theme is active (System,
// Light, Dark — all just different values of the same names). Only the login
// page is a separate host (account.proton.me) and is left unthemed on purpose.
//
// NOT loaded as a bare pack entry: like youtube.js, Proton's content-script
// entry lists the ENGINE files first (omarchy-colors.js, omarchy-surfaces.js,
// omarchy-runtime.js) and then protonmail.js. Chromium 152 injected separate
// document_start content-script entries in arbitrary order — the pack entry ran
// before the shared engine entry and died with "OmarchyTheme is not defined".
// Within one entry, files execute in listed order in one isolated world, so the
// engine is guaranteed present here. If the manifest is ever refactored to a
// shared engine entry + per-site pack entries, move the engine files first AND
// keep protonmail.js in the SAME entry as them, or the pack crashes again.

OmarchyTheme.register({
  id: "protonmail",

  cssVars(theme, s) {
    // Ink that rides on the accent fill. Proton paints the selected mailbox row
    // and the nav badge on --interaction-norm; its shipped *-contrast tokens
    // are hardcoded (white on purple), so resolve the ink via contrast against
    // OUR accent and escalate to white/black only where nothing reads.
    const onAccent = inkOn(s.accent, [s.bg, s.fg]);

    const danger = statusColor(theme.colors || {}, "danger", [], "#dc3251");
    const success = statusColor(theme.colors || {}, "success", [], "#1ea885");
    const attention = statusColor(theme.colors || {}, "attention", [], "#ff9900");
    // Proton's --signal-info is the blue "informational" hue. No status role
    // describes it (the palette solver can't invent a blue) — but information
    // and primary action share a hue in most design systems, so it follows the
    // theme accent rather than importing Proton's brand blue.
    const info = s.accent;

    return {
      // Page canvas + the surface ladder (weak = one step up, the sidebar and
      // panel fills; strong = pressed/depressed chrome; lowered = recessed rows;
      // elevated = menus/popovers).
      "--background-norm": s.bg,
      "--background-weak": s.sidebarBg,
      "--background-strong": shade(s.bg, s.dir * 0.05),
      "--background-lowered": shade(s.bg, s.dir * 0.02),
      "--background-elevated": s.sidebarBg,

      // Ink ladder. text-weak is the real-copy level (the read-message preview,
      // subscription counts) so it gets the contrast-targeted sidebarMuted;
      // text-hint/disabled are fainter on purpose.
      "--text-norm": s.fg,
      "--text-weak": s.sidebarMuted,
      "--text-hint": withAlpha(s.fg, 0.45),
      "--text-disabled": withAlpha(s.fg, 0.3),

      // Hairlines.
      "--border-norm": withAlpha(s.fg, 0.18),
      "--border-weak": withAlpha(s.fg, 0.08),

      // Links + the whole primary/interaction family. The -hover/-active steps
      // walk the theme's own dark/light ramp (darker in light mode, lighter in
      // dark), matching how Proton's own --norm-hover ladder behaves.
      "--link-norm": s.accent,
      "--link-hover": shade(s.accent, s.dir * 0.08),
      "--link-active": shade(s.accent, s.dir * 0.14),
      "--primary": s.accent,
      "--interaction-norm": s.accent,
      "--interaction-norm-hover": shade(s.accent, s.dir * 0.08),
      "--interaction-norm-active": shade(s.accent, s.dir * 0.14),
      "--interaction-norm-minor-1": withAlpha(s.accent, 0.18),
      "--interaction-norm-minor-2": withAlpha(s.accent, 0.1),
      "--interaction-norm-contrast": onAccent,
      "--primary-contrast": onAccent,
      "--interaction-weak": withAlpha(s.fg, 0.06),
      "--interaction-weak-hover": withAlpha(s.fg, 0.1),
      "--interaction-weak-active": withAlpha(s.fg, 0.13),
      "--interaction-weak-contrast": s.fg,
      "--interaction-default-hover": withAlpha(s.fg, 0.07),
      "--interaction-default-active": withAlpha(s.fg, 0.13),

      // Form fields. border/ink levels, plus the four pairings Proton paints
      // the input chrome from.
      "--field-norm": withAlpha(s.fg, 0.28),
      "--field-hover": withAlpha(s.fg, 0.45),
      "--field-disabled": withAlpha(s.fg, 0.15),
      "--field-background-color": s.bg,
      "--field-hover-background-color": s.bg,
      "--field-focus-background-color": s.bg,
      "--field-disabled-background-color": withAlpha(s.fg, 0.05),
      "--field-text-color": s.fg,
      "--field-hover-text-color": s.fg,
      "--field-focus-text-color": s.fg,
      "--field-disabled-text-color": withAlpha(s.fg, 0.35),
      "--field-placeholder-color": withAlpha(s.fg, 0.45),

      // Focus chrome.
      "--focus-outline": s.accent,
      "--focus-ring": withAlpha(s.accent, 0.25),

      // Status inks. The LIKE/subscribe-equivalents (unread badges, validation)
      // get theme-coherent status colors; the fallbacks are Proton's own.
      "--signal-danger": danger,
      "--signal-danger-hover": shade(danger, s.dir * 0.08),
      "--signal-danger-active": shade(danger, s.dir * 0.14),
      "--signal-success": success,
      "--signal-success-hover": shade(success, s.dir * 0.08),
      "--signal-success-active": shade(success, s.dir * 0.14),
      "--signal-warning": attention,
      "--signal-warning-hover": shade(attention, s.dir * 0.08),
      "--signal-warning-active": shade(attention, s.dir * 0.14),
      "--signal-info": info,
      "--signal-info-hover": shade(info, s.dir * 0.08),
      "--signal-info-active": shade(info, s.dir * 0.14),

      // Mailbox list chrome: read/unread row states and the accent-filled
      // selection/badges.
      "--email-item-unread-text-color": s.fg,
      "--email-item-read-text-color": s.sidebarMuted,
      "--email-item-unread-background-color": s.bg,
      "--email-item-read-background-color": withAlpha(s.fg, 0.03),
      "--email-item-selected-background-color": s.accent,
      "--email-item-selected-text-color": onAccent,
      "--email-item-selected-icon-background-color": shade(s.accent, s.dir * 0.14),
      "--email-item-selected-icon-text-color": onAccent,
      "--email-item-unread-icon-background-color": withAlpha(s.fg, 0.08),
      "--email-item-unread-icon-text-color": s.fg,
      "--email-item-read-icon-background-color": withAlpha(s.fg, 0.06),
      "--email-item-read-icon-text-color": s.sidebarMuted,

      // Toolbar + sidebar nav chrome.
      "--toolbar-background-color": s.bg,
      "--toolbar-text-color": s.fg,
      "--toolbar-border-bottom-color": withAlpha(s.fg, 0.08),
      "--toolbar-separator-color": withAlpha(s.fg, 0.12),
      "--navigation-current-item-text-color": s.fg,
      "--navigation-current-item-marker-color": s.accent,
      "--navigation-current-item-background-color": withAlpha(s.fg, 0.07),
      "--navigation-item-count-background-color": s.accent,
      "--navigation-item-count-text-color": onAccent,
    };
  },
});