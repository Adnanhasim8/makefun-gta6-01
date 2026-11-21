// Every tuning number, colour and key in one place. Solmar City is a fixed
// 3400 x 2600 world; the renderer shows a 1280 x 720 window of it through a
// camera that follows the player, so no rule below depends on the screen size.

export const WORLD = { width: 3400, height: 2600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The logical window the renderer scales to the canvas. */
export const VIEW = { width: 1280, height: 720 };

export const ROAD = {
  width: 96,
  lane: 24,
  // Vertical avenues (x) and horizontal streets (y) of the grid.
  avenues: [240, 720, 1200, 1680, 2160, 2640, 3120],
  streets: [220, 620, 1020, 1420, 1820, 2220],
};

export const PLAYER = {
  radius: 14,
  walk: 170,
  run: 300,
  health: 100,
  // Pistol: damage per hit, shots a second, bullet speed, range.
  damage: 34,
  fireRate: 4,
  bulletSpeed: 900,
  range: 520,
};

export const CAR = {
  width: 44,
  length: 78,
  accel: 520,
  brake: 700,
  reverse: 260,
  maxSpeed: 560,
  maxReverse: 160,
  turn: 2.6,
  grip: 6.0,
  health: 100,
};

export const TRAFFIC = { count: 22, cruise: 150, cruiseJitter: 60 };

export const PEDS = { count: 46, walk: 55, flee: 190 };

export const POLICE = {
  // Wanted 0-5: how many police cars and foot officers are out, and how fast they are.
  cars: [0, 1, 2, 3, 4, 5],
  officers: [0, 0, 1, 2, 3, 4],
  carSpeed: 600,
  officerSpeed: 240,
  // Seconds an officer must stay touching the player on foot to bust them.
  bustTime: 1.5,
  // Seconds with no police seeing the player before the wanted level drops one star.
  decaySeconds: 14,
  sight: 700,
};

export const THUG = { health: 60, speed: 150, damage: 9, fireRate: 0.8, range: 420 };

export const PICKUPS = { cash: 14, health: 8, cashValue: 25, heal: 40 };

export const FARE = { pay: 120, bonusPerSecond: 2, radius: 60 };

export const MISSIONS = {
  // Seconds allowed for each story mission.
  firstFare: 75,
  marinaPickup: 120,
  getaway: 90,
  rewards: [250, 400, 600],
};

export const PALETTE = {
  sea: '#2e7fa8',
  deepSea: '#256b8f',
  sand: '#e8d8a0',
  ground: '#c9bfa5',
  sidewalk: '#b3a88d',
  road: '#3a3f4a',
  roadEdge: '#2c3038',
  lane: '#e8d44d',
  park: '#5da24a',
  parkDark: '#4a8a3c',
  tree: '#2f6b2a',
  building: '#d8c9a8',
  roof: '#8a6f5c',
  roofAlt: '#7a5a48',
  glass: '#7fb8d8',
  player: '#ffcf3d',
  playerCar: '#e5534b',
  police: '#2f6fd8',
  policeLight: '#ff3b30',
  thug: '#8a2f8a',
  text: '#f4f1e6',
  muted: '#c9c2ae',
  panel: 'rgba(16, 20, 28, 0.78)',
  panelEdge: 'rgba(244, 241, 230, 0.25)',
  star: '#ffd23d',
  starEmpty: '#6b6558',
  health: '#57d977',
  healthLow: '#e5534b',
  marker: '#ffd23d',
  cash: '#7ee787',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-city.save.v1';

/** The four scripted screenshot scenes and the query that stages each. */
export const SHOTS = ['start', 'drive', 'chase', 'mission'];
