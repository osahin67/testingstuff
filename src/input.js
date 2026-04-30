// Keyboard input manager.
// We poll a single shared key map; each Player asks for its bindings each frame.
// "pressed" returns true exactly once per physical key-down (edge-triggered).

const down = new Set();
const justPressed = new Set();
const consumed = new Set();

window.addEventListener('keydown', (e) => {
  if (!down.has(e.code)) justPressed.add(e.code);
  down.add(e.code);
  // prevent page scrolling on arrow/space
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  down.delete(e.code);
  consumed.delete(e.code);
});
window.addEventListener('blur', () => { down.clear(); justPressed.clear(); consumed.clear(); });

// Call once at end of each frame to clear edge-triggered state.
export function endInputFrame() {
  justPressed.clear();
}

export function isDown(code) { return down.has(code); }
export function wasPressed(code) {
  // edge-triggered: true exactly on the frame the key was first registered
  return justPressed.has(code);
}

export const BINDINGS = {
  p1: {
    left:  'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    dash:  'ShiftLeft',
    light: 'KeyJ', medium: 'KeyK', heavy: 'KeyL',
  },
  p2: {
    left:  'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    dash:  'Slash',
    light: 'Numpad1', medium: 'Numpad2', heavy: 'Numpad3',
  },
};

// Given a binding map, return an InputState object describing held + pressed.
export function readInput(map) {
  return {
    left:    isDown(map.left),
    right:   isDown(map.right),
    up:      isDown(map.up),
    down:    isDown(map.down),
    dash:    isDown(map.dash),
    dashEdge:isDown(map.dash) && wasPressed(map.dash),
    light:   wasPressed(map.light),
    medium:  wasPressed(map.medium),
    heavy:   wasPressed(map.heavy),
    upEdge:  wasPressed(map.up),
  };
}

// AI / scripted players synthesize an input object directly — they bypass the
// keyboard layer but use the same data shape so Player code is agnostic.
export function emptyInput() {
  return {
    left:false, right:false, up:false, down:false,
    dash:false, dashEdge:false,
    light:false, medium:false, heavy:false, upEdge:false,
  };
}
