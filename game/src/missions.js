// missions.js — the story of Sunset Bay, in three jobs for Mara Quinn,
// plus taxi fares on the side. Each mission is a chain of objectives with
// a map marker, a timer where the job demands one, and a cash reward.

import { dist } from './rng.js';

export const MISSION_DEFS = [
  {
    id: 'wheels',
    title: 'Job 1 — Borrowed Wheels',
    brief: 'Mara needs wheels. Steal any car and bring it to her garage.',
    steps: [
      { kind: 'stealCar', text: 'Steal a car (walk up and press E)' },
      { kind: 'goto', target: 'garage', text: "Drive to Mara's Garage" },
    ],
    reward: 300,
  },
  {
    id: 'package',
    title: 'Job 2 — The Package',
    brief: 'A package is waiting at the docks. Grab it and deliver it to the Palms Hotel in 90 seconds — the cops will notice.',
    steps: [
      { kind: 'goto', target: 'docks', text: 'Go to the docks and pick up the package' },
      { kind: 'goto', target: 'hotel', text: 'Deliver the package to the Palms Hotel', timed: 90 },
    ],
    reward: 800,
  },
  {
    id: 'score',
    title: 'Job 3 — The Big Score',
    brief: 'Bay Federal Bank. Walk in, hold the lobby for 5 seconds, then lose the cops and reach the safehouse. The whole city will be after you.',
    steps: [
      { kind: 'goto', target: 'bank', text: 'Reach Bay Federal Bank' },
      { kind: 'hold', target: 'bank', seconds: 5, text: 'Hold the lobby (stay in the marker)' },
      { kind: 'goto', target: 'safehouse', text: 'Escape to the Safehouse', wanted: 4 },
    ],
    reward: 2000,
  },
];

export function createMissions() {
  return {
    current: 0, // index into MISSION_DEFS
    step: 0,
    done: [],
    holdTimer: 0,
    missionTimer: 0,
    active: true,
    taxi: null, // { pickup, dropoff, fare, state }
    taxiCooldown: 8,
    allDone: false,
  };
}

/** The world position of a mission target. */
export function targetPos(city, target) {
  if (target === 'garage') return city.garage;
  if (target === 'bank') return city.bank;
  if (target === 'hotel') return city.hotel;
  if (target === 'safehouse') return city.safehouse;
  if (target === 'hospital') return city.hospital;
  if (target === 'docks') return city.docks;
  return city.garage;
}

/** Current objective text for the HUD, or null when the story is done. */
export function currentObjective(game) {
  const m = game.missions;
  if (!m.active || m.current >= MISSION_DEFS.length) return null;
  const def = MISSION_DEFS[m.current];
  const step = def.steps[m.step];
  if (!step) return null;
  return { mission: def.title, brief: def.brief, step: step.text, reward: def.reward };
}

/** The current marker position for the HUD and minimap, or null. */
export function currentMarker(game) {
  const m = game.missions;
  if (m.taxi && m.taxi.state === 'pickup') return m.taxi.pickup;
  if (m.taxi && m.taxi.state === 'drive') return m.taxi.dropoff;
  if (!m.active || m.current >= MISSION_DEFS.length) return null;
  const def = MISSION_DEFS[m.current];
  const step = def.steps[m.step];
  if (!step || !step.target) return null;
  return targetPos(game.city, step.target);
}

function completeMission(game) {
  const m = game.missions;
  const def = MISSION_DEFS[m.current];
  game.player.money += def.reward;
  game.stats.missionsDone += 1;
  m.done.push(def.id);
  game.addMessage(`${def.title} complete! +$${def.reward}`);
  game.audio.missionDone();
  game.spawnParticles(game.player.x, game.player.y, '#e8b93a', 24);
  m.current += 1;
  m.step = 0;
  m.holdTimer = 0;
  m.missionTimer = 0;
  if (m.current >= MISSION_DEFS.length) {
    m.active = false;
    m.allDone = true;
    game.addMessage('All jobs done — Sunset Bay is yours, Rico. Free roam!');
  }
}

