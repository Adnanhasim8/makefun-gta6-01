// The story and the fares: three timed missions for fixer Lena Torres, in
// order, plus the taxi fares that pay between missions. A mission starts
// when the player presses E at its start marker; the HUD and the minimap
// always point at the current objective.

import { FARE, MISSIONS } from './config.js';
import { randomRoadPoint } from './city.js';
import { distance } from './random.js';
import { spawnThug } from './combat.js';
import { playMissionStart, playMissionDone, playMissionFail, playCash } from './audio.js';

const NAMES = ['First Fare', 'The Marina Pickup', 'The Great Getaway'];

/** The next mission the player has not finished (0, 1, 2) or null when all are done. */
export function nextMissionIndex(state) {
  for (let i = 0; i < 3; i += 1) {
    if (!state.missionsDone[i]) return i;
  }
  return null;
}

/** Where the next mission starts (and its name), or null when the story is done. */
export function missionStartPoint(state) {
  const index = nextMissionIndex(state);
  if (index === null) return null;
  const lm = state.city.landmarks;
  if (index === 0) return { x: lm.garage.x + lm.garage.w / 2, y: lm.garage.y + lm.garage.h / 2, label: `Lena Torres — ${NAMES[0]}` };
  if (index === 1) return { x: lm.marina.x + lm.marina.w / 2, y: lm.marina.y + lm.marina.h / 2, label: `Lena Torres — ${NAMES[1]}` };
  return { x: lm.garage.x + lm.garage.w / 2, y: lm.garage.y + lm.garage.h / 2, label: `Lena Torres — ${NAMES[2]}` };
}

/** Try to start the next mission (E at its start marker). Returns true when one starts. */
export function tryStartMission(state) {
  if (state.mission) return false;
  const start = missionStartPoint(state);
  if (!start) return false;
  if (distance(state.player.x, state.player.y, start.x, start.y) > 90) return false;
  const index = nextMissionIndex(state);
  const lm = state.city.landmarks;
  if (index === 0) {
    const pickup = randomRoadPoint(state.rng, state.city);
    state.mission = {
      id: 0, name: NAMES[0], stage: 'pickup',
      timer: MISSIONS.firstFare, reward: MISSIONS.rewards[0],
      target: { x: pickup.x, y: pickup.y, label: 'Pick up the fare' },
      dest: { x: lm.hotel.x + lm.hotel.w / 2, y: lm.hotel.y + lm.hotel.h / 2, label: 'Drop off at the hotel' },
    };
  } else if (index === 1) {
    state.mission = {
      id: 1, name: NAMES[1], stage: 'pickup',
      timer: MISSIONS.marinaPickup, reward: MISSIONS.rewards[1],
      target: { x: lm.marina.x + 40, y: lm.marina.y + lm.marina.h - 30, label: 'Grab the package' },
      dest: { x: lm.safehouse.x + lm.safehouse.w / 2, y: lm.safehouse.y + lm.safehouse.h / 2, label: 'Deliver to the safehouse' },
    };
  } else {
    state.mission = {
      id: 2, name: NAMES[2], stage: 'deliver',
      timer: MISSIONS.getaway, reward: MISSIONS.rewards[2],
      target: { x: lm.airfield.x + lm.airfield.w / 2, y: lm.airfield.y + lm.airfield.h / 2, label: 'Reach the airfield' },
      dest: null,
    };
    // The getaway starts hot: the police are already on the player.
    state.wanted = Math.max(state.wanted, 3);
    state.wantedTimer = 0;
  }
  state.events.push({ type: 'missionStart', name: NAMES[index] });
  playMissionStart();
  return true;
}

function completeMission(state) {
  const mission = state.mission;
  state.player.cash += mission.reward;
  state.missionsDone[mission.id] = true;
  state.events.push({ type: 'missionDone', name: mission.name, amount: mission.reward });
  playMissionDone();
  state.mission = null;
}

function failMission(state, why) {
  const mission = state.mission;
  state.events.push({ type: 'missionFail', name: mission.name, why });
  playMissionFail();
  state.mission = null;
}

/** Advance the active mission one step (timer, stages, thugs, completion). */
export function updateMission(state, dt) {
  const mission = state.mission;
  if (!mission) return;
  mission.timer -= dt;
  if (mission.timer <= 0) {
    failMission(state, 'Out of time');
    return;
  }
  const player = state.player;
  if (mission.stage === 'pickup') {
    if (distance(player.x, player.y, mission.target.x, mission.target.y) < 60) {
      if (mission.id === 0) {
        // First Fare: the passenger is in — now drive them to the hotel.
        mission.stage = 'deliver';
        mission.target = mission.dest;
        state.events.push({ type: 'missionStage', name: mission.name, label: 'Passenger in — drive to the hotel' });
      } else if (mission.id === 1) {
        // Marina Pickup: the package is grabbed — thugs move in, run for the safehouse.
        mission.stage = 'deliver';
        mission.target = mission.dest;
        for (let i = 0; i < 3; i += 1) {
          spawnThug(state, player.x + 160 + i * 70, player.y - 120 + i * 60);
        }
        state.events.push({ type: 'missionStage', name: mission.name, label: 'Package grabbed — thugs incoming, run!' });
      }
    }
  } else if (mission.stage === 'deliver') {
    if (distance(player.x, player.y, mission.target.x, mission.target.y) < 70) {
      completeMission(state);
    }
  }
}

/** The current objective marker for the HUD and the minimap (mission, fare, or start point). */
export function missionTarget(state) {
  if (state.mission) return state.mission.target;
  if (state.fare) return state.fare.stage === 'pickup' ? state.fare.pickup : state.fare.drop;
  const start = missionStartPoint(state);
  if (start) return { x: start.x, y: start.y, label: start.label };
  return null;
}

/** Taxi fares: one at a time, only while driving and with no mission running. */
export function updateFare(state, dt) {
  const player = state.player;
  if (!state.fare) {
    if (!state.mission && player.inCar) {
      state.fareDelay = (state.fareDelay || 4) - dt;
      if (state.fareDelay <= 0) {
        const pickup = randomRoadPoint(state.rng, state.city);
        const drop = randomRoadPoint(state.rng, state.city);
        const dist = distance(pickup.x, pickup.y, drop.x, drop.y);
        state.fare = {
          stage: 'pickup',
          pickup: { x: pickup.x, y: pickup.y, label: 'Fare waiting' },
          drop: { x: drop.x, y: drop.y, label: 'Fare destination' },
          timer: 30 + dist / 22,
          pay: FARE.pay,
        };
      }
    }
    return;
  }
  const fare = state.fare;
  fare.timer -= dt;
  if (fare.timer <= 0) {
    state.fare = null;
    state.fareDelay = 6;
    state.events.push({ type: 'fareFail' });
    return;
  }
  if (!player.inCar) {
    // Out of the car with a fare waiting: the passenger walks off after a while.
    fare.timer -= dt * 0.5;
    return;
  }
  if (fare.stage === 'pickup' && distance(player.x, player.y, fare.pickup.x, fare.pickup.y) < FARE.radius) {
    fare.stage = 'deliver';
    state.events.push({ type: 'fareStage', label: 'Passenger in — drive to the marker' });
    playCash();
  } else if (fare.stage === 'deliver' && distance(player.x, player.y, fare.drop.x, fare.drop.y) < FARE.radius) {
    const bonus = Math.floor(fare.timer * FARE.bonusPerSecond);
    player.cash += fare.pay + bonus;
    state.events.push({ type: 'fareDone', amount: fare.pay + bonus });
    playCash();
    state.fare = null;
    state.fareDelay = 5;
  }
}
