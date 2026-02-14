// ===============================
// Atualiza o log na tela
// ===============================
async function loadLog() {
    const { activityLog } = await chrome.storage.local.get("activityLog");
    const logDiv = document.getElementById("log");

    if (!activityLog || activityLog.length === 0) {
        logDiv.textContent = "Nenhum log registrado ainda.";
        return;
    }

    logDiv.textContent = activityLog.join("\n");

    // Auto-scroll para o final
    logDiv.scrollTop = logDiv.scrollHeight;
}



// ===============================
// Atualização automática a cada 1 segundo
// ===============================

// Evita múltiplos intervals caso o log.html seja reaberto
if (!window.logIntervalStarted) {
    window.logIntervalStarted = true;
    setInterval(loadLog, 1000);
}



// ===============================
// Botão "Limpar Log"
// ===============================
document.getElementById("clear").addEventListener("click", async () => {
    await chrome.storage.local.set({ activityLog: [] });
    loadLog();
});



// ===============================
// Carrega imediatamente ao abrir
// ===============================
loadLog();
