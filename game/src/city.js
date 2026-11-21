// Solmar City itself: a road grid, the blocks between the roads, the beach and
// the sea along the east edge, and the named landmarks. The layout is fixed
// (the same city every visit); the seeded generator varies only which blocks
// are parks and the buildings inside them, so one seed always builds the
// same city.

import { ROAD, WORLD } from './config.js';

const BUILDING_COLORS = ['#d8c9a8', '#cbb98f', '#e0d4b8', '#c4b49a', '#d9c2a0'];
const ROOF_COLORS = ['#8a6f5c', '#7a5a48', '#96705a', '#6f5a4a'];

/** A circle (x, y, r) against an axis-aligned rectangle. */
function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export function buildCity(rng) {
  const city = {
    roads: [],
    blocks: [],
    buildings: [],
    parks: [],
    trees: [],
    landmarks: {},
    districts: [],
    beach: { x: 3168, y: 0, w: 92, h: WORLD.height },
    sea: { x: 3260, y: 0, w: WORLD.width - 3260, h: WORLD.height },
  };

  // Roads: the grid lines, each with its span.
  for (const x of ROAD.avenues) city.roads.push({ axis: 'v', at: x, from: 0, to: WORLD.height });
  for (const y of ROAD.streets) city.roads.push({ axis: 'h', at: y, from: 0, to: WORLD.width });

  // The blocks between neighbouring roads (plus the rim blocks at the edges).
  const xs = [0, ...ROAD.avenues, WORLD.width];
  const ys = [0, ...ROAD.streets, WORLD.height];
  const half = ROAD.width / 2;
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] === 0 ? 0 : xs[i] + half;
      const x1 = xs[i + 1] === WORLD.width ? WORLD.width : xs[i + 1] - half;
      const y0 = ys[j] === 0 ? 0 : ys[j] + half;
      const y1 = ys[j + 1] === WORLD.height ? WORLD.height : ys[j + 1] - half;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 60 || h < 60) continue;
      // The eastern rim is beach and sea, not blocks.
      if (x0 >= 3120) continue;
      city.blocks.push({ x: x0, y: y0, w, h });
    }
  }

  // Landmark blocks, by name, placed on specific blocks.
  const landmarkSpots = {
    airfield: { x: 288, y: 268, w: 384, h: 304 },
    garage: { x: 288, y: 1868, w: 384, h: 304 },
    hotel: { x: 1248, y: 668, w: 384, h: 304 },
    hospital: { x: 2208, y: 668, w: 384, h: 304 },
    policeHQ: { x: 1248, y: 1068, w: 384, h: 304 },
    cityHall: { x: 1728, y: 1068, w: 384, h: 304 },
    safehouse: { x: 768, y: 2268, w: 384, h: 284 },
  };
  for (const [name, rect] of Object.entries(landmarkSpots)) {
    city.landmarks[name] = { name, ...rect };
  }
  // Marina and docks sit on the beach edge, south-east.
  city.landmarks.marina = { name: 'marina', x: 2960, y: 1900, w: 200, h: 260 };
  city.landmarks.docks = { name: 'docks', x: 2688, y: 2268, w: 384, h: 284 };

  // Fill the ordinary blocks: most get buildings, some become parks.
  for (const block of city.blocks) {
    const isLandmark = Object.values(city.landmarks).some(
      (lm) => lm.x <= block.x + 4 && lm.y <= block.y + 4 && lm.x + lm.w >= block.x + block.w - 4 && lm.y + lm.h >= block.y + block.h - 4,
    );
    if (isLandmark) continue;
    if (rng.chance(0.22)) {
      const park = { x: block.x, y: block.y, w: block.w, h: block.h };
      city.parks.push(park);
      const treeCount = Math.floor((block.w * block.h) / 9000);
      for (let t = 0; t < treeCount; t += 1) {
        city.trees.push({
          x: block.x + 24 + rng.next() * (block.w - 48),
          y: block.y + 24 + rng.next() * (block.h - 48),
          r: 10 + rng.next() * 8,
        });
      }
      continue;
    }
    // Buildings: a small grid inside the block, each with a margin.
    const cols = block.w > 320 ? 2 : 1;
    const rows = block.h > 260 ? 2 : 1;
    const cellW = block.w / cols;
    const cellH = block.h / rows;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (rng.chance(0.12)) continue;
        const bw = cellW * (0.55 + rng.next() * 0.25);
        const bh = cellH * (0.55 + rng.next() * 0.25);
        const bx = block.x + c * cellW + (cellW - bw) / 2;
        const by = block.y + r * cellH + (cellH - bh) / 2;
        city.buildings.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          color: rng.pick(BUILDING_COLORS),
          roof: rng.pick(ROOF_COLORS),
        });
      }
    }
  }

  // Districts, checked in order (the beach first, it is the narrowest).
  city.districts = [
    { name: 'Beachside', x: 3120, y: 0, w: 280, h: WORLD.height },
    { name: 'Airfield', x: 0, y: 0, w: 960, h: 700 },
    { name: 'Marina Bay', x: 2280, y: 0, w: 1120, h: 1500 },
    { name: 'Downtown', x: 960, y: 0, w: 1320, h: 1500 },
    { name: 'Old Town', x: 0, y: 700, w: 960, h: 800 },
    { name: 'The Docks', x: 2280, y: 1500, w: 1120, h: 1100 },
    { name: 'Midtown', x: 960, y: 1500, w: 1320, h: 1100 },
    { name: 'West End', x: 0, y: 1500, w: 960, h: 1100 },
  ];

  return city;
}

