// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between six screens: title, play, paused, help, wasted and busted.
//
// ?seed=N fixes the world. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import {
  ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_HORN,
  ACTION_RESTART, ACTION_MUTE, createInput, takeClick,
} from './input.js';
import {
  createPlayer, spawnTraffic, spawnPedestrians, spawnParkedCars, spawnPickups,
  updatePlayer, updateTraffic, updatePedestrians, updatePickups, playerDistrict,
} from './entities.js';
import { updateCombat } from './combat.js';
import { addWanted, clearWanted, updatePolice } from './police.js';
import {
  missionStartPoint, tryStartMission, updateMission, updateFare,
} from './missions.js';
import { drawGame, drawScreen } from './render.js';
import { setupShot } from './shots.js';
import {
  isMuted, playBusted, playHorn, playMissionFail, toggleMute,
  unlockAudio, updateAmbience,
} from './audio.js';
import { clearSave, readSave, writeSave } from './save.js';
import { distance } from './random.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function createState(seedValue) {
  const rng = createRandom(seedValue);
  const city = buildCity(rng);
  const garage = city.landmarks.garage;
  const state = {
    time: 0,
    seed: seedValue,
    rng,
    city,
    player: createPlayer(garage.x + garage.w / 2, garage.y + garage.h / 2),
    cars: [],
    peds: [],
    pickups: [],
    bullets: [],
    thugs: [],
    officers: [],
    wanted: 0,
    wantedTimer: 0,
    lastWanted: 0,
    mission: null,
    missionsDone: [false, false, false],
    fare: null,
    fareDelay: 4,
    events: [],
    messages: [],
    fleeFrom: null,
    fleeTimer: 0,
    district: 'Solmar City',
    prompt: '',
    camera: { x: 0, y: 0, w: VIEW.width, h: VIEW.height, scale: 1, ox: 0, oy: 0 },
  };
  state.cars = [...spawnTraffic(rng, city), ...spawnParkedCars(rng, city)];
  state.peds = spawnPedestrians(rng, city);
  state.pickups = spawnPickups(rng, city);
  return state;
}

function pushMessage(state, text, good) {
  state.messages.unshift({ text, life: 4, good: !!good });
  if (state.messages.length > 4) state.messages.pop();
}

/** The context prompt under the HUD (what E does here, if anything). */
function computePrompt(state, input) {
  const player = state.player;
  if (player.inCar) return '';
  const start = missionStartPoint(state);
  if (!state.mission && start && distance(player.x, player.y, start.x, start.y) < 90) {
    return `Press E to start: ${start.label}`;
  }
  // The nearest stealable car.
  let best = null;
  let bestDist = 80;
  for (const car of state.cars) {
    if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  if (best) return best.owned ? 'Press E to get in your car' : 'Press E to steal the car';
  return '';
}

/** Handle one frame's events (toasts, wanted, screens). */
function handleEvents(state, screen) {
  const events = state.events.splice(0);
  let nextScreen = screen;
  for (const event of events) {
    if (event.type === 'cash') pushMessage(state, `+$${event.amount} street cash`, true);
    else if (event.type === 'heal') pushMessage(state, `+${event.amount} health`, true);
    else if (event.type === 'thugDown') pushMessage(state, `Thug down — +$${event.amount}`, true);
    else if (event.type === 'pedDown') {
      addWanted(state, 1);
      pushMessage(state, 'Pedestrian down — wanted level up', false);
    } else if (event.type === 'wanted') {
      if (event.level > state.lastWanted) pushMessage(state, `Wanted level ${event.level} — the police are coming`, false);
      state.lastWanted = event.level;
    } else if (event.type === 'missionStart') pushMessage(state, `Mission: ${event.name}`, true);
    else if (event.type === 'missionStage') pushMessage(state, event.label, true);
    else if (event.type === 'missionDone') {
      pushMessage(state, `Mission complete — +$${event.amount}`, true);
      writeSave(state);
    } else if (event.type === 'missionFail') pushMessage(state, `Mission failed — ${event.why}`, false);
    else if (event.type === 'fareStage') pushMessage(state, event.label, true);
    else if (event.type === 'fareDone') pushMessage(state, `Fare paid — +$${event.amount}`, true);
    else if (event.type === 'fareFail') pushMessage(state, 'The fare gave up and walked off', false);
    else if (event.type === 'carWrecked') pushMessage(state, 'Your car is wrecked!', false);
    else if (event.type === 'wasted') {
      nextScreen = 'wasted';
      playMissionFail();
    } else if (event.type === 'busted') {
      nextScreen = 'busted';
      playBusted();
    }
  }
  return nextScreen;
}

/** One simulation step (the same step the game loop and the shots use). */
function stepWorld(state, input, dt) {
  state.time += dt;
  const player = state.player;

  // E at a mission marker starts the mission instead of entering a car.
  if ((input.actions & ACTION_INTERACT) && !player.inCar && !state.mission) {
    const start = missionStartPoint(state);
    if (start && distance(player.x, player.y, start.x, start.y) < 90) {
      if (tryStartMission(state)) input.actions &= ~ACTION_INTERACT;
    }
  }

  const playerEvents = updatePlayer(state, input, dt, state.camera);
  if (playerEvents.stole) addWanted(state, 1);
  if (playerEvents.entered) pushMessage(state, 'You are driving', true);
  if (playerEvents.horn) playHorn();

  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updatePickups(state, dt);
  updateCombat(state, input, dt, state.camera);
  updatePolice(state, dt);
  updateMission(state, dt);
  updateFare(state, dt);

  // Message lifetimes.
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    state.messages[i].life -= dt;
    if (state.messages[i].life <= 0) state.messages.splice(i, 1);
  }

  state.district = playerDistrict(state);
  state.prompt = computePrompt(state, input);

  // Ambience: the engine follows speed, the siren wails when police are near.
  const policeNear = state.cars.some((car) => car.kind === 'police' && distance(car.x, car.y, player.x, player.y) < 700);
  const speedRatio = player.inCar ? Math.abs(player.inCar.speed) / 560 : 0;
  updateAmbience(!!player.inCar, speedRatio, policeNear);
}

