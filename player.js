(function () {
  "use strict";

  class Player {
    constructor(camera, world, input) {
      this.camera = camera;
      this.world = world;
      this.input = input;
      this.position = world.findSpawnPosition();
      this.velocity = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.height = 1.72;
      this.radius = 0.32;
      this.onGround = false;
      this.walkSpeed = 4.7;
      this.runSpeed = 7.4;
      this.creativeSpeed = 8.5;
      this.creativeRunSpeed = 15;
      this.jumpSpeed = 7.0;
      this.gravity = 21;
      this.creative = false;
      this.maxHealth = 20;
      this.health = 20;
      this.maxHunger = 20;
      this.hunger = 20;
      this.hungerDrain = 0;
      this.regenTimer = 0;
      this.starveTimer = 0;
      this.fallStartY = this.position.y;
      this.stepTimer = 0;
      this.onStep = null;
      this.onJump = null;
      this.onDamage = null;
      this.onStatsChanged = null;
      this.onDeath = null;
      this.camera.position.copy(this.position).add(new THREE.Vector3(0, this.height, 0));
    }

    update(dt) {
      this.updateLook();
      this.stepTimer = Math.max(0, this.stepTimer - dt);

      if (this.creative) {
        this.updateCreativeMovement(dt);
        this.updateCamera();
        this.notifyStatsChanged();
        return;
      }

      const speed = this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight") ? this.runSpeed : this.walkSpeed;
      const forward = Number(this.input.isDown("KeyW")) - Number(this.input.isDown("KeyS"));
      const right = Number(this.input.isDown("KeyD")) - Number(this.input.isDown("KeyA"));
      const wish = new THREE.Vector3(right, 0, -forward);

      if (wish.lengthSq() > 0) {
        wish.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      }

      this.velocity.x = wish.x * speed;
      this.velocity.z = wish.z * speed;

      if (this.onGround && this.input.isDown("Space")) {
        this.velocity.y = this.jumpSpeed;
        this.onGround = false;
        this.spendHunger(0.18);
        this.fallStartY = this.position.y;
        if (this.onJump) this.onJump();
      }

      if (!this.onGround) {
        this.fallStartY = Math.max(this.fallStartY, this.position.y);
      }

      this.velocity.y -= this.gravity * dt;
      this.moveAxis("x", this.velocity.x * dt);
      this.moveAxis("z", this.velocity.z * dt);
      this.moveAxis("y", this.velocity.y * dt);
      this.updateSurvival(dt, wish.lengthSq() > 0, speed > this.walkSpeed);

      if (this.position.y < -12) {
        this.takeDamage(8, "queda no vazio");
        this.respawnIfDead();
      }

      if (this.onGround && wish.lengthSq() > 0 && this.stepTimer <= 0) {
        this.stepTimer = speed > this.walkSpeed ? 0.26 : 0.38;
        if (this.onStep) this.onStep();
      }

      this.updateCamera();
      this.notifyStatsChanged();
    }

    updateCreativeMovement(dt) {
      const speed = this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight") ? this.creativeRunSpeed : this.creativeSpeed;
      const forward = Number(this.input.isDown("KeyW")) - Number(this.input.isDown("KeyS"));
      const right = Number(this.input.isDown("KeyD")) - Number(this.input.isDown("KeyA"));
      const up = Number(this.input.isDown("Space")) - Number(this.input.isDown("ControlLeft") || this.input.isDown("ControlRight"));
      const wish = new THREE.Vector3(right, up, -forward);

      if (wish.lengthSq() > 0) {
        wish.normalize();
        const horizontal = new THREE.Vector3(wish.x, 0, wish.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        this.position.x += horizontal.x * speed * dt;
        this.position.z += horizontal.z * speed * dt;
        this.position.y += wish.y * speed * dt;
      }

      this.velocity.set(0, 0, 0);
      this.onGround = false;
    }

    updateCamera() {
      this.camera.position.set(this.position.x, this.position.y + this.height, this.position.z);
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    }

    updateLook() {
      const delta = this.input.consumeLookDelta();
      const sensitivity = 0.0022;
      this.yaw -= delta.x * sensitivity;
      this.pitch -= delta.y * sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    }

    moveAxis(axis, amount) {
      if (amount === 0) return;
      this.position[axis] += amount;

      if (this.collides()) {
        this.position[axis] -= amount;
        if (axis === "y") {
          if (amount < 0) {
            const fallDistance = Math.max(0, this.fallStartY - this.position.y);
            if (!this.onGround && fallDistance > 3.2) {
              this.takeDamage((fallDistance - 3.2) * 1.35, "queda");
            }
            this.onGround = true;
            this.fallStartY = this.position.y;
          }
          this.velocity.y = 0;
        }
      } else if (axis === "y" && amount !== 0) {
        this.onGround = false;
      }
    }

    collides() {
      const minX = Math.floor(this.position.x - this.radius);
      const maxX = Math.floor(this.position.x + this.radius);
      const minY = Math.floor(this.position.y);
      const maxY = Math.floor(this.position.y + this.height);
      const minZ = Math.floor(this.position.z - this.radius);
      const maxZ = Math.floor(this.position.z + this.radius);

      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          for (let x = minX; x <= maxX; x++) {
            if (this.world.isSolidBlock(x, y, z)) return true;
          }
        }
      }

      return false;
    }

    canPlaceAt(blockPosition) {
      const minX = Math.floor(this.position.x - this.radius);
      const maxX = Math.floor(this.position.x + this.radius);
      const minY = Math.floor(this.position.y);
      const maxY = Math.floor(this.position.y + this.height);
      const minZ = Math.floor(this.position.z - this.radius);
      const maxZ = Math.floor(this.position.z + this.radius);
      return !(
        blockPosition.x >= minX && blockPosition.x <= maxX &&
        blockPosition.y >= minY && blockPosition.y <= maxY &&
        blockPosition.z >= minZ && blockPosition.z <= maxZ
      );
    }

    setCreative(enabled) {
      this.creative = enabled;
      this.velocity.set(0, 0, 0);
      this.onGround = false;
      if (enabled) {
        this.health = this.maxHealth;
        this.hunger = this.maxHunger;
      }
      this.notifyStatsChanged();
    }

    toggleCreative() {
      this.setCreative(!this.creative);
      return this.creative;
    }

    updateSurvival(dt, moving, running) {
      if (this.creative || this.health <= 0) return;

      if (moving && this.onGround) {
        this.spendHunger((running ? 0.38 : 0.16) * dt);
      } else {
        this.spendHunger(0.025 * dt);
      }

      if (this.hunger >= 17 && this.health < this.maxHealth) {
        this.regenTimer += dt;
        if (this.regenTimer >= 3) {
          this.regenTimer = 0;
          this.heal(1);
          this.spendHunger(0.45);
        }
      } else {
        this.regenTimer = 0;
      }

      if (this.hunger <= 0) {
        this.starveTimer += dt;
        if (this.starveTimer >= 4) {
          this.starveTimer = 0;
          this.takeDamage(1, "fome");
        }
      } else {
        this.starveTimer = 0;
      }
    }

    spendHunger(amount) {
      if (this.creative || amount <= 0) return;
      this.hunger = THREE.MathUtils.clamp(this.hunger - amount, 0, this.maxHunger);
    }

    eat(foodItem) {
      if (!foodItem || foodItem.type !== "food") return false;
      if (this.creative) return false;
      if (this.hunger >= this.maxHunger && this.health >= this.maxHealth) return false;
      this.hunger = THREE.MathUtils.clamp(this.hunger + foodItem.hunger, 0, this.maxHunger);
      if (foodItem.hunger >= 4) this.heal(1);
      this.notifyStatsChanged();
      return true;
    }

    heal(amount) {
      this.health = THREE.MathUtils.clamp(this.health + amount, 0, this.maxHealth);
    }

    takeDamage(amount, source = "dano") {
      if (this.creative || this.health <= 0) return false;
      this.health = THREE.MathUtils.clamp(this.health - amount, 0, this.maxHealth);
      if (this.onDamage) this.onDamage(amount, source);
      this.notifyStatsChanged();
      this.respawnIfDead();
      return true;
    }

    respawnIfDead() {
      if (this.health > 0) return;
      if (this.onDeath) this.onDeath();
      this.position.copy(this.world.findSpawnPosition());
      this.velocity.set(0, 0, 0);
      this.health = this.maxHealth;
      this.hunger = Math.max(12, this.hunger);
      this.fallStartY = this.position.y;
      this.notifyStatsChanged();
    }

    setSurvivalStats(stats) {
      if (!stats || typeof stats !== "object") return;
      if (Number.isFinite(stats.health)) this.health = THREE.MathUtils.clamp(stats.health, 0, this.maxHealth);
      if (Number.isFinite(stats.hunger)) this.hunger = THREE.MathUtils.clamp(stats.hunger, 0, this.maxHunger);
      this.notifyStatsChanged();
    }

    exportSurvivalStats() {
      return {
        health: this.health,
        hunger: this.hunger
      };
    }

    notifyStatsChanged() {
      if (this.onStatsChanged) this.onStatsChanged(this.health, this.hunger);
    }
  }

  window.VoxelPlayer = { Player };
})();
