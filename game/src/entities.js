// The things that move: the player (on foot or in a car), the traffic, the
// pedestrians, the parked cars you can steal, and the pickups. Each spawner
// builds its set from the city and a seed; the updaters move them one step.

import { CAR, FARE, PICKUPS, PLAYER, ROAD, TRAFFIC, PEDS, WORLD } from './config.js';
import { blockedAt, districtAt, nearestRoadLine, randomRoadPoint, resolveCollision } from './city.js';
import { clamp, distance, wrapAngle } from './random.js';
import { moveVector, isRunning, isBraking } from './input.js';

const CAR_COLORS = ['#e5534b', '#4fc3f7', '#f2c94c', '#7ee787', '#e8e8e8', '#f28c28', '#9b7ede', '#5ad1c8', '#c0c8d0', '#ff7a9e'];
const PED_COLORS = ['#e8b48a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#6b4a2f'];
const SHIRT_COLORS = ['#d84a4a', '#4a7dd8', '#57a857', '#d8c94a', '#8a5fc0', '#e8e8e8', '#3a3a3a'];

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    cash: 0,
    inCar: null,
    fireCooldown: 0,
    invulnerable: 0,
    walking: false,
  };
}

function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle,
    speed: 0,
    color,
    kind,
    health: CAR.health,
    axis: 'v', at: x, dir: 1, lane: ROAD.lane,
    turnCooldown: 0,
    wobble: 0,
  };
}

export function spawnTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const point = randomRoadPoint(rng, city);
    const angle = point.axis === 'v' ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const car = makeCar(point.x, point.y, angle, rng.pick(CAR_COLORS), 'traffic');
    car.axis = point.axis;
    car.at = point.at;
    car.dir = angle === 0 || angle === Math.PI / 2 ? 1 : -1;
    car.lane = point.axis === 'v' ? point.x - point.at : point.y - point.at;
    car.speed = TRAFFIC.cruise + rng.range(-TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter);
    car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}

export function spawnPedestrians(rng, city) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const x = rng.range(120, WORLD.width - 220);
    const y = rng.range(120, WORLD.height - 120);
    if (blockedAt(city, x, y, 12)) continue;
    peds.push({
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: PEDS.walk * rng.range(0.7, 1.3),
      state: 'walk',
      tx: x, ty: y,
      shirt: rng.pick(SHIRT_COLORS),
      skin: rng.pick(PED_COLORS),
      fleeX: 0, fleeY: 0,
    });
  }
  return peds;
}

export function spawnParkedCars(rng, city) {
  const cars = [];
  let tries = 0;
  while (cars.length < 10 && tries < 200) {
    tries += 1;
    const road = rng.pick(city.roads);
    const along = rng.range(120, (road.axis === 'v' ? WORLD.height : WORLD.width) - 120);
    const side = rng.chance(0.5) ? 1 : -1;
    const offset = ROAD.width / 2 + 34;
    const x = road.axis === 'v' ? road.at + side * offset : along;
    const y = road.axis === 'v' ? along : road.at + side * offset;
    if (blockedAt(city, x, y, 30)) continue;
    if (cars.some((c) => distance(c.x, c.y, x, y) < 120)) continue;
    const angle = road.axis === 'v' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    cars.push(makeCar(x, y, angle, rng.pick(CAR_COLORS), 'parked'));
  }
  return cars;
}

export function spawnPickups(rng, city) {
  const pickups = [];
  function place(kind) {
    for (let tries = 0; tries < 60; tries += 1) {
      const x = rng.range(140, WORLD.width - 240);
      const y = rng.range(140, WORLD.height - 140);
      if (blockedAt(city, x, y, 16)) continue;
      if (pickups.some((p) => distance(p.x, p.y, x, y) < 140)) continue;
      pickups.push({ x, y, kind, taken: false, respawn: 0 });
      return;
    }
  }
  for (let i = 0; i < PICKUPS.cash; i += 1) place('cash');
  for (let i = 0; i < PICKUPS.health; i += 1) place('health');
  return pickups;
}

