const HOST = "com.omarchy.web_theme";

// Firefox's chrome.* shim keeps callback signatures and does NOT return
// promises everywhere Chrome's service-worker context does (notably
// tabs.sendMessage), while Chrome knows no browser.* alias. Route every
// call through whichever namespace this runtime provides: browser.* on
// Firefox promises everything, chrome.* on Chrome/Chromium/Brave promises
// in MV3.
const api = (() => {
  try {
    if (typeof browser !== "undefined") return browser;
  } catch (_) {}
  return chrome;
})();

// Every site a pack supports, straight from the manifest's content-script
// matches — adding a pack never touches this file.
const MATCH_PATTERNS = [
  ...new Set(api.runtime.getManifest().content_scripts.flatMap((cs) => cs.matches)),
];
// Universal (experimental) mode: the manifest matches <all_urls>, so every
// http(s) tab is a themed tab.
const IS_UNIVERSAL = MATCH_PATTERNS.includes("<all_urls>");
// Bare hostnames for the cheap onUpdated filter ("*://*.slack.com/*" → slack.com).
const MATCH_HOSTS = [
  ...new Set(
    MATCH_PATTERNS.map((p) =>
      p.replace(/^\*:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "")
    )
  ),
];

function isThemedUrl(url) {
  if (IS_UNIVERSAL) return /^https?:/i.test(url || "");
  try {
    const host = new URL(url).hostname;
    return MATCH_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch (_) {
    return false;
  }
}

let port = null;
let reconnectTimer = null;

function connect() {
  // The service worker can reach this from three directions at once: the
  // module-level call below, onInstalled, and onStartup. Without this guard each
  // one opens its own port, and every port spawns a separate long-lived native
  // host — so the theme-set hook then signals N hosts and every theme change
  // gets broadcast to the same tabs N times.
  if (port) return;
  try {
    port = api.runtime.connectNative(HOST);
    console.log("[omarchy] native port connected");
  } catch (e) {
    console.warn("[omarchy] connectNative threw:", e);
    scheduleReconnect();
    return;
  }

  port.onMessage.addListener((theme) => {
    if (!theme || theme.error) {
      console.warn("[omarchy] native host error:", theme && theme.error);
      return;
    }
    console.log("[omarchy] theme pushed by native host:", theme.theme_name, theme.bg);
    api.storage.local.set({ theme });
    broadcast(theme);
  });

  port.onDisconnect.addListener(() => {
    const err = api.runtime.lastError;
    console.warn("[omarchy] native host disconnected:", err && err.message);
    port = null;
    scheduleReconnect();
  });

  // No request needed: the host is push-only. It emits the current theme as soon
  // as it starts, then again on every theme change (driven by omarchy's
  // theme-set hook). We never write to the port.
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

function broadcast(theme) {
  const onTabs = (tabs) => {
    console.log("[omarchy] broadcasting theme to", tabs.length, "themed tab(s)");
    for (const t of tabs) {
      api.tabs.sendMessage(t.id, { type: "omarchy-theme", theme }).catch(() => {});
    }
  };
  // Dual-shape call: Chrome invokes the callback and returns undefined, Firefox
  // (browser.*) IGNORES the extra argument and returns a promise. Without the
  // .then branch the broadcast silently never runs on Firefox, so only the
  // initial request-theme reached tabs and live theme changes did nothing.
  const result = api.tabs.query({ url: MATCH_PATTERNS }, onTabs);
  if (result && typeof result.then === "function") result.then(onTabs).catch(() => {});
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "request-theme") {
    api.storage.local.get("theme").then(({ theme }) => sendResponse(theme || null));
    return true;
  }
  // Kept for content.js, which asks for a guaranteed-current theme right before
  // driving Slack's Color Mode radio. Storage is already current: omarchy fires
  // its theme-set hook after the new theme's files are final, the host pushes
  // immediately, and we write storage on that push — all before the content
  // script gets the broadcast that makes it ask. So there's nothing to go fetch.
  if (msg && msg.type === "request-fresh-theme") {
    api.storage.local.get("theme").then(({ theme }) => sendResponse(theme || null));
    return true;
  }
});

api.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return;
  if (!tab.url || !isThemedUrl(tab.url)) return;
  api.storage.local.get("theme").then(({ theme }) => {
    if (theme) api.tabs.sendMessage(tabId, { type: "omarchy-theme", theme }).catch(() => {});
  });
});

api.runtime.onInstalled.addListener(connect);
api.runtime.onStartup.addListener(connect);

connect();
