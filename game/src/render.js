// The renderer: the city and everything in it through the camera, then the
// HUD (cash, health, wanted stars, district, objective, minimap) and the
// screens (title, pause, help, wasted, busted). All drawing is plain Canvas
// 2D, no images, no network.

import { CAR, PALETTE, PLAYER, ROAD, VIEW, WORLD } from './config.js';
import { drawMinimap } from './minimap.js';
import { missionTarget } from './missions.js';
import { clamp, distance } from './random.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Point the camera at the player (a 1280 x 720 window of the world). */
export function updateCamera(state, canvas) {
  const scale = canvas.height / VIEW.height;
  const w = canvas.width / scale;
  const h = VIEW.height;
  const cam = state.camera;
  cam.scale = scale;
  cam.w = Math.min(w, WORLD.width);
  cam.h = h;
  cam.x = clamp(state.player.x - cam.w / 2, 0, WORLD.width - cam.w);
  cam.y = clamp(state.player.y - h / 2, 0, WORLD.height - h);
  cam.ox = 0;
  cam.oy = 0;
}

function inView(cam, x, y, margin) {
  return x > cam.x - margin && x < cam.x + cam.w + margin && y > cam.y - margin && y < cam.y + cam.h + margin;
}

function drawCarBody(ctx, car, outline) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = CAR.width;
  const l = CAR.length;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(-l / 2 + 4, -w / 2 + 5, l, w);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-l / 2, -w / 2, l, w, 10);
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // Windshield and rear window.
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(l / 2 - 22, -w / 2 + 5, 14, w - 10);
  ctx.fillRect(-l / 2 + 6, -w / 2 + 5, 10, w - 10);
  // Headlights.
  ctx.fillStyle = '#fff6c0';
  ctx.fillRect(l / 2 - 2, -w / 2 + 2, 3, 8);
  ctx.fillRect(l / 2 - 2, w / 2 - 10, 3, 8);
  ctx.restore();
}

