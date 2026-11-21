// Saving and loading: cash, health, missions finished and where the player
// stands, kept in localStorage between visits. A save never carries the
// wanted level (the player always starts clean).

import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      health: typeof data.health === 'number' ? data.health : 100,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone.map(Boolean) : [false, false, false],
      x: typeof data.x === 'number' ? data.x : null,
      y: typeof data.y === 'number' ? data.y : null,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.floor(state.player.cash),
      health: Math.round(state.player.health),
      missionsDone: state.missionsDone,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
