// ===== omarchy-colors (shared color library — same file scope)
// Omarchy web-app theming — shared color library (app-agnostic).
//
// App-agnostic helpers for turning an omarchy theme's hex values into the
// surfaces an app pack paints with. Loaded first in the content-script list so
// every later script (omarchy-surfaces.js, omarchy-runtime.js, and each app
// pack) shares these in the content script's isolated-world global scope.

document.documentElement.setAttribute("data-omarchy-colors-loaded", "1");

function hexToRgb(hex) {
  // Accept rgb(r, g, b) too — shade() emits that form, and we sometimes
  // chain shade() output back through mix()/withAlpha().
  if (typeof hex === "string" && hex.startsWith("rgb")) {
    const m = hex.match(/\d+/g);
    if (m && m.length >= 3) {
      return { r: +m[0], g: +m[1], b: +m[2] };
    }
    return null;
  }
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// WCAG relative luminance needs each channel linearized (gamma-decoded) first;
// weighting the raw sRGB bytes misclassifies mid-tone backgrounds (#808080 reads
// 0.502 raw vs 0.216 linearized). Every shipped omarchy theme lands the same
// either way — a custom mid-tone background need not.
function channelLuminance(byte) {
  const channel = byte / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relLuminance({ r, g, b }) {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function shade(hex, delta) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + delta * 255)));
  return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
}

function withAlpha(hex, alpha) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

// WCAG contrast ratio between two colors. Both are composited/opaque by the
// time they get here — pass the surface a translucent ink will actually sit on,
// not the ink's rgba() string.
function contrastRatio(colorA, colorB) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return 1;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Pick the lowest alpha at which `ink` over EVERY surface in `surfaces` clears
// `target` contrast. Muted text is a fixed fraction of the foreground in most
// theming systems, but a fixed fraction ignores how much contrast the theme's fg
// had to begin with: at the old flat 0.65, 5 of the 22 shipped omarchy themes put
// muted text below the WCAG AA 4.5:1 floor (rose-pine was worst at 3.00:1), and
// GitHub spends --fgColor-muted on real copy — issue metadata, mega-menu
// descriptions — not just incidental labels.
//
// Contrast is monotonic in alpha (compositing walks the colour from the surface
// toward the ink, and luminance is monotonic in the channels), so a rising scan
// finds the minimum. Returns 1 when even the opaque foreground can't reach the
// target — on a low-headroom theme that means muted lands on fg and the
// muted/primary distinction flattens, which is the accepted cost of the target.
function alphaForContrast(ink, surfaces, target, floorAlpha) {
  const floor = floorAlpha == null ? 0.65 : floorAlpha;
  const list = (Array.isArray(surfaces) ? surfaces : [surfaces]).filter(Boolean);
  if (!list.length) return floor;
  for (let a = floor; a < 1; a += 0.01) {
    const ok = list.every((surface) => contrastRatio(mix(surface, ink, a), surface) >= target);
    if (ok) return Math.round(a * 100) / 100;
  }
  return 1;
}

// Pick the ink for text/icons that ride on a SATURATED FILL (an accent button,
// a badge, a selected chip). The conventional answer is the page background —
// dark ink on a light accent, light ink on a dark one — and on most palettes
// that's both legible and the most theme-coherent choice. But it is only a
// convention, not a guarantee: an accent that sits in the MIDDLE of the range
// contrasts poorly with the page AND with the foreground. Measured across the 22
// shipped themes, three land there — rose-pine (accent #56949f on page #faf4ed:
// 3.14:1), miasma (#78824b: 3.86:1) and catppuccin-latte (#1e66f5: 4.34:1) — all
// under the AA 4.5:1 floor for the button LABELS this ink is spent on.
//
// So try the theme's own colors first, in the caller's order of preference, and
// only escalate to plain white/black when neither reads. Escalating costs some
// theme coherence on those three palettes; not escalating costs legibility on
// the one control the user is most likely to click. Returns the best candidate
// available when nothing clears the target, so the caller always gets a color.
function inkOn(fill, candidates, target) {
  const want = target == null ? 4.5 : target;
  const list = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
  for (const ink of list) {
    if (contrastRatio(ink, fill) >= want) return ink;
  }
  const all = list.concat(["#ffffff", "#000000"]);
  let best = all[0];
  let bestRatio = -1;
  for (const ink of all) {
    const r = contrastRatio(ink, fill);
    if (r > bestRatio) {
      bestRatio = r;
      best = ink;
    }
  }
  return best;
}

// Emit "r, g, b" — a bare channel list, NOT a color. Some design systems (see
// Slack's --sk_* tokens) hold their palette as triplets and composite at the
// point of use: `color: rgba(var(--sk_primary_foreground), .7)`. Feeding a real
// color into one of those produces `rgba(#a9b1d6, .7)`, which is invalid at
// computed-value time — the declaration is dropped and an inherited property
// like `color` silently unwinds to the UA default (white under color-scheme:
// dark, black under light) instead of failing visibly. Always verify how a token
// is consumed before overriding it; the format is part of the contract.
function toTriplet(color) {
  const c = hexToRgb(color);
  if (!c) return color;
  return `${c.r}, ${c.g}, ${c.b}`;
}

