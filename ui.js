(function () {
  "use strict";

  const { Items, cloneDefaultInventory } = window.VoxelItems;

  class GameUI {
    constructor() {
      this.startScreen = document.getElementById("start-screen");
      this.playButton = document.getElementById("play-button");
      this.resetButton = document.getElementById("reset-button");
      this.playerNameInput = document.getElementById("player-name");
      this.loginStatus = document.getElementById("login-status");
      this.gameUi = document.getElementById("game-ui");
      this.hotbar = document.getElementById("hotbar");
      this.inventoryPanel = document.getElementById("inventory-panel");
      this.inventoryGrid = document.getElementById("inventory-grid");
      this.fpsCounter = document.getElementById("fps-counter");
      this.modeStatus = document.getElementById("mode-status");
      this.playerStatus = document.getElementById("player-status");
      this.healthBar = document.getElementById("health-bar");
      this.hungerBar = document.getElementById("hunger-bar");
      this.saveStatus = document.getElementById("save-status");
      this.message = document.getElementById("message");
      this.selectedIndex = 0;
      this.inventory = cloneDefaultInventory();
      this.slots = [];
      this.inventorySlots = [];
      this.playerNameKey = "voxel-livre-player-name";
      this.onInventoryChanged = null;
      this.loadPlayerName();
      this.buildHotbar();
      this.buildInventory();
      this.updateStats(20, 20);
    }

    loadPlayerName() {
      const storedName = localStorage.getItem(this.playerNameKey) || "Jogador";
      this.playerNameInput.value = storedName;
      this.setPlayerName(storedName, false);
    }

    getPlayerName() {
      const rawName = this.playerNameInput.value.trim() || "Jogador";
      return rawName.replace(/[^\w -]/g, "").slice(0, 18) || "Jogador";
    }

    setPlayerName(name, save = true) {
      const cleanName = (name || "Jogador").replace(/[^\w -]/g, "").slice(0, 18) || "Jogador";
      this.playerNameInput.value = cleanName;
      this.playerStatus.textContent = cleanName;
      if (save) {
        localStorage.setItem(this.playerNameKey, cleanName);
        this.loginStatus.textContent = "Login salvo";
      }
      return cleanName;
    }

    buildHotbar() {
      this.hotbar.innerHTML = "";
      this.slots = [];
      for (let index = 0; index < 9; index++) {
        const slot = this.createSlot(index, true);
        this.hotbar.appendChild(slot);
        this.slots.push(slot);
      }
      this.renderInventory();
    }

    buildInventory() {
      this.inventoryGrid.innerHTML = "";
      this.inventorySlots = [];
      for (let index = 0; index < this.inventory.length; index++) {
        const slot = this.createSlot(index, false);
        this.inventoryGrid.appendChild(slot);
        this.inventorySlots.push(slot);
      }
      this.renderInventory();
    }

    createSlot(index, hotbar) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = hotbar ? "hotbar-slot item-slot" : "inventory-slot item-slot";
      slot.dataset.index = String(index);
      slot.addEventListener("click", () => this.handleSlotClick(index));
      return slot;
    }

    handleSlotClick(index) {
      if (index < 9) {
        this.setSelected(index);
        return;
      }

      const selected = this.inventory[this.selectedIndex];
      this.inventory[this.selectedIndex] = this.inventory[index];
      this.inventory[index] = selected;
      this.renderInventory();
      this.notifyInventoryChanged();
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
      this.selectedIndex = THREE.MathUtils.clamp(index, 0, 8);
      this.renderInventory();
    }

    getSelectedStack() {
      return this.inventory[this.selectedIndex] || null;
    }

    getSelectedItem() {
      const stack = this.getSelectedStack();
      return stack ? Items[stack.id] : null;
    }

    decrementSelected(count = 1) {
      const stack = this.getSelectedStack();
      if (!stack) return false;
      stack.count -= count;
      if (stack.count <= 0) {
        this.inventory[this.selectedIndex] = null;
      }
      this.renderInventory();
      this.notifyInventoryChanged();
      return true;
    }

    addItem(itemId, count = 1) {
      const maxStack = 64;
      let remaining = count;

      for (const stack of this.inventory) {
        if (!stack || stack.id !== itemId || stack.count >= maxStack) continue;
        const amount = Math.min(maxStack - stack.count, remaining);
        stack.count += amount;
        remaining -= amount;
        if (remaining <= 0) break;
      }

      for (let index = 0; index < this.inventory.length && remaining > 0; index++) {
        if (this.inventory[index]) continue;
        const amount = Math.min(maxStack, remaining);
        this.inventory[index] = { id: itemId, count: amount };
        remaining -= amount;
      }

      this.renderInventory();
      this.notifyInventoryChanged();
      return remaining === 0;
    }

    setInventory(slots) {
      if (!Array.isArray(slots)) return;
      this.inventory = cloneDefaultInventory();
      for (let index = 0; index < this.inventory.length; index++) {
        const stack = slots[index];
        this.inventory[index] = this.sanitizeStack(stack);
      }
      this.renderInventory();
    }

    serializeInventory() {
      return this.inventory.map((stack) => stack ? { id: stack.id, count: stack.count } : null);
    }

    sanitizeStack(stack) {
      if (!stack || !Items[stack.id]) return null;
      const count = Math.max(1, Math.min(64, Number(stack.count) || 1));
      return { id: stack.id, count };
    }

    toggleInventory() {
      const opened = this.inventoryPanel.classList.toggle("hidden");
      return !opened;
    }

    closeInventory() {
      this.inventoryPanel.classList.add("hidden");
    }

    renderInventory() {
      this.slots.forEach((slot, index) => this.renderSlot(slot, index, true));
      this.inventorySlots.forEach((slot, index) => this.renderSlot(slot, index, false));
    }

    renderSlot(slot, index, hotbar) {
      if (!slot) return;
      const stack = this.inventory[index];
      const item = stack ? Items[stack.id] : null;
      slot.classList.toggle("selected", index === this.selectedIndex);
      slot.classList.toggle("food", Boolean(item && item.type === "food"));
      slot.innerHTML = "";

      if (hotbar) {
        const number = document.createElement("span");
        number.className = "slot-number";
        number.textContent = String(index + 1);
        slot.appendChild(number);
      }

      if (!item) return;

      const swatch = document.createElement("span");
      swatch.className = "block-swatch";
      swatch.style.background = `#${item.color.toString(16).padStart(6, "0")}`;
      slot.appendChild(swatch);

      const name = document.createElement("span");
      name.className = "slot-name";
      name.textContent = item.name;
      slot.appendChild(name);

      const count = document.createElement("span");
      count.className = "slot-count";
      count.textContent = String(stack.count);
      slot.appendChild(count);
    }

    updateFps(fps) {
      this.fpsCounter.textContent = `FPS ${fps}`;
    }

    setCreative(enabled) {
      this.modeStatus.textContent = enabled ? "Criativo" : "Sobrevivencia";
      this.modeStatus.classList.toggle("creative", enabled);
    }

    updateStats(health, hunger) {
      this.renderStatRow(this.healthBar, health, 20, "vida", "#d74747");
      this.renderStatRow(this.hungerBar, hunger, 20, "fome", "#d7a23c");
    }

    renderStatRow(element, value, max, label, color) {
      element.innerHTML = "";
      element.setAttribute("aria-label", `${label}: ${Math.ceil(value)} de ${max}`);
      for (let i = 0; i < max / 2; i++) {
        const unit = document.createElement("span");
        unit.className = "stat-unit";
        const filled = Math.max(0, Math.min(2, value - i * 2));
        unit.style.setProperty("--fill", `${filled / 2}`);
        unit.style.setProperty("--stat-color", color);
        element.appendChild(unit);
      }
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

    notifyInventoryChanged() {
      if (this.onInventoryChanged) this.onInventoryChanged();
    }
  }

  window.VoxelUI = new GameUI();
})();
