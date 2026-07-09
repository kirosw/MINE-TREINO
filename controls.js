(function () {
  "use strict";

  class InputController {
    constructor(domElement) {
      this.domElement = domElement;
      this.keys = new Set();
      this.pointerLocked = false;
      this.lookDelta = { x: 0, y: 0 };
      this.onPrimary = null;
      this.onSecondary = null;

      document.addEventListener("keydown", (event) => this.handleKeyDown(event));
      document.addEventListener("keyup", (event) => this.keys.delete(event.code));
      document.addEventListener("pointerlockchange", () => {
        this.pointerLocked = document.pointerLockElement === this.domElement;
      });
      document.addEventListener("mousemove", (event) => {
        if (!this.pointerLocked) return;
        this.lookDelta.x += event.movementX;
        this.lookDelta.y += event.movementY;
      });
      document.addEventListener("mousedown", (event) => this.handleMouseDown(event));
      document.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    handleKeyDown(event) {
      this.keys.add(event.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyC", "Space", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight"].includes(event.code)) {
        event.preventDefault();
      }
    }

    handleMouseDown(event) {
      if (!this.pointerLocked) {
        this.lockPointer();
        return;
      }

      if (event.button === 0 && this.onPrimary) this.onPrimary();
      if (event.button === 2 && this.onSecondary) this.onSecondary();
    }

    lockPointer() {
      if (this.domElement.requestPointerLock) {
        this.domElement.requestPointerLock();
      }
    }

    consumeLookDelta() {
      const delta = { ...this.lookDelta };
      this.lookDelta.x = 0;
      this.lookDelta.y = 0;
      return delta;
    }

    isDown(code) {
      return this.keys.has(code);
    }
  }

  window.VoxelControls = { InputController };
})();