function respawn(state) {
  const garage = state.city.landmarks.garage;
  state.player.x = garage.x + garage.w / 2;
  state.player.y = garage.y + garage.h / 2;
  state.player.angle = -Math.PI / 2;
  state.player.health = 100;
  state.player.inCar = null;
  state.player.invulnerable = 2;
  state.thugs.length = 0;
  state.bullets.length = 0;
  state.mission = null;
  clearWanted(state);
  state.messages.length = 0;
  pushMessage(state, 'Back on the streets', true);
}

function runShot(name) {
  const state = createState(Number.isInteger(seedParam) ? seedParam : 1);
  const scene = setupShot(name, state);
  // The camera needs the canvas before the first step (aiming uses it).
  canvas.width = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  const fake = { keys: new Set(), mouseX: 640, mouseY: 360, mouseDown: false, clicked: false, actions: 0 };
  status.textContent = '';
  status.style.display = 'none';
  const steps = Math.round(scene.seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const drive = scene.driver();
    fake.keys = drive.keys;
    fake.mouseX = drive.mouseX;
    fake.mouseY = drive.mouseY;
    fake.mouseDown = drive.mouseDown;
    fake.actions = 0;
    stepWorld(state, fake, STEP);
    handleEvents(state, scene.screen);
  }
  let painted = 0;
  function paint() {
    drawGame(ctx, canvas, state, scene.screen);
    drawScreen(ctx, state, scene.screen, { hasSave: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let state = createState(seed);
  const saved = readSave();
  let screen = 'title';
  let returnScreen = 'title';
  let best = 0;
  try {
    best = Number.parseInt(window.localStorage.getItem('solmar-city.best') ?? '0', 10) || 0;
  } catch {
    best = 0;
  }

  function announce(message) {
    status.textContent = message;
  }

  function startGame(useSave) {
    if (useSave && saved) {
      state.player.cash = saved.cash;
      state.player.health = saved.health;
      state.missionsDone = [...saved.missionsDone];
      if (saved.x !== null && saved.y !== null) {
        state.player.x = saved.x;
        state.player.y = saved.y;
      }
      pushMessage(state, 'Save loaded — welcome back', true);
    }
    screen = 'play';
    announce('Playing. Find Lena Torres at the gold marker.');
  }

  function endToTitle() {
    state = createState(seed);
    screen = 'title';
  }

  let accumulator = 0;
  let last = performance.now();
  const ctx = canvas.getContext('2d');

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    unlockAudio();

    const actions = input.actions;
    if (actions & ACTION_MUTE) {
      toggleMute();
      pushMessage(state, isMuted() ? 'Sound off' : 'Sound on', true);
    }

    if (screen === 'title') {
      // The city lives behind the title: traffic and pedestrians move.
      while (accumulator >= STEP) {
        state.time += STEP;
        updateTraffic(state, STEP);
        updatePedestrians(state, STEP);
        accumulator -= STEP;
      }
      if (input.keys.has('KeyN')) {
        clearSave();
        startGame(false);
      } else if ((actions & ACTION_CONFIRM) || takeClick(input)) {
        startGame(!!saved);
      } else if (actions & ACTION_PAUSE) {
        screen = 'help';
        returnScreen = 'title';
      }
    } else if (screen === 'play') {
      if (actions & ACTION_PAUSE) {
        screen = 'paused';
        announce('Paused.');
      } else if (actions & ACTION_RESTART && state.mission) {
        state.mission = null;
        pushMessage(state, 'Mission restarted — head back to the marker', false);
      } else {
        while (accumulator >= STEP) {
          stepWorld(state, input, STEP);
          screen = handleEvents(state, screen);
          accumulator -= STEP;
          if (screen !== 'play') break;
        }
      }
      if (actions & ACTION_CONFIRM && screen === 'play') {
        // Enter also confirms: nothing to do while playing.
      }
    } else if (screen === 'paused') {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
        screen = 'play';
        announce('Playing.');
      } else if (input.keys.has('KeyH')) {
        screen = 'help';
        returnScreen = 'paused';
      }
    } else if (screen === 'help') {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM || input.keys.has('KeyH')) {
        screen = returnScreen;
      }
    } else if (screen === 'wasted' || screen === 'busted') {
      if (actions & ACTION_CONFIRM) {
        respawn(state);
        screen = 'play';
        announce('Playing.');
      }
    }

    // H opens help from play as well.
    if (screen === 'play' && input.keys.has('KeyH') && !(actions & ACTION_PAUSE)) {
      screen = 'help';
      returnScreen = 'play';
    }

    input.actions = 0;
    drawGame(ctx, canvas, state, screen);
    drawScreen(ctx, state, screen, { hasSave: !!saved });
  }

  // Fit the canvas to the window; the renderer scales the 1280x720 view to it.
  function fit() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', fit);
  fit();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Solmar City. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
