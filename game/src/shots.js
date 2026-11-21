// The scripted screenshot scenes behind ?shot=start|drive|chase|mission.
// Each one sets the world to a moment of the real game, then steps the real
// simulation forward with a scripted driver (the same inputs a player would
// give), so the frame is what a short game really looks like and the same
// seed always gives the same frame.

import { CAR, MISSIONS, ROAD } from './config.js';
import { distance } from './random.js';

const SHOT_SECONDS = { start: 5, drive: 5, chase: 3, mission: 5 };

/** The road line nearest a coordinate. */
function nearestLine(lines, value) {
  let best = lines[0];
  for (const line of lines) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

/**
 * The next waypoint on the road grid toward a target: drive along the road
 * the car is on to the cross-street nearest the target, then along that one.
 * A car that steers straight at its target cuts across buildings; this one
 * drives like a player would, on the roads.
 */
function waypointFor(car, tx, ty) {
  const street = nearestLine(ROAD.streets, car.y);
  const avenue = nearestLine(ROAD.avenues, car.x);
  const targetAvenue = nearestLine(ROAD.avenues, tx);
  const targetStreet = nearestLine(ROAD.streets, ty);
  const onStreet = Math.abs(car.y - street) < 40;
  const onAvenue = Math.abs(car.x - avenue) < 40;
  if (onAvenue && Math.abs(car.x - targetAvenue) < 60) {
    // Already on the avenue that leads to the target: drive along it.
    return { x: car.x, y: targetStreet };
  }
  if (onStreet) {
    // On a street: drive along it to the avenue nearest the target.
    return { x: targetAvenue, y: street };
  }
  if (onAvenue) {
    // On an avenue: drive along it to the street nearest the target.
    return { x: avenue, y: targetStreet };
  }
  // Off the road (or at a crossroads): head for the intersection nearest the target.
  return { x: targetAvenue, y: targetStreet };
}

/** Keys that steer a car toward a point, from the car's own heading. */
function carKeys(car, tx, ty) {
  const keys = new Set();
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  // Ease off the gas for a sharp turn, so the car turns instead of sliding wide.
  if (Math.abs(diff) < 0.9) keys.add('KeyW');
  if (diff < -0.12) keys.add('KeyA');
  else if (diff > 0.12) keys.add('KeyD');
  return keys;
}

/** Keys that steer a car toward a target along the road grid. */
function driveKeys(car, tx, ty) {
  const wp = waypointFor(car, tx, ty);
  return carKeys(car, wp.x, wp.y);
}

/** Keys that walk the player toward a point. */
function walkKeys(player, tx, ty) {
  const keys = new Set();
  const dx = tx - player.x;
  const dy = ty - player.y;
  if (dy < -12) keys.add('KeyW');
  if (dy > 12) keys.add('KeyS');
  if (dx < -12) keys.add('KeyA');
  if (dx > 12) keys.add('KeyD');
  return keys;
}

/**
 * Set the world to the named scene and return how it plays: the screen to
 * draw, how long to step it, and a driver that makes the fake input for
 * each step. The caller steps the real simulation with that input.
 */
export function setupShot(name, state) {
  const lm = state.city.landmarks;
  const player = state.player;
  const garage = { x: lm.garage.x + lm.garage.w / 2, y: lm.garage.y + lm.garage.h / 2 };
  const hotel = { x: lm.hotel.x + lm.hotel.w / 2, y: lm.hotel.y + lm.hotel.h / 2 };

  if (name === 'drive') {
    // A taxi fare in progress: the passenger is in, the hotel is the drop-off.
    // The car starts at the west end of the street so the drive is still
    // under way when the frame is taken.
    const car = {
      x: 240, y: 1420, angle: 0, speed: 0, color: '#e5534b', kind: 'player',
      health: CAR.health, axis: 'h', at: 1420, dir: 1, lane: 24, turnCooldown: 0, cruise: 0, owned: true,
    };
    state.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = 0;
    state.fare = {
      stage: 'deliver',
      pickup: { x: 720, y: 1420, label: 'Fare waiting' },
      drop: { x: hotel.x, y: hotel.y, label: 'Fare destination' },
      timer: 60,
      pay: 120,
    };
    const target = state.fare.drop;
    return {
      screen: 'play',
      seconds: SHOT_SECONDS.drive,
      driver() {
        return { keys: driveKeys(player.inCar, target.x, target.y), mouseX: 640, mouseY: 360, mouseDown: false };
      },
    };
  }

  if (name === 'chase') {
    // The Great Getaway at full heat: five stars, five police cars on the tail.
    const car = {
      x: 720, y: 1020, angle: 0, speed: 420, color: '#e5534b', kind: 'player',
      health: CAR.health, axis: 'h', at: 1020, dir: 1, lane: 24, turnCooldown: 0, cruise: 0, owned: true,
    };
    state.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = 0;
    state.wanted = 5;
    state.wantedTimer = 0;
    // The getaway's destination is the road corner by the airfield, so the
    // drive stays on the roads instead of cutting across the blocks.
    state.mission = {
      id: 2, name: 'The Great Getaway', stage: 'deliver',
      timer: MISSIONS.getaway, reward: MISSIONS.rewards[2],
      target: { x: 240, y: 220, label: 'Reach the airfield' },
      dest: null,
    };
    const target = state.mission.target;
    return {
      screen: 'play',
      seconds: SHOT_SECONDS.chase,
      driver() {
        // Weave a little so the chase reads on the frame.
        const weave = Math.sin(state.time * 1.4) * 260;
        return { keys: driveKeys(player.inCar, target.x + weave, target.y), mouseX: 640, mouseY: 360, mouseDown: false };
      },
    };
  }

  if (name === 'mission') {
    // The Marina Pickup on foot: the package is on the pier, thugs closing in.
    player.x = lm.marina.x - 160;
    player.y = lm.marina.y + lm.marina.h / 2;
    player.angle = 0;
    player.inCar = null;
    state.mission = {
      id: 1, name: 'The Marina Pickup', stage: 'pickup',
      timer: MISSIONS.marinaPickup, reward: MISSIONS.rewards[1],
      target: { x: lm.marina.x + 40, y: lm.marina.y + lm.marina.h - 30, label: 'Grab the package' },
      dest: { x: lm.safehouse.x + lm.safehouse.w / 2, y: lm.safehouse.y + lm.safehouse.h / 2, label: 'Deliver to the safehouse' },
    };
    const spots = [
      [player.x + 220, player.y - 140],
      [player.x + 260, player.y + 120],
      [player.x + 120, player.y + 200],
    ];
    for (const [tx, ty] of spots) {
      state.thugs.push({ x: tx, y: ty, angle: 0, health: 60, fireCooldown: 1, state: 'hunt' });
    }
    const target = state.mission.target;
    return {
      screen: 'play',
      seconds: SHOT_SECONDS.mission,
      driver() {
        const d = distance(player.x, player.y, target.x, target.y);
        const keys = d > 40 ? walkKeys(player, target.x, target.y) : new Set();
        return { keys, mouseX: 640, mouseY: 360, mouseDown: false };
      },
    };
  }

  // start: the title screen over a living city, the player by the garage.
  player.x = garage.x;
  player.y = garage.y + 120;
  player.angle = -Math.PI / 2;
  player.inCar = null;
  return {
    screen: 'title',
    seconds: SHOT_SECONDS.start,
    driver() {
      return { keys: new Set(), mouseX: 640, mouseY: 360, mouseDown: false };
    },
  };
}

/** How many seconds a scene steps for. */
export function shotSeconds(name) {
  return SHOT_SECONDS[name] || SHOT_SECONDS.start;
}
