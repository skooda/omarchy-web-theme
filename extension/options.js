// Options page: one toggle per site pack. State lives in chrome.storage.sync
// as { disabledSites: { <pack id>: true } } — absent/false means enabled, so
// new packs default to on without a migration.
//
// Adding a site pack: add its row here (id must match the pack's
// OmarchyTheme.register({ id })).
const SITES = [
  { id: "slack", label: "Slack", host: "app.slack.com" },
  { id: "whatsapp", label: "WhatsApp Web", host: "web.whatsapp.com" },
  { id: "github", label: "GitHub", host: "github.com" },
  { id: "linear", label: "Linear", host: "linear.app" },
  { id: "discord", label: "Discord", host: "discord.com" },
  { id: "outlook", label: "Outlook", host: "outlook.office.com" },
  { id: "notion", label: "Notion", host: "app.notion.com" },
  { id: "hey", label: "HEY + Calendar", host: "app.hey.com" },
  { id: "youtube", label: "YouTube", host: "www.youtube.com" },
  { id: "protonmail", label: "Proton Mail", host: "mail.proton.me" },
  { id: "teams", label: "Microsoft Teams", host: "teams.microsoft.com" },
];

const container = document.getElementById("sites");

chrome.storage.sync.get({ disabledSites: {} }, ({ disabledSites }) => {
  for (const site of SITES) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = !disabledSites[site.id];
    box.addEventListener("change", () => {
      chrome.storage.sync.get({ disabledSites: {} }, ({ disabledSites }) => {
        if (box.checked) delete disabledSites[site.id];
        else disabledSites[site.id] = true;
        chrome.storage.sync.set({ disabledSites });
      });
    });
    const name = document.createElement("span");
    name.className = "site";
    name.textContent = site.label;
    const host = document.createElement("span");
    host.className = "host";
    host.textContent = site.host;
    label.append(box, name, host);
    container.appendChild(label);
  }
});