function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  const r = Math.round(a.r * (1 - t) + b.r * t);
  const g = Math.round(a.g * (1 - t) + b.g * t);
  const bl = Math.round(a.b * (1 - t) + b.b * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// ===== semantic status colors =============================================
//
// success / danger / attention / done are NOT decorative. GitHub paints a
// pending check amber and a passing one green, so getting the hue wrong doesn't
// look slightly off — it MISREPORTS STATE. Two traps, both hit in practice:
//
//  1. A SLOT'S NAME DOES NOT PROMISE ITS HUE. osaka-jade ships
//     yellow = #459451 (a green, hue 129) and matte-black ships
//     green = #FFC107 (an amber) alongside yellow = #b91c1c (a red). 14 of the
//     28 themes on a stock machine have at least one such slot. Reading
//     `pal.yellow` for "attention" painted GitHub's in-progress spinner green —
//     visually identical to "all checks passed".
//  2. SOME PALETTES HAVE NO SUCH COLOR AT ALL. `white` and `vantablack` are
//     monochrome by design; `lumon` is blue end to end. There is nothing honest
//     to pick, and a faked status color is worse than an unthemed one — the
//     site's own default at least still means what the site says it means.
//
// Strategy: try the conventionally-named slots first (ANSI color1/2/3/5 and
// their bright twins included — that numbering is itself a convention), accept
// one only when its hue actually matches the role AND it stays perceptually
// clear of the roles already assigned, otherwise search the rest of the palette,
// otherwise fall back to the site's default.
//
// Hue classification uses HSL (cheap, and it's the space these palettes are
// authored in) while the "is this actually a color" and "are two roles
// distinguishable" tests use CIELab, which is perceptual. That split matters:
// a near-black like #12140e scores 0.18 HSL *saturation* but has almost no Lab
// chroma, and it slipped through an early saturation-only gate as a "green".

// CIELab, reusing the same gamma decode as relLuminance so this agrees with the
// WCAG math elsewhere in this file. D65 white point.
function labOf(color) {
  const c = hexToRgb(color);
  if (!c) return null;
  const x = (channelLuminance(c.r) * 0.4124 + channelLuminance(c.g) * 0.3576 +
             channelLuminance(c.b) * 0.1805) / 0.95047;
  const y = channelLuminance(c.r) * 0.2126 + channelLuminance(c.g) * 0.7152 +
            channelLuminance(c.b) * 0.0722;
  const z = (channelLuminance(c.r) * 0.0193 + channelLuminance(c.g) * 0.1192 +
             channelLuminance(c.b) * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// Lab chroma — distance from the neutral axis. Unlike HSL saturation this does
// not inflate at extreme lightness, so it's the honest "is this a color" test.
function chromaOf(color) {
  const lab = labOf(color);
  return lab ? Math.sqrt(lab.a * lab.a + lab.b * lab.b) : 0;
}

// CIE76. Crude next to CIEDE2000, but we only need a "clearly different color"
// threshold, and it's a handful of lines instead of forty.
function deltaE(colorA, colorB) {
  const a = labOf(colorA);
  const b = labOf(colorB);
  if (!a || !b) return 0;
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

// HSL hue in degrees, or null when the color is achromatic (hue is undefined
// for greys — that's the signal monochrome themes give us).
function hueOf(color) {
  const c = hexToRgb(color);
  if (!c) return null;
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return null;
  let h;
  if (mx === r) h = ((g - b) / d + 6) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h * 60;
}

function hueDistance(hue, target) {
  if (hue == null) return Infinity;
  const d = Math.abs(hue - target) % 360;
  return Math.min(d, 360 - d);
}

// target: the hue a role should read as. tolerance: how far a candidate may sit
// from it — wider for green because terminal "greens" skew olive (gruvbox 70°,
// everforest 83°) and narrower for amber, which turns into orange or lime fast.
// preferred: slots to try in order before searching, most conventional first.
const STATUS_ROLES = {
  danger:    { target: 2,   tolerance: 50, preferred: ["red", "bright_red", "color1", "color9"] },
  success:   { target: 105, tolerance: 55, preferred: ["green", "bright_green", "color2", "color10"] },
  attention: { target: 45,  tolerance: 40, preferred: ["yellow", "bright_yellow", "orange", "color3", "color11"] },
  done:      { target: 300, tolerance: 50, preferred: ["magenta", "bright_magenta", "color5", "color13"] },
};

// Slots that describe the UI's structure rather than its palette. Never status
// candidates — `background` being coincidentally green-ish must not make it the
// success color.
const STRUCTURAL_SLOTS = new Set([
  "background", "dark_background", "darker_background", "lighter_background",
  "foreground", "dark_foreground", "light_foreground", "bright_foreground",
  "selection", "selection_background", "selection_foreground", "muted",
  "accent", "cursor", "cursor_text", "border", "mode",
  "active_border_color", "inactive_border_color",
  "active_tab_background", "active_tab_foreground",
  "inactive_tab_background", "inactive_tab_foreground",
]);

// A named slot only has to be recognisably its own hue — the author calling it
// "red" is evidence of intent, so miasma's muted #685742 still earns danger. An
// unnamed candidate we picked ourselves has no such backing, so it must be
// unambiguously colorful and not near-black/near-white.
// Named slots used to need only chroma >= 8 on the theory that the author calling
// something "red" was evidence enough. It isn't: miasma's red is #685742, chroma
// 15.2 — a brown — and ethereal's green is #92a593, chroma 12.4, a desaturated
// sage. Both passed, and a brown "failed check" doesn't read as failed. A status
// colour has to be recognisably its own hue before intent counts for anything,
// so the floor is now high enough to demand an actual colour while still well
// under the level a deliberately muted palette can reach.
const NAMED_MIN_CHROMA = 20;
const SEARCHED_MIN_CHROMA = 25;
const SEARCHED_L_RANGE = [25, 90];
// Below this two roles read as "the same color" at a glance.
const ROLE_MIN_DELTA_E = 18;
// ...and dE alone isn't enough for THESE roles. Two oranges can sit 20 dE apart
// and still both read "orange": retro-82 resolved danger at hue 14 and attention
// at hue 22, eight degrees apart, so "failing" and "in progress" were the same
// colour to a glance even though the perceptual distance passed. Roles must also
// be separated around the hue wheel.
const ROLE_MIN_HUE_SEPARATION = 35;

function statusCandidateOk(color, role, taken, named) {
  const spec = STATUS_ROLES[role];
  if (!spec || !color) return false;
  if (hueDistance(hueOf(color), spec.target) > spec.tolerance) return false;
  if (chromaOf(color) < (named ? NAMED_MIN_CHROMA : SEARCHED_MIN_CHROMA)) return false;
  if (!named) {
    const L = labOf(color).L;
    if (L < SEARCHED_L_RANGE[0] || L > SEARCHED_L_RANGE[1]) return false;
  }
  const hue = hueOf(color);
  return taken.every((other) => {
    if (deltaE(color, other) < ROLE_MIN_DELTA_E) return false;
    // An achromatic neighbour can't be confused by hue, and hueDistance() would
    // read its null hue as 0 and measure from red.
    const otherHue = hueOf(other);
    if (otherHue == null) return true;
    return hueDistance(hue, otherHue) >= ROLE_MIN_HUE_SEPARATION;
  });
}

// Resolve one role. `taken` is the colors already assigned to other roles.
// Returns the site's `fallback` when the palette has nothing honest to offer.
function statusColor(palette, role, taken, fallback) {
  const spec = STATUS_ROLES[role];
  const pal = palette || {};
  const chosen = taken || [];
  if (!spec) return fallback;

  for (const slot of spec.preferred) {
    if (pal[slot] && statusCandidateOk(pal[slot], role, chosen, true)) return pal[slot];
  }

  let best = null;
  let bestScore = Infinity;
  for (const slot of Object.keys(pal)) {
    if (STRUCTURAL_SLOTS.has(slot)) continue;
    const color = pal[slot];
    if (!statusCandidateOk(color, role, chosen, false)) continue;
    // closest hue wins; chroma breaks ties toward the more vivid candidate
    const score = hueDistance(hueOf(color), spec.target) - chromaOf(color) / 10;
    if (score < bestScore) {
      best = color;
      bestScore = score;
    }
  }
  return best || fallback;
}

// The palette's most perceptually DISTANT real colour from `avoid`, for markers
// that must stand out rather than mean something. Status roles are the wrong tool
// there: they refuse to invent a hue that isn't present, which is right for
// "pending" or "failed" but leaves a marker with nothing at all on a palette that
// simply has no warm colour. spacex-terrafab is the case in point — every slot
// sits between hue 184 and 276, its "red" is #9c8ba9 (a violet) and its "yellow"
// is #c4f6ff (a cyan) — so attention and danger both correctly decline, yet
// #bcfbff still sits 50 dE from that theme's accent and reads unmistakably.
//
// Requires real chroma, and enough contrast against `surface` to be visible as a
// hairline. Returns null when nothing clears the distinctness floor, so callers
// keep their own last resort.
function highlightColor(palette, avoid, surface, minChroma) {
  const pal = palette || {};
  const floor = minChroma == null ? 18 : minChroma;
  let best = null;
  let bestScore = -Infinity;
  for (const slot of Object.keys(pal)) {
    if (STRUCTURAL_SLOTS.has(slot)) continue;
    const color = pal[slot];
    if (!color || chromaOf(color) < floor) continue;
    if (surface && contrastRatio(color, surface) < 3) continue;
    const d = deltaE(color, avoid);
    if (d > bestScore) {
      bestScore = d;
      best = color;
    }
  }
  return bestScore >= ROLE_MIN_DELTA_E ? best : null;
}

// Resolve all four together. Order is deliberate — danger and success are the
// two a user is most likely to act on, so they get first claim on the palette
// and later roles must stay clear of them rather than the other way round.
// `defaults` supplies the site's own shipped colors, keyed by role.
// Do two roles read as the same colour? Both tests matter: dE catches "these are
// the same shade", hue separation catches "these are both orange".
function statusRolesClash(a, b) {
  if (!a || !b) return false;
  if (deltaE(a, b) < ROLE_MIN_DELTA_E) return true;
  const ha = hueOf(a);
  const hb = hueOf(b);
  if (ha == null || hb == null) return false;
  return hueDistance(ha, hb) < ROLE_MIN_HUE_SEPARATION;
}

function statusPalette(palette, defaults) {
  const defs = defaults || {};
  const roles = ["danger", "success", "attention", "done"];
  const out = {};
  const taken = [];
  for (const role of roles) {
    const color = statusColor(palette, role, taken, defs[role]);
    if (color) taken.push(color);
    out[role] = color;
  }

  // Repair pass. statusColor() returns its fallback WITHOUT the distinctness
  // test — the palette had nothing to offer, so there was nothing to test — and
  // that can seat the site's amber right next to a themed red: miasma ended up
  // with danger #b36d43 (hue 23) beside the fallback attention #d29922 (hue 41),
  // 18 degrees apart, which is the same "can't tell failing from pending" problem
  // the hue rule exists to prevent.
  //
  // The site's own four are mutually distinct by construction (Primer's are all
  // >= 37 degrees apart), so whenever a fallback clashes with a themed sibling,
  // drop that sibling to ITS default too and re-check. Each step moves one role
  // to a default and never back, so this terminates.
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of roles) {
      for (const b of roles) {
        if (a === b || !statusRolesClash(out[a], out[b])) continue;
        const aDefault = out[a] === defs[a];
        const bDefault = out[b] === defs[b];
        if (aDefault && !bDefault && defs[b]) {
          out[b] = defs[b];
          changed = true;
        } else if (bDefault && !aDefault && defs[a]) {
          out[a] = defs[a];
          changed = true;
        }
      }
    }
  }
  return out;
}

// ===== omarchy-recolor (universal engine) =====
// Omarchy web-app theming — UNIVERSAL RECOLOR ENGINE (experimental, v2).
//
// Replaces the per-site pack model with one site-agnostic strategy: repaint
// EVERY color the page uses with a color from the current omarchy palette,
// preserving the page's own ROLES. v1's plain nearest-color matching merged
// the ink and surface worlds (a near-white background mapped onto
// light_foreground — an ink slot — and broke readability), so v2 splits the
// palette into three disjoint target sets and maps into the right one:
//
//   surfaces  — background/darker_background/lighter_background/selection/
//               chrome slots + derived mix(bg → fg) elevation rungs
//   inks      — foreground/dark/light/bright_foreground/cursor/muted slots +
//               derived muting rungs
//   chromatic — red/green/blue/yellow/orange/magenta/cyan/brown/bright_* and
//               accent; classes with chroma above NEUTRAL_CHROMA map HERE
//               regardless of role, so links/buttons/status colors keep their
//               hue instead of collapsing into gray
//
// Property decides the target for neutral colors: `color`/caret/decoration/
// text-fill/stroke → ink set; background/border/outline/shadow → surface
// set. Custom properties are role-unknown ("any"): they map over the union
// neutral pool so nothing inverts, and the contrast pass repairs the pairs
// that land badly.
//
// Contrast pass: after the CSSOM/inline map, every visible element's computed
// ink is checked against its effective painted surface (first opaque painted
// ancestor). Pairs under 4:1 get the best readable candidate from the same
// hue family first, then the theme ink ladder (inkOn-based). Contrast is thus
// preserved by construction even where page-authored pairs were already
// broken.
//
// Fonts: html/body get the omarchy system font (theme.font when the host
// carries one, else the Omarchy default stack) important — inheritance hits
// sites that don't set their own family, sites that do keep theirs.
//
// Data flow (same animal as before): content script → background.js →
// native host → ~/.local/state/omarchy/current. Getting here means omarchy
// 4+ and host_permissions <all_urls>.
//
// Known limits (accepted for the experiment):
//   - Cross-origin stylesheets (cssRules SecurityError) are skipped.
//   - color-mix() etc. is mapped only through its inner color arguments.
//   - Canvas/WebGL pixels are out of reach.
//   - Role inference is per-declaration, not per-painted-pair; the contrast
//     pass is the net that catches misclassified pairs.

(function () {
  if (window.__omarchyRecolorInstalled) return;
  window.__omarchyRecolorInstalled = true;
  // Canary visible from the page's MAIN world through BiDi probes.
  document.documentElement.setAttribute("data-omarchy-cs", "1");

  const NEUTRAL_CHROMA = 16; // Lab chroma floor for calling a color "chromatic"
  // A SOURCE color is routed into the chromatic family only when it is a real,
  // usable color: vivid enough to read as a hue AND sitting clearly inside the
  // lightness range. Both tests matter. Chroma alone misfiles every dark tinted
  // surface — #05182e (GitHub's dark navy) scores 17.1, over NEUTRAL_CHROMA, and
  // landed on the theme's brown; and lightness alone would still send the
  // theme's own cream foreground (chroma 23.9) to the accent. VIVID_CHROMA is
  // set above the muted-but-tinted neutrals (miasma brown 18.4, the theme's
  // cream fg 23.9) so only genuinely saturated copy/fills keep a hue.
  const VIVID_CHROMA = 28;
  const VIVID_L_MIN = 15; // near-black carries no usable hue
  const VIVID_L_MAX = 90; // near-white neither
  const CONTRAST_FLOOR = 4.5; // ink vs surface below this gets repaired (WCAG AA)

  const state = {
    theme: null,
    palette: null, // { surfaces, inks, chromatic, union } — arrays of { css, lab }
    enabled: null, // null until the settings read lands; pends application
    pendingTheme: null,
    themeDark: null, // theme polarity (WCAG luminance of theme.bg)
    surfaceAnchor: null, // theme.bg as css — the base "background" target
    inkAnchor: null, // theme.fg as css — the base "text" target
    cache: new Map(), // "group|original value" -> mapped value
    snapshots: new WeakMap(), // CSSStyleDeclaration -> [[prop, value, priority]]
    inlineSeen: new WeakMap(), // Element -> last style attribute string
    attrSnap: new WeakMap(), // Element -> { attr: original value }
    sheetsSeen: new WeakSet(),
    contrastWalked: new WeakMap(), // Element -> last "(ink|surface)" checked
    contrastTimer: null,
    contrastDebounce: null, // trailing full pass after a mutation burst
    inkOrig: new WeakMap(), // Element -> pre-fix inline style attr string
  };

  // ===== palette / role groups ============================================

  function slotGroup(name) {
    // colors.toml schema is stable across omarchy themes: *_background and
    // selection paint backdrops, *foreground/cursor/muted paint inks, and
    // the ANSI + accent slots are the chroma family. NAME decides, not
    // chroma — retro-82's foreground (#f6dcac, a cream) is chromatic-looking
    // yet is every text's ink slot; chroma must only classify UNKNOWN
    // source colors from the page, not the theme's own named slots.
    if (/background/.test(name) || name === "selection" || name === "chrome")
      return "surface";
    if (/foreground/.test(name) || name === "cursor" || name === "cursor_text" || name === "muted")
      return "ink";
    // ANSI-style scale + accent behave as "chroma slots" even when muted
    // (miasma's brown still reads as its hue family).
    return "chromatic";
  }

  function buildPalette(theme) {
    const surfaces = [];
    const inks = [];
    const chromatic = [];
    const seen = new Set();
    const add = (name, v, forceGroup) => {
      const c = hexToRgb(v);
      if (!c) return;
      const key = `${c.r},${c.g},${c.b}`;
      if (seen.has(key)) return;
      seen.add(key);
      const css = `rgb(${c.r}, ${c.g}, ${c.b})`;
      const lab = labOf(css);
      const group = forceGroup || slotGroup(name || "");
      const entry = { css, lab };
      (group === "surface" ? surfaces : group === "ink" ? inks : chromatic).push(entry);
    };

    // Named fields first so they win ties, then the whole colors.toml.
    add("background", theme.bg, "surface");
    add("foreground", theme.fg, "ink");
    add("accent", theme.accent);
    add("selection_background", theme.selection_bg, "surface");
    add("chrome", theme.chrome, "surface");
    const colors = theme.colors || {};
    for (const slot of Object.keys(colors)) add(slot, colors[slot]);

    const bg = hexToRgb(theme.bg);
    const fg = hexToRgb(theme.fg);
    if (bg && fg) {
      // Elevation rungs: the theme's own surfaces are too coarse for modern
      // UI (a page's #f6f6ef sits well above background), so derived mix()
      // rungs give the neutral mapping a finer ladder to preserve which
      // surface was which — light stays light, dark stays dark, order keeps.
      for (const t of [0.04, 0.09, 0.15, 0.25]) {
        const rgb = mix(theme.bg, theme.fg, t);
        const c2 = hexToRgb(rgb);
        if (!seen.has(`${c2.r},${c2.g},${c2.b}`)) {
          seen.add(`${c2.r},${c2.g},${c2.b}`);
          surfaces.push({ css: rgb, lab: labOf(rgb) });
        }
      }
      for (const t of [0.35, 0.6]) {
        const rgb = mix(theme.fg, theme.bg, t);
        const c2 = hexToRgb(rgb);
        if (!seen.has(`${c2.r},${c2.g},${c2.b}`)) {
          seen.add(`${c2.r},${c2.g},${c2.b}`);
          inks.push({ css: rgb, lab: labOf(rgb) });
        }
      }
    }
    return { surfaces, inks, chromatic, union: inks.concat(surfaces) };
  }

  function nearestIn(group, css) {
    const set = state.palette[group];
    if (!set || !set.length) return null;
    const lab = labOf(css);
    if (!lab) return null;
    let best = null;
    let bestD = Infinity;
    for (const entry of set) {
      const d =
        (entry.lab.L - lab.L) ** 2 +
        (entry.lab.a - lab.a) ** 2 +
        (entry.lab.b - lab.b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = entry;
      }
    }
    return best && best.css;
  }

  // Neutral source colors, matched with POLARITY in mind.
  //
  // The palette's surface ladder runs from theme.bg outward and the ink ladder
  // from theme.fg inward, so same-polarity pages preserve elevation. But a page
  // whose polarity OPPOSES the theme's (a dark page under a light theme — easy
  // to hit, because sites that switch on the CSS `prefers-color-scheme` media
  // query follow the OS, which no content script can spoof) would otherwise map
  // its page background onto the far end of the ladder: GitHub's dark
  // `--bgColor-default` became the theme's mid-grey selection, and its body
  // text became the theme's foreground, i.e. a light-on-dark page under a light
  // theme. When the source sits on the wrong side of mid-L, anchor it on the
  // theme's own base for that role (background → bg, text → fg). Elevation is
  // lost for those pages, which is the right trade for never inverting.
  function mapNeutral(css, set) {
    const lab = labOf(css);
    const anchor = set === "inks" ? state.inkAnchor : state.surfaceAnchor;
    if (!lab) return nearestIn(set, css) || anchor;
    // A background's lightness tells you the page's polarity directly; an
    // ink's tells you the INVERSE (light copy means a dark page). Compare the
    // page's implied polarity — not the colour's own — against the theme's.
    const pageDark = set === "inks" ? lab.L >= 50 : lab.L < 50;
    if (state.themeDark != null && pageDark !== state.themeDark) return anchor;
    return nearestIn(set, css) || anchor;
  }

  // Chromatic source colors match by HUE, not by raw Lab distance. A palette
  // has few chromatic slots and usually no blue at all, so Euclidean distance
  // from a saturated blue finds the closest thing in *lightness*, which was
  // GitHub's #0969da landing on the theme's MAGENTA (85 degrees away) instead
  // of its blue/cyan family. Hue first, lightness as the tie-breaker, keeps
  // "blue stays blue-ish" while still picking the closest available shade.
  function nearestChromatic(css) {
    const set = state.palette && state.palette.chromatic;
    if (!set || !set.length) return null;
    const lab = labOf(css);
    if (!lab) return null;
    const hue = hueOf(css);
    if (hue == null) return nearestIn("chromatic", css);
    let best = null;
    let bestScore = Infinity;
    for (const entry of set) {
      const eh = hueOf(entry.css);
      if (eh == null) continue;
      const score = hueDistance(hue, eh) + Math.abs(entry.lab.L - lab.L) * 0.25;
      if (score < bestScore) {
        bestScore = score;
        best = entry.css;
      }
    }
    return best || nearestIn("chromatic", css);
  }

  // ===== color resolution =================================================
  //
  // A canvas 2D fillStyle parses ANY CSS color syntax (hex, named, rgb/hsl,
  // oklab/oklch/lab/color(), system colors) — so we get a universal parser with
  // zero color math of our own. An invalid value leaves the previous fillStyle
  // untouched, so each parse resets to a transparent sentinel first.
  //
  // The serializer is the trap: the `fillStyle` getter only hands back legacy
  // syntaxes (hex/rgb/hsl) as sRGB. A modern color function comes straight back
  // in its OWN space — `oklab(0.16 -0.01 0.001 / 0.2)` — and parsing those
  // decimals as RGB bytes silently invents a color (Tailwind v4 is built on
  // `oklab`/`color-mix`, so this hit almost everything). Rasterize instead:
  // one pixel of the 2D canvas IS sRGB, so read it back and hand off real
  // bytes. The canvas is 1x1 and values are cached, so the readback is cheap.

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const SENTINEL = "rgba(0, 0, 0, 0)";

  function resolveColor(value) {
    try {
      ctx.fillStyle = SENTINEL;
      ctx.fillStyle = value;
      const out = ctx.fillStyle;
      if (out === SENTINEL) return null;
      if (out.startsWith("#") || out.startsWith("rgb")) return out;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      const px = ctx.getImageData(0, 0, 1, 1).data;
      const a = Math.round((px[3] / 255) * 1000) / 1000;
      return `rgba(${px[0]}, ${px[1]}, ${px[2]}, ${a})`;
    } catch (_) {
      return null;
    }
  }

  // Words that must never be treated as colors. currentcolor is the sneaky
  // one: a canvas resolves it to black (no element context), which would
  // repaint every inherited-ink icon fill to the palette's nearest of black.
  const NON_COLORS = new Set([
    "transparent", "currentcolor", "none", "inherit", "initial", "unset",
    "revert", "revert-layer", "auto", "normal", "var", "calc", "url", "from",
    "in", "srgb", "srgb-linear", "display-p3", "a98-rgb", "prophoto-rgb",
    "rec2020", "xyz", "xyz-d50", "xyz-d65", "deg", "grad", "rad", "turn",
    "important", "set", "and", "not", "only", "light-dark",
  ]);

  // A color token is either a #hex literal or a something(...) function call
  // with one nesting level (enough for rgb/hsl/oklch/lab/color; color-mix's
  // nested parens simply don't match and fall through to the word pass).
  const COLOR_TOKEN_RE = /#[0-9a-fA-F]{3,8}\b|[a-zA-Z-]+\([^()]*\)/g;

  function parseResolved(resolved) {
    // Canvas emits "#rrggbb" for opaque colors but "rgba(r, g, b, a)" when
    // alpha < 1 — accept both shapes.
    if (resolved.startsWith("#")) {
      const h = resolved.slice(1);
      if (h.length === 6 || h.length === 8) {
        return {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16),
          a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
        };
      }
      if (h.length === 3) {
        return {
          r: parseInt(h[0] + h[0], 16),
          g: parseInt(h[1] + h[1], 16),
          b: parseInt(h[2] + h[2], 16),
          a: 1,
        };
      }
      return null;
    }
    const nums = resolved.match(/[\d.]+/g);
    if (!nums || nums.length < 3) return null;
    const alpha = nums.length > 3 ? parseFloat(nums[3]) : 1;
    return { r: +nums[0], g: +nums[1], b: +nums[2], a: alpha };
  }

  function mapColorToken(token, group) {
    const resolved = resolveColor(token);
    if (!resolved) return token;
    const c = parseResolved(resolved);
    if (!c || c.a === 0) return token;
    const rgbCss = `rgb(${c.r}, ${c.g}, ${c.b})`;
    const lab = labOf(rgbCss);
    // Vivid only when the hue is genuinely usable — see VIVID_CHROMA. A dark
    // tinted surface stays a surface; the theme's own cream fg stays an ink.
    const vivid =
      chromaOf(rgbCss) >= VIVID_CHROMA &&
      lab &&
      lab.L >= VIVID_L_MIN &&
      lab.L <= VIVID_L_MAX;
    let mapped;
    if (vivid) {
      // Saturated colors keep their hue: red stays red, blue stays blue-ish.
      mapped = nearestChromatic(rgbCss);
    } else if (group === "ink") {
      mapped = mapNeutral(rgbCss, "inks");
    } else if (group === "surface") {
      mapped = mapNeutral(rgbCss, "surfaces");
    } else {
      mapped = nearestIn("union", rgbCss);
    }
    if (!mapped) mapped = nearestIn("union", rgbCss);
    if (!mapped) return token;
    return c.a < 1 ? withAlpha(mapped, Math.round(c.a * 1000) / 1000) : mapped;
  }

  function mapValue(value, group) {
    if (!value || !value.trim()) return value;
    const key = `${group}|${value}`;
    const cached = state.cache.get(key);
    if (cached !== undefined) return cached;

    let out = value.replace(COLOR_TOKEN_RE, (token) => mapColorToken(token, group));
    // Named colors inside composite values ("1px solid white"): any bare
    // word the canvas can parse as a color gets mapped; everything else
    // (solid, px, gradient names, …) fails to parse and survives as-is.
    out = out.replace(/[a-zA-Z-]+/g, (word) => {
      const lower = word.toLowerCase();
      if (NON_COLORS.has(lower)) return word;
      return mapColorToken(word, group);
    });

    state.cache.set(key, out === value ? value : out);
    return out;
  }

  // ===== declaration rewriting ============================================

  // Textual properties a false-positive "named color" match would corrupt
  // (font families can legally be "Red Hat Text"; content strings lie).
  // Values here are never mapped.
  const SKIP_PROPS = new Set([
    "content", "font", "font-family", "src", "unicode-range",
    "animation-name", "will-change", "grid-area", "counter-reset",
    "counter-increment", "list-style", "marker", "target-name",
  ]);

  // Custom properties have no declared role, and the neutral "union" fallback
  // preserves LIGHTNESS, not ROLE — so a dark site under a light theme mapped
  // its dark `--bgColor-default` onto the theme's dark FOREGROUND (GitHub's
  // body ended up as light text on a dark page), and vice versa. Most design
  // systems name the role; reading it back is what keeps backgrounds on
  // surfaces and copy on inks regardless of which polarity the SITE thinks it
  // is in. Keywords are matched as words/substrings that are unambiguous in
  // practice (Primer, Fluent, Slack, Radix, Tailwind all qualify).
  const SURFACE_HINT =
    /(^|[-_])(bg|background|surface|canvas|base|backdrop|overlay|panel|card|border|stroke|rule|shadow|skeleton)/;
  const INK_HINT =
    /(^|[-_])(fg|foreground|text|ink|label|title|content|icon|caret|placeholder|link)/;

  // Which neutral target group a declaration maps into. Roles follow the
  // property: text gets ink, backdrops/edges get surface. Custom properties are
  // role-unknown, so their NAME decides where it can, else the union.
  function declGroup(prop) {
    const p = prop.toLowerCase();
    if (p.startsWith("--")) {
      const name = p.slice(2);
      if (SURFACE_HINT.test(name) && !INK_HINT.test(name)) return "surface";
      if (INK_HINT.test(name) && !SURFACE_HINT.test(name)) return "ink";
      return "any";
    }
    if (
      p === "color" || p === "caret-color" || p === "text-shadow" ||
      p === "fill" || p === "stroke" ||
      p === "-webkit-text-fill-color" || p === "-webkit-text-stroke-color" ||
      p.startsWith("text-decoration")
    )
      return "ink";
    if (
      p.includes("background") || p.includes("outline") || p.includes("border") ||
      p.includes("column-rule") || p === "box-shadow" || p === "filter"
    )
      return "surface";
    return "any";
  }

  function snapshotStyle(style) {
    if (state.snapshots.has(style)) return;
    const snap = [];
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      snap.push([prop, style.getPropertyValue(prop), style.getPropertyPriority(prop)]);
    }
    state.snapshots.set(style, snap);
  }

  function restoreStyle(style) {
    const snap = state.snapshots.get(style);
    if (!snap) return;
    for (const [prop, value, priority] of snap) {
      try {
        style.setProperty(prop, value, priority);
      } catch (_) {}
    }
  }

  function rewriteStyle(style) {
    // Snapshot BEFORE the first rewrite so theme switches re-map from the
    // page's true colors, never from a previous theme's mapped output.
    snapshotStyle(style);
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      // Textual properties a false-positive word match could corrupt.
      if (SKIP_PROPS.has(prop.toLowerCase())) continue;
      const before = style.getPropertyValue(prop);
      // Cheap reject: a color always needs a letter (function/named) or a #.
      if (!/[#a-zA-Z]/.test(before)) continue;
      const after = mapValue(before, declGroup(prop));
      if (after !== before) {
        try {
          style.setProperty(prop, after, style.getPropertyPriority(prop));
        } catch (_) {}
      }
    }
  }

  function walkRules(rules) {
    for (const rule of rules) {
      try {
        if (rule.style) rewriteStyle(rule.style);
        // @media / @supports / @keyframes / @layer / nested CSS all expose
        // their children as cssRules; CSSStyleRule can carry both.
        if (rule.cssRules) walkRules(rule.cssRules);
      } catch (_) {}
    }
  }

  function processSheet(sheet) {
    if (!sheet || state.sheetsSeen.has(sheet)) return;
    state.sheetsSeen.add(sheet);
    try {
      walkRules(sheet.cssRules);
    } catch (_) {
      // Cross-origin sheet (SecurityError) — unfixable from a content script.
    }
  }

  function processAdopted(owner) {
    for (const sheet of owner.adoptedStyleSheets || []) processSheet(sheet);
  }

  // ===== inline styles ====================================================

  function processInline(el) {
    if (!el || el.nodeType !== 1 || !el.style) return;
    // The contrast pass flags repaired inks; their inline style is OURS, not
    // the site's, so never re-map it.
    if (el.getAttribute("data-omarchy-ink")) return;
    const attr = el.getAttribute("style");
    if (attr == null) return;
    // Sites rewrite their own inline styles constantly (React re-renders);
    // only re-map when the attribute actually changed since we saw it.
    if (state.inlineSeen.get(el) === attr) return;
    state.inlineSeen.set(el, attr);
    rewriteStyle(el.style);
  }

  // HTML presentation attributes (the pre-CSS color carriers — HN is built
  // entirely from bgcolor/color attributes) and SVG fill/stroke literals.
  // The legacy attribute color parser is stricter than CSS proper — it does
  // not reliably take "rgb(r, g, b)" strings and its failure mode is a
  // bizarre stripped-green fill — so attribute writes go out as plain hex.
  // resolveColor() fails to parse "none"/"inherit"/url() forms, so those
  // survive untouched; mapping is idempotent, so sweeps can re-run freely.
  const PAINT_ATTRS = {
    bgcolor: "surface",
    color: "ink",
    text: "ink",
    link: "ink",
    vlink: "ink",
    alink: "ink",
    fill: "ink",
    stroke: "ink",
  };
  function toHex(css) {
    const c = hexToRgb(css);
    if (!c) return null;
    return `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }
  function processPaintAttrs(el) {
    for (const attr of Object.keys(PAINT_ATTRS)) {
      const before = el.getAttribute(attr);
      if (before == null) continue;
      // First sight = capture the original, so theme switches restore and
      // re-map from true colors instead of cascading old mappings.
      let snap = state.attrSnap.get(el);
      if (!snap) {
        snap = {};
        state.attrSnap.set(el, snap);
      }
      if (!(attr in snap)) snap[attr] = before;
      const after = toHex(mapValue(before, PAINT_ATTRS[attr]));
      if (after && after !== before) el.setAttribute(attr, after);
    }
  }

  // ===== contrast pass ====================================================
  //
  // Mapping moves colors around; the pair (ink, surface) a site chose may
  // come out too weak. For every element, effective surface = first opaque
  // painted ancestor background (theme.bg as the canvas floor); if
  // contrastRatio(ink, surface) < floor, swap the ink for the best readable
  // candidate — same-hue chromatic variants first, then the theme ink ladder
  // via the existing inkOn() helper.

  function contrastCandidates(ink, surface) {
    const list = [];
    const hue = hueOf(ink);
    if (hue != null && chromaOf(ink) >= NEUTRAL_CHROMA) {
      // Same hue family keeps the semantic ("red error" stays red-ish).
      for (const entry of state.palette.chromatic) {
        const eh = hueOf(entry.css);
        if (eh == null) continue;
        if (((eh - hue + 540) % 360) - 180 <= 40) list.push(entry.css);
      }
    }
    // The whole ink ladder as backup; inkOn() takes the first candidate that
    // clears the target, else the highest-contrast one.
    for (const entry of state.palette.inks) list.push(entry.css);
    // ...and the theme's own background LAST, as the on-fill ink. Some
    // surfaces are saturated fills (HN's orange header, an accent badge) where
    // no ink in the ladder reads — the theme's page background is the
    // theme-coherent "dark ink" there, and it beats inkOn()'s built-in
    // escalation to literal #000/#fff. Order matters: the ladder has already
    // had its chance, and on a normal surface bg can't out-contrast fg anyway.
    if (state.theme && state.theme.bg) {
      const bg = hexToRgb(state.theme.bg);
      if (bg) list.push(`rgb(${bg.r}, ${bg.g}, ${bg.b})`);
    }
    return Array.from(new Set(list));
  }

  function effectiveSurface(el) {
    let node = el;
    while (node && node.nodeType === 1) {
      // resolveColor() so oklab()/color() surfaces are read as sRGB, not as
      // their own space's decimals.
      const bg = resolveColor(getComputedStyle(node).backgroundColor);
      if (bg) {
        const c = parseResolved(bg);
        if (c && c.a > 0.85) return bg;
      }
      node = node.parentElement;
    }
    return state.theme && state.theme.bg;
  }

  // An element only needs its own `color` checked when it paints text itself;
  // descendants are checked individually, and inherited ink lands on them. Most
  // nodes on a modern page are containers, so this cheap test removes most of
  // the full pass's computed-style reads (~70ms → single digits on GitHub).
  function paintsText(el) {
    const nodes = el.childNodes;
    if (!nodes) return false;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.nodeType === 3 && n.textContent.trim()) return true;
    }
    return false;
  }

  function contrastNode(el) {
    if (!paintsText(el)) return;
    const cs = getComputedStyle(el);
    // resolveColor() first: a computed color can come back as oklab()/color()
    // (Tailwind v4, anything on CSS Color 4), and the digits-only parser would
    // misread those decimals as RGB bytes.
    const ink = resolveColor(cs.color);
    if (!ink) return;
    const c = parseResolved(ink);
    if (!c || c.a < 0.1) return;
    const surface = effectiveSurface(el);
    if (!surface) return;
    // Remember what we last checked rather than a flat "seen" flag: a node can
    // be contrast-checked while it still holds the SITE's colors and only get
    // mapped on a later sweep (MutationObserver ordering), and a boolean would
    // then hide every later change — including our own repaired ink.
    const stamp = `${ink}|${surface}`;
    if (state.contrastWalked.get(el) === stamp) return;
    state.contrastWalked.set(el, stamp);
    if (contrastRatio(ink, surface) >= CONTRAST_FLOOR) return;
    const pick = inkOn(surface, contrastCandidates(ink, surface), CONTRAST_FLOOR);
    if (pick && contrastRatio(pick, surface) > contrastRatio(ink, surface) + 0.05) {
      // Flag the element so the sweep never re-maps OUR pick: the ink we
      // chose is already a palette color, and re-running it through the
      // chromatic path (cream fg has chroma ≥ threshold!) would slowly drag
      // every repaired ink toward accent. Remember the pre-fix inline attr
      // so a theme switch can restore AND re-map from the true origin.
      state.inkOrig.set(el, el.getAttribute("style"));
      el.setAttribute("data-omarchy-ink", "1");
      el.style.setProperty("color", pick, "important");
    }
  }

  function contrastSubtree(root) {
    if (!root || root.nodeType !== 1 || !state.theme) return;
    contrastNode(root);
    if (!root.querySelectorAll) return;
    for (const el of root.querySelectorAll("*")) {
      try {
        contrastNode(el);
      } catch (_) {}
    }
  }

  // The observer's incremental check repairs the burst's own nodes, but a node
  // can be checked before a LATER batch repaints an ancestor (the surface it
  // sits on), leaving a stamp that no longer describes reality. One full pass
  // 500ms after the last mutation closes that gap without paying a full
  // document walk on every render.
  function scheduleContrast() {
    // THROTTLE, not debounce: resetting on every mutation starves this
    // entirely on an app that mutates continuously (Tailwind's highlighted
    // code blocks), which is exactly the page where a surface repaints under
    // already-stamped text. One pass per 800ms of activity, then it stops.
    if (state.contrastDebounce) return;
    state.contrastDebounce = setTimeout(() => {
      state.contrastDebounce = null;
      contrastPass();
    }, 800);
  }

  function contrastPass() {
    if (!state.theme) return;
    // Chunked over the full document; the (ink|surface) stamps keep replays
    // from re-repairing, but each element still needs one computed-style read,
    // so this full form is reserved for apply/theme-switch and the delayed
    // straggler sweeps — never the per-render observer.
    const els = document.querySelectorAll("*");
    let i = 0;
    const step = () => {
      const end = Math.min(i + 500, els.length);
      for (; i < end; i++) {
        try {
          contrastNode(els[i]);
        } catch (_) {}
      }
      if (i < els.length) state.contrastTimer = setTimeout(step, 0);
    };
    step();
  }

  // ===== sweeps ===========================================================

  function sweepRoot(root) {
    processAdopted(root);
    // style covers inline CSS; the PAINT_ATTRS selector covers presentation
    // attributes and SVG paint literals in one scan.
    for (const el of root.querySelectorAll("[style],[bgcolor],[color],[fill],[stroke]")) {
      processInline(el);
      processPaintAttrs(el);
    }
  }

  function sweep() {
    if (!state.theme) return;
    for (const sheet of document.styleSheets) processSheet(sheet);
    sweepRoot(document);
    // The body paints its own site font (font-family on body beats html
    // inheritance); bring it into the omarchy family too whenever it exists.
    if (document.body) {
      document.body.style.setProperty(
        "font-family",
        document.documentElement.style.getPropertyValue("font-family"),
        "important"
      );
    }
    // Open shadow roots. querySelectorAll("*") is the brute-force part of
    // this engine; sweeps are mutation-batched so busy pages don't hammer it.
    for (const host of document.querySelectorAll("*")) {
      const root = host.shadowRoot;
      if (root) sweepRoot(root);
    }
    // Mapping is what creates unreadable pairs, so every sweep schedules a
    // contrast pass. Without this, a surface repainted by a LATE stylesheet
    // (mapped after the text was already stamped) keeps its stale stamp until
    // something else happens to mutate — Tailwind's async-loaded code blocks
    // stayed cyan-on-dark for exactly that reason.
    scheduleContrast();
  }

  // A theme switch must re-map from ORIGINAL colors, not from the previous
  // theme's output: clear the cache, restore every snapshotted declaration,
  // then sweep. Rules we never snapshotted (added between themes) are simply
  // mapped as found.
  function remapAll() {
    // Our contrast-pass fixes first. The flag blocked re-mapping, but that
    // also means the style snapshot never covers the attribute — so on a
    // theme switch restore the recorded original attr, drop the flag, and
    // let the sweep below re-map the true origin. Otherwise the fix ink
    // would re-enter the chromatic path (cream → accent drift).
    document.querySelectorAll("[data-omarchy-ink]").forEach((el) => {
      const orig = state.inkOrig.get(el);
      if (orig == null) el.removeAttribute("style");
      else el.setAttribute("style", orig);
      el.removeAttribute("data-omarchy-ink");
    });
    document.querySelectorAll("*").forEach((el) => {
      if (el.style && el.getAttribute("style") != null) restoreStyle(el.style);
      const snap = state.attrSnap.get(el);
      if (snap) {
        for (const [attr, value] of Object.entries(snap)) el.setAttribute(attr, value);
      }
    });
    const restoreWalk = (rules) => {
      for (const rule of rules) {
        try {
          if (rule.style) restoreStyle(rule.style);
          if (rule.cssRules) restoreWalk(rule.cssRules);
        } catch (_) {}
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        restoreWalk(sheet.cssRules);
      } catch (_) {}
    }
    const restoreAdopted = (owner) => {
      for (const sheet of owner.adoptedStyleSheets || []) {
        try {
          restoreWalk(sheet.cssRules);
        } catch (_) {}
      }
    };
    restoreAdopted(document);
    document.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) restoreAdopted(el.shadowRoot);
    });
    state.sheetsSeen = new WeakSet();
    state.inlineSeen = new WeakMap();
    state.contrastWalked = new WeakMap();
    sweep();
  }

  // ===== theme application ================================================

  function applyTheme(theme) {
    if (!theme || !theme.bg) return;
    if (!state.enabled) {
      state.pendingTheme = theme;
      return;
    }
    const firstApply = !state.theme;
    state.theme = theme;
    state.palette = buildPalette(theme);
    state.cache.clear();
    const isDark = relLuminance(hexToRgb(theme.bg)) < 0.5;
    state.themeDark = isDark;
    const bgrgb = hexToRgb(theme.bg);
    const fgrgb = hexToRgb(theme.fg);
    state.surfaceAnchor = bgrgb ? `rgb(${bgrgb.r}, ${bgrgb.g}, ${bgrgb.b})` : theme.bg;
    state.inkAnchor = fgrgb
      ? `rgb(${fgrgb.r}, ${fgrgb.g}, ${fgrgb.b})`
      : nearestIn("inks", theme.bg);
    console.log("[omarchy-recolor] theme", theme.theme_name, "applied; palette surfaces:", state.palette.surfaces.length, "inks:", state.palette.inks.length, "chromatic:", state.palette.chromatic.length);

    const html = document.documentElement;
    html.style.colorScheme = isDark ? "dark" : "light";
    // The viewport canvas: sites that never paint <html> (or paint it white
    // inline before hydration) get the theme background with priority, so the
    // boot flash is themed on every page without per-site packs.
    html.style.setProperty("background-color", theme.bg, "important");
    // Same font as the rest of omarchy. Important on html/body only:
    // inheritance carries it wherever the site doesn't set its own family.
    const fontStack = theme.font
      ? `"${theme.font}", system-ui, sans-serif`
      : `"JetBrains Mono NF", "JetBrainsMono Nerd Font", system-ui, sans-serif`;
    html.style.setProperty("font-family", fontStack, "important");
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute("content", theme.bg);
    }
    // Flip the MAIN-world shim (matchMedia spoof), so apps that follow
    // prefers-color-scheme switch their own light/dark mode for us.
    document.dispatchEvent(
      new CustomEvent("omarchy:set-color-scheme", { detail: { dark: isDark } })
    );

    if (firstApply || document.readyState === "loading") {
      sweep();
      // Stylesheets and SPA shells keep landing after document_start; a few
      // delayed sweeps catch the stragglers the MutationObserver is too early
      // for (the observer only sees DOM mutations, not adopted-sheet swaps).
      for (const ms of [100, 400, 1200, 3000, 7000]) {
        setTimeout(() => {
          sweep();
          contrastPass();
        }, ms);
      }
    } else {
      remapAll();
    }
    contrastPass();
  }

  // ===== wiring ===========================================================

  chrome.storage.sync.get({ disabledSites: {} }, ({ disabledSites }) => {
    state.enabled = !disabledSites.universal;
    if (state.pendingTheme) {
      const t = state.pendingTheme;
      state.pendingTheme = null;
      applyTheme(t);
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.disabledSites) return;
    state.enabled = !(changes.disabledSites.newValue || {}).universal;
    if (state.enabled && state.theme) {
      state.pendingTheme = state.theme;
      state.theme = null;
      applyTheme(state.pendingTheme);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "omarchy-theme") applyTheme(msg.theme);
  });
  chrome.runtime.sendMessage({ type: "request-theme" }, (theme) => {
    if (chrome.runtime.lastError) return;
    if (theme) applyTheme(theme);
  });

  // DOM mutations: new <style>/<link> nodes, new elements carrying inline
  // styles, new shadow hosts. Batched on a trailing rAF; the sweep itself is
  // incremental (WeakSet/WeakMap bookkeeping), so hot pages just rescan.
  let scheduled = false;
  const observer = new MutationObserver((mutations) => {
    if (!state.theme || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const added = [];
      const touched = new Set();
      for (const m of mutations) {
        if (m.type === "attributes") {
          processInline(m.target);
          touched.add(m.target);
        }
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === "STYLE") processSheet(node.sheet);
          if (node.tagName === "LINK" && node.rel === "stylesheet") {
            processSheet(node.sheet);
          }
          processInline(node);
          processPaintAttrs(node);
          if (node.querySelectorAll) {
            for (const el of node.querySelectorAll("[style],[bgcolor],[color],[fill],[stroke]")) {
              processInline(el);
              processPaintAttrs(el);
            }
            if (node.shadowRoot) sweepRoot(node.shadowRoot);
          }
          added.push(node);
        }
      }
      // Map FIRST, then contrast: the other order walks brand-new nodes while
      // they still hold the site's own colors and stamps them as checked, so
      // the mapped pair that actually needs repairing is never looked at.
      sweep();
      // Contrast only the burst's own nodes, never the whole document — a full
      // pass costs ~70ms on a 1.8k-element page and the observer fires on every
      // render. Existing nodes that a late stylesheet re-inked (invisible to
      // the mutation list) are caught by the delayed full passes in applyTheme.
      for (const node of added) contrastSubtree(node);
      for (const t of touched) contrastNode(t);
      scheduleContrast();
    });
  });

  const armObserver = () => {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  };
  if (document.documentElement) armObserver();
  else document.addEventListener("readystatechange", armObserver, { once: true });

  // Experimentation handle: lets a CDP probe call mapValue/contrastNode with
  // live palette state instead of re-deriving the pipeline by hand.
  window.__omarchyRecolorDebug = { state, mapValue, declGroup, contrastNode, contrastPass, contrastSubtree, mapNeutral, nearestChromatic, effectiveSurface };
})();