function drawWorld(ctx, state) {
  const cam = state.camera;
  const city = state.city;
  // Sea, beach and ground.
  ctx.fillStyle = PALETTE.deepSea;
  ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(Math.max(cam.x, city.sea.x), cam.y, Math.max(0, cam.x + cam.w - Math.max(cam.x, city.sea.x)), cam.h);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(cam.x, city.beach.x), cam.y, Math.max(0, Math.min(cam.x + cam.w, city.sea.x) - Math.max(cam.x, city.beach.x)), cam.h);
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(cam.x, cam.y, Math.min(cam.w, city.beach.x - cam.x), cam.h);

  // Parks and trees.
  for (const park of city.parks) {
    if (!inView(cam, park.x + park.w / 2, park.y + park.h / 2, 200)) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = PALETTE.parkDark;
    ctx.fillRect(park.x + 6, park.y + 6, park.w - 12, park.h - 12);
  }
  ctx.fillStyle = PALETTE.tree;
  for (const tree of city.trees) {
    if (!inView(cam, tree.x, tree.y, 40)) continue;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Roads: the dark strip, the edge lines and the centre dashes.
  for (const road of city.roads) {
    ctx.fillStyle = PALETTE.road;
    if (road.axis === 'v') ctx.fillRect(road.at - ROAD.width / 2, 0, ROAD.width, WORLD.height);
    else ctx.fillRect(0, road.at - ROAD.width / 2, WORLD.width, ROAD.width);
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const road of city.roads) {
    if (road.axis === 'v') {
      ctx.moveTo(road.at, 0);
      ctx.lineTo(road.at, WORLD.height);
    } else {
      ctx.moveTo(0, road.at);
      ctx.lineTo(WORLD.width, road.at);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Buildings: a shadow, the body, and the roof.
  for (const b of city.buildings) {
    if (!inView(cam, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(b.x + 7, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = PALETTE.glass;
    ctx.fillRect(b.x + 14, b.y + 14, 10, 10);
    ctx.fillRect(b.x + b.w - 24, b.y + 14, 10, 10);
  }

  drawLandmarks(ctx, state);
  drawPickups(ctx, state);
  drawCars(ctx, state);
  drawPeds(ctx, state);
  drawThugs(ctx, state);
  drawOfficers(ctx, state);
  drawPlayer(ctx, state);
  drawBullets(ctx, state);
  drawObjective(ctx, state);
}

function drawLandmarks(ctx, state) {
  const cam = state.camera;
  const lm = state.city.landmarks;
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px ' + FONT;
  // Airfield: runway and hangar.
  const af = lm.airfield;
  if (inView(cam, af.x + af.w / 2, af.y + af.h / 2, 100)) {
    ctx.fillStyle = '#6f7378';
    ctx.fillRect(af.x, af.y, af.w, af.h);
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(af.x + 20, af.y + af.h / 2 - 16, af.w - 40, 32);
    ctx.strokeStyle = '#e8d44d';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 18]);
    ctx.beginPath();
    ctx.moveTo(af.x + 30, af.y + af.h / 2);
    ctx.lineTo(af.x + af.w - 30, af.y + af.h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#2c3038';
    ctx.fillRect(af.x + 24, af.y + 20, 90, 60);
    label(ctx, 'AIRFIELD', af.x + af.w / 2, af.y + af.h - 16);
  }
  // Marina: pier and boats.
  const marina = lm.marina;
  if (inView(cam, marina.x + marina.w / 2, marina.y + marina.h / 2, 100)) {
    ctx.fillStyle = '#8a6f5c';
    ctx.fillRect(marina.x, marina.y, 60, marina.h);
    ctx.fillStyle = '#e8e8e8';
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(marina.x + 70, marina.y + 20 + i * 56, 44, 18);
    }
    label(ctx, 'MARINA', marina.x + marina.w / 2, marina.y + marina.h - 12);
  }
  // Docks: crates.
  const docks = lm.docks;
  if (inView(cam, docks.x + docks.w / 2, docks.y + docks.h / 2, 100)) {
    ctx.fillStyle = '#7a6a4a';
    ctx.fillRect(docks.x, docks.y, docks.w, docks.h);
    ctx.fillStyle = '#a8845a';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(docks.x + 24 + i * 66, docks.y + 30, 48, 48);
      ctx.fillRect(docks.x + 24 + i * 66, docks.y + 120, 48, 48);
    }
    label(ctx, 'DOCKS', docks.x + docks.w / 2, docks.y + docks.h - 14);
  }
  // Named buildings.
  const named = [
    ['garage', 'GARAGE', '#b8a06a'],
    ['hotel', 'HOTEL', '#c9a86a'],
    ['hospital', 'HOSPITAL', '#e8e8e8'],
    ['policeHQ', 'POLICE HQ', '#5a7dd8'],
    ['cityHall', 'CITY HALL', '#d8c9a8'],
    ['safehouse', 'SAFEHOUSE', '#a8b8a0'],
  ];
  for (const [key, name, color] of named) {
    const rect = lm[key];
    if (!rect || !inView(cam, rect.x + rect.w / 2, rect.y + rect.h / 2, 100)) continue;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(rect.x + 6, rect.y + 7, rect.w, rect.h);
    ctx.fillStyle = color;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = key === 'hospital' ? '#c0392b' : '#3a3f4a';
    ctx.fillRect(rect.x + rect.w / 2 - 26, rect.y + rect.h / 2 - 26, 52, 52);
    if (key === 'hospital') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rect.x + rect.w / 2 - 5, rect.y + rect.h / 2 - 18, 10, 36);
      ctx.fillRect(rect.x + rect.w / 2 - 18, rect.y + rect.h / 2 - 5, 36, 10);
    }
    label(ctx, name, rect.x + rect.w / 2, rect.y + rect.h - 12);
  }
}

function label(ctx, text, x, y) {
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillStyle = 'rgba(16, 20, 28, 0.8)';
  const w = ctx.measureText(text).width + 16;
  ctx.fillRect(x - w / 2, y - 18, w, 24);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(text, x, y);
}

