// city.js — Sunset Bay, the open world.
// A 3200 x 3200 grid city: roads every 320 units, blocks of buildings,
// parks, a beach and docks on the south edge, and the story landmarks
// (garage, bank, hotel, safehouse, hospital) placed on fixed blocks.

import { makeRng, clamp } from './rng.js';

export const WORLD = 3200; // world is WORLD x WORLD units
export const ROAD_STEP = 320; // distance between road centrelines
export const ROAD_HALF = 34; // half the road width (asphalt + sidewalk)

const ROOF_PALETTE = [
  '#c96f4a', '#b8573f', '#8f6b4f', '#7d8a99', '#a8a29a',
  '#d9a05b', '#6f7f6a', '#9c7b8b', '#5f7486', '#c2b280',
];
const WALL_PALETTE = [
  '#e8d9c0', '#d9c2a3', '#cbb59a', '#b9c4c9', '#e3cfae',
  '#d8b48f', '#c4b49a', '#aebfc7', '#e0c9a6', '#cfd6cf',
];

// A road centreline coordinate: roads run at 0, 320, 640, ... 3200.
export function roadLines() {
  const lines = [];
  for (let x = 0; x <= WORLD; x += ROAD_STEP) lines.push(x);
  return lines;
}

/** True when (x, y) is on asphalt (inside a road band). */
export function onRoad(x, y) {
  const rx = x % ROAD_STEP;
  const ry = y % ROAD_STEP;
  const near = (v) => v < ROAD_HALF || v > ROAD_STEP - ROAD_HALF;
  return near(rx) || near(ry);
}

/** Snap a point to the nearest road centreline coordinate on one axis. */
export function nearestRoad(v) {
  return Math.round(v / ROAD_STEP) * ROAD_STEP;
}

