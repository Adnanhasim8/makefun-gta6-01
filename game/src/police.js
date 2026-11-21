// The law: the wanted level (0-5 stars), the police cars and foot officers
// it brings out, the chase and the ram, and the bust. Wanted decays only
// when no officer can see the player.

import { CAR, POLICE, WORLD } from './config.js';
import { resolveCollision } from './city.js';
import { clamp, distance, wrapAngle } from './random.js';

function makePoliceCar(x, y, angle) {
  return {
    x, y, angle,
    speed: 0,
    color: '#2f6fd8',
    kind: 'police',
    health: 200,
    axis: 'v', at: x, dir: 1, lane: 0,
    turnCooldown: 0,
    cruise: POLICE.carSpeed,
  };
}

export function addWanted(state, amount) {
  if (amount <= 0) return;
  state.wanted = clamp(state.wanted + amount, 0, 5);
  state.wantedTimer = 0;
  state.events.push({ type: 'wanted', level: state.wanted });
}

function spawnPosition(state) {
  // A point on a road near the player but not on top of them.
  const player = state.player;
  const angle = state.rng.next() * Math.PI * 2;
  const dist = 520 + state.rng.next() * 220;
  let x = player.x + Math.cos(angle) * dist;
  let y = player.y + Math.sin(angle) * dist;
  x = clamp(x, 60, WORLD.width - 60);
  y = clamp(y, 60, WORLD.height - 60);
  return { x, y };
}

function policeCars(state) {
  return state.cars.filter((car) => car.kind === 'police');
}

function ensureForce(state) {
  const wantCars = POLICE.cars[state.wanted];
  const wantOfficers = POLICE.officers[state.wanted];
  const cars = policeCars(state);
  while (cars.length < wantCars) {
    const pos = spawnPosition(state);
    const car = makePoliceCar(pos.x, pos.y, state.rng.next() * Math.PI * 2);
    state.cars.push(car);
    cars.push(car);
  }
  while (cars.length > wantCars) {
    // Send the furthest car home.
    let far = 0;
    let farDist = -1;
    for (let i = 0; i < cars.length; i += 1) {
      const d = distance(cars[i].x, cars[i].y, state.player.x, state.player.y);
      if (d > farDist) { farDist = d; far = i; }
    }
    const gone = cars.splice(far, 1)[0];
    const index = state.cars.indexOf(gone);
    if (index !== -1) state.cars.splice(index, 1);
  }
  while (state.officers.length < wantOfficers) {
    const pos = spawnPosition(state);
    state.officers.push({ x: pos.x, y: pos.y, angle: 0, bustTimer: 0 });
  }
  while (state.officers.length > wantOfficers) state.officers.pop();
}

function updatePoliceCars(state, dt) {
  const player = state.player;
  for (const car of policeCars(state)) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const wantAngle = Math.atan2(dy, dx);
    const turn = wrapAngle(wantAngle - car.angle);
    car.angle += clamp(turn, -2.8 * dt, 2.8 * dt);
    car.speed = Math.min(POLICE.carSpeed, car.speed + 700 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const prevX = car.x;
    const prevY = car.y;
    car.x = nx;
    car.y = ny;
    resolveCollision(state.city, car, CAR.length / 2 - 2, prevX, prevY);
    if (car.x !== nx || car.y !== ny) car.speed *= 0.5;

    // Ram the player's car: shove it and wear it down. The shove respects
    // buildings too, so a ram never pushes the player through a wall.
    if (player.inCar && dist < 70) {
      const push = 260 * dt;
      const prevX = player.inCar.x;
      const prevY = player.inCar.y;
      player.inCar.x += Math.cos(car.angle) * push;
      player.inCar.y += Math.sin(car.angle) * push;
      resolveCollision(state.city, player.inCar, CAR.length / 2 - 2, prevX, prevY);
      player.x = player.inCar.x;
      player.y = player.inCar.y;
      player.inCar.health -= 14 * dt;
      car.speed *= 0.6;
      if (player.inCar.health <= 0) {
        player.inCar.health = 0;
        player.inCar.speed = 0;
        player.inCar.kind = 'parked';
        player.inCar = null;
        player.x = player.x + 40;
        player.y = player.y + 40;
        state.events.push({ type: 'carWrecked' });
      }
    }
  }
}

function updateOfficers(state, dt) {
  const player = state.player;
  for (const officer of state.officers) {
    const dist = distance(officer.x, officer.y, player.x, player.y);
    officer.angle = Math.atan2(player.y - officer.y, player.x - officer.x);
    const prevX = officer.x;
    const prevY = officer.y;
    if (player.inCar) {
      // On foot they cannot catch a car: they run after it anyway.
      officer.x += Math.cos(officer.angle) * POLICE.officerSpeed * dt;
      officer.y += Math.sin(officer.angle) * POLICE.officerSpeed * dt;
      officer.bustTimer = 0;
    } else if (dist > 26) {
      officer.x += Math.cos(officer.angle) * POLICE.officerSpeed * dt;
      officer.y += Math.sin(officer.angle) * POLICE.officerSpeed * dt;
      officer.bustTimer = 0;
    } else {
      // Close enough to make the arrest: hold still and the bust timer runs.
      officer.bustTimer += dt;
      if (officer.bustTimer >= POLICE.bustTime) {
        state.events.push({ type: 'busted' });
        officer.bustTimer = 0;
      }
    }
    resolveCollision(state.city, officer, 12, prevX, prevY);
  }
}

/** One police step: keep the force at the wanted level, chase, and decay. */
export function updatePolice(state, dt) {
  ensureForce(state);
  updatePoliceCars(state, dt);
  updateOfficers(state, dt);

  // Wanted decays only while nobody can see the player.
  let seen = false;
  for (const car of policeCars(state)) {
    if (distance(car.x, car.y, state.player.x, state.player.y) < POLICE.sight) { seen = true; break; }
  }
  if (!seen) {
    for (const officer of state.officers) {
      if (distance(officer.x, officer.y, state.player.x, state.player.y) < POLICE.sight) { seen = true; break; }
    }
  }
  if (state.wanted > 0) {
    if (seen) state.wantedTimer = 0;
    else {
      state.wantedTimer += dt;
      if (state.wantedTimer >= POLICE.decaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        state.events.push({ type: 'wanted', level: state.wanted });
      }
    }
  }
}

/** Clear the wanted level (a mission start, a new game). */
export function clearWanted(state) {
  state.wanted = 0;
  state.wantedTimer = 0;
  state.cars = state.cars.filter((car) => car.kind !== 'police');
  state.officers.length = 0;
}
