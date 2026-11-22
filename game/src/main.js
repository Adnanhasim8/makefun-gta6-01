// main.js — Sunset Bay bootstrap and game loop.
// Builds the world, runs the state machine (menu / playing / paused /
// busted / wasted), and stages screenshot scenes from ?shot=.

import { makeRng } from './rng.js';
import { buildCity, WORLD } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer, createCar, enterCar } from './player.js';
import { createTraffic, createParkedCars, updateTraffic } from './traffic.js';
import { updatePolice } from './police.js';
import { createCombat, updateCombat, spawnParticles } from './combat.js';
import { createMissions, updateMissions, currentMarker, MISSION_DEFS } from './missions.js';
import { render } from './render.js';
import { drawHUD } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';

const SEED = 20261122;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const game = {
  ctx,
  time: 0,
  state: 'menu', // menu | playing | paused | busted | wasted
  view: { w: 1280, h: 720 },
  camera: { x: WORLD / 2, y: WORLD / 2, zoom: 1, shake: 0 },
  city: null,
  player: null,
  cars: [],
  peds: [],
  police: [],
  footCops: [],
  combat: null,
  missions: null,
  messages: [],
  stats: { shotsFired: 0, carsStolen: 0, cashFound: 0, missionsDone: 0, taxiFares: 0 },
  rng: makeRng(SEED),
  policeSpawnTimer: 0,
  demoDrive: false, // ?shot= staging only: holds the throttle down for the shot
  marker: null,
  audio: createAudio(),
  input: null,
  saveTimer: 0,
};

game.input = createInput(canvas);
game.combat = createCombat();
game.spawnParticles = (x, y, color, count) => spawnParticles(game, x, y, color, count);
game.addMessage = (text) => {
  game.messages.push({ text, at: game.time });
  if (game.messages.length > 4) game.messages.shift();
};
game.damagePlayer = (amount, cause) => {
  const p = game.player;
  if (!p.alive || game.state !== 'playing') return;
  p.health -= amount;
  p.lastDamageAt = game.time;
  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
    if (cause === 'busted') game.busted();
    else game.wasted();
  }
};
game.busted = () => {
  if (game.state !== 'playing') return;
  game.state = 'busted';
  const p = game.player;
  p.money = Math.max(0, p.money - 250);
  p.heat = 0;
  p.wanted = 0;
  game.police = [];
  game.footCops = [];
  showEndScreen('BUSTED', 'The Sunset Bay PD caught up with you. Bail cost you $250.');
  game.audio.missionFail();
};
game.wasted = () => {
  if (game.state !== 'playing') return;
  game.state = 'wasted';
  const p = game.player;
  p.money = Math.max(0, p.money - 150);
  p.heat = 0;
  p.wanted = 0;
  game.police = [];
  game.footCops = [];
  showEndScreen('WASTED', 'Rico is down. The hospital patched him up — for $150.');
  game.audio.missionFail();
};

/** Build a fresh world and player. */
function newGame(fromSave) {
  game.city = buildCity(SEED);
  const traffic = createTraffic(game.city, SEED);
  game.cars = [...createParkedCars(game.city, SEED), ...traffic.cars];
  game.peds = traffic.peds;
  game.police = [];
  game.footCops = [];
  game.combat = createCombat();
  game.missions = createMissions();
  game.messages = [];
  game.time = 0;
  game.stats = { shotsFired: 0, carsStolen: 0, cashFound: 0, missionsDone: 0, taxiFares: 0 };
  game.rng = makeRng(SEED);

  const save = fromSave ? loadSave() : null;
  const startX = save && save.playerX !== null ? save.playerX : game.city.garage.x - 60;
  const startY = save && save.playerY !== null ? save.playerY : game.city.garage.y + 120;
  game.player = createPlayer(startX, startY);
  if (save) {
    game.player.money = save.money;
    game.missions.done = save.missionsDone.slice();
    game.missions.current = Math.min(save.missionsDone.length, MISSION_DEFS.length - 1);
    if (game.missions.current >= MISSION_DEFS.length) game.missions.active = false;
    game.stats.taxiFares = save.taxiFares;
  }
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.marker = currentMarker(game);
  game.addMessage("Welcome to Sunset Bay, Rico. Mara's waiting — steal a car.");
}

