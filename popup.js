// Pausa sempre que o popup abre
chrome.runtime.sendMessage({ action: "pause" });

const urlContainer = document.getElementById("url-container");
const multiTabEl = document.getElementById("multiTab");
const switchTimeEl = document.getElementById("switchTime");
const enabledEl = document.getElementById("enabled");

document.getElementById("add").addEventListener("click", () => {
    addUrlField();
    autoSave();
});

function normalizeUrl(url) {
    if (!/^https?:\/\//i.test(url)) {
        return "https://" + url;
    }
    return url;
}

function addUrlField(url = "", reload = 10) {
    const div = document.createElement("div");
    div.classList.add("url-item");

    div.innerHTML = `
        <input class="url-input" placeholder="URL" value="${url}">
        <input class="reload-input" type="number" min="0" max="120" value="${reload}">
        <span class="seg-label">seg</span>
        <button class="remove-btn">X</button>
    `;

    const urlInput = div.querySelector(".url-input");
    const reloadInput = div.querySelector(".reload-input");
    const removeBtn = div.querySelector(".remove-btn");

    urlInput.addEventListener("change", autoSave);

    reloadInput.addEventListener("change", () => {
        let v = parseInt(reloadInput.value);

        // inválido → vira 10
        if (isNaN(v)) v = 10;

        // negativo → 0
        if (v < 0) v = 0;

        // 1–9 → vira 10
        if (v > 0 && v < 10) v = 10;

        // 121+ → 120
        if (v > 120) v = 120;

        reloadInput.value = v;
        autoSave();
    });

    removeBtn.onclick = () => {
        div.remove();
        autoSave();
    };

    urlContainer.appendChild(div);
}

async function autoSave() {
    const urls = [...document.querySelectorAll(".url-input")];
    const reloads = [...document.querySelectorAll(".reload-input")];

    const entries = urls
        .map((input, i) => {
            let reload = parseInt(reloads[i].value);

            if (isNaN(reload)) reload = 10;
            if (reload < 0) reload = 0;
            if (reload > 0 && reload < 10) reload = 10;
            if (reload > 120) reload = 120;

            reloads[i].value = reload;

            const url = normalizeUrl(input.value.trim());

            return { url, reload };
        })
        .filter(x => x.url.length > 0);

    let switchTime = parseInt(switchTimeEl.value);

    if (isNaN(switchTime)) switchTime = 10;
    if (switchTime > 300) switchTime = 300;
    if (switchTime < 1) switchTime = 1;

    switchTimeEl.value = switchTime;

    const multiTab = multiTabEl.checked;

    await chrome.storage.local.set({ entries, switchTime, multiTab });
}

enabledEl.addEventListener("change", async (e) => {
    const enabled = e.target.checked;

    await autoSave();
    await chrome.storage.local.set({ enabled });

    chrome.runtime.sendMessage({ action: enabled ? "start" : "stop" });
});

multiTabEl.addEventListener("change", async () => {
    await autoSave();
});

switchTimeEl.addEventListener("change", async () => {
    let v = parseInt(switchTimeEl.value);

    if (isNaN(v)) v = 10;
    if (v > 300) v = 300;
    if (v < 1) v = 1;

    switchTimeEl.value = v;
    await autoSave();
});

(async () => {
    const { entries, switchTime, multiTab, enabled } = await chrome.storage.local.get();

    urlContainer.innerHTML = "";

    if (entries && Array.isArray(entries)) {
        entries.forEach(e => {
            let reload = e.reload;

            if (reload < 0) reload = 0;
            if (reload > 0 && reload < 10) reload = 10;
            if (reload > 120) reload = 120;

            addUrlField(e.url, reload);
        });
    }

    if (switchTime) {
        let st = switchTime;
        if (st > 300) st = 300;
        if (st < 1) st = 1;
        switchTimeEl.value = st;
    }

    multiTabEl.checked = !!multiTab;
    enabledEl.checked = !!enabled;
})();

document.getElementById("viewLog").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});