function drawPickups(ctx, state) {
  const cam = state.camera;
  for (const pickup of state.pickups) {
    if (pickup.taken || !inView(cam, pickup.x, pickup.y, 40)) continue;
    if (pickup.kind === 'cash') {
      ctx.fillStyle = '#1e7d32';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.cash;
      ctx.font = 'bold 16px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('$', pickup.x, pickup.y + 6);
    } else {
      ctx.fillStyle = '#f4f1e6';
      ctx.fillRect(pickup.x - 12, pickup.y - 12, 24, 24);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(pickup.x - 3, pickup.y - 9, 6, 18);
      ctx.fillRect(pickup.x - 9, pickup.y - 3, 18, 6);
    }
  }
}

function drawCars(ctx, state) {
  for (const car of state.cars) {
    if (!inView(state.camera, car.x, car.y, 90)) continue;
    if (car.kind === 'player') {
      drawCarBody(ctx, car, '#ffcf3d');
    } else if (car.kind === 'police') {
      drawCarBody(ctx, car, null);
      // Flashing light bar.
      const phase = Math.floor(state.time * 6) % 2 === 0;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = phase ? '#ff3b30' : '#2f6fd8';
      ctx.fillRect(-6, -CAR.width / 2 + 4, 12, 10);
      ctx.fillStyle = phase ? '#2f6fd8' : '#ff3b30';
      ctx.fillRect(-6, CAR.width / 2 - 14, 12, 10);
      ctx.restore();
    } else {
      drawCarBody(ctx, car, null);
    }
  }
}

