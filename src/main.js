// Bootstraps the game.  Owns the fixed-timestep loop, builds players from
// the character roster, swaps controllers (human / AI), and forwards inputs
// each frame.

import { FRAME_MS, FPS, STAGE } from './constants.js';
import { CHARACTERS, CHARACTER_LIST } from './characters.js';
import { Player } from './player.js';
import { resolveCombat } from './combat.js';
import { AIController } from './ai.js';
import { Renderer } from './render.js';
import { Match } from './match.js';
import { BINDINGS, readInput, emptyInput, endInputFrame, isDown, wasPressed } from './input.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);

// --- Roster setup -----------------------------------------------------------

let p1Char = 'katana';
let p2Char = 'nodachi';

function makePlayer(charKey, isP1) {
  return new Player({
    id: isP1 ? 1 : 2,
    character: CHARACTERS[charKey],
    x: STAGE.width * (isP1 ? 0.30 : 0.70),
    facing: isP1 ? 1 : -1,
    isP1,
  });
}

let p1 = makePlayer(p1Char, true);
let p2 = makePlayer(p2Char, false);
let match = new Match(p1, p2);

// AI on/off per side (defaults: P1 human, P2 AI)
const aiOn = { p1: false, p2: true };
let ai1 = new AIController({ self: p1, opponent: p2 });
let ai2 = new AIController({ self: p2, opponent: p1 });

function rebuildPlayers() {
  const w1 = p1.roundsWon, w2 = p2.roundsWon;     // preserve match score
  p1 = makePlayer(p1Char, true);
  p2 = makePlayer(p2Char, false);
  p1.roundsWon = w1; p2.roundsWon = w2;
  ai1 = new AIController({ self: p1, opponent: p2 });
  ai2 = new AIController({ self: p2, opponent: p1 });
  match = new Match(p1, p2);
  match.p1.roundsWon = w1; match.p2.roundsWon = w2;
}

// --- Top-level shortcuts ----------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.code === 'F1') { renderer.debug = !renderer.debug; e.preventDefault(); }
  if (e.code === 'F2') { aiOn.p2 = !aiOn.p2; e.preventDefault(); }
  if (e.code === 'F3') { aiOn.p1 = !aiOn.p1; e.preventDefault(); }
  if (e.code === 'F5') { rebuildPlayers(); e.preventDefault(); }

  // Top-row 1-4 select P1 character; 5-8 select P2 character.
  const map = { Digit1:0, Digit2:1, Digit3:2, Digit4:3 };
  const map2 = { Digit5:0, Digit6:1, Digit7:2, Digit8:3 };
  if (map[e.code] !== undefined) {
    p1Char = CHARACTER_LIST[map[e.code]];
    rebuildPlayers();
  } else if (map2[e.code] !== undefined) {
    p2Char = CHARACTER_LIST[map2[e.code]];
    rebuildPlayers();
  }
});

// --- Fixed-timestep loop ----------------------------------------------------

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(now - last, 100);
  last = now;
  acc += dt;
  while (acc >= FRAME_MS) {
    tick();
    acc -= FRAME_MS;
  }
  renderer.draw({ p1, p2, match, aiOn });
  requestAnimationFrame(frame);
}

function tick() {
  const liveTick = match.preTick();

  if (liveTick) {
    const i1 = aiOn.p1 ? ai1.update() : readInput(BINDINGS.p1);
    const i2 = aiOn.p2 ? ai2.update() : readInput(BINDINGS.p2);

    p1.update(i1, p2.x);
    p2.update(i2, p1.x);
    resolveCombat(p1, p2);
    match.postTick();
  }
  endInputFrame();
}

requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
