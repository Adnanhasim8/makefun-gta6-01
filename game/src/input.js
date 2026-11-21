// Keyboard and mouse: the held keys, the mouse position in world space, and
// the one-shot actions (confirm, pause, interact, horn, restart, mute).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_HORN = 8;
export const ACTION_RESTART = 16;
export const ACTION_MUTE = 32;

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
    actions: 0,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') state.actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP') state.actions |= ACTION_PAUSE;
    if (event.code === 'KeyE') state.actions |= ACTION_INTERACT;
    if (event.code === 'KeyH') state.actions |= ACTION_HORN;
    if (event.code === 'KeyR') state.actions |= ACTION_RESTART;
    if (event.code === 'KeyM') state.actions |= ACTION_MUTE;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = event.clientX - rect.left;
    state.mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    state.mouseDown = true;
    state.clicked = true;
  }
  function onMouseUp() {
    state.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return state;
}

/** The movement direction from the held keys, as a unit vector (or 0, 0). */
export function moveVector(input) {
  let x = 0;
  let y = 0;
  for (const code of input.keys) {
    const dir = MOVE_KEYS[code];
    if (dir === 'up') y -= 1;
    else if (dir === 'down') y += 1;
    else if (dir === 'left') x -= 1;
    else if (dir === 'right') x += 1;
  }
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const len = Math.sqrt(x * x + y * y);
  return { x: x / len, y: y / len };
}

export function isRunning(input) {
  return input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
}

export function isBraking(input) {
  return input.keys.has('Space');
}

/** Take and clear the one-shot actions queued since the last call. */
export function takeActions(input) {
  const actions = input.actions;
  input.actions = 0;
  return actions;
}

/** Take and clear the mouse click queued since the last call. */
export function takeClick(input) {
  const clicked = input.clicked;
  input.clicked = false;
  return clicked;
}
