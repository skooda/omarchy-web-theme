// Options page: a single master switch for the experimental universal
// recolor engine. State lives in chrome.storage.sync as
// { disabledSites: { universal: true } } — absent means enabled.
const container = document.getElementById("sites");

chrome.storage.sync.get({ disabledSites: {} }, ({ disabledSites }) => {
  const label = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !disabledSites.universal;
  box.addEventListener("change", () => {
    chrome.storage.sync.get({ disabledSites: {} }, ({ disabledSites }) => {
      if (box.checked) delete disabledSites.universal;
      else disabledSites.universal = true;
      chrome.storage.sync.set({ disabledSites });
    });
  });
  const name = document.createElement("span");
  name.className = "site";
  name.textContent = "Universal recolor (every site)";
  const host = document.createElement("span");
  host.className = "host";
  host.textContent = "enabled pages reset fully on reload";
  box.id = "omarchy-universal-toggle";
  label.append(box, name, host);
  container.appendChild(label);
});
