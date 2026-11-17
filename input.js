// Keyboard and mouse, read once a frame. Movement keys, the aim point, firing, dash,
// pause, mute and the confirm key are all plain state the world and the screens read.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_DASH = 'dash';

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 640, y: 360, down: false, clicked: false, clickX: 0, clickY: 0 };
  let digit = 0;

  function keyPos(event) {
    return MOVE_KEYS[event.code] ?? null;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      pressed.add(event.code);
      if (event.code === 'Space') pressed.add(ACTION_DASH);
      if (event.code === 'Enter') pressed.add(ACTION_CONFIRM);
      if (event.code === 'KeyP' || event.code === 'Escape') pressed.add(ACTION_PAUSE);
      if (event.code === 'KeyM') pressed.add(ACTION_MUTE);
      if (event.code.startsWith('Digit')) digit = Number(event.code.slice(5));
    }
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 720;
  }
  canvas.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('mousedown', (event) => {
    updateMouse(event);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
    if (event.button === 2) pressed.add(ACTION_DASH);
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised move vector from the held movement keys. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    get firing() { return mouse.down || keys.has('Space'); },
    get aim() { return { x: mouse.x, y: mouse.y }; },
    /** True once for a key pressed since the last frame; the frame's caller clears it. */
    wasPressed(action) { return pressed.has(action); },
    /** The digit key (1-9) pressed since the last frame, else 0. */
    takeDigit() { const d = digit; digit = 0; return d; },
    /** The last mouse click in logical coordinates, else null. */
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    endFrame() { pressed.clear(); },
  };
}
