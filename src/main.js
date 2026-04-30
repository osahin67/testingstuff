// Game bootstrap.
//
// Startup order:
//   1. Show loading screen on canvas.
//   2. Async-load sprite sheets for all characters.
//   3. Build AnimationControllers (one per player).
//   4. Start fixed-timestep game loop.
//
// AnimationController instances live here (not inside Player) because
// animation is a rendering concern — Player stays pure combat logic.
// Controllers are passed into renderer.draw() each frame.

import { FRAME_MS, STAGE } from './constants.js';
import { CHARACTERS, CHARACTER_LIST } from './characters.js';
import { Player }          from './player.js';
import { resolveCombat }   from './combat.js';
import { AIController }    from './ai.js';
import { Renderer }        from './render.js';
import { Match }           from './match.js';
import { SpriteAnimation, AnimationController } from './animation.js';
import { loadCharacterSprites }                 from './sprite_loader.js';
import { BINDINGS, readInput, endInputFrame }   from './input.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);

// ── Loading screen ───────────────────────────────────────────────────────────

function drawLoading(ctx, msg = 'Loading sprites…') {
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  ctx.fillStyle = '#f4c062';
  ctx.font = 'bold 24px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(msg, STAGE.width / 2, STAGE.height / 2);
}

// ── Sprite / controller building ────────────────────────────────────────────

// Cache of loaded images keyed by basePath, shared across characters that
// use the same sprite config.
const imageCache = new Map();

async function loadSpritesForChar(char) {
  const cfg = char.sprites;
  const cacheKey = cfg.basePath + JSON.stringify(Object.keys(cfg.animations));
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
  const images = await loadCharacterSprites(cfg);
  imageCache.set(cacheKey, images);
  return images;
}

/**
 * Build a fresh AnimationController for a character using pre-loaded images.
 * Each controller gets its own SpriteAnimation instances so state is independent
 * between P1 and P2 even when they share the same sprite sheets.
 */
function buildController(char, images) {
  const cfg = char.sprites;
  const anims = {};
  for (const [key, def] of Object.entries(cfg.animations)) {
    anims[key] = new SpriteAnimation({
      image:      images[key] ?? null,
      frameCount: def.frameCount,
      fps:        def.fps,
      loop:       def.loop,
    });
  }
  return new AnimationController(anims, {
    scale:       cfg.scale,
    footRatio:   cfg.footRatio,
    attackSync:  cfg.attackSync,
  });
}

// ── Player / AI factories ────────────────────────────────────────────────────

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

const aiOn = { p1: false, p2: true };
let ai1 = new AIController({ self: p1, opponent: p2 });
let ai2 = new AIController({ self: p2, opponent: p1 });

// AnimationControllers — populated once sprites load, null until then.
let ac1 = null;
let ac2 = null;

// Images keyed by character id — built during async init.
const charImages = {};

async function buildControllersForCurrentChars() {
  // Load (or retrieve from cache) images for both characters.
  const [img1, img2] = await Promise.all([
    loadSpritesForChar(CHARACTERS[p1Char]),
    loadSpritesForChar(CHARACTERS[p2Char]),
  ]);
  charImages[p1Char] = img1;
  charImages[p2Char] = img2;
  ac1 = buildController(CHARACTERS[p1Char], img1);
  ac2 = buildController(CHARACTERS[p2Char], img2);
}

function rebuildPlayers() {
  const w1 = p1.roundsWon, w2 = p2.roundsWon;
  p1 = makePlayer(p1Char, true);
  p2 = makePlayer(p2Char, false);
  p1.roundsWon = w1; p2.roundsWon = w2;
  ai1 = new AIController({ self: p1, opponent: p2 });
  ai2 = new AIController({ self: p2, opponent: p1 });
  match = new Match(p1, p2);
  match.p1.roundsWon = w1; match.p2.roundsWon = w2;

  // Rebuild controllers if images are already loaded for these chars.
  if (charImages[p1Char]) ac1 = buildController(CHARACTERS[p1Char], charImages[p1Char]);
  if (charImages[p2Char]) ac2 = buildController(CHARACTERS[p2Char], charImages[p2Char]);

  // Load any new character's sprites in the background.
  buildControllersForCurrentChars().catch(() => {});
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.code === 'F1') { renderer.debug = !renderer.debug; e.preventDefault(); return; }
  if (e.code === 'F2') { aiOn.p2 = !aiOn.p2; e.preventDefault(); return; }
  if (e.code === 'F3') { aiOn.p1 = !aiOn.p1; e.preventDefault(); return; }
  if (e.code === 'F5') { rebuildPlayers(); e.preventDefault(); return; }

  const map1 = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
  const map2 = { Digit5: 0, Digit6: 1, Digit7: 2, Digit8: 3 };
  if (map1[e.code] !== undefined) {
    p1Char = CHARACTER_LIST[map1[e.code]]; rebuildPlayers();
  } else if (map2[e.code] !== undefined) {
    p2Char = CHARACTER_LIST[map2[e.code]]; rebuildPlayers();
  }
});

// ── Fixed-timestep loop ──────────────────────────────────────────────────────

let last = 0;
let acc  = 0;

function frame(now) {
  const dt = Math.min(now - last, 100);
  last = now;
  acc += dt;
  while (acc >= FRAME_MS) {
    tick();
    acc -= FRAME_MS;
  }
  renderer.draw({ p1, p2, match, aiOn, ac1, ac2 });
  requestAnimationFrame(frame);
}

function tick() {
  const live = match.preTick();
  if (live) {
    const i1 = aiOn.p1 ? ai1.update() : readInput(BINDINGS.p1);
    const i2 = aiOn.p2 ? ai2.update() : readInput(BINDINGS.p2);
    p1.update(i1, p2.x);
    p2.update(i2, p1.x);
    resolveCombat(p1, p2);
    match.postTick();
  }
  endInputFrame();
}

// ── Async init ───────────────────────────────────────────────────────────────

async function init() {
  drawLoading(renderer.ctx);
  try {
    await buildControllersForCurrentChars();
    const loaded = Object.values(charImages[p1Char]).filter(Boolean).length;
    if (loaded === 0) drawLoading(renderer.ctx, 'No sprites found — using rectangles');
  } catch (err) {
    console.warn('Sprite loading failed:', err);
  }
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
}

init();
