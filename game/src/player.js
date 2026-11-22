// player.js — Rico Vale, on foot and behind the wheel.
// On foot: WASD to run, mouse to aim, click to shoot, E to steal a car.
// Driving: W/S to accelerate and brake, A/D to steer, Space for handbrake,
// E to get out. Cars have arcade physics: speed, grip, drift and damage.

import { clamp, angleDiff, dist } from './rng.js';
import { collideCircleBuildings, WORLD, onRoad } from './city.js';

export const CAR_TYPES = {
  sedan: { w: 46, h: 22, accel: 340, top: 520, grip: 3.2, color: '#c94f42' },
  taxi: { w: 46, h: 22, accel: 320, top: 500, grip: 3.2, color: '#e8b93a' },
  sports: { w: 48, h: 21, accel: 460, top: 640, grip: 4.0, color: '#2f7fb8' },
  truck: { w: 58, h: 26, accel: 240, top: 420, grip: 2.6, color: '#7a7d84' },
  coupe: { w: 44, h: 21, accel: 400, top: 580, grip: 3.6, color: '#7fb069' },
  van: { w: 54, h: 24, accel: 260, top: 440, grip: 2.8, color: '#b08968' },
  police: { w: 48, h: 22, accel: 420, top: 600, grip: 3.8, color: '#20242c' },
};

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    speed: 0,
    health: 100,
    money: 120,
    ammo: 12,
    reserveAmmo: 48,
    reloading: 0,
    onFoot: true,
    car: null, // the car object the player is driving
    sprinting: false,
    wanted: 0,
    heat: 0, // 0..100, drives the wanted stars
    lastDamageAt: -999,
    alive: true,
    footstep: 0,
  };
}

/** A parked or traffic car the player can steal or drive. */
export function createCar(x, y, angle, type, driver) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    x, y, angle,
    speed: 0,
    type,
    spec,
    color: spec.color,
    driver: driver || 'parked', // parked | traffic | player | police
    health: 100,
    brakeLight: false,
    sirenPhase: 0,
    stuck: 0,
  };
}

/** Find the nearest drivable car within reach of the player. */
export function nearestCar(game, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (car.driver === 'police') continue;
    const d = dist(game.player.x, game.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Put the player into a car (stealing it raises heat). */
export function enterCar(game, car) {
  const p = game.player;
  if (car.driver === 'parked' || car.driver === 'traffic') {
    // Stealing a car is a crime: the heat jumps.
    p.heat = Math.min(100, p.heat + 18);
    if (car.driver === 'traffic') game.stats.carsStolen += 1;
    game.addMessage(car.driver === 'parked' ? 'Car stolen — the heat is on!' : 'Carjacked! The heat is on!');
  }
  car.driver = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
  game.audio.ensure();
}

/** Get out of the car, stepping to its side. */
export function exitCar(game) {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed *= 0.3;
  const side = p.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  const fixed = collideCircleBuildings(game.city, p.x, p.y, 14);
  p.x = fixed.x;
  p.y = fixed.y;
  p.onFoot = true;
  p.car = null;
  p.speed = 0;
}

/** On-foot movement, aiming and shooting. */
function updateOnFoot(game, dt) {
  const p = game.player;
  const input = game.input;
  const mv = input.moveVector();
  const sprint = input.held('ShiftLeft') || input.held('ShiftRight');
  p.sprinting = sprint && (mv.x !== 0 || mv.y !== 0);
  const walkSpeed = p.sprinting ? 265 : 175;
  p.x += mv.x * walkSpeed * dt;
  p.y += mv.y * walkSpeed * dt;
  if (mv.x !== 0 || mv.y !== 0) {
    p.angle = Math.atan2(mv.y, mv.x);
    p.footstep += dt * (p.sprinting ? 11 : 8);
  }
  const fixed = collideCircleBuildings(game.city, p.x, p.y, 14);
  p.x = fixed.x;
  p.y = fixed.y;

  // Aim at the mouse (screen -> world through the camera).
  const cam = game.camera;
  const wx = cam.x + (input.mouse.x - game.view.w / 2) / cam.zoom;
  const wy = cam.y + (input.mouse.y - game.view.h / 2) / cam.zoom;
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);

  // Reload.
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0 && p.reserveAmmo > 0) {
      const need = 12 - p.ammo;
      const take = Math.min(need, p.reserveAmmo);
      p.ammo += take;
      p.reserveAmmo -= take;
    }
  }
  if (input.wasPressed('KeyR') && p.ammo < 12 && p.reserveAmmo > 0 && p.reloading <= 0) {
    p.reloading = 1.1;
  }

  // Shoot: hold the mouse button, one bullet per 0.16s.
  p.shootCooldown = Math.max(0, (p.shootCooldown || 0) - dt);
  if (input.mouse.down && p.shootCooldown <= 0 && p.reloading <= 0) {
    if (p.ammo > 0) {
      p.ammo -= 1;
      p.shootCooldown = 0.16;
      game.combat.fireBullet(game, p.x, p.y, p.aimAngle, 620, 'player');
      game.audio.shot();
      p.heat = Math.min(100, p.heat + 6);
      game.stats.shotsFired += 1;
    } else if (p.reserveAmmo > 0) {
      p.reloading = 1.1;
    }
  }

  // Enter a car.
  if (input.wasPressed('KeyE')) {
    const car = nearestCar(game, 56);
    if (car) enterCar(game, car);
  }

  // Pick up cash lying on the sidewalk.
  for (const pk of game.city.pickups) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 26) {
      pk.taken = true;
      p.money += pk.amount;
      game.stats.cashFound += pk.amount;
      game.addMessage(`+$${pk.amount} found on the street`);
      game.audio.pickup();
      game.spawnParticles(pk.x, pk.y, '#e8b93a', 10);
    }
  }
}

