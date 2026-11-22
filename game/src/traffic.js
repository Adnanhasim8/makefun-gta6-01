// traffic.js — the city's living background: traffic cars that follow the
// road grid and pedestrians who walk the sidewalks and flee from danger.

import { makeRng, clamp, angleDiff, dist } from './rng.js';
import { ROAD_STEP, WORLD, randomRoadPoint, insideBuilding, ROAD_HALF } from './city.js';
import { createCar, CAR_TYPES } from './player.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'truck', 'sports'];

/** Spawn the traffic fleet and the pedestrian crowd. */
export function createTraffic(city, seed) {
  const rng = makeRng(seed + 101);
  const cars = [];
  const peds = [];
  for (let i = 0; i < 22; i++) {
    const pt = randomRoadPoint(city, rng);
    const vertical = rng.chance(0.5);
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const car = createCar(pt.x, pt.y, angle, rng.pick(TRAFFIC_TYPES), 'traffic');
    car.speed = rng.range(120, 220);
    car.cruise = car.speed;
    car.lane = rng.chance(0.5) ? -12 : 12;
    car.color = rng.pick(['#c94f42', '#2f7fb8', '#e8e4da', '#7a7d84', '#7fb069', '#d97b29', '#5b4a8a', '#3a3f47']);
    cars.push(car);
  }
  const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
  for (let i = 0; i < 42; i++) {
    const pt = randomRoadPoint(city, rng);
    // Pedestrians walk the sidewalks, not the middle of the road: push
    // them off the asphalt, perpendicular to the road they are on.
    const nearVerticalRoad = Math.abs(pt.x - Math.round(pt.x / ROAD_STEP) * ROAD_STEP) < 20;
    const side = rng.chance(0.5) ? 1 : -1;
    const px = nearVerticalRoad ? pt.x + side * (ROAD_HALF + 10) : pt.x + rng.range(-30, 30);
    const py = nearVerticalRoad ? pt.y + rng.range(-30, 30) : pt.y + side * (ROAD_HALF + 10);
    peds.push({
      x: px,
      y: py,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 52),
      color: rng.pick(PED_COLORS),
      skin: rng.pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
      down: false,
      downTimer: 0,
      fleeing: false,
      walkPhase: rng.range(0, Math.PI * 2),
      retarget: 0,
    });
  }
  return { cars, peds };
}

/** Drive one traffic car along the road grid, turning at intersections. */
function updateTrafficCar(game, car, dt) {
  const player = game.player;
  const px = car.x;
  const py = car.y;
  // Slow down for the car ahead on the same road.
  let targetSpeed = car.cruise;
  for (const other of game.cars) {
    if (other === car || other.driver === 'wreck') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 90 && side < 26) {
      targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 20));
    }
  }
  // Panic-brake for the player stepping into the road.
  if (player.onFoot && dist(car.x, car.y, player.x, player.y) < 70) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    if (ahead > 0 && ahead < 70) targetSpeed = 0;
  }
  car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);

  // At an intersection, sometimes turn onto the cross road.
  const nearX = Math.abs(((car.x % ROAD_STEP) + ROAD_STEP) % ROAD_STEP) < 26
    || Math.abs(((car.x % ROAD_STEP) + ROAD_STEP) % ROAD_STEP - ROAD_STEP) < 26;
  const nearY = Math.abs(((car.y % ROAD_STEP) + ROAD_STEP) % ROAD_STEP) < 26
    || Math.abs(((car.y % ROAD_STEP) + ROAD_STEP) % ROAD_STEP - ROAD_STEP) < 26;
  if (nearX && nearY && Math.abs(car.speed) > 40) {
    car.turnCooldown = Math.max(0, (car.turnCooldown || 0) - dt);
    if ((car.turnCooldown || 0) <= 0 && game.rng.chance(0.35)) {
      const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      const current = Math.round(car.angle / (Math.PI / 2)) % 4;
      const choices = dirs.filter((d, i) => i !== (current + 2) % 4);
      car.angle = choices[Math.floor(game.rng.next() * choices.length)];
      car.turnCooldown = 2.5;
      // Snap onto the lane of the new road.
      if (Math.abs(Math.sin(car.angle)) < 0.5) {
        car.y = Math.round(car.y / ROAD_STEP) * ROAD_STEP + car.lane;
      } else {
        car.x = Math.round(car.x / ROAD_STEP) * ROAD_STEP + car.lane;
      }
    }
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Wrap around the world edge instead of driving off the map.
  if (car.x < 30) { car.x = 30; car.angle = 0; }
  if (car.x > WORLD - 30) { car.x = WORLD - 30; car.angle = Math.PI; }
  if (car.y < 30) { car.y = 30; car.angle = Math.PI / 2; }
  if (car.y > WORLD - 60) { car.y = WORLD - 60; car.angle = -Math.PI / 2; }
}

