// render.js — draws Sunset Bay from above: the sun-soaked streets, the
// buildings with their shadows, the traffic, the people, the police lights
// and the mission beacons. One pass, no images: every pixel is canvas.

import { WORLD, ROAD_STEP, ROAD_HALF } from './city.js';
import { dist } from './rng.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.spec.w;
  const h = car.spec.h;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, 7);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Windshield + rear window.
  ctx.fillStyle = '#1d2b36';
  roundRect(ctx, w * 0.12, -h / 2 + 3, w * 0.16, h - 6, 3);
  ctx.fill();
  roundRect(ctx, -w * 0.34, -h / 2 + 3, w * 0.13, h - 6, 3);
  ctx.fill();
  // Roof.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, -w * 0.18, -h / 2 + 4, w * 0.26, h - 8, 4);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 3, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 7, 3, 5);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-w / 2 - 1, -h / 2 + 2, 3, 5);
    ctx.fillRect(-w / 2 - 1, h / 2 - 7, 3, 5);
  }
  // Taxi sign / police light bar.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#f7d774';
    ctx.fillRect(-6, -5, 12, 10);
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2.5);
  }
  if (car.type === 'police') {
    const phase = Math.floor(time * 6 + car.sirenPhase) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-8, -h / 2 - 2, 7, 5);
    ctx.fillStyle = phase ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(1, -h / 2 - 2, 7, 5);
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  // Wreck smoke.
  if (car.driver === 'wreck' || car.health < 35) {
    ctx.fillStyle = 'rgba(80,80,80,0.5)';
    ctx.beginPath();
    ctx.arc(-w * 0.2, 0, 8 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.color;
    roundRect(ctx, -11, -5, 22, 10, 5);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 1.5;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 8, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 2, Math.sin(ped.angle) * 2 + bob * 0.3, 5, 0, Math.PI * 2);
  ctx.fill();
  // Fleeing marker.
  if (ped.fleeing) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -14);
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  ctx.save();
  if (p.onFoot) {
    ctx.translate(p.x, p.y);
    const bob = Math.sin(p.footstep) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: Rico in a teal jacket.
    ctx.fillStyle = '#0e7c7b';
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a5a59';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Head + cap.
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2 + bob * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
    // Gun pointing at the aim angle.
    ctx.rotate(p.aimAngle);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(8, -2, 14, 4);
    ctx.restore();
    // Aim reticle at the mouse.
    const cam = game.camera;
    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.moveTo(mx - 13, my);
    ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my);
    ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13);
    ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5);
    ctx.lineTo(mx, my + 13);
    ctx.stroke();
    ctx.restore();
  } else {
    // A gold ring marks the player's car.
    ctx.translate(p.car.x, p.car.y);
    ctx.strokeStyle = 'rgba(232,185,58,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 24, p.car.angle, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBuildings(ctx, city, cam) {
  for (const b of city.buildings) {
    if (b.x > cam.x + 800 || b.x + b.w < cam.x - 800 || b.y > cam.y + 600 || b.y + b.h < cam.y - 600) continue;
    // Drop shadow in the sun's direction.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    // Walls.
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Roof.
    ctx.fillStyle = b.roof;
    const inset = Math.min(7, b.w / 6, b.h / 6);
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    // Roof details: vents and AC boxes.
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    const vents = Math.max(1, Math.floor((b.w * b.h) / 3600));
    for (let i = 0; i < vents; i++) {
      const vx = b.x + inset + 8 + ((i * 37) % Math.max(10, b.w - inset * 2 - 18));
      const vy = b.y + inset + 8 + ((i * 53) % Math.max(10, b.h - inset * 2 - 18));
      ctx.fillRect(vx, vy, 8, 8);
    }
    // Tall towers get a darker crown.
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.4, b.h * 0.4);
    }
    // Landmark label.
    if (b.label) {
      ctx.fillStyle = 'rgba(20,24,32,0.85)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(b.label).width;
      roundRect(ctx, b.x + b.w / 2 - tw / 2 - 6, b.y + b.h / 2 - 10, tw + 12, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 3);
    }
  }
}

function drawRoads(ctx, city, cam) {
  // Asphalt: one band per road line, both directions.
  ctx.fillStyle = '#3a3f47';
  for (const line of city.lines) {
    ctx.fillRect(-40, line - ROAD_HALF + 8, WORLD + 80, (ROAD_HALF - 8) * 2);
    ctx.fillRect(line - ROAD_HALF + 8, -40, (ROAD_HALF - 8) * 2, WORLD + 80);
  }
  // Sidewalk borders.
  ctx.fillStyle = '#9aa0a8';
  for (const line of city.lines) {
    ctx.fillRect(-40, line - ROAD_HALF, WORLD + 80, 6);
    ctx.fillRect(-40, line + ROAD_HALF - 6, WORLD + 80, 6);
    ctx.fillRect(line - ROAD_HALF, -40, 6, WORLD + 80);
    ctx.fillRect(line + ROAD_HALF - 6, -40, 6, WORLD + 80);
  }
  // Centre dashes.
  ctx.fillStyle = '#e8c93a';
  for (const line of city.lines) {
    for (let d = 0; d < WORLD; d += 64) {
      ctx.fillRect(d, line - 2, 34, 4);
      ctx.fillRect(line - 2, d, 4, 34);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const lx of city.lines) {
    for (const ly of city.lines) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(lx + i * 9 - 3, ly - ROAD_HALF + 4, 5, 10);
        ctx.fillRect(lx + i * 9 - 3, ly + ROAD_HALF - 14, 5, 10);
        ctx.fillRect(lx - ROAD_HALF + 4, ly + i * 9 - 3, 10, 5);
        ctx.fillRect(lx + ROAD_HALF - 14, ly + i * 9 - 3, 10, 5);
      }
    }
  }
  // Beach and water along the south edge.
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(-40, city.beachY, WORLD + 80, 90);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(-40, city.waterY, WORLD + 80, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = 0; x < WORLD; x += 120) {
    ctx.fillRect(x + ((cam.x * 0.2) % 120), city.waterY + 8, 60, 3);
  }
  // Docks pier.
  ctx.fillStyle = '#8a6d4b';
  ctx.fillRect(city.docks.x - 70, city.docks.y - 30, 140, 26);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOCKS', city.docks.x, city.docks.y - 38);
}

