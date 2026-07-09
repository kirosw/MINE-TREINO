(function () {
  "use strict";

  const CREATURE_TYPES = {
    SPROUT: {
      name: "Brotoide",
      speed: 1.3,
      radius: 0.55,
      passive: true,
      color: 0x5aa64f
    },
    SHADE: {
      name: "Vulto",
      speed: 2.15,
      radius: 0.45,
      passive: false,
      color: 0x27313a
    }
  };

  class CreatureManager {
    constructor(scene, world, player, audio, ui) {
      this.scene = scene;
      this.world = world;
      this.player = player;
      this.audio = audio;
      this.ui = ui;
      this.creatures = [];
      this.maxCreatures = 18;
      this.spawnTimer = 0;
      this.shared = createSharedAssets();
    }

    update(dt) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 1.8;
        this.spawnAroundPlayer();
      }

      for (let i = this.creatures.length - 1; i >= 0; i--) {
        const creature = this.creatures[i];
        const distance = creature.group.position.distanceTo(this.player.position);
        if (distance > 88) {
          this.scene.remove(creature.group);
          this.creatures.splice(i, 1);
          continue;
        }
        this.updateCreature(creature, dt, distance);
      }
    }

    seedNearPlayer() {
      if (this.creatures.length > 0) return;
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.3;
        const distance = 7 + Math.random() * 10;
        const x = Math.floor(this.player.position.x + Math.cos(angle) * distance) + 0.5;
        const z = Math.floor(this.player.position.z + Math.sin(angle) * distance) + 0.5;
        const y = this.world.terrainHeight(x, z) + 1.02;
        const type = i === 0 || Math.random() > 0.76 ? CREATURE_TYPES.SHADE : CREATURE_TYPES.SPROUT;
        this.creatures.push(this.createCreature(type, x, y, z));
      }
    }

    spawnAroundPlayer() {
      while (this.creatures.length < this.maxCreatures) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 18 + Math.random() * 36;
        const x = Math.floor(this.player.position.x + Math.cos(angle) * distance) + 0.5;
        const z = Math.floor(this.player.position.z + Math.sin(angle) * distance) + 0.5;
        const y = this.world.terrainHeight(x, z) + 1.02;
        const type = Math.random() > 0.72 ? CREATURE_TYPES.SHADE : CREATURE_TYPES.SPROUT;
        this.creatures.push(this.createCreature(type, x, y, z));
      }
    }

    createCreature(type, x, y, z) {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = Math.random() * Math.PI * 2;
      group.userData.creatureName = type.name;

      const creature = {
        type,
        group,
        parts: {},
        phase: Math.random() * 10,
        target: new THREE.Vector3(x, y, z),
        wait: 0,
        callTimer: 2 + Math.random() * 6,
        bumpTimer: 0
      };

      if (type === CREATURE_TYPES.SPROUT) {
        buildSprout(creature, this.shared);
      } else {
        buildShade(creature, this.shared);
      }

      this.scene.add(group);
      this.pickWanderTarget(creature);
      return creature;
    }

    updateCreature(creature, dt, playerDistance) {
      creature.phase += dt * 7;
      creature.bumpTimer = Math.max(0, creature.bumpTimer - dt);
      creature.callTimer -= dt;

      if (creature.callTimer <= 0 && playerDistance < 24) {
        creature.callTimer = 5 + Math.random() * 8;
        this.audio.playCreature(creature.type.passive);
      }

      if (!creature.type.passive && !this.player.creative && playerDistance < 13) {
        creature.target.copy(this.player.position);
      } else if (creature.wait <= 0 && creature.group.position.distanceTo(creature.target) < 1.2) {
        creature.wait = 0.8 + Math.random() * 2.2;
      } else {
        creature.wait -= dt;
        if (creature.wait <= 0 && creature.group.position.distanceTo(creature.target) < 1.2) {
          this.pickWanderTarget(creature);
        }
      }

      const pos = creature.group.position;
      const direction = new THREE.Vector3(creature.target.x - pos.x, 0, creature.target.z - pos.z);
      if (direction.lengthSq() > 0.04 && creature.wait <= 0) {
        direction.normalize();
        const speed = creature.type.speed * (creature.type.passive ? 1 : playerDistance < 13 ? 1.35 : 1);
        pos.x += direction.x * speed * dt;
        pos.z += direction.z * speed * dt;
        creature.group.rotation.y = Math.atan2(direction.x, direction.z);
      }

      pos.y = THREE.MathUtils.lerp(pos.y, this.world.terrainHeight(pos.x, pos.z) + 1.02, 0.22);
      this.animateCreature(creature, direction.lengthSq() > 0.04 && creature.wait <= 0);

      if (!creature.type.passive && !this.player.creative && playerDistance < 1.35 && creature.bumpTimer <= 0) {
        creature.bumpTimer = 1.2;
        this.audio.playCreature(false);
        this.player.takeDamage(2, "Vulto");
        this.ui.showMessage("Um Vulto te empurrou. Use C para voar no criativo.");
      }
    }

    pickWanderTarget(creature) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 12;
      creature.target.set(
        creature.group.position.x + Math.cos(angle) * distance,
        creature.group.position.y,
        creature.group.position.z + Math.sin(angle) * distance
      );
    }

    animateCreature(creature, moving) {
      const bob = moving ? Math.sin(creature.phase) * 0.06 : 0;
      creature.group.children[0].position.y = creature.parts.baseBodyY + bob;

      if (creature.parts.head) {
        creature.parts.head.position.y = creature.parts.baseHeadY + bob * 0.7;
      }

      if (creature.parts.legs) {
        creature.parts.legs.forEach((leg, index) => {
          leg.rotation.x = moving ? Math.sin(creature.phase + index * Math.PI) * 0.42 : 0;
        });
      }

      if (creature.parts.arms) {
        creature.parts.arms.forEach((arm, index) => {
          arm.rotation.x = moving ? Math.sin(creature.phase + index * Math.PI) * 0.32 : 0.08;
        });
      }
    }
  }

  function createSharedAssets() {
    return {
      cube: new THREE.BoxGeometry(1, 1, 1),
      materials: {
        sproutBody: new THREE.MeshLambertMaterial({ color: 0x5aa64f }),
        sproutBelly: new THREE.MeshLambertMaterial({ color: 0x7bc46a }),
        sproutEye: new THREE.MeshLambertMaterial({ color: 0x172617 }),
        shadeBody: new THREE.MeshLambertMaterial({ color: 0x27313a }),
        shadeHead: new THREE.MeshLambertMaterial({ color: 0x1b232c }),
        shadeEye: new THREE.MeshLambertMaterial({ color: 0x77e6d6 }),
        shadeArm: new THREE.MeshLambertMaterial({ color: 0x303b46 })
      }
    };
  }

  function addBox(group, shared, materialName, position, scale) {
    const mesh = new THREE.Mesh(shared.cube, shared.materials[materialName]);
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.set(scale.x, scale.y, scale.z);
    group.add(mesh);
    return mesh;
  }

  function buildSprout(creature, shared) {
    const group = creature.group;
    const body = addBox(group, shared, "sproutBody", { x: 0, y: 0.42, z: 0 }, { x: 0.92, y: 0.68, z: 1.05 });
    const head = addBox(group, shared, "sproutBelly", { x: 0, y: 0.92, z: 0.42 }, { x: 0.64, y: 0.58, z: 0.56 });
    addBox(group, shared, "sproutEye", { x: -0.18, y: 0.98, z: 0.72 }, { x: 0.1, y: 0.1, z: 0.04 });
    addBox(group, shared, "sproutEye", { x: 0.18, y: 0.98, z: 0.72 }, { x: 0.1, y: 0.1, z: 0.04 });

    const legs = [
      addBox(group, shared, "sproutBody", { x: -0.3, y: 0.05, z: -0.35 }, { x: 0.22, y: 0.34, z: 0.22 }),
      addBox(group, shared, "sproutBody", { x: 0.3, y: 0.05, z: -0.35 }, { x: 0.22, y: 0.34, z: 0.22 }),
      addBox(group, shared, "sproutBody", { x: -0.3, y: 0.05, z: 0.35 }, { x: 0.22, y: 0.34, z: 0.22 }),
      addBox(group, shared, "sproutBody", { x: 0.3, y: 0.05, z: 0.35 }, { x: 0.22, y: 0.34, z: 0.22 })
    ];

    creature.parts = {
      baseBodyY: body.position.y,
      baseHeadY: head.position.y,
      head,
      legs
    };
  }

  function buildShade(creature, shared) {
    const group = creature.group;
    const body = addBox(group, shared, "shadeBody", { x: 0, y: 0.78, z: 0 }, { x: 0.56, y: 1.1, z: 0.36 });
    const head = addBox(group, shared, "shadeHead", { x: 0, y: 1.56, z: 0.05 }, { x: 0.48, y: 0.48, z: 0.44 });
    addBox(group, shared, "shadeEye", { x: -0.13, y: 1.6, z: 0.3 }, { x: 0.08, y: 0.08, z: 0.04 });
    addBox(group, shared, "shadeEye", { x: 0.13, y: 1.6, z: 0.3 }, { x: 0.08, y: 0.08, z: 0.04 });

    const arms = [
      addBox(group, shared, "shadeArm", { x: -0.42, y: 0.82, z: 0.02 }, { x: 0.18, y: 0.75, z: 0.18 }),
      addBox(group, shared, "shadeArm", { x: 0.42, y: 0.82, z: 0.02 }, { x: 0.18, y: 0.75, z: 0.18 })
    ];
    const legs = [
      addBox(group, shared, "shadeBody", { x: -0.16, y: 0.08, z: 0 }, { x: 0.18, y: 0.42, z: 0.18 }),
      addBox(group, shared, "shadeBody", { x: 0.16, y: 0.08, z: 0 }, { x: 0.18, y: 0.42, z: 0.18 })
    ];

    creature.parts = {
      baseBodyY: body.position.y,
      baseHeadY: head.position.y,
      head,
      arms,
      legs
    };
  }

  window.VoxelEntities = { CreatureManager };
})();
