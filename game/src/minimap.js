// The live minimap: the whole city shrunk into a corner panel, with the
// player, the police, the thugs and the current objective marked on it.

import { WORLD } from './config.js';
import { missionTarget } from './missions.js';

const MAP_W = 216;
const MAP_H = 166;
const MARGIN = 14;

/** Draw the minimap in the top-right corner of the canvas (screen space). */
export function drawMinimap(ctx, state, viewW) {
  const x0 = viewW - MAP_W - MARGIN;
  const y0 = MARGIN;
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;

  ctx.save();
  ctx.fillStyle = 'rgba(16, 20, 28, 0.78)';
  ctx.strokeStyle = 'rgba(244, 241, 230, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x0 - 6, y0 - 6, MAP_W + 12, MAP_H + 12, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x0, y0, MAP_W, MAP_H);
  ctx.clip();

  // Ground, sea and beach.
  ctx.fillStyle = '#c9bfa5';
  ctx.fillRect(x0, y0, MAP_W, MAP_H);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0 + state.city.sea.x * sx, y0, state.city.sea.w * sx, MAP_H);
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(x0 + state.city.beach.x * sx, y0, state.city.beach.w * sx, MAP_H);
  // Parks.
  ctx.fillStyle = '#5da24a';
  for (const park of state.city.parks) {
    ctx.fillRect(x0 + park.x * sx, y0 + park.y * sy, Math.max(1, park.w * sx), Math.max(1, park.h * sy));
  }
  // Roads.
  ctx.fillStyle = '#3a3f4a';
  for (const road of state.city.roads) {
    if (road.axis === 'v') ctx.fillRect(x0 + (road.at - 48) * sx, y0, 96 * sx, MAP_H);
    else ctx.fillRect(x0, y0 + (road.at - 48) * sy, MAP_W, 96 * sy);
  }
  // Landmarks.
  ctx.fillStyle = '#8a6f5c';
  for (const lm of Object.values(state.city.landmarks)) {
    ctx.fillRect(x0 + lm.x * sx, y0 + lm.y * sy, Math.max(2, lm.w * sx), Math.max(2, lm.h * sy));
  }

  // The objective marker (a pulsing diamond).
  const target = missionTarget(state);
  if (target) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffd23d';
    const tx = x0 + target.x * sx;
    const ty = y0 + target.y * sy;
    ctx.beginPath();
    ctx.moveTo(tx, ty - pulse - 3);
    ctx.lineTo(tx + pulse + 3, ty);
    ctx.lineTo(tx, ty + pulse + 3);
    ctx.lineTo(tx - pulse - 3, ty);
    ctx.closePath();
    ctx.fill();
  }

  // Thugs, police, then the player on top.
  ctx.fillStyle = '#8a2f8a';
  for (const thug of state.thugs) {
    ctx.fillRect(x0 + thug.x * sx - 2, y0 + thug.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#2f6fd8';
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const officer of state.officers) {
    ctx.fillRect(x0 + officer.x * sx - 2, y0 + officer.y * sy - 2, 4, 4);
  }
  const px = x0 + state.player.x * sx;
  const py = y0 + state.player.y * sy;
  ctx.fillStyle = '#ffcf3d';
  ctx.strokeStyle = '#11141b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // The camera's view, as a faint rectangle.
  ctx.strokeStyle = 'rgba(244, 241, 230, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + state.camera.x * sx, y0 + state.camera.y * sy, state.camera.w * sx, state.camera.h * sy);
  ctx.restore();
}
