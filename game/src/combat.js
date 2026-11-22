// combat.js — bullets, damage and the little explosions that make a
// crime game feel like one. Bullets fly straight, hit peds, cops and cars,
// and die on buildings.

import { dist } from './rng.js';
import { insideBuilding } from './city.js';

export function createCombat() {
  return {
    bullets: [],
    particles: [],
    /** Fire one bullet from (x, y) along angle. Owner: 'player' | 'police'. */
    fireBullet(game, x, y, angle, speed, owner) {
      this.bullets.push({
        x: x + Math.cos(angle) * 18,
        y: y + Math.sin(angle) * 18,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        owner,
        life: 1.1,
      });
    },
  };
}

/** Spawn a burst of particles (sparks, smoke, blood-free impact puffs). */
export function spawnParticles(game, x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = game.rng.range(0, Math.PI * 2);
    const s = game.rng.range(40, 220);
    game.combat.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: game.rng.range(0.3, 0.8),
      maxLife: 0.8,
      color,
      size: game.rng.range(2, 5),
    });
  }
}

export function updateCombat(game, dt) {
  const combat = game.combat;
  const p = game.player;

  for (const b of combat.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Buildings stop bullets.
    if (insideBuilding(game.city, b.x, b.y)) {
      b.life = 0;
      spawnParticles(game, b.x, b.y, '#c9c9c9', 3);
      continue;
    }
    if (b.owner === 'player') {
      // Hit a pedestrian.
      for (const ped of game.peds) {
        if (!ped.down && dist(b.x, b.y, ped.x, ped.y) < 14) {
          ped.down = true;
          ped.downTimer = 8;
          b.life = 0;
          p.heat = Math.min(100, p.heat + 14);
          game.addMessage('Civilian hit! Witnesses called the cops.');
          spawnParticles(game, ped.x, ped.y, '#e74c3c', 8);
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a foot cop.
      for (const cop of game.footCops) {
        if (!cop.down && dist(b.x, b.y, cop.x, cop.y) < 16) {
          cop.health -= 34;
          b.life = 0;
          spawnParticles(game, cop.x, cop.y, '#20242c', 6);
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a police car.
      for (const car of game.police) {
        if (dist(b.x, b.y, car.x, car.y) < 26) {
          car.health -= 12;
          b.life = 0;
          spawnParticles(game, car.x, car.y, '#ffb347', 5);
          if (car.health <= 0) {
            car.driver = 'wreck';
            car.speed = 0;
            game.police.splice(game.police.indexOf(car), 1);
            p.money += 100;
            game.addMessage('Police car disabled! +$100 recovered from the wreck.');
            spawnParticles(game, car.x, car.y, '#555', 24);
          }
          break;
        }
      }
    } else if (b.owner === 'police') {
      // A cop's bullet hits the player.
      if (p.onFoot && dist(b.x, b.y, p.x, p.y) < 14) {
        game.damagePlayer(9, 'shot');
        b.life = 0;
        spawnParticles(game, p.x, p.y, '#e74c3c', 5);
      }
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);

  for (const pt of combat.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  combat.particles = combat.particles.filter((pt) => pt.life > 0);
}
