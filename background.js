// ===============================
// LOG
// ===============================
async function writeLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${message}`;
    console.log("[Tab Alternate]", entry);

    const { activityLog } = await chrome.storage.local.get("activityLog");
    const log = activityLog || [];
    log.push(entry);
    if (log.length > 500) log.shift();
    await chrome.storage.local.set({ activityLog: log });
}

// ===============================
// ÍCONE
// ===============================
async function setIcon(isOn) {
    chrome.action.setIcon({
        path: isOn ? "icons/verde.png" : "icons/vermelho.png"
    });
}

// ===============================
// ESTADO
// ===============================
let tabIds = [];
let currentIndex = 0;

// ===============================
// RESTAURAR ESTADO AO ACORDAR
// ===============================
async function restoreState() {
    const data = await chrome.storage.local.get([
        "tabIds",
        "currentIndex",
        "entries",
        "switchTime",
        "multiTab"
    ]);

    tabIds = data.tabIds || [];
    currentIndex = data.currentIndex || 0;

    globalThis.entries = data.entries || [];
    globalThis.switchTime = data.switchTime || 10;
    globalThis.multiTab = data.multiTab || false;

    await writeLog(
        "SW acordou. Estado restaurado: " +
        JSON.stringify({
            tabIds,
            currentIndex,
            switchTime: globalThis.switchTime,
            multiTab: globalThis.multiTab,
            entriesCount: globalThis.entries.length
        })
    );
}

chrome.runtime.onStartup.addListener(restoreState);
chrome.runtime.onInstalled.addListener(restoreState);

// ===============================
// POPUP
// ===============================
chrome.runtime.onMessage.addListener(async (msg) => {
    const { entries, switchTime, multiTab, enabled } = await chrome.storage.local.get();

    if (msg.action === "pause") {
        await writeLog("Popup aberto → serviço pausado");
        await stopService();
        return;
    }

    if (msg.action === "stop") {
        await writeLog("Serviço parado pelo usuário");
        await stopService();
        return;
    }

    if (msg.action === "start" && enabled) {
        await writeLog("Serviço iniciado pelo usuário");
        await startService(entries, switchTime, multiTab);
        return;
    }
});

// ===============================
// START / STOP
// ===============================
async function startService(entries, switchTime, multiTab) {
    await stopService();

    if (!entries || !entries.length) {
        await writeLog("Nenhuma URL configurada.");
        return;
    }

    if (multiTab) {
        await openMultipleTabs(entries, switchTime);
    } else {
        await openSingleTab(entries, switchTime);
    }

    await setIcon(true);
}

async function stopService() {
    chrome.alarms.clearAll();
    tabIds = [];
    currentIndex = 0;

    await chrome.storage.local.set({ tabIds: [], currentIndex: 0 });
    await writeLog("Serviço parado.");
    await setIcon(false);
}

// ===============================
// MONITOR DE CARREGAMENTO
// ===============================
function watchTabLoad(tabId, timeoutSec, url) {
    const timer = setTimeout(() => {
        writeLog(`Timeout ao carregar ${url}, recarregando aba ${tabId}`);
        chrome.tabs.update(tabId, { url });
    }, timeoutSec * 1000);

    const listener = (updatedTabId, info) => {
        if (updatedTabId === tabId && info.status === "complete") {
            writeLog(`Aba ${tabId} carregada`);
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
        }
    };

    chrome.tabs.onUpdated.addListener(listener);
}

// ===============================
// MULTI-ABAS
// ===============================
async function openMultipleTabs(entries, switchTime) {
    tabIds = [];

    for (const item of entries) {
        const tab = await chrome.tabs.create({ url: item.url });
        tabIds.push(tab.id);

        watchTabLoad(tab.id, 15, item.url);

        if (item.reload > 0) {
            chrome.alarms.create(`reload_${tab.id}`, {
                periodInMinutes: item.reload / 60
            });
        }
    }

    await chrome.storage.local.set({ tabIds });

    chrome.alarms.create("switch_tabs", {
        periodInMinutes: switchTime / 60
    });

    await writeLog("Multi-abas iniciado. tabIds=" + JSON.stringify(tabIds));
}

// ===============================
// ABA ÚNICA
// ===============================
async function openSingleTab(entries, switchTime) {
    const tab = await chrome.tabs.create({ url: entries[0].url });
    tabIds = [tab.id];

    await chrome.storage.local.set({ tabIds });

    watchTabLoad(tab.id, 15, entries[0].url);

    if (entries[currentIndex].reload > 0) {
        chrome.alarms.create(`reload_${tabIds[0]}`, {
            periodInMinutes: entries[currentIndex].reload / 60
        });
    }


    chrome.alarms.create("switch_single", {
        periodInMinutes: switchTime / 60
    });

    await writeLog("Aba única iniciada.");
}

// ===============================
// ALARMS
// ===============================
chrome.alarms.onAlarm.addListener(async alarm => {
    await writeLog("Alarm disparou: " + alarm.name);

    if (alarm.name.startsWith("reload_")) {
        const tabId = Number(alarm.name.replace("reload_", ""));
        chrome.tabs.reload(tabId);
        return;
    }

    if (alarm.name === "switch_tabs") {
        const data = await chrome.storage.local.get(["tabIds", "currentIndex"]);
        tabIds = data.tabIds || [];
        currentIndex = data.currentIndex || 0;

        if (!tabIds.length) {
            await writeLog("Sem tabIds. Alternância cancelada.");
            return;
        }

        currentIndex = (currentIndex + 1) % tabIds.length;
        await chrome.storage.local.set({ currentIndex });

        const tabId = tabIds[currentIndex];
        chrome.tabs.update(tabId, { active: true });

        await writeLog(`Alternando para aba ${currentIndex} (tabId=${tabId})`);
    }

    if (alarm.name === "switch_single") {
        const { entries } = await chrome.storage.local.get("entries");
        const data = await chrome.storage.local.get(["tabIds", "currentIndex"]);

        tabIds = data.tabIds || [];
        currentIndex = data.currentIndex || 0;

        currentIndex = (currentIndex + 1) % entries.length;
        await chrome.storage.local.set({ currentIndex });

        chrome.tabs.update(tabIds[0], { url: entries[currentIndex].url });

        await writeLog("Alternando aba única.");
    }
});
