(function () {
  "use strict";

  class PersistenceClient {
    constructor() {
      this.endpoint = "/.netlify/functions/progress";
      this.available = location.protocol.startsWith("http");
      this.playerName = "Jogador";
      this.saveTimer = null;
      this.lastPayload = null;
    }

    setPlayerName(name) {
      this.playerName = name || "Jogador";
    }

    async load(playerName) {
      this.setPlayerName(playerName);
      if (!this.available) return null;

      try {
        const response = await fetch(`${this.endpoint}?player=${encodeURIComponent(this.playerName)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.progress || null;
      } catch (error) {
        console.warn("Persistencia remota indisponivel.", error);
        return null;
      }
    }

    saveSoon(payload) {
      this.lastPayload = payload;
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveNow(), 900);
    }

    async saveNow() {
      if (!this.available || !this.lastPayload) return;

      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerName: this.playerName,
            progress: this.lastPayload
          })
        });
        if (response.ok) {
          window.VoxelUI?.showSaveStatus("Progresso salvo no Neon");
        }
      } catch (error) {
        console.warn("Nao foi possivel salvar no Neon.", error);
      }
    }
  }

  window.VoxelPersistence = new PersistenceClient();
})();