function drawPeds(ctx, state) {
  for (const ped of state.peds) {
    if (!inView(state.camera, ped.x, ped.y, 30)) continue;
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawThugs(ctx, state) {
  for (const thug of state.thugs) {
    if (!inView(state.camera, thug.x, thug.y, 30)) continue;
    ctx.fillStyle = PALETTE.thug;
    ctx.beginPath();
    ctx.arc(thug.x, thug.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a103a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Gun barrel.
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(thug.x, thug.y);
    ctx.lineTo(thug.x + Math.cos(thug.angle) * 22, thug.y + Math.sin(thug.angle) * 22);
    ctx.stroke();
  }
}

function drawOfficers(ctx, state) {
  for (const officer of state.officers) {
    if (!inView(state.camera, officer.x, officer.y, 30)) continue;
    ctx.fillStyle = PALETTE.police;
    ctx.beginPath();
    ctx.arc(officer.x, officer.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c3a6b';
    ctx.beginPath();
    ctx.arc(officer.x, officer.y - 3, 7, Math.PI, 0);
    ctx.fill();
  }
}

function drawPlayer(ctx, state) {
  const player = state.player;
  if (!inView(state.camera, player.x, player.y, 60)) return;
  if (player.inCar) return; // The car is drawn by drawCars.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.arc(player.x + 3, player.y + 4, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5a00';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Pistol barrel toward the aim.
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24);
  ctx.stroke();
}

function drawBullets(ctx, state) {
  ctx.fillStyle = '#fff6c0';
  for (const bullet of state.bullets) {
    if (!inView(state.camera, bullet.x, bullet.y, 20)) continue;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawObjective(ctx, state) {
  const target = missionTarget(state);
  if (!target) return;
  const cam = state.camera;
  // A pulsing beacon over the objective when it is on screen.
  if (inView(cam, target.x, target.y, 0)) {
    const pulse = 1 + Math.sin(state.time * 5) * 0.25;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.marker;
    const s = 16 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.marker;
    ctx.fillText(target.label, target.x, target.y - 26);
  } else {
    // An arrow at the screen edge pointing toward it.
    const cx = clamp(target.x, cam.x + 40, cam.x + cam.w - 40);
    const cy = clamp(target.y, cam.y + 40, cam.y + cam.h - 40);
    const angle = Math.atan2(target.y - cy, target.x - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 14px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.marker;
    const dist = Math.round(distance(state.player.x, state.player.y, target.x, target.y));
    ctx.fillText(`${target.label} — ${dist}m`, cx, cy + 30);
  }
}

/** Text with a dark outline, so the HUD stays readable over light buildings. */
function textOutlined(ctx, text, x, y) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(12, 15, 20, 0.75)';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawHud(ctx, state, viewW) {
  const player = state.player;
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px ' + FONT;
  // Cash and health, top-left.
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.beginPath();
  ctx.roundRect(14, 14, 250, 86, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.cash;
  ctx.fillText(`$${Math.floor(player.cash)}`, 28, 44);
  // Health bar.
  ctx.fillStyle = '#333a45';
  ctx.fillRect(28, 56, 180, 12);
  ctx.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
  ctx.fillRect(28, 56, 180 * clamp(player.health / 100, 0, 1), 12);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '14px ' + FONT;
  ctx.fillText(`Health ${Math.round(player.health)}`, 28, 86);
  // Wanted stars, under the cash panel.
  ctx.font = '26px ' + FONT;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? PALETTE.star : PALETTE.starEmpty;
    ctx.fillText('★', 24 + i * 32, 132);
  }
  // District and objective, top-centre.
  const district = state.district || 'Solmar City';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  textOutlined(ctx, district, viewW / 2, 34);
  ctx.font = '15px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  if (state.mission) {
    const time = Math.max(0, Math.ceil(state.mission.timer));
    ctx.fillStyle = state.mission.timer < 15 ? PALETTE.healthLow : PALETTE.text;
    textOutlined(ctx, `${state.mission.name} — ${state.mission.target.label}  ·  ${time}s`, viewW / 2, 58);
  } else if (state.fare) {
    const time = Math.max(0, Math.ceil(state.fare.timer));
    ctx.fillStyle = PALETTE.text;
    const label = state.fare.stage === 'pickup' ? 'Fare waiting — pick them up' : 'Fare aboard — drive to the marker';
    textOutlined(ctx, `${label}  ·  ${time}s`, viewW / 2, 58);
  } else {
    const done = state.missionsDone.filter(Boolean).length;
    textOutlined(ctx, `Missions ${done}/3  ·  Find Lena Torres at the marker`, viewW / 2, 58);
  }
  // Bottom-left: the controls.
  ctx.textAlign = 'left';
  ctx.font = '13px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  textOutlined(ctx, 'WASD drive / walk · Shift run · E enter / steal / start · Space handbrake · Click shoot · P pause · M mute', 14, VIEW.height - 14);
  // Bottom-centre: the context prompt.
  if (state.prompt) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px ' + FONT;
    ctx.fillStyle = PALETTE.marker;
    textOutlined(ctx, state.prompt, viewW / 2, VIEW.height - 44);
  }
  // Message toasts, above the prompt.
  ctx.textAlign = 'center';
  ctx.font = '15px ' + FONT;
  state.messages.forEach((message, index) => {
    ctx.globalAlpha = clamp(message.life, 0, 1);
    ctx.fillStyle = message.good ? PALETTE.cash : PALETTE.text;
    textOutlined(ctx, message.text, viewW / 2, VIEW.height - 72 - index * 22);
  });
  ctx.globalAlpha = 1;
}

/** Paint one frame: the world through the camera, then the HUD. */
/** Draw the world and, while playing, the HUD. The title and end screens
 *  draw their own panel over the world, so the HUD stays out of their way. */
export function drawGame(ctx, canvas, state, screen) {
  updateCamera(state, canvas);
  const cam = state.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#11141b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale, -cam.y * cam.scale);
  drawWorld(ctx, state);
  if (screen === 'title' || screen === 'wasted' || screen === 'busted') return;
  // HUD in the same view space as the world (cam.w x 720 logical), so the
  // panels sit where the world ends and the minimap stays on screen.
  ctx.setTransform(cam.scale, 0, 0, cam.scale, 0, 0);
  drawMinimap(ctx, state, cam.w);
  drawHud(ctx, state, cam.w);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
}

function drawTitle(ctx, state, info) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const scale = ctx.canvas.width / VIEW.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const cx = VIEW.width / 2;
  panel(ctx, cx - 360, 130, 720, 420);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.marker;
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText('SOLMAR CITY', cx, 220);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '22px ' + FONT;
  ctx.fillText('An open-world crime game in the spirit of GTA 6', cx, 258);
  ctx.font = '16px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Drive, steal cars, outrun the police, and run three missions for Lena Torres.', cx, 290);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 20px ' + FONT;
  if (info.hasSave) ctx.fillText('Press ENTER to continue your save, or N for a new game', cx, 350);
  else ctx.fillText('Press ENTER or click to start', cx, 350);
  ctx.font = '15px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('WASD / arrows move and drive · Shift run · E enter, steal, start · Space handbrake', cx, 400);
  ctx.fillText('Mouse aim, click to shoot · H horn · R restart mission · P pause · M mute · H for help', cx, 424);
  const done = state.missionsDone.filter(Boolean).length;
  ctx.fillText(`Missions done ${done}/3 · Cash $${Math.floor(state.player.cash)}`, cx, 470);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '13px ' + FONT;
  ctx.fillText('An original game: its city, characters and story are its own, not Rockstar’s.', cx, 520);
}

function drawPaused(ctx, state) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(10, 14, 20, 0.6)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const scale = ctx.canvas.width / VIEW.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const cx = VIEW.width / 2;
  panel(ctx, cx - 260, 220, 520, 220);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText('PAUSED', cx, 300);
  ctx.font = '17px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('P or Enter to resume · H for help · R to restart the mission', cx, 340);
  ctx.fillText('Your progress saves when you finish a mission or quit.', cx, 372);
}

