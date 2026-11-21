// Combat: the player's pistol, the rival thugs who shoot back, and the
// bullets between them. Gunfire makes nearby pedestrians flee and raises
// the wanted level; killing a pedestrian is a crime of its own.

import { PLAYER, THUG } from './config.js';
import { blockedAt } from './city.js';
import { distance } from './random.js';
import { playGunshot, playHit } from './audio.js';

export function spawnThug(state, x, y) {
  const thug = {
    x, y,
    angle: 0,
    health: THUG.health,
    fireCooldown: 1 + state.rng.next(),
    state: 'hunt',
  };
  state.thugs.push(thug);
  return thug;
}

/** The player fires the pistol toward a world point (on foot only). */
export function playerShoot(state, targetX, targetY) {
  const player = state.player;
  if (player.inCar || player.fireCooldown > 0) return false;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  const bx = player.x + Math.cos(angle) * 24;
  const by = player.y + Math.sin(angle) * 24;
  state.bullets.push({
    x: bx, y: by,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: PLAYER.range / PLAYER.bulletSpeed,
    damage: PLAYER.damage,
    from: 'player',
  });
  player.fireCooldown = 1 / PLAYER.fireRate;
  state.fleeFrom = { x: player.x, y: player.y };
  state.fleeTimer = 3;
  state.events.push({ type: 'shot' });
  playGunshot();
  return true;
}

function damageThug(state, thug, damage) {
  thug.health -= damage;
  playHit();
  if (thug.health <= 0) {
    const index = state.thugs.indexOf(thug);
    if (index !== -1) state.thugs.splice(index, 1);
    state.player.cash += 20;
    state.events.push({ type: 'thugDown', amount: 20 });
  }
}

function damagePlayer(state, damage) {
  const player = state.player;
  if (player.invulnerable > 0) return;
  player.health -= damage;
  player.invulnerable = 0.4;
  playHit();
  if (player.health <= 0) {
    player.health = 0;
    state.events.push({ type: 'wasted' });
  }
}

/** Move the bullets one step and resolve what they hit. */
export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0;
    if (!dead && blockedAt(state.city, bullet.x, bullet.y, 2)) dead = true;
    if (!dead && bullet.from === 'player') {
      for (const thug of [...state.thugs]) {
        if (distance(bullet.x, bullet.y, thug.x, thug.y) < 20) {
          damageThug(state, thug, bullet.damage);
          dead = true;
          break;
        }
      }
    }
    if (!dead && bullet.from === 'player') {
      for (let p = 0; p < state.peds.length; p += 1) {
        if (distance(bullet.x, bullet.y, state.peds[p].x, state.peds[p].y) < 16) {
          state.peds.splice(p, 1);
          state.events.push({ type: 'pedDown' });
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of [...state.cars]) {
        if (car.kind === 'parked') continue;
        if (distance(bullet.x, bullet.y, car.x, car.y) < 34) {
          car.health -= bullet.damage;
          if (car.kind === 'police' && car.health <= 0) {
            // A wrecked police car is out of the chase.
            const index = state.cars.indexOf(car);
            if (index !== -1) state.cars.splice(index, 1);
          } else if (car.kind === 'player' && car.health <= 0) {
            car.health = 0;
            car.speed = 0;
            car.kind = 'parked';
            state.player.inCar = null;
            state.player.x = state.player.x + 40;
            state.player.y = state.player.y + 40;
            state.events.push({ type: 'carWrecked' });
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && bullet.from === 'thug') {
      const player = state.player;
      if (distance(bullet.x, bullet.y, player.x, player.y) < 18) {
        damagePlayer(state, bullet.damage);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** The thugs: close on the player, stop at range, and shoot. */
export function updateThugs(state, dt) {
  const player = state.player;
  for (const thug of state.thugs) {
    thug.fireCooldown = Math.max(0, thug.fireCooldown - dt);
    const dist = distance(thug.x, thug.y, player.x, player.y);
    thug.angle = Math.atan2(player.y - thug.y, player.x - thug.x);
    if (dist > THUG.range * 0.85) {
      // Close the distance.
      const nx = thug.x + Math.cos(thug.angle) * THUG.speed * dt;
      const ny = thug.y + Math.sin(thug.angle) * THUG.speed * dt;
      thug.x = nx;
      thug.y = ny;
      if (blockedAt(state.city, thug.x, thug.y, 12)) {
        thug.x -= Math.cos(thug.angle) * THUG.speed * dt;
        thug.y -= Math.sin(thug.angle) * THUG.speed * dt;
      }
    } else if (thug.fireCooldown <= 0 && dist < THUG.range) {
      thug.fireCooldown = 1 / THUG.fireRate;
      state.bullets.push({
        x: thug.x + Math.cos(thug.angle) * 22,
        y: thug.y + Math.sin(thug.angle) * 22,
        vx: Math.cos(thug.angle) * 620,
        vy: Math.sin(thug.angle) * 620,
        life: THUG.range / 620,
        damage: THUG.damage,
        from: 'thug',
      });
      state.fleeFrom = { x: thug.x, y: thug.y };
      state.fleeTimer = 2;
      playGunshot();
    }
  }
}

/** One combat step: player fire, thugs, bullets, and the flee timer. */
export function updateCombat(state, input, dt, camera) {
  if (state.fleeTimer > 0) {
    state.fleeTimer -= dt;
    if (state.fleeTimer <= 0) state.fleeFrom = null;
  }
  if (input.mouseDown && camera) {
    const wx = camera.x + input.mouseX / camera.scale;
    const wy = camera.y + input.mouseY / camera.scale;
    playerShoot(state, wx, wy);
  }
  updateThugs(state, dt);
  updateBullets(state, dt);
}
