(function () {
  "use strict";

  const { BlockId } = window.VoxelBlocks;
  const { VoxelWorld } = window.VoxelWorld;
  const { InputController } = window.VoxelControls;
  const { Player } = window.VoxelPlayer;
  const { CreatureManager } = window.VoxelEntities;
  const ui = window.VoxelUI;
  const audio = window.VoxelAudio;
  const persistence = window.VoxelPersistence;

  let renderer;
  let scene;
  let camera;
  let world;
  let player;
  let input;
  let creatures;
  let highlight;
  let lastTime = performance.now();
  let fpsFrames = 0;
  let fpsElapsed = 0;
  let progressElapsed = 0;
  let running = false;

  init();

  function init() {
    if (!window.THREE) {
      ui.showMessage("Three.js nao foi carregado. Verifique sua conexao com a internet.");
      return;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ec7f0);
    scene.fog = new THREE.Fog(0x8ec7f0, 42, 118);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 260);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.52);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4d0, 0.92);
    sun.position.set(32, 60, 18);
    scene.add(sun);

    world = new VoxelWorld(scene);
    world.setSaveHandler(scheduleProgressSave);
    input = new InputController(renderer.domElement);
    player = new Player(camera, world, input);
    player.onStep = () => audio.playStep();
    player.onJump = () => audio.playJump();
    creatures = new CreatureManager(scene, world, player, audio, ui);
    createHighlight();

    world.generateAround(player.position);
    world.updateMeshes(80);

    ui.playButton.addEventListener("click", () => {
      running = true;
      audio.unlock();
      const playerName = ui.setPlayerName(ui.getPlayerName());
      persistence.setPlayerName(playerName);
      ui.showGame();
      ui.showMessage(`Bem-vindo, ${playerName}`);
      creatures.seedNearPlayer();
      input.lockPointer();
      loadRemoteProgress(playerName);
    });

    ui.playerNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        ui.playButton.click();
      }
    });

    ui.resetButton.addEventListener("click", () => {
      world.resetSavedWorld();
      ui.showMessage("Mundo salvo resetado. Recarregue a pagina para gerar tudo de novo.");
    });

    input.onPrimary = breakTargetBlock;
    input.onSecondary = placeSelectedBlock;
    document.addEventListener("keydown", handleHotbarKeys);
    window.addEventListener("resize", onResize);
    animate(performance.now());
  }

  function createHighlight() {
    const geometry = new THREE.BoxGeometry(1.012, 1.012, 1.012);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    highlight = new THREE.LineSegments(edges, material);
    highlight.visible = false;
    scene.add(highlight);
  }

  function handleHotbarKeys(event) {
    const number = Number(event.key);
    if (number >= 1 && number <= 6) {
      ui.setSelected(number - 1);
      scheduleProgressSave();
    }

    if (event.code === "KeyC" && !event.repeat) {
      const enabled = player.toggleCreative();
      ui.setCreative(enabled);
      audio.playModeToggle(enabled);
      ui.showMessage(enabled ? "Modo criativo ativado" : "Modo sobrevivencia ativado");
      scheduleProgressSave();
    }
  }

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (running) {
      player.update(dt);
      world.generateAround(player.position);
      creatures.update(dt);
      updateTargetHighlight();
      progressElapsed += dt;
      if (progressElapsed >= 5) {
        progressElapsed = 0;
        scheduleProgressSave();
      }
    }

    world.updateMeshes(2);
    renderer.render(scene, camera);
    updateFps(dt);
  }

  function updateFps(dt) {
    fpsFrames++;
    fpsElapsed += dt;
    if (fpsElapsed >= 0.5) {
      ui.updateFps(Math.round(fpsFrames / fpsElapsed));
      fpsFrames = 0;
      fpsElapsed = 0;
    }
  }

  function getLookTarget() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    return world.raycast(camera.position, direction, 6);
  }

  function updateTargetHighlight() {
    const target = getLookTarget();
    if (!target) {
      highlight.visible = false;
      return;
    }
    highlight.visible = true;
    highlight.position.set(target.block.x + 0.5, target.block.y + 0.5, target.block.z + 0.5);
  }

  function breakTargetBlock() {
    const target = getLookTarget();
    if (!target || target.block.y <= 0) return;
    if (world.setBlock(target.block.x, target.block.y, target.block.z, BlockId.AIR)) {
      audio.playBreak();
    }
  }

  function placeSelectedBlock() {
    const target = getLookTarget();
    if (!target || !target.adjacent) return;
    if (!player.canPlaceAt(target.adjacent)) return;
    if (world.setBlock(target.adjacent.x, target.adjacent.y, target.adjacent.z, ui.getSelectedBlock())) {
      audio.playPlace();
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  async function loadRemoteProgress(playerName) {
    const progress = await persistence.load(playerName);
    if (!progress) return;

    if (Array.isArray(progress.edits)) {
      world.importEdits(progress.edits);
    }

    if (progress.player && Number.isFinite(progress.player.x) && Number.isFinite(progress.player.y) && Number.isFinite(progress.player.z)) {
      player.position.set(progress.player.x, progress.player.y, progress.player.z);
      player.velocity.set(0, 0, 0);
      world.generateAround(player.position);
    }

    if (typeof progress.creative === "boolean") {
      player.setCreative(progress.creative);
      ui.setCreative(progress.creative);
    }

    if (Number.isInteger(progress.selectedBlock)) {
      ui.setSelected(progress.selectedBlock);
    }

    ui.showSaveStatus("Progresso carregado");
  }

  function scheduleProgressSave() {
    if (!running) return;
    persistence.saveSoon({
      version: 1,
      player: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      },
      creative: player.creative,
      selectedBlock: ui.selectedIndex,
      edits: world.exportEdits()
    });
  }
})();
