// Microsoft Teams (web) pack for the Omarchy web-app theming engine —
// declarative.
//
// Teams is the same Fluent v9 design system as Outlook Web, so the pack mirrors
// outlook.js's token ladder and extends it with the Teams-specific families.
// Verified against the live app (2026-09-15, teams.microsoft.com/v2/).
//
// How the theme is delivered, from the live-DOM audit:
//  - the app themes via a class stamped on <html> ("theme-defaultV2" /
//    "theme-darkV2"), following prefers-color-scheme. The mode is informational:
//    every colour resolves through one FluentProvider whose CSS-in-JS rule
//    defines the full --color-* collection (404 tokens on a loaded mailbox-
//    style page). The engine's "html, html * { token: colour !important }"
//    sweep redefines each token on the consuming element itself, which loses to
//    nothing — the provider rule is a plain class rule, not an inline style.
//  - real colours only. A scan of readable stylesheets found no rgb(var(--x))
//    triplets, so feeding a colour into each slot is the format Teams resolves.
//
// What painted what (measured on the live page, dark mode):
//  - message pane    → --colorNeutralBackground1 (#292929)
//  - entity header   → --colorNeutralBackground3 (#1f1f1f)
//  - left nav pane   → --colorDefaultBackground7 (#1A1A1A) — a TEAMS-OWN token
//    the app paints its navigation/list chrome from, NOT part of Fluent's stock
//    ladder. Map it to the sidebar surface or the nav pane stays a neutral grey
//    slab inside the tinted app.
//  - title bar/canvas→ --colorNeutralBackground5 (#0a0a0a) / Background4.
//  - pre-boot shell  → --theme* custom props on <html> (--themeBackgroundColor,
//    --themeLoadingScreenColor, --themeTitleBar*), which the loading screen
//    paints from before the app hydrates. Overriding them kills the white flash.
//
// What is deliberately NOT mapped:
//  - --colorPalette* (~300 brand-scale primitives): raw colour scales, not
//    semantic slots — same call youtube/outlook make about brand ladders.
//  - The polarity-INVERTING family (--colorNeutralForegroundInverted*,
//    --colorNeutralBackgroundInverted*, --colorNeutralForegroundStaticInverted):
//    OS-level forced-polarity ink/surface, not app chrome.
//  - --colorBackgroundOverlay (scrim) and every --shadow* / --colorTeams*Shadow
//    / --colorBrandShadow* compositing token: black-alpha scrims and shadows are
//    theme-agnostic by design and stay that way.
//  - Geometry: --borderRadius*, --fontSize*, --fontFamily*, --spacing*,
//    --strokeWidth*, --fui-positioning-*, --slot-* — not colours.
//  - The nine chromatic --colorPalette<Hue>* families are left untouched for the
//    same reason: a red exception bubble is the user's status, not the app's.
//
// No light/dark automation and no user setting: every surface, ink and border
// resolves through the mapped tokens, so the pack renders the omarchy surfaces
// on whichever Teams theme is active.
//
// NOT loaded as a bare pack entry: like youtube.js/protonmail.js, Teams's
// content-script entry lists the ENGINE files first (omarchy-colors.js,
// omarchy-surfaces.js, omarchy-runtime.js) and then teams.js. Chromium 152
// injected separate document_start content-script entries in arbitrary order —
// the pack entry ran before the shared engine entry and died with "OmarchyTheme
// is not defined". Within one entry, files execute in listed order in one
// isolated world, so the engine is guaranteed present here. If the manifest is
// ever refactored to a shared engine entry + per-site pack entries, move the
// engine files first AND keep teams.js in the SAME entry as them.