function drawMarker(ctx, game, marker, time) {
  if (!marker) return;
  const pulse = 1 + Math.sin(time * 4) * 0.15;
  // Beacon column.
  const grad = ctx.createLinearGradient(marker.x, marker.y - 160, marker.x, marker.y);
  grad.addColorStop(0, 'rgba(255,209,102,0)');
  grad.addColorStop(1, 'rgba(255,209,102,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(marker.x - 14, marker.y - 160, 28, 160);
  // Pulsing ground ring.
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,209,102,0.25)';
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Diamond above the ring.
  ctx.save();
  ctx.translate(marker.x, marker.y - 60 - Math.sin(time * 3) * 6);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-9, -9, 18, 18);
  ctx.strokeStyle = '#20242c';
  ctx.lineWidth = 2;
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.restore();
}

export function render(game) {
  const ctx = game.ctx;
  const view = game.view;
  const cam = game.camera;
  const city = game.city;
  const time = game.time;

  ctx.clearRect(0, 0, view.w, view.h);
  // Sky-warm backdrop behind the world edges.
  ctx.fillStyle = '#7ec8a9';
  ctx.fillRect(0, 0, view.w, view.h);

  ctx.save();
  const shakeX = (Math.random() - 0.5) * cam.shake;
  const shakeY = (Math.random() - 0.5) * cam.shake;
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

  // Ground: warm grass with a subtle checker of city blocks.
  ctx.fillStyle = '#8fbf6f';
  ctx.fillRect(-60, -60, WORLD + 120, WORLD + 120);
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let bx = 0; bx < 10; bx++) {
    for (let by = 0; by < 10; by++) {
      if ((bx + by) % 2 === 0) {
        ctx.fillRect(bx * ROAD_STEP + ROAD_HALF, by * ROAD_STEP + ROAD_HALF, ROAD_STEP - ROAD_HALF * 2, ROAD_STEP - ROAD_HALF * 2);
      }
    }
  }
  // Parks and plazas.
  for (const park of city.parks) {
    ctx.fillStyle = park.plaza ? '#c9b18a' : '#6da85c';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    if (!park.plaza) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(park.x, park.y + park.h / 2);
      ctx.lineTo(park.x + park.w, park.y + park.h / 2);
      ctx.stroke();
    }
  }

  drawRoads(ctx, city, cam);
  drawBuildings(ctx, city, cam);

  // Trees.
  for (const t of city.trees) {
    if (t.x < cam.x - 700 || t.x > cam.x + 700 || t.y < cam.y - 500 || t.y > cam.y + 500) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.palm ? '#2f9e6e' : '#3e8f4f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cash pickups.
  for (const pk of city.pickups) {
    if (pk.taken) continue;
    const bobY = Math.sin(time * 3 + pk.x) * 3;
    ctx.fillStyle = '#2f9e44';
    roundRect(ctx, pk.x - 9, pk.y - 6 + bobY, 18, 12, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + 3 + bobY);
  }

  drawMarker(ctx, game, game.marker, time);

  // Cars: traffic and police first, then the player's car on top.
  for (const car of game.cars) {
    if (car.driver === 'player') continue;
    drawCar(ctx, car, time);
  }
  if (game.player.car) drawCar(ctx, game.player.car, time);

  // Pedestrians and foot cops.
  for (const ped of game.peds) drawPed(ctx, ped);
  for (const cop of game.footCops) {
    if (cop.down) continue;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(Math.cos(cop.angle) * 2, Math.sin(cop.angle) * 2, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e7bff';
    ctx.fillRect(-6, -11, 12, 4);
    ctx.restore();
  }

  // Bullets as tracers.
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 3;
  for (const b of game.combat.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Particles.
  for (const pt of game.combat.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawPlayer(ctx, game);

  // Off-screen marker arrow at the viewport edge.
  const marker = game.marker;
  if (marker) {
    const dx = marker.x - cam.x;
    const dy = marker.y - cam.y;
    const d = Math.hypot(dx, dy);
    const maxD = Math.hypot(view.w, view.h) / 2 / cam.zoom;
    if (d > maxD * 0.75) {
      const a = Math.atan2(dy, dx);
      const ex = cam.x + Math.cos(a) * (view.w / 2 - 70) / cam.zoom;
      const ey = cam.y + Math.sin(a) * (view.h / 2 - 70) / cam.zoom;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#20242c';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(d)}m`, ex, ey - 20);
    }
  }

  ctx.restore();

  // Sunset vignette for the sun-soaked look.
  const vg = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.45, view.w / 2, view.h / 2, view.h * 0.95);
  vg.addColorStop(0, 'rgba(255,170,60,0)');
  vg.addColorStop(1, 'rgba(255,140,40,0.14)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, view.w, view.h);
}
