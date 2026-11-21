// Solmar City — bootstrap and the game loop: renderer, golden-hour light,
// input, the title/playing/paused/wasted/busted states, saving, and the
// crime hook every other system reports through.

(function () {
  'use strict';

  SC.now = 0;
  var SAVE_KEY = 'solmar-city-save-v1';
  var SEED = 20261122;

  var canvas = document.getElementById('game');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    document.getElementById('nogl').style.display = 'block';
    window.__gameError = 'WebGL unavailable';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb8d8);
  scene.fog = new THREE.Fog(0xd8c49a, 130, 430);

  // Golden hour: a low warm sun and a soft sky fill.
  var sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110;
  sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110;
  sun.shadow.camera.bottom = -110;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  var hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.85);
  scene.add(hemi);

  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  // ---- world --------------------------------------------------------------
  var city = SC.city.build(scene, SEED);
  var traffic = new SC.Traffic(scene, city, SEED);
  var peds = new SC.Pedestrians(scene, city, SEED);
  var police = new SC.Police(scene, city, SEED);
  var player = new SC.Player(scene, city.spawn);

  var world = {
    scene: scene,
    city: city,
    traffic: traffic,
    peds: peds,
    police: police,
    player: player,
    missions: null, // set below (needs world)
    hud: null, // set below
    onCrime: onCrime,
    saveGame: saveGame,
    loadGame: loadGame,
    clearSave: clearSave,
    hasSave: hasSave,
  };
  world.missions = new SC.Missions(scene, world);
  world.hud = new SC.Hud(world);

  function onCrime(kind, stars) {
    if (stars) police.addWanted(stars);
  }

  // ---- save / load ----------------------------------------------------------
  function saveGame() {
    try {
      var data = {
        money: player.money,
        missionIndex: world.missions.index,
        missionStep: world.missions.step,
        x: player.x,
        z: player.z,
        heading: player.heading,
        health: player.health,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* saving is best-effort */ }
  }

  function loadGame() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function hasSave() {
    return loadGame() !== null;
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  function applySave(data) {
    player.money = data.money || 0;
    player.health = data.health || 100;
    player.x = data.x !== undefined ? data.x : city.spawn.x;
    player.z = data.z !== undefined ? data.z : city.spawn.z;
    player.heading = data.heading || 0;
    player.camYaw = player.heading;
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    world.missions.setMission(data.missionIndex || 0, data.missionStep || 0);
    police.clearWanted();
  }

  // ---- input ---------------------------------------------------------------
  var input = {
    forward: false, back: false, left: false, right: false,
    sprint: false, handbrake: false,
    enter: false, punch: false,
    lookDX: 0, lookDY: 0, zoom: 0,
  };
  var KEYMAP = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'handbrake',
  };
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM') {
      var m = SC.audio.setMuted(!SC.audio.isMuted());
      world.hud.muteBtn.textContent = m ? '🔇 Muted' : '🔊 Sound on';
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
      return;
    }
    if (e.code === 'KeyE') { input.enter = true; return; }
    if (e.code === 'KeyF') { input.punch = true; return; }
    var field = KEYMAP[e.code];
    if (field) {
      input[field] = true;
      if (e.code === 'Space') e.preventDefault();
    }
  });
  window.addEventListener('keyup', function (e) {
    var field = KEYMAP[e.code];
    if (field) input[field] = false;
  });
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    SC.audio.ensureContext();
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    input.lookDX += e.clientX - lastX;
    input.lookDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointerup', function () { dragging = false; });
  canvas.addEventListener('wheel', function (e) {
    input.zoom += Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Test hooks: advance the world a fixed number of frames (used by the
  // headless play-test, where software rendering makes real time crawl),
  // and set input flags from outside. Harmless in normal play.
  world.stepFrames = function (n) {
    for (var i = 0; i < n; i++) {
      update(1 / 60);
      world.hud.update(1 / 60);
    }
    render();
  };
  world.setInput = function (patch) {
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(input, k)) input[k] = patch[k];
    }
  };

  // ---- states ---------------------------------------------------------------
  var state = 'title'; // title | playing | paused | wasted | busted
  var lastMissionIndex = 0;
  var warmUp = 0;
  var shotName = null;

  function startGame(fresh) {
    if (fresh) {
      clearSave();
      player.money = 0;
      player.health = 100;
      player.x = city.spawn.x;
      player.z = city.spawn.z;
      player.heading = city.spawn.heading;
      player.camYaw = player.heading;
      if (player.inCar) {
        player.car.parkedRef.taken = false;
        player.car = null;
        player.inCar = false;
        player.mesh.visible = true;
      }
      player.mesh.position.set(player.x, 0, player.z);
      world.missions.setMission(0, 0);
      police.clearWanted();
    }
    world.hud.hideOverlay();
    state = 'playing';
    world.hud.say('Welcome back to Solmar City, Marco.');
    var m = world.missions.current();
    if (m) world.hud.bigMessage(m.title, m.briefing);
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      saveGame();
      world.hud.showPause(
        function () { world.hud.hideOverlay(); state = 'playing'; },
        function () { startGame(true); },
        function () { state = 'title'; world.hud.hideOverlay(); showTitle(); }
      );
    } else if (state === 'paused') {
      world.hud.hideOverlay();
      state = 'playing';
    }
  }

  function showTitle() {
    state = 'title';
    world.hud.showStart(hasSave(), function () { startGame(true); }, function () {
      var data = loadGame();
      if (data) applySave(data);
      startGame(false);
    });
  }

  function endGame(kind) {
    state = kind;
    police.clearWanted();
    SC.audio.engine(0, false);
    SC.audio.siren(false, 0);
    if (kind === 'wasted') SC.audio.missionFail();
    else SC.audio.busted();
    world.hud.showEnd(kind, function () {
      // Retry: back on your feet at the spawn, cash kept, current job restarts.
      player.health = 100;
      player.x = city.spawn.x;
      player.z = city.spawn.z;
      player.heading = city.spawn.heading;
      player.camYaw = player.heading;
      if (player.inCar) {
        player.car.parkedRef.taken = false;
        player.car = null;
        player.inCar = false;
        player.mesh.visible = true;
      }
      player.mesh.position.set(player.x, 0, player.z);
      world.missions.setMission(world.missions.index, 0);
      world.hud.hideOverlay();
      state = 'playing';
    }, function () {
      world.hud.hideOverlay();
      showTitle();
    });
  }

  // ---- the loop ---------------------------------------------------------------
  var camPos = new THREE.Vector3(0, 10, -20);
  var lastT = performance.now();
  var firstFrame = true;

  function update(dt) {
    SC.now += dt;
    if (state !== 'playing') return;
    player.update(dt, input, world);
    input.enter = false;
    input.punch = false;
    // Danger for pedestrians: the player's car, or the player on foot.
    var danger = { x: player.x, z: player.z };
    peds.update(dt, danger, player.inCar ? 14 : 6);
    traffic.update(dt, { x: player.x, z: player.z }, Math.abs(player.speed));
    var pol = police.update(dt, player);
    missionsTick(dt);
    if (pol.busted) {
      endGame('busted');
      return;
    }
    if (player.health <= 0) {
      endGame('wasted');
      return;
    }
    // Siren when a cruiser is close; engine handled by the player.
    SC.audio.siren(pol.anyClose && police.wanted > 0, dt);
    if (!player.inCar) SC.audio.engine(0, false);
    // Auto-save when a mission completes.
    if (world.missions.index !== lastMissionIndex) {
      lastMissionIndex = world.missions.index;
      saveGame();
    }
  }

  function missionsTick(dt) {
    world.missions.update(dt, input);
  }

  function render() {
    // Sun follows the player so shadows stay crisp wherever you drive.
    sun.position.set(player.x - 90, 150, player.z + 70);
    sun.target.position.set(player.x, 0, player.z);
    var pose = player.cameraPose();
    var target = new THREE.Vector3(pose.x, pose.y, pose.z);
    if (firstFrame) {
      camPos.copy(target);
      firstFrame = false;
    } else {
      camPos.lerp(target, 0.12);
    }
    camera.position.copy(camPos);
    camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
    renderer.render(scene, camera);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (shotName) {
      // Screenshot mode: advance the world on a fixed clock without rendering
      // every step (software rendering is slow), then render once and signal.
      // Driving shots hold the throttle so the car is at speed.
      var shotDef = SC.shots.get(shotName) || {};
      if (shotDef.drive) input.forward = true;
      while (warmUp > 0) {
        update(1 / 60);
        world.hud.update(1 / 60);
        warmUp--;
      }
      input.forward = false;
      render();
      window.__shotReady = true;
      shotName = null; // keep rendering live afterwards
      return;
    }
    update(dt);
    world.hud.update(dt);
    render();
    if (!window.__gameReady) window.__gameReady = true;
  }

  // ---- boot -------------------------------------------------------------------
  window.__solmar = world; // for play-testing and debugging from the console
  shotName = SC.shots.shotName();
  if (shotName) {
    state = 'playing';
    world.hud.hideOverlay();
    SC.shots.apply(world);
    var shotDef = SC.shots.get(shotName) || {};
    warmUp = shotDef.warmUp || 110; // frames of world time before the capture
  } else {
    showTitle();
  }
  requestAnimationFrame(frame);
})();
