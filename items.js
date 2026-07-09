(function () {
  "use strict";

  const { BlockId, Blocks } = window.VoxelBlocks;

  const ItemId = Object.freeze({
    GRASS: "block_grass",
    DIRT: "block_dirt",
    STONE: "block_stone",
    WOOD: "block_wood",
    LEAVES: "block_leaves",
    SAND: "block_sand",
    BERRY: "food_berry",
    BREAD: "food_bread",
    APPLE: "food_apple"
  });

  const Items = Object.freeze({
    [ItemId.GRASS]: blockItem(ItemId.GRASS, BlockId.GRASS),
    [ItemId.DIRT]: blockItem(ItemId.DIRT, BlockId.DIRT),
    [ItemId.STONE]: blockItem(ItemId.STONE, BlockId.STONE),
    [ItemId.WOOD]: blockItem(ItemId.WOOD, BlockId.WOOD),
    [ItemId.LEAVES]: blockItem(ItemId.LEAVES, BlockId.LEAVES),
    [ItemId.SAND]: blockItem(ItemId.SAND, BlockId.SAND),
    [ItemId.BERRY]: { id: ItemId.BERRY, type: "food", name: "Bagas", color: 0xc83f5d, hunger: 3 },
    [ItemId.BREAD]: { id: ItemId.BREAD, type: "food", name: "Pao", color: 0xc98b43, hunger: 5 },
    [ItemId.APPLE]: { id: ItemId.APPLE, type: "food", name: "Fruta", color: 0xd94b3d, hunger: 4 }
  });

  const DefaultInventory = [
    stack(ItemId.GRASS, 64),
    stack(ItemId.DIRT, 64),
    stack(ItemId.STONE, 64),
    stack(ItemId.WOOD, 64),
    stack(ItemId.LEAVES, 64),
    stack(ItemId.SAND, 64),
    stack(ItemId.BERRY, 8),
    stack(ItemId.BREAD, 4),
    stack(ItemId.APPLE, 5),
    stack(ItemId.GRASS, 32),
    stack(ItemId.DIRT, 32),
    stack(ItemId.STONE, 32),
    stack(ItemId.WOOD, 16),
    stack(ItemId.SAND, 24),
    stack(ItemId.BERRY, 6),
    stack(ItemId.BREAD, 2),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ];

  function blockItem(id, blockId) {
    const block = Blocks[blockId];
    return {
      id,
      type: "block",
      name: block.name,
      color: block.color,
      blockId
    };
  }

  function stack(id, count) {
    return { id, count };
  }

  function cloneDefaultInventory() {
    return DefaultInventory.map((item) => item ? { ...item } : null);
  }

  function itemForBlock(blockId) {
    return Object.values(Items).find((item) => item.type === "block" && item.blockId === blockId) || null;
  }

  window.VoxelItems = {
    ItemId,
    Items,
    cloneDefaultInventory,
    itemForBlock
  };
})();