/** The district a point stands in (the first whose rectangle holds it). */
export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Solmar City';
}

/** True when a circle of radius r at (x, y) is inside a building, the sea, or outside the world. */
export function blockedAt(city, x, y, r) {
  if (x - r < 0 || y - r < 0 || x + r > WORLD.width || y + r > WORLD.height) return true;
  if (x + r > city.sea.x && y + r > city.sea.y && x - r < city.sea.x + city.sea.w && y - r < city.sea.y + city.sea.h) return true;
  for (let i = 0; i < city.buildings.length; i += 1) {
    if (circleHitsRect(x, y, r, city.buildings[i])) return true;
  }
  return false;
}

/**
 * Push a circle out of whatever blocks it (buildings, sea, world edge), one axis
 * at a time so it slides along walls instead of sticking.
 */
/**
 * Keep a body out of buildings. The body has already moved to its new
 * position; prevX/prevY are where it was before the move. If the new spot is
 * inside a building, slide along the wall: try the X move alone, then the Y
 * move alone, and stay where it was if both are blocked. The caller can tell
 * a hit happened because body.x/y no longer match the move it made.
 */
export function resolveCollision(city, body, r, prevX, prevY) {
  if (blockedAt(city, body.x, body.y, r)) {
    if (!blockedAt(city, body.x, prevY, r)) body.y = prevY;
    else if (!blockedAt(city, prevX, body.y, r)) body.x = prevX;
    else { body.x = prevX; body.y = prevY; }
  }
  body.x = Math.max(r, Math.min(WORLD.width - r, body.x));
  body.y = Math.max(r, Math.min(WORLD.height - r, body.y));
}

/** A point on a random road (the centre of a lane), for spawning traffic. */
export function randomRoadPoint(rng, city) {
  const road = rng.pick(city.roads);
  if (road.axis === 'v') {
    return { x: road.at + (rng.chance(0.5) ? -ROAD.lane : ROAD.lane), y: rng.range(40, WORLD.height - 40), axis: 'v', at: road.at };
  }
  return { x: rng.range(40, WORLD.width - 40), y: road.at + (rng.chance(0.5) ? -ROAD.lane : ROAD.lane), axis: 'h', at: road.at };
}

/** The nearest road line of an axis to a coordinate. */
export function nearestRoadLine(axis, value) {
  const lines = axis === 'v' ? ROAD.avenues : ROAD.streets;
  let best = lines[0];
  for (const line of lines) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}