OmarchyTheme.register({
  id: "teams",

  cssVars(theme, s) {
    // Mirror outlook.js's ladder arithmetic: Fluent's 1..6 elevation steps run
    // lightest→darkest, and the engine walks the theme's own direction via s.dir.
    const bg2 = shade(s.bg, s.dir * 0.02);
    const bg5 = shade(s.bg, s.dir * 0.08);
    const bg6 = shade(s.bg, s.dir * 0.1);
    const hover = shade(s.bg, s.dir * 0.04);
    const pressed = shade(s.bg, s.dir * 0.07);
    const strokeStrong = withAlpha(s.fg, s.isDark ? 0.22 : 0.18);
    // The Teams chrome (title bar + canvas) runs a step off the app; keep
    // theme.chrome when the theme really ships one, otherwise step off the
    // sidebar surface.
    const railBg = theme.chrome || shade(s.sidebarBg, s.dir * 0.04);

    // Status inks ride statusColor() so the theme's own palette supplies them;
    // solid tier 3 fills get the page background as their ink.
    const pal = theme.colors || {};
    const danger = statusColor(pal, "danger", [], s.isDark ? "#f85149" : "#d20f39");
    const success = statusColor(pal, "success", [], s.isDark ? "#3fb950" : "#1a7f37");
    const warning = statusColor(pal, "attention", [], s.isDark ? "#d29922" : "#9a6700");
    return {
      // ----- Fluent surfaces (the elevation ladder) -----
      // 1 = message pane / cards / dialogs; 2 = hover chips; 3 = entity header;
      // 4 = the outer chrome; 5/6 keep stepping off the page.
      "--colorNeutralBackground1": s.bg,
      "--colorNeutralBackground1Hover": hover,
      "--colorNeutralBackground1Pressed": pressed,
      "--colorNeutralBackground1Selected": s.selectedBg,
      "--colorNeutralBackground2": bg2,
      "--colorNeutralBackground2Hover": hover,
      "--colorNeutralBackground2Pressed": pressed,
      "--colorNeutralBackground2Selected": s.selectedBg,
      "--colorNeutralBackground3": shade(s.bg, s.dir * 0.03),
      "--colorNeutralBackground3Hover": hover,
      "--colorNeutralBackground3Pressed": pressed,
      "--colorNeutralBackground3Selected": s.selectedBg,
      "--colorNeutralBackground4": railBg,
      "--colorNeutralBackground4Hover": hover,
      "--colorNeutralBackground4Pressed": pressed,
      "--colorNeutralBackground4Selected": s.selectedBg,
      "--colorNeutralBackground5": bg5,
      "--colorNeutralBackground5Hover": hover,
      "--colorNeutralBackground5Pressed": pressed,
      "--colorNeutralBackground5Selected": s.selectedBg,
      "--colorNeutralBackground6": bg6,
      "--colorNeutralBackground7": shade(s.bg, s.dir * 0.11),
      "--colorNeutralBackground7Hover": hover,
      "--colorNeutralBackground7Pressed": pressed,
      "--colorNeutralBackground7Selected": s.selectedBg,
      "--colorNeutralBackground8": shade(s.bg, s.dir * 0.01),
      "--colorNeutralBackgroundStatic": s.bg,
      "--colorNeutralBackgroundDisabled": bg2,
      "--colorNeutralBackgroundDisabled2": bg2,
      "--colorNeutralBackgroundAlpha": withAlpha(s.bg, 0.9),
      "--colorNeutralBackgroundAlpha2": withAlpha(s.bg, 0.8),

      // The Teams-OWN nav token. Without this the left navigation/channel pane
      // stays Teams's neutral #1a1a1a inside the tinted app.
      "--colorDefaultBackground7": s.sidebarBg,

      // ----- Fluent text -----
      "--colorNeutralForeground1": s.fg,
      "--colorNeutralForeground2": withAlpha(s.fg, 0.88),
      "--colorNeutralForeground3": s.sidebarMuted,
      "--colorNeutralForeground4": withAlpha(s.fg, 0.55),
      "--colorNeutralForeground5": withAlpha(s.fg, 0.45),
      "--colorNeutralForegroundDisabled": withAlpha(s.fg, 0.38),
      "--colorNeutralForegroundOnBrand": s.bg,

      // ----- Fluent borders -----
      "--colorNeutralStroke1": strokeStrong,
      "--colorNeutralStroke2": s.borderColor,
      "--colorNeutralStroke3": s.borderColor,
      "--colorNeutralStroke4": withAlpha(s.fg, 0.05),
      "--colorNeutralStrokeAlpha": withAlpha(s.fg, 0.12),
      "--colorNeutralStrokeAlpha2": withAlpha(s.fg, 0.18),
      "--colorNeutralStrokeSubtle": withAlpha(s.fg, 0.06),
      "--colorNeutralStrokeDisabled": withAlpha(s.fg, 0.1),
      "--colorNeutralStrokeAccessible": withAlpha(s.fg, 0.6),
      "--colorNeutralStrokeAccessibleHover": withAlpha(s.fg, 0.7),
      "--colorNeutralStrokeAccessibleSelected": s.accent,
      "--colorNeutralStrokeAccessiblePressed": withAlpha(s.fg, 0.65),
      "--colorNeutralStrokeOnBrand": withAlpha(s.bg, 0.7),
      "--colorNeutralStrokeOnBrand2": withAlpha(s.bg, 0.5),
      "--colorNeutralStrokeOnBrand2Hover": withAlpha(s.bg, 0.5),
      "--colorNeutralStrokeOnBrand2Pressed": withAlpha(s.bg, 0.5),
      "--colorNeutralStrokeOnBrand2Selected": withAlpha(s.bg, 0.5),

      // ----- Brand → accent -----
      "--colorBrandBackground": s.accent,
      "--colorBrandBackgroundHover": shade(s.accent, s.dir * 0.08),
      "--colorBrandBackgroundPressed": s.accent,
      "--colorBrandBackgroundSelected": shade(s.accent, s.dir * 0.08),
      "--colorBrandBackgroundStatic": s.accent,
      "--colorBrandBackground2": withAlpha(s.accent, 0.15),
      "--colorBrandBackground3Static": s.accent,
      "--colorBrandBackground4Static": shade(s.accent, s.dir * 0.12),
      "--colorBrandForeground1": s.accent,
      "--colorBrandForeground2": shade(s.accent, s.dir * 0.08),
      "--colorBrandForeground2Hover": shade(s.accent, s.dir * 0.08),
      "--colorBrandForeground2Pressed": shade(s.accent, s.dir * 0.14),
      "--colorBrandStroke1": withAlpha(s.accent, 0.7),
      "--colorBrandStroke2": withAlpha(s.accent, 0.5),
      "--colorBrandStroke2Hover": withAlpha(s.accent, 0.5),
      "--colorBrandStroke2Pressed": withAlpha(s.accent, 0.5),
      "--colorBrandStroke2Contrast": s.accent,

      // ----- Links (Fluent links ride the brand family) -----
      "--colorBrandForegroundLink": s.accent,
      "--colorBrandForegroundLinkHover": shade(s.accent, s.dir * 0.06),
      "--colorBrandForegroundLinkSelected": s.accent,
      "--colorBrandForegroundLinkPressed": shade(s.accent, s.dir * 0.12),
      "--colorCompoundBrandForeground1": s.accent,
      "--colorCompoundBrandForeground1Hover": shade(s.accent, s.dir * 0.06),
      "--colorCompoundBrandForeground1Pressed": shade(s.accent, s.dir * 0.12),
      "--colorCompoundBrandStroke": s.accent,
      "--colorCompoundBrandStrokeHover": shade(s.accent, s.dir * 0.06),
      "--colorCompoundBrandStrokePressed": shade(s.accent, s.dir * 0.12),
      "--colorCompoundBrandBackground": s.accent,
      "--colorCompoundBrandBackgroundHover": shade(s.accent, s.dir * 0.06),
      "--colorCompoundBrandBackgroundPressed": shade(s.accent, s.dir * 0.12),

      // ----- Teams-OWN brand family (the app icon / rail accents) -----
      "--colorTeamsBrand1": s.accent,
      "--colorTeamsBrand1Hover": shade(s.accent, s.dir * 0.08),
      "--colorTeamsBrand1Pressed": shade(s.accent, s.dir * 0.16),
      "--colorTeamsBrand1Selected": shade(s.accent, s.dir * 0.08),

      // ----- Hover/selection washes -----
      "--colorSubtleBackgroundHover": s.hoverBg,
      "--colorSubtleBackgroundPressed": s.selectedBg,
      "--colorSubtleBackgroundSelected": s.selectedBg,
      "--colorSubtleBackgroundLightAlphaHover": s.hoverBg,
      "--colorSubtleBackgroundLightAlphaPressed": s.selectedBg,
      "--colorSubtleBackgroundLightAlphaSelected": s.selectedBg,
      "--colorTransparentBackgroundHover": s.hoverBg,
      "--colorTransparentBackgroundPressed": s.selectedBg,
      "--colorTransparentBackgroundSelected": s.selectedBg,
      "--colorTransparentStroke": withAlpha(s.fg, 0.02),
      "--colorTransparentStrokeInteractive": s.borderColor,
      "--colorTransparentStrokeDisabled": withAlpha(s.fg, 0.06),

      // ----- Cards + overlay scrollbar + stale/missing content -----
      "--colorNeutralCardBackground": s.bg,
      "--colorNeutralCardBackgroundHover": s.hoverBg,
      "--colorNeutralCardBackgroundPressed": s.selectedBg,
      "--colorNeutralCardBackgroundSelected": s.selectedBg,
      "--colorNeutralCardBackgroundDisabled": bg2,
      "--colorScrollbarOverlay": withAlpha(s.fg, 0.35),
      "--colorNeutralStencil1": withAlpha(s.fg, 0.06),
      "--colorNeutralStencil1Alpha": withAlpha(s.fg, 0.05),
      "--colorNeutralStencil2": withAlpha(s.fg, 0.08),
      "--colorNeutralStencil2Alpha": withAlpha(s.fg, 0.07),

      // ----- Avatars (initial-letter chips) -----
      "--colorAvatar": s.bg,
      "--colorAvatarBackground": s.accent,

      // ----- Focus rings (Fluent pairs an outer/inner ring for contrast on
      // bright fills; on a themed surface the accent/bright pair reads as one) -----
      "--colorStrokeFocus1": s.accent,
      "--colorStrokeFocus2": withAlpha(s.fg, 0.9),

      // ----- Status families -----
      "--colorStatusDangerBackground1": withAlpha(danger, 0.15),
      "--colorStatusDangerBackground2": withAlpha(danger, 0.22),
      "--colorStatusDangerBackground3": danger,
      "--colorStatusDangerForeground1": danger,
      "--colorStatusDangerForeground2": danger,
      "--colorStatusDangerForeground3": danger,
      "--colorStatusDangerForegroundInverted": s.bg,
      "--colorStatusDangerBorder1": withAlpha(danger, 0.5),
      "--colorStatusDangerBorder2": withAlpha(danger, 0.7),
      "--colorStatusDangerBorderActive": withAlpha(danger, 0.7),
      "--colorStatusDangerBackground3Hover": shade(danger, s.dir * 0.08),
      "--colorStatusDangerBackground3Pressed": shade(danger, s.dir * 0.16),

      "--colorStatusSuccessBackground1": withAlpha(success, 0.15),
      "--colorStatusSuccessBackground2": withAlpha(success, 0.22),
      "--colorStatusSuccessBackground3": success,
      "--colorStatusSuccessForeground1": success,
      "--colorStatusSuccessForeground2": success,
      "--colorStatusSuccessForeground3": success,
      "--colorStatusSuccessForegroundInverted": s.bg,
      "--colorStatusSuccessBorder1": withAlpha(success, 0.5),
      "--colorStatusSuccessBorder2": withAlpha(success, 0.7),
      "--colorStatusSuccessBorderActive": withAlpha(success, 0.7),

      "--colorStatusWarningBackground1": withAlpha(warning, 0.15),
      "--colorStatusWarningBackground2": withAlpha(warning, 0.22),
      "--colorStatusWarningBackground3": warning,
      "--colorStatusWarningForeground1": warning,
      "--colorStatusWarningForeground2": warning,
      "--colorStatusWarningForeground3": warning,
      "--colorStatusWarningForegroundInverted": s.bg,
      "--colorStatusWarningBorder1": withAlpha(warning, 0.5),
      "--colorStatusWarningBorder2": withAlpha(warning, 0.7),
      "--colorStatusWarningBorderActive": withAlpha(warning, 0.7),

      // ----- Outer canvas + pre-boot shell (loading screen / title bar) -----
      "--backgroundCanvas": s.bg,
      "--themeBackgroundColor": s.bg,
      "--themeColor": s.fg,
      "--themeLoadingScreenColor": s.bg,
      "--themeCarouselTextColor": s.sidebarMuted,
      "--themeTitleBarBackgroundColor": railBg,
      "--themeTitleBarColor": s.sidebarMuted,
      "--themeTitleBarButtonHoverBackgroundColor": s.hoverBg,
      "--themeTitleBarButtonHoverColor": s.fg,
    };
  },
});