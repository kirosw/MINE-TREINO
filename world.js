(function () {
  "use strict";

  const { BlockId, Blocks, FaceDirections, createTextureAtlas, tileForFace } = window.VoxelBlocks;

  const DEFAULT_WORLD_OPTIONS = {
    chunkSize: 16,
    worldHeight: 64,
    viewDistance: 3,
    unloadDistance: 5,
    seed: 91357,
    saveKey: "voxel-livre-save-v1"
  };

  function floorDiv(value, size) {
    return Math.floor(value / size);
  }

  function mod(value, size) {
    return ((value % size) + size) % size;
  }

  function chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  function blockKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  class Chunk {
    constructor(world, cx, cz) {
      this.world = world;
      this.cx = cx;
      this.cz = cz;
      this.size = world.chunkSize;
      this.height = world.worldHeight;
      this.blocks = new Uint8Array(this.size * this.height * this.size);
      this.mesh = null;
      this.dirty = true;
      this.generated = false;
    }

    index(x, y, z) {
      return x + this.size * (z + this.size * y);
    }

    inBounds(x, y, z) {
      return x >= 0 && x < this.size && z >= 0 && z < this.size && y >= 0 && y < this.height;
    }

    getLocal(x, y, z) {
      if (!this.inBounds(x, y, z)) return BlockId.AIR;
      return this.blocks[this.index(x, y, z)];
    }

    setLocal(x, y, z, id) {
      if (!this.inBounds(x, y, z)) return;
      this.blocks[this.index(x, y, z)] = id;
      this.dirty = true;
    }

    buildMesh() {
      const positions = [];
      const normals = [];
      const colors = [];
      const uvs = [];
      const indices = [];
      let vertexCount = 0;

      for (let y = 0; y < this.height; y++) {
        for (let z = 0; z < this.size; z++) {
          for (let x = 0; x < this.size; x++) {
            const blockId = this.getLocal(x, y, z);
            if (blockId === BlockId.AIR) continue;

            const wx = this.cx * this.size + x;
            const wz = this.cz * this.size + z;

            for (const face of FaceDirections) {
              const nx = wx + face.normal[0];
              const ny = y + face.normal[1];
              const nz = wz + face.normal[2];
              if (this.world.isSolidBlock(nx, ny, nz)) continue;

              const shade = face.name === "py" ? 1 : face.name === "ny" ? 0.55 : 0.78;
              const tile = this.world.textureAtlas.uvForTile(tileForFace(blockId, face.name));

              for (const corner of face.corners) {
                positions.push(wx + corner[0], y + corner[1], wz + corner[2]);
                normals.push(face.normal[0], face.normal[1], face.normal[2]);
                colors.push(shade, shade, shade);
              }
              uvs.push(tile.u1, tile.v0, tile.u1, tile.v1, tile.u0, tile.v1, tile.u0, tile.v0);

              indices.push(
                vertexCount,
                vertexCount + 1,
                vertexCount + 2,
                vertexCount,
                vertexCount + 2,
                vertexCount + 3
              );
              vertexCount += 4;
            }
          }
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();

      if (this.mesh) {
        this.world.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
      }

      this.mesh = new THREE.Mesh(geometry, this.world.material);
      this.mesh.frustumCulled = true;
      this.mesh.userData.chunk = this;
      this.world.scene.add(this.mesh);
      this.dirty = false;
    }

    dispose() {
      if (!this.mesh) return;
      this.world.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }

  class VoxelWorld {
    constructor(scene, options = {}) {
      this.scene = scene;
      this.options = { ...DEFAULT_WORLD_OPTIONS, ...options };
      this.chunkSize = this.options.chunkSize;
      this.worldHeight = this.options.worldHeight;
      this.viewDistance = this.options.viewDistance;
      this.unloadDistance = this.options.unloadDistance;
      this.seed = this.options.seed;
      this.chunks = new Map();
      this.edits = new Map();
      this.pendingRebuilds = new Set();
      this.lastCenterKey = "";
      this.textureAtlas = createTextureAtlas();
      this.material = new THREE.MeshLambertMaterial({
        map: this.textureAtlas.texture,
        vertexColors: true,
        side: THREE.FrontSide
      });
      this.loadEdits();
    }

    getChunk(cx, cz, create = true) {
      const key = chunkKey(cx, cz);
      let chunk = this.chunks.get(key);
      if (!chunk && create) {
        chunk = new Chunk(this, cx, cz);
        this.chunks.set(key, chunk);
        this.generateChunk(chunk);
        this.applyEditsToChunk(chunk);
        this.markChunkDirty(cx, cz);
      }
      return chunk;
    }

    generateAround(position) {
      const centerX = floorDiv(position.x, this.chunkSize);
      const centerZ = floorDiv(position.z, this.chunkSize);
      const centerKey = chunkKey(centerX, centerZ);
      if (centerKey === this.lastCenterKey) return;
      this.lastCenterKey = centerKey;

      for (let dz = -this.viewDistance; dz <= this.viewDistance; dz++) {
        for (let dx = -this.viewDistance; dx <= this.viewDistance; dx++) {
          this.getChunk(centerX + dx, centerZ + dz, true);
        }
      }

      for (const [key, chunk] of this.chunks) {
        const distance = Math.max(Math.abs(chunk.cx - centerX), Math.abs(chunk.cz - centerZ));
        if (distance > this.unloadDistance) {
          chunk.dispose();
          this.chunks.delete(key);
          this.pendingRebuilds.delete(key);
        }
      }
    }

    updateMeshes(maxPerFrame = 2) {
      let built = 0;
      for (const key of Array.from(this.pendingRebuilds)) {
        const chunk = this.chunks.get(key);
        this.pendingRebuilds.delete(key);
        if (chunk && chunk.dirty) {
          chunk.buildMesh();
          built++;
          if (built >= maxPerFrame) return;
        }
      }
    }

    generateChunk(chunk) {
      for (let z = 0; z < this.chunkSize; z++) {
        for (let x = 0; x < this.chunkSize; x++) {
          const wx = chunk.cx * this.chunkSize + x;
          const wz = chunk.cz * this.chunkSize + z;
          const height = this.terrainHeight(wx, wz);

          for (let y = 0; y <= height; y++) {
            let id = BlockId.STONE;
            if (y === height) {
              id = height <= 18 ? BlockId.SAND : BlockId.GRASS;
            } else if (y > height - 4) {
              id = height <= 18 ? BlockId.SAND : BlockId.DIRT;
            }
            chunk.setLocal(x, y, z, id);
          }

          if (height > 20 && this.shouldPlaceTree(wx, wz)) {
            this.placeTree(chunk, x, height + 1, z);
          }
        }
      }

      this.placeSpawnCastle(chunk);
      chunk.generated = true;
    }

    placeSpawnCastle(chunk) {
      const castle = {
        minX: -12,
        maxX: 12,
        minZ: -34,
        maxZ: -10,
        baseY: this.terrainHeight(0, -22) + 1
      };

      const minChunkX = chunk.cx * this.chunkSize;
      const minChunkZ = chunk.cz * this.chunkSize;

      for (let z = 0; z < this.chunkSize; z++) {
        for (let x = 0; x < this.chunkSize; x++) {
          const wx = minChunkX + x;
          const wz = minChunkZ + z;
          if (wx < castle.minX - 1 || wx > castle.maxX + 1 || wz < castle.minZ - 1 || wz > castle.maxZ + 1) continue;

          const inside = wx >= castle.minX && wx <= castle.maxX && wz >= castle.minZ && wz <= castle.maxZ;
          const edgeX = wx === castle.minX || wx === castle.maxX;
          const edgeZ = wz === castle.minZ || wz === castle.maxZ;
          const gate = wz === castle.maxZ && wx >= -2 && wx <= 2;
          const tower = isTowerCorner(wx, wz, castle);

          for (let y = castle.baseY - 5; y < castle.baseY; y++) {
            if (y >= 0) chunk.setLocal(x, y, z, BlockId.STONE);
          }

          for (let y = castle.baseY; y < castle.baseY + 14; y++) {
            chunk.setLocal(x, y, z, BlockId.AIR);
          }

          if (!inside) continue;

          chunk.setLocal(x, castle.baseY, z, BlockId.STONE);

          if (tower) {
            for (let y = castle.baseY + 1; y <= castle.baseY + 10; y++) {
              chunk.setLocal(x, y, z, BlockId.STONE);
            }
            if ((wx + wz) % 2 === 0) {
              chunk.setLocal(x, castle.baseY + 11, z, BlockId.STONE);
            }
            continue;
          }

          if ((edgeX || edgeZ) && !gate) {
            for (let y = castle.baseY + 1; y <= castle.baseY + 6; y++) {
              chunk.setLocal(x, y, z, BlockId.STONE);
            }
            if ((wx + wz) % 2 === 0) {
              chunk.setLocal(x, castle.baseY + 7, z, BlockId.STONE);
            }
          }

          if (gate && (wx === -2 || wx === 2)) {
            for (let y = castle.baseY + 1; y <= castle.baseY + 5; y++) {
              chunk.setLocal(x, y, z, BlockId.WOOD);
            }
          }

          if (gate && wz === castle.maxZ && wx > -2 && wx < 2) {
            chunk.setLocal(x, castle.baseY + 5, z, BlockId.WOOD);
          }

          if (wx >= -4 && wx <= 4 && wz >= -27 && wz <= -21) {
            const keepAir = wx >= -2 && wx <= 2 && wz >= -25 && wz <= -22;
            if (!keepAir) {
              for (let y = castle.baseY + 1; y <= castle.baseY + 4; y++) {
                chunk.setLocal(x, y, z, BlockId.WOOD);
              }
            }
          }
        }
      }

      function isTowerCorner(wx, wz, area) {
        const nearWest = wx >= area.minX && wx <= area.minX + 3;
        const nearEast = wx <= area.maxX && wx >= area.maxX - 3;
        const nearNorth = wz >= area.minZ && wz <= area.minZ + 3;
        const nearSouth = wz <= area.maxZ && wz >= area.maxZ - 3;
        return (nearWest || nearEast) && (nearNorth || nearSouth);
      }
    }

    placeTree(chunk, x, baseY, z) {
      if (baseY + 6 >= this.worldHeight || x < 3 || z < 3 || x > this.chunkSize - 4 || z > this.chunkSize - 4) {
        return;
      }

      const trunkHeight = 4 + Math.floor(this.random2D(chunk.cx * 97 + x, chunk.cz * 97 + z) * 2);
      for (let y = 0; y < trunkHeight; y++) {
        chunk.setLocal(x, baseY + y, z, BlockId.WOOD);
      }

      const leafStart = baseY + trunkHeight - 2;
      for (let ly = 0; ly < 4; ly++) {
        const radius = ly === 3 ? 1 : 2;
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const distance = Math.abs(dx) + Math.abs(dz);
            if (distance > radius + 1) continue;
            if (dx === 0 && dz === 0 && ly < 2) continue;
            chunk.setLocal(x + dx, leafStart + ly, z + dz, BlockId.LEAVES);
          }
        }
      }
    }

    terrainHeight(x, z) {
      const broad = this.valueNoise(x * 0.026, z * 0.026) * 18;
      const detail = this.valueNoise(x * 0.085 + 73, z * 0.085 - 21) * 6;
      const rolling = this.valueNoise(x * 0.014 - 19, z * 0.014 + 41) * 10;
      return THREE.MathUtils.clamp(Math.floor(20 + broad + detail + rolling), 7, this.worldHeight - 12);
    }

    shouldPlaceTree(x, z) {
      const spacing = this.hash2D(Math.floor(x / 4), Math.floor(z / 4));
      return spacing > 0.965 && this.valueNoise(x * 0.04 + 11, z * 0.04 + 29) > 0.08;
    }

    valueNoise(x, z) {
      const x0 = Math.floor(x);
      const z0 = Math.floor(z);
      const xf = x - x0;
      const zf = z - z0;
      const u = xf * xf * (3 - 2 * xf);
      const v = zf * zf * (3 - 2 * zf);

      const a = this.hash2D(x0, z0);
      const b = this.hash2D(x0 + 1, z0);
      const c = this.hash2D(x0, z0 + 1);
      const d = this.hash2D(x0 + 1, z0 + 1);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v) * 2 - 1;
    }

    hash2D(x, z) {
      let n = x * 374761393 + z * 668265263 + this.seed * 1442695041;
      n = (n ^ (n >>> 13)) * 1274126177;
      n = n ^ (n >>> 16);
      return ((n >>> 0) % 10000) / 10000;
    }

    random2D(x, z) {
      return this.hash2D(Math.floor(x), Math.floor(z));
    }

    getBlock(x, y, z) {
      if (y < 0 || y >= this.worldHeight) return BlockId.AIR;
      const cx = floorDiv(x, this.chunkSize);
      const cz = floorDiv(z, this.chunkSize);
      const chunk = this.getChunk(cx, cz, false);
      if (!chunk) return BlockId.AIR;
      return chunk.getLocal(mod(x, this.chunkSize), y, mod(z, this.chunkSize));
    }

    isSolidBlock(x, y, z) {
      const id = this.getBlock(x, y, z);
      return Boolean(Blocks[id] && Blocks[id].solid);
    }

    setBlock(x, y, z, id, save = true) {
      if (y < 0 || y >= this.worldHeight) return false;
      const cx = floorDiv(x, this.chunkSize);
      const cz = floorDiv(z, this.chunkSize);
      const chunk = this.getChunk(cx, cz, true);
      const lx = mod(x, this.chunkSize);
      const lz = mod(z, this.chunkSize);
      if (chunk.getLocal(lx, y, lz) === id) return false;

      chunk.setLocal(lx, y, lz, id);
      this.markChunkAndNeighborsDirty(x, z);

      if (save) {
        const key = blockKey(x, y, z);
        if (id === BlockId.AIR) {
          this.edits.set(key, id);
        } else {
          this.edits.set(key, id);
        }
        this.saveEditsSoon();
      }
      return true;
    }

    markChunkDirty(cx, cz) {
      const key = chunkKey(cx, cz);
      const chunk = this.chunks.get(key);
      if (chunk) chunk.dirty = true;
      this.pendingRebuilds.add(key);
    }

    markChunkAndNeighborsDirty(x, z) {
      const cx = floorDiv(x, this.chunkSize);
      const cz = floorDiv(z, this.chunkSize);
      this.markChunkDirty(cx, cz);
      if (mod(x, this.chunkSize) === 0) this.markChunkDirty(cx - 1, cz);
      if (mod(x, this.chunkSize) === this.chunkSize - 1) this.markChunkDirty(cx + 1, cz);
      if (mod(z, this.chunkSize) === 0) this.markChunkDirty(cx, cz - 1);
      if (mod(z, this.chunkSize) === this.chunkSize - 1) this.markChunkDirty(cx, cz + 1);
    }

    applyEditsToChunk(chunk) {
      const minX = chunk.cx * this.chunkSize;
      const minZ = chunk.cz * this.chunkSize;
      const maxX = minX + this.chunkSize - 1;
      const maxZ = minZ + this.chunkSize - 1;

      for (const [key, id] of this.edits) {
        const [x, y, z] = key.split(",").map(Number);
        if (x < minX || x > maxX || z < minZ || z > maxZ || y < 0 || y >= this.worldHeight) continue;
        chunk.setLocal(mod(x, this.chunkSize), y, mod(z, this.chunkSize), id);
      }
    }

    loadEdits() {
      try {
        const raw = localStorage.getItem(this.options.saveKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!Array.isArray(data.edits)) return;
        this.edits = new Map(data.edits);
      } catch (error) {
        console.warn("Nao foi possivel carregar o mundo salvo.", error);
      }
    }

    saveEditsSoon() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(this.options.saveKey, JSON.stringify({ edits: Array.from(this.edits) }));
          window.VoxelUI?.showSaveStatus("Mundo salvo");
        } catch (error) {
          window.VoxelUI?.showMessage("Nao foi possivel salvar o mundo neste navegador.");
        }
        if (this.onSave) this.onSave();
      }, 350);
    }

    resetSavedWorld() {
      localStorage.removeItem(this.options.saveKey);
    }

    setSaveHandler(handler) {
      this.onSave = handler;
    }

    exportEdits() {
      return Array.from(this.edits);
    }

    importEdits(entries) {
      if (!Array.isArray(entries)) return;
      this.edits = new Map(entries.filter((entry) => Array.isArray(entry) && typeof entry[0] === "string"));
      for (const chunk of this.chunks.values()) {
        this.applyEditsToChunk(chunk);
        this.markChunkDirty(chunk.cx, chunk.cz);
      }
    }

    raycast(origin, direction, maxDistance) {
      const step = 0.05;
      const pos = new THREE.Vector3();
      let previous = null;

      for (let distance = 0; distance <= maxDistance; distance += step) {
        pos.copy(origin).addScaledVector(direction, distance);
        const bx = Math.floor(pos.x);
        const by = Math.floor(pos.y);
        const bz = Math.floor(pos.z);

        if (!previous || previous.x !== bx || previous.y !== by || previous.z !== bz) {
          if (this.isSolidBlock(bx, by, bz)) {
            const normal = previous ? new THREE.Vector3(previous.x - bx, previous.y - by, previous.z - bz) : new THREE.Vector3();
            return {
              block: new THREE.Vector3(bx, by, bz),
              adjacent: previous ? new THREE.Vector3(previous.x, previous.y, previous.z) : null,
              normal,
              distance
            };
          }
          previous = { x: bx, y: by, z: bz };
        }
      }

      return null;
    }

    findSpawnPosition() {
      const height = this.terrainHeight(0, 0);
      return new THREE.Vector3(0.5, height + 3, 0.5);
    }
  }

  window.VoxelWorld = {
    VoxelWorld,
    chunkKey,
    floorDiv,
    mod
  };
})();