/** The nearest car of the given kinds within maxDist of a point (or null). */
export function nearestCar(state, x, y, maxDist, kinds) {
  let best = null;
  let bestDist = maxDist;
  for (const car of state.cars) {
    if (!kinds.includes(car.kind)) continue;
    const d = distance(x, y, car.x, car.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

/**
 * Move the player one step. Returns events the caller handles: { stole, entered,
 * exited, horn } — the caller applies wanted level and sounds for them.
 * On foot the player walks/runs and aims at the mouse; in a car the car drives.
 */
export function updatePlayer(state, input, dt, camera) {
  const player = state.player;
  const events = { stole: false, entered: false, exited: false, horn: false };
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);

  if (player.inCar) {
    const car = player.inCar;
    const move = moveVector(input);
    // Forward is the car's nose: W/up accelerates, S/down brakes/reverses.
    const forward = move.y !== 0 ? -move.y : 0;
    const steer = move.x;
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverse) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * dt);
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    if (isBraking(input)) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
    const turnRate = CAR.turn * clamp(Math.abs(car.speed) / 220, 0, 1) * Math.sign(car.speed || 1);
    car.angle += steer * turnRate * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const prevX = car.x;
    const prevY = car.y;
    car.x = nx;
    car.y = ny;
    resolveCollision(state.city, car, CAR.length / 2 - 2, prevX, prevY);
    // A hard hit into a wall costs speed (and a little health at speed).
    if (car.x !== nx || car.y !== ny) {
      if (Math.abs(car.speed) > 300) car.health -= 6;
      car.speed *= 0.4;
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (input.actions & 4) {
      // E: get out of the car. It stays yours: getting back in is not a theft.
      player.inCar = null;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      car.kind = 'parked';
      car.owned = true;
      car.speed = 0;
      events.exited = true;
    }
    if (input.actions & 8) events.horn = true;
    return events;
  }

  // On foot.
  const move = moveVector(input);
  const speed = isRunning(input) ? PLAYER.run : PLAYER.walk;
  player.walking = move.x !== 0 || move.y !== 0;
  if (player.walking) {
    const nx = player.x + move.x * speed * dt;
    const ny = player.y + move.y * speed * dt;
    const prevX = player.x;
    const prevY = player.y;
    player.x = nx;
    player.y = ny;
    resolveCollision(state.city, player, PLAYER.radius, prevX, prevY);
    player.angle = Math.atan2(move.y, move.x);
  }
  // Aim at the mouse (in world space) when the mouse has moved over the canvas.
  if (camera) {
    const wx = camera.x + input.mouseX / camera.scale;
    const wy = camera.y + input.mouseY / camera.scale;
    if (distance(player.x, player.y, wx, wy) > 30) {
      player.angle = Math.atan2(wy - player.y, wx - player.x);
    }
  }
  if (input.actions & 4) {
    const car = nearestCar(state, player.x, player.y, 80, ['parked', 'traffic']);
    if (car) {
      car.kind = 'player';
      car.health = Math.max(car.health, 60);
      player.inCar = car;
      player.x = car.x;
      player.y = car.y;
      events.entered = true;
      // Taking a car that is not yours is a crime; your own parked car is not.
      if (!car.owned) events.stole = true;
    }
  }
  return events;
}

/** Drive the traffic one step: along their road, turning at intersections, slowing for the car ahead. */
export function updateTraffic(state, dt) {
  const all = state.cars;
  for (const car of all) {
    if (car.kind !== 'traffic') continue;
    car.turnCooldown = Math.max(0, car.turnCooldown - dt);
    // Look ahead for a car in front; slow down instead of rear-ending it.
    let ahead = null;
    let aheadDist = 120;
    for (const other of all) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = car.axis === 'v' ? dy * car.dir : dx * car.dir;
      const across = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
      if (along > 0 && along < aheadDist && across < 40) {
        aheadDist = along;
        ahead = other;
      }
    }
    const target = ahead ? Math.max(0, car.cruise * 0.25) : car.cruise;
    car.speed += clamp(target - car.speed, -300 * dt, 200 * dt);
    const step = car.speed * car.dir * dt;
    if (car.axis === 'v') car.y += step;
    else car.x += step;

    // At an intersection, sometimes turn onto the crossing road.
    if (car.turnCooldown <= 0) {
      const lines = car.axis === 'v' ? state.city.roads.filter((r) => r.axis === 'h') : state.city.roads.filter((r) => r.axis === 'v');
      const pos = car.axis === 'v' ? car.y : car.x;
      for (const line of lines) {
        const before = pos - step;
        if ((before < line.at && pos >= line.at) || (before > line.at && pos <= line.at)) {
          if (state.rng.next() < 0.3) {
            car.axis = car.axis === 'v' ? 'h' : 'v';
            car.at = line.at;
            car.dir = state.rng.next() < 0.5 ? 1 : -1;
            car.lane = state.rng.next() < 0.5 ? -ROAD.lane : ROAD.lane;
            car.turnCooldown = 2;
          }
          break;
        }
      }
    }
    // Keep on the road line and inside the world; wrap at the ends.
    if (car.axis === 'v') {
      car.x = car.at + car.lane;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y < 30) { car.y = 30; car.dir = 1; }
      if (car.y > WORLD.height - 30) { car.y = WORLD.height - 30; car.dir = -1; }
    } else {
      car.y = car.at + car.lane;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x < 30) { car.x = 30; car.dir = 1; }
      if (car.x > WORLD.width - 30) { car.x = WORLD.width - 30; car.dir = -1; }
    }
  }
}

