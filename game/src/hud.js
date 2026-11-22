// hud.js — the heads-up display: health, money, wanted stars, the mission
// objective, speed and ammo, and a live minimap of Sunset Bay.

import { WORLD } from './city.js';
import { currentObjective } from './missions.js';

function drawStars(ctx, wanted, x, y, time) {
  for (let i = 0; i < 5; i++) {
    const lit = i < wanted;
    const blink = lit && wanted >= 4 && Math.floor(time * 3) % 2 === 0;
    ctx.fillStyle = lit ? (blink ? '#ff6b6b' : '#ffd166') : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    const cx = x + i * 30;
    const cy = y;
    const r = 11;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI) / 5;
      const rad = k % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawMinimap(ctx, game) {
  const size = 190;
  const x0 = game.view.w - size - 16;
  const y0 = 16;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(16,20,28,0.82)';
  ctx.beginPath();
  ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();

  // Ground and water.
  ctx.fillStyle = '#5d8a4f';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x0, y0 + game.city.waterY * scale, size, size - game.city.waterY * scale);
  // Roads.
  ctx.strokeStyle = '#3a3f47';
  ctx.lineWidth = 3;
  for (const line of game.city.lines) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + line * scale);
    ctx.lineTo(x0 + size, y0 + line * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 + line * scale, y0);
    ctx.lineTo(x0 + line * scale, y0 + size);
    ctx.stroke();
  }
  // Mission marker.
  const marker = game.marker;
  if (marker) {
    const pulse = 4 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x0 + marker.x * scale, y0 + marker.y * scale, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police dots.
  ctx.fillStyle = '#2e7bff';
  for (const car of game.police) {
    ctx.beginPath();
    ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = game.player;
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#20242c';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // North label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + size / 2, y0 + 13);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SUNSET BAY', x0 + size, y0 + size + 20);
}

export function drawHUD(ctx, game) {
  const p = game.player;
  const view = game.view;
  const time = game.time;

  // --- Top-left: health bar + money ---
  ctx.save();
  ctx.fillStyle = 'rgba(16,20,28,0.75)';
  ctx.beginPath();
  ctx.roundRect(14, 14, 240, 58, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RICO VALE', 26, 34);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.roundRect(26, 42, 180, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 50 ? '#2f9e44' : p.health > 25 ? '#e8b93a' : '#e74c3c';
  ctx.beginPath();
  ctx.roundRect(26, 42, 180 * Math.max(0, p.health / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`${Math.ceil(p.health)}`, 212, 52);
  // Money.
  ctx.fillStyle = '#7CFC9A';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`$${Math.floor(p.money).toLocaleString('en-US')}`, 26, 92);
  ctx.restore();

  // --- Wanted stars, top centre ---
  drawStars(ctx, p.wanted, view.w / 2 - 60, 34, time);
  if (p.wanted > 0) {
    ctx.fillStyle = 'rgba(16,20,28,0.75)';
    ctx.beginPath();
    ctx.roundRect(view.w / 2 - 78, 52, 156, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.wanted >= 4 ? 'POLICE ON YOUR TAIL' : 'WANTED', view.w / 2, 67);
  }

  // --- Minimap, top-right ---
  drawMinimap(ctx, game);

  // --- Objective panel, under the health bar ---
  const obj = currentObjective(game);
  const taxi = game.missions.taxi;
  if (obj || taxi) {
    ctx.save();
    const lines = [];
    if (obj) {
      lines.push({ text: obj.mission, bold: true, color: '#ffd166' });
      lines.push({ text: obj.step, bold: false, color: '#fff' });
      if (game.missions.missionTimer > 0) {
        lines.push({ text: `TIME LEFT: ${Math.ceil(game.missions.missionTimer)}s`, bold: true, color: '#ff6b6b' });
      }
    }
    if (taxi) {
      lines.push({ text: 'TAXI FARE', bold: true, color: '#7CFC9A' });
      lines.push({ text: taxi.state === 'pickup' ? 'Pick up the passenger' : 'Drive to the destination', bold: false, color: '#fff' });
      lines.push({ text: `Fare $${taxi.fare} — ${Math.ceil(taxi.timer)}s`, bold: false, color: '#fff' });
    }
    const h = 14 + lines.length * 20 + 10;
    ctx.fillStyle = 'rgba(16,20,28,0.75)';
    ctx.beginPath();
    ctx.roundRect(14, 108, 330, h, 8);
    ctx.fill();
    ctx.textAlign = 'left';
    let y = 108 + 24;
    for (const line of lines) {
      ctx.fillStyle = line.color;
      ctx.font = (line.bold ? 'bold ' : '') + '14px sans-serif';
      ctx.fillText(line.text, 26, y);
      y += 20;
    }
    // Hold-the-lobby progress.
    if (obj && game.missions.holdTimer > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(26, y - 6, 200, 8);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(26, y - 6, 200 * Math.min(1, game.missions.holdTimer / 5), 8);
    }
    ctx.restore();
  }

  // --- Bottom-left: ammo / weapon ---
  if (p.onFoot) {
    ctx.save();
    ctx.fillStyle = 'rgba(16,20,28,0.75)';
    ctx.beginPath();
    ctx.roundRect(14, view.h - 58, 190, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    if (p.reloading > 0) {
      ctx.fillText('RELOADING…', 26, view.h - 30);
    } else {
      ctx.fillText(`PISTOL  ${p.ammo} / ${p.reserveAmmo}`, 26, view.h - 30);
    }
    ctx.restore();
  }

  // --- Bottom-right: speed when driving ---
  if (!p.onFoot && p.car) {
    ctx.save();
    ctx.fillStyle = 'rgba(16,20,28,0.75)';
    ctx.beginPath();
    ctx.roundRect(view.w - 204, view.h - 58, 190, 44, 8);
    ctx.fill();
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, view.w - 52, view.h - 28);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('km/h', view.w - 26, view.h - 28);
    // Car health.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(view.w - 192, view.h - 48, 120, 6);
    ctx.fillStyle = p.car.health > 50 ? '#2f9e44' : '#e74c3c';
    ctx.fillRect(view.w - 192, view.h - 48, 120 * Math.max(0, p.car.health / 100), 6);
    ctx.restore();
  }

  // --- Controls hint, bottom centre ---
  ctx.save();
  ctx.fillStyle = 'rgba(16,20,28,0.6)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  const hint = p.onFoot
    ? 'WASD move · Mouse aim · Click shoot · E enter car · R reload · Shift sprint · P pause · M mute'
    : 'W/S drive · A/D steer · Space handbrake · E exit car · P pause · M mute';
  const tw = ctx.measureText(hint).width;
  ctx.beginPath();
  ctx.roundRect(view.w / 2 - tw / 2 - 10, view.h - 26, tw + 20, 20, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(hint, view.w / 2, view.h - 12);
  ctx.restore();

  // --- Message feed, above the hint ---
  ctx.save();
  ctx.textAlign = 'center';
  let my = view.h - 92;
  for (let i = game.messages.length - 1; i >= 0; i--) {
    const msg = game.messages[i];
    const age = time - msg.at;
    const alpha = age > 4 ? Math.max(0, 1 - (age - 4) / 1.5) : 1;
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 15px sans-serif';
    const mw = ctx.measureText(msg.text).width;
    ctx.fillStyle = 'rgba(16,20,28,0.75)';
    ctx.beginPath();
    ctx.roundRect(view.w / 2 - mw / 2 - 10, my - 16, mw + 20, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(msg.text, view.w / 2, my);
    my -= 28;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
