// police.js — the wanted system and the Sunset Bay Police Department.
// Wanted stars come from the player's heat. Police cars spawn at the map
// edge, chase and ram; at high wanted levels officers pursue on foot.
// Getting busted (caught) or wasted (health 0) ends the run with a cost.

import { clamp, dist, angleDiff } from './rng.js';
import { WORLD, nearestRoad, collideCircleBuildings } from './city.js';
import { createCar } from './player.js';

const MAX_POLICE_CARS = 5;
const MAX_FOOT_COPS = 4;

/** How many police cars a wanted level fields. */
export function policeCarsFor(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] || 0;
}

/** Spawn a police car at a road near the map edge, heading for the player. */
function spawnPoliceCar(game) {
  const p = game.player;
  const edge = game.rng.pick(['n', 's', 'e', 'w']);
  let x = p.x;
  let y = p.y;
  if (edge === 'n') { x = nearestRoad(p.x + game.rng.range(-400, 400)); y = 80; }
  if (edge === 's') { x = nearestRoad(p.x + game.rng.range(-400, 400)); y = WORLD - 160; }
  if (edge === 'e') { x = WORLD - 80; y = nearestRoad(p.y + game.rng.range(-400, 400)); }
  if (edge === 'w') { x = 80; y = nearestRoad(p.y + game.rng.range(-400, 400)); }
  const car = createCar(clamp(x, 60, WORLD - 60), clamp(y, 60, WORLD - 60), 0, 'police', 'police');
  car.speed = 200;
  car.sirenPhase = game.rng.range(0, 1);
  game.police.push(car);
  game.cars.push(car);
  game.addMessage('Police unit dispatched!');
}

/** Spawn a foot officer near the player. */
function spawnFootCop(game) {
  const p = game.player;
  const a = game.rng.range(0, Math.PI * 2);
  const x = clamp(p.x + Math.cos(a) * 260, 40, WORLD - 40);
  const y = clamp(p.y + Math.sin(a) * 260, 40, WORLD - 40);
  game.footCops.push({
    x, y, angle: a, speed: 150, health: 40, down: false,
    shootCooldown: game.rng.range(0.5, 1.5), walkPhase: 0,
  });
}

/** One police car: steer toward the player and ram. */
function updatePoliceCar(game, car, dt) {
  const p = game.player;
  car.sirenPhase += dt * 6;
  const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
  const diff = angleDiff(car.angle, targetAngle);
  const turnRate = 2.4;
  car.angle += clamp(diff, -turnRate * dt, turnRate * dt);
  const d = dist(car.x, car.y, p.x, p.y);
  const wantSpeed = d > 700 ? 620 : d > 260 ? 560 : 480;
  car.speed += clamp(wantSpeed - car.speed, -420 * dt, 380 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Police cars obey the buildings: they steer around the blocks, and a
  // hard hit against a wall costs them speed.
  const beforeX = car.x;
  const beforeY = car.y;
  const fixed = collideCircleBuildings(game.city, car.x, car.y, 20);
  car.x = fixed.x;
  car.y = fixed.y;
  if (Math.abs(fixed.x - beforeX) > 0.5 || Math.abs(fixed.y - beforeY) > 0.5) {
    car.speed *= 0.6;
  }
  car.x = clamp(car.x, 30, WORLD - 30);
  car.y = clamp(car.y, 30, WORLD - 30);

  // Ram the player's car or the player on foot.
  if (p.onFoot) {
    if (d < 30) {
      game.damagePlayer(12 * dt * 4, 'busted');
      car.speed *= 0.4;
    }
  } else if (p.car) {
    const cd = dist(car.x, car.y, p.car.x, p.car.y);
    if (cd < 46) {
      p.car.health -= 14 * dt;
      p.car.speed *= 0.985;
      car.speed *= 0.9;
      if (game.rng.chance(0.02)) game.audio.crash();
      game.spawnParticles((car.x + p.car.x) / 2, (car.y + p.car.y) / 2, '#ffb347', 2);
    }
  }
}

/** One foot officer: run at the player, shoot when close, arrest on touch. */
function updateFootCop(game, cop, dt) {
  const p = game.player;
  if (cop.down) return;
  const d = dist(cop.x, cop.y, p.x, p.y);
  const targetAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
  cop.angle += clamp(angleDiff(cop.angle, targetAngle), -3 * dt, 3 * dt);
  if (d > 34) {
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.walkPhase += dt * 9;
  } else if (p.onFoot) {
    // Arrest: the player is busted.
    game.busted();
    return;
  }
  // Officers fire their pistols at range.
  cop.shootCooldown -= dt;
  if (cop.shootCooldown <= 0 && d < 420 && d > 60) {
    cop.shootCooldown = game.rng.range(0.9, 1.6);
    const spread = game.rng.range(-0.09, 0.09);
    game.combat.fireBullet(game, cop.x, cop.y, targetAngle + spread, 560, 'police');
    game.audio.shot();
  }
  if (cop.health <= 0) {
    cop.down = true;
    game.player.heat = Math.min(100, game.player.heat + 25);
    game.addMessage('Officer down! The whole department is coming.');
    game.spawnParticles(cop.x, cop.y, '#e74c3c', 10);
  }
}

export function updatePolice(game, dt) {
  const wanted = game.player.wanted;
  game.policeSpawnTimer = Math.max(0, (game.policeSpawnTimer || 0) - dt);

  // Keep the right number of police cars on the road.
  const wantCars = policeCarsFor(wanted);
  if (game.police.length < wantCars && game.policeSpawnTimer <= 0) {
    spawnPoliceCar(game);
    game.policeSpawnTimer = 1.6;
  }
  // Despawn far-away units when the heat is gone.
  if (wanted === 0) {
    game.police = game.police.filter((c) => {
      if (dist(c.x, c.y, game.player.x, game.player.y) > 900) {
        game.cars.splice(game.cars.indexOf(c), 1);
        return false;
      }
      return true;
    });
    game.footCops = [];
  }
  // Foot officers at wanted 3 and above, only while the player is on foot
  // and only once the heat has been high for a while — the department
  // needs time to put boots on the street.
  game.wanted3Timer = Math.max(0, Math.min(30, (game.wanted3Timer || 0) + (wanted >= 3 ? dt : -dt * 2)));
  if (wanted >= 3 && game.wanted3Timer > 8 && game.player.onFoot && game.footCops.length < Math.min(MAX_FOOT_COPS, wanted - 1)) {
    spawnFootCop(game);
  }

  for (const car of [...game.police]) updatePoliceCar(game, car, dt);
  for (const cop of [...game.footCops]) updateFootCop(game, cop, dt);
  game.footCops = game.footCops.filter((c) => !c.down || c.health > -50);
}
