// save.js — progress saved to localStorage, so a run survives a reload.
// Only game numbers are stored (money, missions, position): no personal data.

const KEY = 'sunset-bay-save-v1';

/** Load a save, or null when there is none. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 120,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      taxiFares: typeof data.taxiFares === 'number' ? data.taxiFares : 0,
      playerX: typeof data.playerX === 'number' ? data.playerX : null,
      playerY: typeof data.playerY === 'number' ? data.playerY : null,
    };
  } catch {
    return null;
  }
}

/** Write the current progress. */
export function writeSave(game) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: Math.round(game.player.money),
      missionsDone: game.missions.done,
      taxiFares: game.stats.taxiFares,
      playerX: Math.round(game.player.x),
      playerY: Math.round(game.player.y),
    }));
  } catch {
    // Storage may be unavailable (private mode): the game still plays.
  }
}

/** Delete the save (New Game). */
export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