/** Resize the canvas to the window, keeping the 16:9 playfield. */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  game.view.w = w;
  game.view.h = h;
  const scale = Math.min(w / 1280, h / 720);
  game.camera.zoom = Math.max(0.75, Math.min(1.15, scale * 1.05));
}
window.addEventListener('resize', resize);
resize();

/** One fixed update step. */
function update(dt) {
  game.time += dt;
  const p = game.player;
  updatePlayer(game, dt);
  updateTraffic(game, dt);
  updatePolice(game, dt);
  updateCombat(game, dt);
  updateMissions(game, dt);
  game.marker = currentMarker(game);

  // Camera follows the player with a little look-ahead.
  const lookX = p.onFoot ? 0 : Math.cos(p.angle) * Math.abs(p.car ? p.car.speed : 0) * 0.18;
  const lookY = p.onFoot ? 0 : Math.sin(p.angle) * Math.abs(p.car ? p.car.speed : 0) * 0.18;
  const tx = p.x + lookX;
  const ty = p.y + lookY;
  game.camera.x += (tx - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (ty - game.camera.y) * Math.min(1, dt * 5);
  game.camera.x = Math.max(0, Math.min(WORLD, game.camera.x));
  game.camera.y = Math.max(0, Math.min(WORLD, game.camera.y));
  game.camera.shake = Math.max(0, game.camera.shake - dt * 14);

  // Autosave every 20 seconds.
  game.saveTimer += dt;
  if (game.saveTimer > 20) {
    game.saveTimer = 0;
    writeSave(game);
  }

  // Audio follows the drive.
  const speed01 = p.car ? Math.abs(p.car.speed) / p.car.spec.top : 0;
  game.audio.update(speed01, p.wanted);
}

/** The main loop: fixed 60 Hz steps, then one render. */
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.state === 'playing') {
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      update(1 / 60);
      accumulator -= 1 / 60;
    }
    render(game);
    drawHUD(ctx, game);
  } else if (game.state === 'menu') {
    // A slow camera drift over the city behind the title screen.
    game.time += dt;
    game.camera.x = WORLD / 2 + Math.cos(game.time * 0.05) * 500;
    game.camera.y = WORLD / 2 + Math.sin(game.time * 0.04) * 500;
    render(game);
  } else {
    // Paused / busted / wasted: freeze the world, keep the last frame.
    render(game);
    drawHUD(ctx, game);
  }
  game.input.endFrame();
}

/** Stage a deterministic scene for screenshots (?shot=...). */
function stageShot(shot) {
  newGame(false);
  game.state = 'playing';
  const p = game.player;
  const city = game.city;
  if (shot === 'street') {
    // On foot at a busy downtown intersection, mission 1 marker ahead.
    p.x = city.hotel.x + 260;
    p.y = city.hotel.y + 180;
    p.aimAngle = -Math.PI / 2;
  } else if (shot === 'chase') {
    // Driving a sports car with police cars on the tail, wanted 4.
    const car = game.cars.find((c) => c.type === 'sports' && c.driver === 'parked');
    enterCar(game, car);
    p.heat = 82;
    p.wanted = 4;
    game.missions.current = 2;
    game.missions.step = 2;
  } else if (shot === 'mission') {
    // The bank job: holding the lobby at wanted 4, the getaway about to start.
    p.x = city.bank.x;
    p.y = city.bank.y + 80;
    p.heat = 85;
    p.wanted = 4;
    game.missions.current = 2;
    game.missions.step = 1;
    game.missions.holdTimer = 2.0;
    // A shorter settle so the hold is still in progress at the capture.
    for (let i = 0; i < 120; i++) update(1 / 60);
    game.camera.x = p.x;
    game.camera.y = p.y;
    game.marker = currentMarker(game);
    render(game);
    drawHUD(ctx, game);
    return;
  } else {
    // Cover (default): driving through downtown with a police chase,
    // wanted 3, the package job active.
    const car = game.cars.find((c) => c.type === 'sports' && c.driver === 'parked');
    enterCar(game, car);
    p.heat = 68;
    p.wanted = 3;
    p.money = 940;
    game.missions.current = 1;
    game.missions.step = 1;
    game.missions.missionTimer = 74;
  }
  // Let the world run for a few seconds so traffic, police and peds
  // settle into a lived-in frame.
  for (let i = 0; i < 240; i++) update(1 / 60);
  if (shot === 'chase' || shot === 'cover') {
    // Re-place the car on an east-west road with speed, and keep the
    // throttle down so the capture catches it mid-drive, police closing in.
    // The chase drives west from midtown so the frame stays inside the city.
    const west = shot === 'chase';
    const startX = west ? 2400 : 500;
    const speed = west ? 520 : 460;
    p.car.x = startX;
    p.car.y = 1600;
    p.car.angle = west ? Math.PI : 0;
    p.car.speed = speed;
    game.demoDrive = true;
  }
  game.camera.x = p.x;
  game.camera.y = p.y;
  game.marker = currentMarker(game);
  render(game);
  drawHUD(ctx, game);
}