/** One pedestrian: stroll the sidewalks, flee gunfire and speeding cars. */
function updatePed(game, ped, dt) {
  const player = game.player;
  if (ped.down) {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      ped.down = false;
      ped.fleeing = true;
    }
    return;
  }
  const danger =
    dist(ped.x, ped.y, player.x, player.y) < (player.onFoot ? 90 : 150) ||
    game.combat.bullets.some((b) => dist(ped.x, ped.y, b.x, b.y) < 120);
  ped.fleeing = danger;
  const speed = ped.fleeing ? ped.speed * 2.6 : ped.speed;
  ped.retarget -= dt;
  if (ped.retarget <= 0) {
    ped.retarget = game.rng.range(2, 5);
    if (ped.fleeing) {
      ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x) + game.rng.range(-0.6, 0.6);
    } else if (game.rng.chance(0.4)) {
      ped.angle += game.rng.pick([-Math.PI / 2, Math.PI / 2, Math.PI]);
    }
  }
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.walkPhase += dt * speed * 0.09;
  // Keep pedestrians on the map and out of buildings.
  if (ped.x < 30 || ped.x > WORLD - 30 || ped.y < 30 || ped.y > WORLD - 30 || insideBuilding(game.city, ped.x, ped.y)) {
    ped.x = clamp(ped.x, 30, WORLD - 30);
    ped.y = clamp(ped.y, 30, WORLD - 30);
    if (insideBuilding(game.city, ped.x, ped.y)) {
      ped.angle += Math.PI;
      ped.x += Math.cos(ped.angle) * 20;
      ped.y += Math.sin(ped.angle) * 20;
    }
  }
}

export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.driver === 'traffic') updateTrafficCar(game, car, dt);
  }
  for (const ped of game.peds) updatePed(game, ped, dt);
}

/** Parked cars the player can steal, placed near landmarks and on side streets. */
export function createParkedCars(city, seed) {
  const rng = makeRng(seed + 202);
  const spots = [
    { x: city.garage.x - 190, y: city.garage.y, angle: 0 },
    { x: city.garage.x + 190, y: city.garage.y + 40, angle: Math.PI },
    { x: city.bank.x - 200, y: city.bank.y - 60, angle: Math.PI / 2 },
    { x: city.hotel.x + 200, y: city.hotel.y, angle: -Math.PI / 2 },
    { x: city.safehouse.x - 180, y: city.safehouse.y + 60, angle: 0 },
    { x: city.hospital.x + 200, y: city.hospital.y - 40, angle: Math.PI },
    { x: city.docks.x - 160, y: city.docks.y - 40, angle: 0 },
    { x: 480, y: 1600, angle: Math.PI / 2 },
    { x: 2240, y: 800, angle: 0 },
    { x: 1600, y: 2560, angle: Math.PI },
    { x: 2880, y: 1920, angle: -Math.PI / 2 },
    { x: 800, y: 2880, angle: 0 },
  ];
  const types = ['sports', 'sedan', 'coupe', 'taxi', 'sedan', 'van', 'sports', 'coupe', 'sedan', 'truck', 'sedan', 'sports'];
  return spots.map((s, i) => {
    const car = createCar(s.x, s.y, s.angle, types[i % types.length], 'parked');
    car.color = rng.pick(['#c94f42', '#2f7fb8', '#e8e4da', '#7fb069', '#d97b29', '#5b4a8a']);
    return car;
  });
}