/** Walk the pedestrians; gunfire (state.fleeFrom) makes them run away from it. */
export function updatePedestrians(state, dt) {
  for (const ped of state.peds) {
    let speed = ped.speed;
    let tx = ped.tx;
    let ty = ped.ty;
    if (state.fleeFrom && distance(ped.x, ped.y, state.fleeFrom.x, state.fleeFrom.y) < 320) {
      ped.state = 'flee';
      const away = Math.atan2(ped.y - state.fleeFrom.y, ped.x - state.fleeFrom.x);
      tx = ped.x + Math.cos(away) * 200;
      ty = ped.y + Math.sin(away) * 200;
      speed = PEDS.flee;
    } else if (ped.state === 'flee') {
      ped.state = 'walk';
      tx = ped.x + (state.rng.next() - 0.5) * 200;
      ty = ped.y + (state.rng.next() - 0.5) * 200;
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 12) {
      ped.tx = ped.x + (state.rng.next() - 0.5) * 320;
      ped.ty = ped.y + (state.rng.next() - 0.5) * 320;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + (dx / dist) * speed * dt;
    const ny = ped.y + (dy / dist) * speed * dt;
    ped.x = nx;
    ped.y = ny;
    if (blockedAt(state.city, ped.x, ped.y, 10)) {
      ped.x -= (dx / dist) * speed * dt;
      ped.y -= (dy / dist) * speed * dt;
      ped.tx = ped.x + (state.rng.next() - 0.5) * 320;
      ped.ty = ped.y + (state.rng.next() - 0.5) * 320;
    }
    ped.x = clamp(ped.x, 10, WORLD.width - 10);
    ped.y = clamp(ped.y, 10, WORLD.height - 10);
  }
}

/** Pickups: collect them, and respawn cash somewhere new after a while. */
export function updatePickups(state, dt) {
  const player = state.player;
  for (const pickup of state.pickups) {
    if (pickup.taken) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0 && pickup.kind === 'cash') {
        // Cash comes back somewhere new; health packs stay taken.
        let x = 0;
        let y = 0;
        for (let tries = 0; tries < 40; tries += 1) {
          x = 140 + state.rng.next() * (WORLD.width - 380);
          y = 140 + state.rng.next() * (WORLD.height - 280);
          if (!blockedAt(state.city, x, y, 16)) break;
        }
        pickup.x = x;
        pickup.y = y;
        pickup.taken = false;
      }
      continue;
    }
    if (distance(player.x, player.y, pickup.x, pickup.y) < 34) {
      pickup.taken = true;
      pickup.respawn = 45;
      if (pickup.kind === 'cash') {
        player.cash += PICKUPS.cashValue;
        state.events.push({ type: 'cash', amount: PICKUPS.cashValue });
      } else {
        player.health = Math.min(PLAYER.health, player.health + PICKUPS.heal);
        state.events.push({ type: 'heal', amount: PICKUPS.heal });
      }
    }
  }
}

/** The district the player is standing in, for the HUD. */
export function playerDistrict(state) {
  return districtAt(state.city, state.player.x, state.player.y);
}
