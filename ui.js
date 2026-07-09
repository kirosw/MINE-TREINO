(function () {
  "use strict";

  const { Blocks, HotbarBlocks } = window.VoxelBlocks;

  class GameUI {
    constructor() {
      this.startScreen = document.getElementById("start-screen");
      this.playButton = document.getElementById("play-button");
      this.resetButton = document.getElementById("reset-button");
      this.gameUi = document.getElementById("game-ui");
      this.hotbar = document.getElementById("hotbar");
      this.fpsCounter = document.getElementById("fps-counter");
      this.modeStatus = document.getElementById("mode-status");
      this.saveStatus = document.getElementById("save-status");
      this.message = document.getElementById("message");
      this.selectedIndex = 0;
      this.slots = [];
      this.buildHotbar();
    }

    buildHotbar() {
      this.hotbar.innerHTML = "";
      this.slots = HotbarBlocks.map((blockId, index) => {
        const block = Blocks[blockId];
        const slot = document.createElement("div");
        slot.className = "hotbar-slot";
        slot.innerHTML = `
          <span class="slot-number">${index + 1}</span>
          <span class="block-swatch" style="background:#${block.color.toString(16).padStart(6, "0")}"></span>
          <span class="slot-name">${block.name}</span>
        `;
        this.hotbar.appendChild(slot);
        return slot;
      });
      this.setSelected(0);
    }

    showGame() {
      this.startScreen.classList.add("hidden");
      this.gameUi.classList.remove("hidden");
    }

    showStart() {
      this.startScreen.classList.remove("hidden");
      this.gameUi.classList.add("hidden");
    }

    setSelected(index) {
      this.selectedIndex = THREE.MathUtils.clamp(index, 0, HotbarBlocks.length - 1);
      this.slots.forEach((slot, slotIndex) => slot.classList.toggle("selected", slotIndex === this.selectedIndex));
    }

    getSelectedBlock() {
      return HotbarBlocks[this.selectedIndex];
    }

    updateFps(fps) {
      this.fpsCounter.textContent = `FPS ${fps}`;
    }

    setCreative(enabled) {
      this.modeStatus.textContent = enabled ? "Criativo" : "Sobrevivencia";
      this.modeStatus.classList.toggle("creative", enabled);
    }

    showSaveStatus(text) {
      this.saveStatus.textContent = text;
      this.saveStatus.classList.add("visible");
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveStatus.classList.remove("visible"), 1100);
    }

    showMessage(text) {
      this.message.textContent = text;
      this.message.classList.remove("hidden");
      clearTimeout(this.messageTimer);
      this.messageTimer = setTimeout(() => this.message.classList.add("hidden"), 2200);
    }
  }

  window.VoxelUI = new GameUI();
})();