/** Build the whole city from a fixed seed. */
export function buildCity(seed) {
  const rng = makeRng(seed);
  const lines = roadLines();
  const buildings = [];
  const trees = [];
  const parks = [];
  const lamps = [];

  // One block = the square between four roads. Fill each block with
  // buildings, a park, or a plaza, leaving the landmark blocks for later.
  const landmarkBlocks = new Set(['3,7', '7,3', '5,5', '2,2', '8,8', '4,2']);
  for (let bx = 0; bx < 10; bx++) {
    for (let by = 0; by < 10; by++) {
      const x0 = bx * ROAD_STEP + ROAD_HALF + 14;
      const y0 = by * ROAD_STEP + ROAD_HALF + 14;
      const x1 = (bx + 1) * ROAD_STEP - ROAD_HALF - 14;
      const y1 = (by + 1) * ROAD_STEP - ROAD_HALF - 14;
      const key = `${bx},${by}`;
      if (landmarkBlocks.has(key)) continue;
      const roll = rng.next();
      if (roll < 0.14) {
        // A park: grass, paths, trees.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i++) {
          trees.push({
            x: rng.range(x0 + 16, x1 - 16),
            y: rng.range(y0 + 16, y1 - 16),
            r: rng.range(9, 15),
          });
        }
        continue;
      }
      if (roll < 0.2) {
        // A plaza: open paved square with a few trees and benches.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, plaza: true });
        for (let i = 0; i < 3; i++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(8, 12) });
        }
        continue;
      }
      // Buildings: 1-4 per block, varied footprints and heights.
      const count = rng.int(1, 4);
      for (let i = 0; i < count; i++) {
        const bw = rng.range(56, 120);
        const bh = rng.range(56, 120);
        const bx0 = rng.range(x0, Math.max(x0 + 1, x1 - bw));
        const by0 = rng.range(y0, Math.max(y0 + 1, y1 - bh));
        const tall = rng.chance(0.22);
        buildings.push({
          x: bx0,
          y: by0,
          w: bw,
          h: bh,
          hgt: tall ? rng.range(46, 78) : rng.range(14, 34),
          roof: rng.pick(ROOF_PALETTE),
          wall: rng.pick(WALL_PALETTE),
          tall,
        });
      }
      // Street trees along the block edges.
      if (rng.chance(0.6)) {
        trees.push({ x: x0 + rng.range(0, x1 - x0), y: y0 - 8, r: rng.range(7, 11) });
        trees.push({ x: x0 + rng.range(0, x1 - x0), y: y1 + 8, r: rng.range(7, 11) });
      }
    }
  }

  // Landmarks on their reserved blocks (block coords -> world centre).
  const blockCentre = (bx, by) => ({
    x: bx * ROAD_STEP + ROAD_STEP / 2,
    y: by * ROAD_STEP + ROAD_STEP / 2,
  });
  const garage = blockCentre(3, 7);
  const bank = blockCentre(7, 3);
  const hotel = blockCentre(5, 5);
  const safehouse = blockCentre(2, 2);
  const hospital = blockCentre(8, 8);
  const docks = { x: WORLD / 2, y: WORLD - 120 };
  const landmarks = [
    { kind: 'garage', label: "Mara's Garage", ...garage, w: 150, h: 110, roof: '#3f6d8e', wall: '#d8c9a8' },
    { kind: 'bank', label: 'Bay Federal Bank', ...bank, w: 170, h: 120, roof: '#8a6d3b', wall: '#e8ddc4' },
    { kind: 'hotel', label: 'Palms Hotel', ...hotel, w: 150, h: 110, roof: '#4a7d6b', wall: '#e3d3b8' },
    { kind: 'safehouse', label: 'Safehouse', ...safehouse, w: 120, h: 100, roof: '#7a4a5e', wall: '#d9c2a3' },
    { kind: 'hospital', label: 'Bay General', ...hospital, w: 160, h: 120, roof: '#5e7d8a', wall: '#e8e2d4' },
  ];
  for (const lm of landmarks) {
    buildings.push({
      x: lm.x - lm.w / 2, y: lm.y - lm.h / 2, w: lm.w, h: lm.h,
      hgt: 30, roof: lm.roof, wall: lm.wall, tall: false, label: lm.label, kind: lm.kind,
    });
  }

  // Street lamps at every intersection corner.
  for (const lx of lines) {
    for (const ly of lines) {
      lamps.push({ x: lx + ROAD_HALF + 6, y: ly + ROAD_HALF + 6 });
    }
  }

  // Palm trees along the beach.
  for (let x = 60; x < WORLD; x += 90) {
    trees.push({ x: x + rng.range(-14, 14), y: WORLD - 46 + rng.range(-8, 8), r: 12, palm: true });
  }

  // Cash pickups scattered on sidewalks.
  const pickups = [];
  for (let i = 0; i < 14; i++) {
    const px = rng.range(120, WORLD - 120);
    const py = rng.range(120, WORLD - 120);
    pickups.push({ x: px, y: py, amount: 50, taken: false });
  }

  return {
    seed, lines, buildings, trees, parks, lamps, pickups,
    garage, bank, hotel, safehouse, hospital, docks,
    // Beach strip: the southern 90 units are sand and water.
    beachY: WORLD - 90,
    waterY: WORLD - 34,
  };
}

/** Circle-vs-building collision: push (x, y, r) out of every building it overlaps. */
export function collideCircleBuildings(city, x, y, r) {
  let px = x;
  let py = y;
  for (const b of city.buildings) {
    const cx = clamp(px, b.x, b.x + b.w);
    const cy = clamp(py, b.y, b.y + b.h);
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * r;
      py = cy + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // Centre inside the building: push out along the smallest overlap.
      const left = px - b.x;
      const right = b.x + b.w - px;
      const top = py - b.y;
      const bottom = b.y + b.h - py;
      const m = Math.min(left, right, top, bottom);
      if (m === left) px = b.x - r;
      else if (m === right) px = b.x + b.w + r;
      else if (m === top) py = b.y - r;
      else py = b.y + b.h + r;
    }
  }
  return { x: clamp(px, 20, WORLD - 20), y: clamp(py, 20, WORLD - 20) };
}

/** True when the point is inside any building (used for spawn validation). */
export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(city, rng) {
  const vertical = rng.chance(0.5);
  const line = rng.pick(city.lines);
  const along = rng.range(80, WORLD - 80);
  return vertical ? { x: line + (rng.chance(0.5) ? -12 : 12), y: along } : { x: along, y: line + (rng.chance(0.5) ? -12 : 12) };
}