function drawHelp(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(10, 14, 20, 0.72)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const scale = ctx.canvas.width / VIEW.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const cx = VIEW.width / 2;
  panel(ctx, cx - 340, 110, 680, 480);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 36px ' + FONT;
  ctx.fillText('HOW TO PLAY', cx, 170);
  ctx.textAlign = 'left';
  ctx.font = '17px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  const lines = [
    ['Move / drive', 'WASD or arrow keys. Shift runs on foot. Space is the handbrake.'],
    ['Enter a car', 'Walk up to a parked or traffic car and press E. E again gets out.'],
    ['Steal', 'Taking a car that is not yours raises your wanted level.'],
    ['Shoot', 'Aim with the mouse, click to fire the pistol (on foot).'],
    ['Wanted', 'Stars bring police cars and officers. Lose them to cool off.'],
    ['Missions', 'Find Lena Torres at the gold marker, press E, beat the timer.'],
    ['Fares', 'Drive a car and a fare appears — pick them up, drop them off, get paid.'],
    ['Pickups', 'Green $ is street cash, white packs heal.'],
    ['Save', 'Progress saves automatically; Continue on the title screen.'],
  ];
  let y = 210;
  for (const [head, body] of lines) {
    ctx.fillStyle = PALETTE.marker;
    ctx.fillText(head, cx - 300, y);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(body, cx - 180, y);
    y += 34;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '15px ' + FONT;
  ctx.fillText('Press H or P to go back', cx, 560);
}

function drawEnd(ctx, title, subtitle, accent) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(10, 14, 20, 0.62)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const scale = ctx.canvas.width / VIEW.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const cx = VIEW.width / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 72px ' + FONT;
  ctx.fillText(title, cx, 330);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px ' + FONT;
  ctx.fillText(subtitle, cx, 380);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '16px ' + FONT;
  ctx.fillText('Press ENTER to try again', cx, 420);
}

/** Paint the overlay for the current screen (title, pause, help, wasted, busted). */
export function drawScreen(ctx, state, screen, info) {
  if (screen === 'title') drawTitle(ctx, state, info);
  else if (screen === 'paused') drawPaused(ctx, state);
  else if (screen === 'help') drawHelp(ctx);
  else if (screen === 'wasted') drawEnd(ctx, 'WASTED', 'Lena Torres is not impressed. Your cash stays where it was.', PALETTE.healthLow);
  else if (screen === 'busted') drawEnd(ctx, 'BUSTED', 'The Solmar City police took you in. Your cash stays where it was.', '#7fb8d8');
}
