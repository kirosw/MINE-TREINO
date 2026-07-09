(function () {
  "use strict";

  const BlockId = Object.freeze({
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    SAND: 6
  });

  const Blocks = Object.freeze({
    [BlockId.AIR]: { id: BlockId.AIR, name: "Ar", color: 0x000000, solid: false },
    [BlockId.GRASS]: { id: BlockId.GRASS, name: "Grama", color: 0x63b044, solid: true },
    [BlockId.DIRT]: { id: BlockId.DIRT, name: "Terra", color: 0x8b5a35, solid: true },
    [BlockId.STONE]: { id: BlockId.STONE, name: "Pedra", color: 0x7f8787, solid: true },
    [BlockId.WOOD]: { id: BlockId.WOOD, name: "Madeira", color: 0x9a6232, solid: true },
    [BlockId.LEAVES]: { id: BlockId.LEAVES, name: "Folhas", color: 0x3f9b4a, solid: true },
    [BlockId.SAND]: { id: BlockId.SAND, name: "Areia", color: 0xdfca83, solid: true }
  });

  const HotbarBlocks = [
    BlockId.GRASS,
    BlockId.DIRT,
    BlockId.STONE,
    BlockId.WOOD,
    BlockId.LEAVES,
    BlockId.SAND
  ];

  const FaceDirections = [
    { name: "px", normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { name: "nx", normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { name: "py", normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { name: "ny", normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { name: "pz", normal: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
    { name: "nz", normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
  ];

  const textureTiles = [
    "grass_top",
    "grass_side",
    "dirt",
    "stone",
    "wood_side",
    "wood_top",
    "leaves",
    "sand"
  ];

  function tileForFace(blockId, faceName) {
    if (blockId === BlockId.GRASS) {
      if (faceName === "py") return "grass_top";
      if (faceName === "ny") return "dirt";
      return "grass_side";
    }

    if (blockId === BlockId.DIRT) return "dirt";
    if (blockId === BlockId.STONE) return "stone";
    if (blockId === BlockId.WOOD) return faceName === "py" || faceName === "ny" ? "wood_top" : "wood_side";
    if (blockId === BlockId.LEAVES) return "leaves";
    if (blockId === BlockId.SAND) return "sand";
    return "dirt";
  }

  function createTextureAtlas() {
    const tileSize = 16;
    const canvas = document.createElement("canvas");
    canvas.width = textureTiles.length * tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext("2d", { alpha: false });

    textureTiles.forEach((name, index) => drawTile(ctx, name, index * tileSize, 0, tileSize));

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    if ("encoding" in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;

    return {
      texture,
      uvForTile(name) {
        const index = Math.max(0, textureTiles.indexOf(name));
        const pad = 0.002;
        const tileWidth = 1 / textureTiles.length;
        return {
          u0: index * tileWidth + pad,
          u1: (index + 1) * tileWidth - pad,
          v0: pad,
          v1: 1 - pad
        };
      }
    };
  }

  function drawTile(ctx, name, offsetX, offsetY, size) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        ctx.fillStyle = pixelColor(name, x, y);
        ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
      }
    }
  }

  function pixelColor(name, x, y) {
    const n = noise(x, y, name.length * 37);
    const n2 = noise(x * 3, y * 5, name.length * 71);

    if (name === "grass_top") {
      const base = n > 0.72 ? 0x79c85a : n < 0.18 ? 0x447f35 : 0x61ad45;
      return hex(mix(base, 0x2f6b2f, n2 > 0.82 ? 0.35 : 0));
    }

    if (name === "grass_side") {
      if (y < 4 + Math.floor(noise(x, 1, 8) * 3)) {
        return hex(mix(0x60ac43, 0x3d7b32, n * 0.45));
      }
      const dirt = n > 0.7 ? 0x9b6840 : n < 0.22 ? 0x68442d : 0x805235;
      return hex(dirt);
    }

    if (name === "dirt") {
      const pebble = n2 > 0.86 ? 0xb07b4e : n < 0.2 ? 0x5f3d29 : 0x835437;
      return hex(pebble);
    }

    if (name === "stone") {
      const crack = (x + y * 2 + Math.floor(n * 5)) % 11 === 0;
      const base = n > 0.72 ? 0x9aa0a0 : n < 0.2 ? 0x646b6b : 0x818888;
      return hex(crack ? 0x555b5b : base);
    }

    if (name === "wood_side") {
      const stripe = x % 5 === 0 || (x + Math.floor(n * 3)) % 7 === 0;
      const knot = Math.abs(x - 9) + Math.abs(y - 7) < 3 && n2 > 0.35;
      return hex(knot ? 0x5b321b : stripe ? 0x6f421f : mix(0x9a6232, 0xc08245, n * 0.3));
    }

    if (name === "wood_top") {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const ring = Math.floor(Math.sqrt(dx * dx + dy * dy) * 2.2) % 3 === 0;
      return hex(ring ? 0x704220 : mix(0xb9793e, 0xd19455, n * 0.35));
    }

    if (name === "leaves") {
      const vein = (x + y) % 9 === 0;
      const base = n > 0.68 ? 0x4ead56 : n < 0.2 ? 0x2f7137 : 0x3f9848;
      return hex(vein ? mix(base, 0x245c2d, 0.35) : base);
    }

    if (name === "sand") {
      const speck = n2 > 0.84 ? 0xbca461 : n < 0.18 ? 0xcdb66d : 0xe3cf86;
      return hex(speck);
    }

    return "#ff00ff";
  }

  function noise(x, y, seed) {
    let n = x * 374761393 + y * 668265263 + seed * 1442695041;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return ((n >>> 0) % 10000) / 10000;
  }

  function mix(a, b, amount) {
    const ar = (a >> 16) & 255;
    const ag = (a >> 8) & 255;
    const ab = a & 255;
    const br = (b >> 16) & 255;
    const bg = (b >> 8) & 255;
    const bb = b & 255;
    return (
      (Math.round(ar + (br - ar) * amount) << 16) |
      (Math.round(ag + (bg - ag) * amount) << 8) |
      Math.round(ab + (bb - ab) * amount)
    );
  }

  function hex(value) {
    return `#${value.toString(16).padStart(6, "0")}`;
  }

  window.VoxelBlocks = {
    BlockId,
    Blocks,
    HotbarBlocks,
    FaceDirections,
    createTextureAtlas,
    tileForFace
  };
})();