// ---- Menu / overlay wiring ---------------------------------------------

const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const endEl = document.getElementById('end');
const endTitle = document.getElementById('end-title');
const endText = document.getElementById('end-text');

function hideOverlays() {
  menuEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  endEl.classList.add('hidden');
}

function showEndScreen(title, text) {
  endTitle.textContent = title;
  endText.textContent = text;
  endEl.classList.remove('hidden');
}

document.getElementById('start-btn').addEventListener('click', () => {
  game.audio.ensure();
  game.audio.click();
  hideOverlays();
  game.state = 'playing';
});
document.getElementById('continue-btn').addEventListener('click', () => {
  game.audio.ensure();
  game.audio.click();
  hideOverlays();
  newGame(true);
  game.state = 'playing';
});
document.getElementById('newgame-btn').addEventListener('click', () => {
  clearSave();
  newGame(false);
  document.getElementById('continue-btn').style.display = 'none';
  game.audio.click();
});
document.getElementById('resume-btn').addEventListener('click', () => {
  hideOverlays();
  game.state = 'playing';
  game.audio.click();
});
document.getElementById('restart-btn').addEventListener('click', () => {
  hideOverlays();
  newGame(false);
  game.state = 'playing';
  game.audio.click();
});
document.getElementById('retry-btn').addEventListener('click', () => {
  hideOverlays();
  const p = game.player;
  p.alive = true;
  p.health = 100;
  p.x = game.city.hospital.x;
  p.y = game.city.hospital.y + 140;
  if (p.car) {
    p.car.driver = 'parked';
    p.car = null;
  }
  p.onFoot = true;
  game.camera.x = p.x;
  game.camera.y = p.y;
  game.state = 'playing';
  game.audio.click();
});
document.getElementById('quit-btn').addEventListener('click', () => {
  writeSave(game);
  hideOverlays();
  menuEl.classList.remove('hidden');
  game.state = 'menu';
});

// Pause on P or Escape; mute on M.
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && game.state === 'playing') {
    const muted = game.audio.toggleMute();
    game.addMessage(muted ? 'Sound muted' : 'Sound on');
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && game.state === 'playing') {
    game.state = 'paused';
    pauseEl.classList.remove('hidden');
  } else if ((e.code === 'KeyP' || e.code === 'Escape') && game.state === 'paused') {
    hideOverlays();
    game.state = 'playing';
  }
});

// ---- Boot --------------------------------------------------------------

newGame(false);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  hideOverlays();
  stageShot(shot);
} else {
  // Show Continue only when a save exists.
  if (!loadSave()) document.getElementById('continue-btn').style.display = 'none';
  document.getElementById('story-line').textContent =
    'Rico Vale is out, broke and back in Sunset Bay. Mara Quinn has three jobs — and the whole city is for the taking.';
}
requestAnimationFrame(frame);

// A small hook for automated play-testing: state, player and helpers.
window.__game = game;
window.__stageShot = stageShot;