function advanceStep(game) {
  const m = game.missions;
  const def = MISSION_DEFS[m.current];
  m.step += 1;
  m.holdTimer = 0;
  if (m.step >= def.steps.length) {
    completeMission(game);
    return;
  }
  const next = def.steps[m.step];
  if (next.timed) m.missionTimer = next.timed;
  if (next.wanted) {
    game.player.heat = Math.max(game.player.heat, 72);
    game.addMessage('WANTED LEVEL 4 — lose the cops and reach the safehouse!');
  }
  game.addMessage(next.text);
  game.audio.pickup();
}

/** Start a taxi fare when the player is driving a taxi. */
function maybeStartTaxi(game, dt) {
  const m = game.missions;
  const p = game.player;
  if (m.taxi) return;
  m.taxiCooldown -= dt;
  if (m.taxiCooldown > 0) return;
  if (!p.car || p.car.type !== 'taxi') return;
  // A fare appears: pick up a passenger nearby, drop them across town.
  const a = game.rng.range(0, Math.PI * 2);
  const pickup = {
    x: Math.max(80, Math.min(3120, p.x + Math.cos(a) * game.rng.range(200, 420))),
    y: Math.max(80, Math.min(3120, p.y + Math.sin(a) * game.rng.range(200, 420))),
  };
  const b = game.rng.range(0, Math.PI * 2);
  const dropoff = {
    x: Math.max(80, Math.min(3120, pickup.x + Math.cos(b) * game.rng.range(500, 1100))),
    y: Math.max(80, Math.min(3120, pickup.y + Math.sin(b) * game.rng.range(500, 1100))),
  };
  const fare = 120 + Math.round(dist(pickup.x, pickup.y, dropoff.x, dropoff.y) / 10);
  m.taxi = { pickup, dropoff, fare, state: 'pickup', timer: 120 };
  game.addMessage(`Taxi fare: pick up the passenger ($${fare})`);
}

export function updateMissions(game, dt) {
  const m = game.missions;
  const p = game.player;
  if (!p.alive) return;

  // --- Taxi side job ---
  maybeStartTaxi(game, dt);
  if (m.taxi) {
    const t = m.taxi;
    t.timer -= dt;
    if (t.timer <= 0) {
      game.addMessage('Fare cancelled — the passenger gave up waiting.');
      m.taxi = null;
      m.taxiCooldown = 10;
    } else if (t.state === 'pickup' && p.car && dist(p.x, p.y, t.pickup.x, t.pickup.y) < 60) {
      t.state = 'drive';
      game.addMessage('Passenger aboard! Drive to the destination.');
      game.audio.pickup();
    } else if (t.state === 'drive' && p.car && dist(p.x, p.y, t.dropoff.x, t.dropoff.y) < 60) {
      p.money += t.fare;
      game.stats.taxiFares += 1;
      game.addMessage(`Fare complete! +$${t.fare}`);
      game.audio.missionDone();
      game.spawnParticles(p.x, p.y, '#e8b93a', 14);
      m.taxi = null;
      m.taxiCooldown = 12;
    }
  }

  // --- Story missions ---
  if (!m.active || m.current >= MISSION_DEFS.length) return;
  const def = MISSION_DEFS[m.current];
  const step = def.steps[m.step];
  if (!step) return;

  if (step.kind === 'stealCar') {
    if (!p.onFoot) advanceStep(game);
    return;
  }
  if (step.kind === 'goto') {
    if (step.timed) {
      m.missionTimer -= dt;
      if (m.missionTimer <= 0) {
        game.addMessage('Too slow — the job fell through. Try again.');
        game.audio.missionFail();
        m.step = 0;
        m.missionTimer = 0;
        return;
      }
    }
    const target = targetPos(game.city, step.target);
    if (dist(p.x, p.y, target.x, target.y) < 90) {
      advanceStep(game);
    }
    return;
  }
  if (step.kind === 'hold') {
    const target = targetPos(game.city, step.target);
    if (dist(p.x, p.y, target.x, target.y) < 110) {
      m.holdTimer += dt;
      if (m.holdTimer >= step.seconds) advanceStep(game);
    } else {
      m.holdTimer = Math.max(0, m.holdTimer - dt * 2);
    }
  }
}