/** Driving physics: accelerate, steer, drift, collide. */
function updateDriving(game, dt) {
  const p = game.player;
  const car = p.car;
  const input = game.input;
  const spec = car.spec;
  const forward = input.held('KeyW') || input.held('ArrowUp') || game.demoDrive;
  const back = input.held('KeyS') || input.held('ArrowDown');
  const left = input.held('KeyA') || input.held('ArrowLeft');
  const right = input.held('KeyD') || input.held('ArrowRight');
  const handbrake = input.held('Space');

  if (forward) car.speed += spec.accel * dt;
  if (back) car.speed -= (car.speed > 10 ? spec.accel * 1.2 : spec.accel * 0.55) * dt;
  if (!forward && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 520 * dt);
  car.speed = clamp(car.speed, -spec.top * 0.45, spec.top);

  const steerInput = (left ? -1 : 0) + (right ? 1 : 0);
  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1) * (handbrake ? 1.5 : 1);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steerInput * steerAuthority * (handbrake ? 2.6 : 1.9) * dir * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  const fixed = collideCircleBuildings(game.city, nx, ny, 20);
  car.x = fixed.x;
  car.y = fixed.y;
  const hitWall = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
  if (hitWall && Math.abs(car.speed) > 140) {
    game.audio.crash();
    game.spawnParticles(car.x, car.y, '#ffb347', 8);
    car.health -= 6;
  }
  if (hitWall) car.speed *= 0.55;

  // World bounds and the beach: cars cannot drive into the water.
  if (car.y > game.city.waterY - 14) {
    car.y = game.city.waterY - 14;
    car.speed *= 0.5;
  }
  car.x = clamp(car.x, 24, WORLD - 24);
  car.y = clamp(car.y, 24, WORLD - 24);

  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  car.brakeLight = back || handbrake;

  // Bumping pedestrians or traffic while speeding is a crime.
  if (Math.abs(car.speed) > 240) {
    for (const ped of game.peds) {
      if (!ped.down && dist(car.x, car.y, ped.x, ped.y) < 26) {
        ped.down = true;
        ped.downTimer = 6;
        p.heat = Math.min(100, p.heat + 22);
        game.addMessage('Pedestrian hit! Witnesses called the cops.');
        game.audio.crash();
        game.spawnParticles(ped.x, ped.y, '#e74c3c', 12);
      }
    }
  }

  // Bumping into other cars: bounce off, lose speed, take a little damage.
  for (const other of game.cars) {
    if (other === car || other.driver === 'wreck' || other.driver === 'police') continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 44 && d > 0.01) {
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x = other.x + nx * 44;
      car.y = other.y + ny * 44;
      other.x -= nx * 6;
      other.y -= ny * 6;
      if (Math.abs(car.speed) > 120) {
        game.audio.crash();
        game.spawnParticles(car.x, car.y, '#ffb347', 6);
        car.health -= 3;
        other.health -= 3;
      }
      car.speed *= 0.45;
    }
  }

  if (input.wasPressed('KeyE')) exitCar(game);
  game.camera.shake = Math.min(6, Math.abs(car.speed) / 640 * 3 + (hitWall ? 3 : 0));
}

/** Wanted stars from heat: 0, 1, 2, 3, 4, 5. */
export function wantedFromHeat(heat) {
  if (heat < 12) return 0;
  if (heat < 30) return 1;
  if (heat < 50) return 2;
  if (heat < 70) return 3;
  if (heat < 88) return 4;
  return 5;
}

export function updatePlayer(game, dt) {
  const p = game.player;
  if (!p.alive) return;
  if (p.onFoot) updateOnFoot(game, dt);
  else updateDriving(game, dt);

  // Heat decays when the player stays out of trouble; faster when hidden.
  const policeNear = game.police.some((c) => dist(p.x, p.y, c.x, c.y) < 420);
  p.heat = clamp(p.heat - dt * (policeNear ? 0.55 : 2.2), 0, 100);
  const newWanted = wantedFromHeat(p.heat);
  if (newWanted > p.wanted) {
    game.addMessage(`WANTED LEVEL ${newWanted} — the police are coming!`);
    game.audio.sirenBlip();
  }
  p.wanted = newWanted;

  // Health regen slowly when not recently damaged.
  if (game.time - p.lastDamageAt > 8 && p.health < 100) {
    p.health = Math.min(100, p.health + 2.5 * dt);
  }

  // Car health: a wrecked car strands the player.
  if (p.car && p.car.health <= 0) {
    game.addMessage('Your car is wrecked!');
    game.spawnParticles(p.car.x, p.car.y, '#555', 20);
    const wreck = p.car;
    wreck.driver = 'wreck';
    wreck.speed = 0;
    exitCar(game);
    p.health = Math.max(20, p.health - 15);
  }

  // Speeding on a road near a cop also draws heat (only while driving fast).
  if (!p.onFoot && Math.abs(p.car.speed) > 480 && onRoad(p.x, p.y)) {
    for (const cop of game.police) {
      if (dist(p.x, p.y, cop.x, cop.y) < 300) {
        p.heat = Math.min(100, p.heat + 4 * dt);
        break;
      }
    }
  }
}
