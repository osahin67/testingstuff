// Character / weapon definitions.
//
// Each attack is described in FRAMES (60fps) and uses a relative hitbox layout:
//   hitbox: { x, y, w, h }   — relative to the character's body anchor (feet center)
//                              with +x facing forward.  y grows DOWNWARDS from feet.
// Attacks resolve in three phases: startup → active → recovery.
// `height` is one of: 'high' (overhead, must stand-block),
//                     'mid'  (either block works),
//                     'low'  (must crouch-block).
//
// Frame-advantage is implicit: blockstun and hitstun on the defender combined
// with the attacker's recovery determine punish windows — there are no
// hand-authored "cancels" or canned combos.

const baseAttack = {
  startup: 6, active: 3, recovery: 10,
  damage: 6, hitstun: 14, blockstun: 10,
  pushback: 4, height: 'mid',
  hitbox: { x: 40, y: -70, w: 60, h: 22 },
};

function mk(o) { return Object.assign({}, baseAttack, o); }

// Weapon archetypes.  All values are intentionally distinct to make spacing
// and pacing the differentiator (per the design doc — no powers/projectiles).

export const CHARACTERS = {
  katana: {
    id: 'katana',
    name: 'Katana — Balanced',
    color: '#d8d4c2',
    weaponColor: '#cfd6e6',
    walkSpeed: 3.0, backSpeed: 2.4, jumpVel: -13.5, dashSpeed: 6.5, dashFrames: 12,
    maxHP: 100,
    attacks: {
      // Standing
      light:  mk({ startup: 5,  active: 3, recovery: 9,  damage: 6,  hitbox:{x:38, y:-78, w:60, h:18}, range:90 }),
      medium: mk({ startup: 9,  active: 4, recovery: 15, damage: 11, hitstun:18, blockstun:12,
                   hitbox:{x:42, y:-72, w:78, h:22}, range:115, pushback:6 }),
      heavy:  mk({ startup: 15, active: 5, recovery: 24, damage: 19, hitstun:24, blockstun:16,
                   hitbox:{x:46, y:-66, w:96, h:28}, range:135, pushback:9 }),
      // Crouching
      cLight: mk({ startup: 5, active: 3, recovery: 11, damage: 5, height:'low',
                   hitbox:{x:36, y:-26, w:62, h:20}, range:90 }),
      cHeavy: mk({ startup: 12, active: 5, recovery: 22, damage: 14, hitstun:22, blockstun:14, height:'low',
                   hitbox:{x:42, y:-22, w:90, h:22}, range:130, pushback:7 }),
      // Jumping (overhead)
      jLight: mk({ startup: 4, active: 6, recovery: 10, damage: 7, height:'high',
                   hitbox:{x:24, y:-90, w:60, h:36}, range:80 }),
      jHeavy: mk({ startup: 8, active: 5, recovery: 14, damage: 14, height:'high', hitstun:22,
                   hitbox:{x:30, y:-86, w:80, h:42}, range:100, pushback:6 }),
    },
  },

  nodachi: {
    id: 'nodachi',
    name: 'Nodachi — Heavy / Long',
    color: '#b8a280',
    weaponColor: '#e6d8a8',
    walkSpeed: 2.2, backSpeed: 1.8, jumpVel: -12.5, dashSpeed: 5.0, dashFrames: 14,
    maxHP: 110,
    attacks: {
      light:  mk({ startup: 9,  active: 4, recovery: 15, damage: 9,  hitstun:18,
                   hitbox:{x:46, y:-78, w:90,  h:22}, range:135 }),
      medium: mk({ startup: 14, active: 5, recovery: 22, damage: 14, hitstun:22, blockstun:14,
                   hitbox:{x:50, y:-72, w:108, h:26}, range:160, pushback:8 }),
      heavy:  mk({ startup: 22, active: 7, recovery: 32, damage: 26, hitstun:30, blockstun:18,
                   hitbox:{x:54, y:-64, w:130, h:32}, range:185, pushback:12 }),
      cLight: mk({ startup: 9, active: 4, recovery: 18, damage: 8, height:'low',
                   hitbox:{x:42, y:-22, w:92, h:22}, range:135 }),
      cHeavy: mk({ startup: 18, active: 6, recovery: 28, damage: 18, hitstun:26, blockstun:14, height:'low',
                   hitbox:{x:48, y:-20, w:120, h:24}, range:170, pushback:9 }),
      jLight: mk({ startup: 7, active: 6, recovery: 14, damage: 10, height:'high',
                   hitbox:{x:30, y:-92, w:78, h:38}, range:108 }),
      jHeavy: mk({ startup:12, active: 5, recovery: 18, damage: 18, height:'high', hitstun:26,
                   hitbox:{x:34, y:-88, w:96, h:46}, range:128, pushback:7 }),
    },
  },

  wakizashi: {
    id: 'wakizashi',
    name: 'Wakizashi — Fast / Short',
    color: '#c4d4d6',
    weaponColor: '#dcd0a4',
    walkSpeed: 3.8, backSpeed: 3.0, jumpVel: -13.0, dashSpeed: 7.5, dashFrames: 10,
    maxHP: 90,
    attacks: {
      light:  mk({ startup: 3, active: 2, recovery: 6,  damage: 4, hitstun:11, blockstun:8,
                   hitbox:{x:32, y:-78, w:46, h:18}, range:70 }),
      medium: mk({ startup: 6, active: 3, recovery: 11, damage: 7, hitstun:14, blockstun:10,
                   hitbox:{x:36, y:-74, w:58, h:20}, range:84, pushback:4 }),
      heavy:  mk({ startup:11, active: 4, recovery: 17, damage: 13, hitstun:20, blockstun:13,
                   hitbox:{x:38, y:-70, w:70, h:24}, range:96, pushback:6 }),
      cLight: mk({ startup: 4, active: 2, recovery: 8, damage: 4, height:'low',
                   hitbox:{x:30, y:-26, w:48, h:18}, range:70 }),
      cHeavy: mk({ startup: 9, active: 4, recovery: 16, damage: 10, hitstun:18, blockstun:11, height:'low',
                   hitbox:{x:36, y:-22, w:62, h:20}, range:92, pushback:5 }),
      jLight: mk({ startup: 3, active: 5, recovery:  8, damage: 5, height:'high',
                   hitbox:{x:22, y:-90, w:50, h:32}, range:64 }),
      jHeavy: mk({ startup: 6, active: 4, recovery: 11, damage: 10, height:'high', hitstun:18,
                   hitbox:{x:26, y:-86, w:60, h:36}, range:78, pushback:5 }),
    },
  },

  yari: {
    id: 'yari',
    name: 'Yari — Spear / Zoner',
    color: '#a89878',
    weaponColor: '#e8e0c8',
    walkSpeed: 2.5, backSpeed: 2.0, jumpVel: -12.5, dashSpeed: 5.5, dashFrames: 13,
    maxHP: 95,
    attacks: {
      light:  mk({ startup: 7, active: 3, recovery: 13, damage: 7, hitstun:15,
                   hitbox:{x:60, y:-78, w:110, h:18}, range:160 }),
      medium: mk({ startup:11, active: 4, recovery: 19, damage: 11, hitstun:18, blockstun:12,
                   hitbox:{x:66, y:-74, w:130, h:20}, range:185, pushback:7 }),
      heavy:  mk({ startup:18, active: 6, recovery: 30, damage: 20, hitstun:26, blockstun:16,
                   hitbox:{x:70, y:-70, w:160, h:24}, range:215, pushback:10 }),
      cLight: mk({ startup: 8, active: 3, recovery: 15, damage: 7, height:'low',
                   hitbox:{x:58, y:-22, w:108, h:18}, range:160 }),
      cHeavy: mk({ startup:15, active: 5, recovery: 26, damage: 14, hitstun:22, blockstun:13, height:'low',
                   hitbox:{x:64, y:-20, w:140, h:20}, range:190, pushback:8 }),
      jLight: mk({ startup: 6, active: 6, recovery: 12, damage: 8, height:'high',
                   hitbox:{x:36, y:-90, w:90, h:30}, range:120 }),
      jHeavy: mk({ startup:10, active: 5, recovery: 17, damage: 14, height:'high', hitstun:22,
                   hitbox:{x:40, y:-86, w:110, h:36}, range:140, pushback:6 }),
    },
  },
};

export const CHARACTER_LIST = ['katana', 'nodachi', 'wakizashi', 'yari'];

// ─── Sprite configuration ────────────────────────────────────────────────────
//
// All four characters share one sprite set (the samurai sheets you provided).
// Drop your five PNGs into the sprites/ folder and the game will pick them up.
// Each character can override `sprites` with its own config later.
//
// attackSync maps each attack anim-state to a sprite-frame band split.
// The numbers are SPRITE frame counts, not game frame counts:
//   startup + active + recovery must equal the clip's total frameCount.
//
//   attack1 (6 frames):  0-1 startup | 2-3 ACTIVE (hitbox live) | 4-5 recovery
//   attack2 (6 frames):  0-1 startup | 2-3 ACTIVE               | 4-5 recovery
//
// footRatio: 0–1, where in the frame the character's feet sit.
//   1.0 = very bottom pixel.  Use ~0.85–0.95 if the sheet has a ground shadow.
//
// scale: uniform draw scale applied to every clip.
//   Tune this until the sprite visually matches the hitbox size on screen.
//   At 1.0 the sprite is drawn at its native pixel size.

export const DEFAULT_SPRITES = {
  basePath: 'sprites/',
  scale: 1.0,        // ← tune me: increase until the character fills the hitbox area
  footRatio: 0.92,   // ← tune me: lower if there's padding at the bottom of frames

  animations: {
    idle:    { file: 'idle.png',    frameCount: 6, fps: 8,  loop: true  },
    attack1: { file: 'attack1.png', frameCount: 6, fps: 60, loop: false }, // fps ignored — combat drives frames
    attack2: { file: 'attack2.png', frameCount: 6, fps: 60, loop: false },
    fall:    { file: 'fall.png',    frameCount: 2, fps: 5,  loop: true  },
    death:   { file: 'death.png',   frameCount: 8, fps: 10, loop: false },
  },

  // How many sprite frames belong to each attack phase.
  attackSync: {
    attack1: { startup: 2, active: 2, recovery: 2 },
    attack2: { startup: 2, active: 2, recovery: 2 },
  },
};

// Attach shared sprite config to every character.
// Override per-character by replacing `sprites` with a custom object.
for (const char of Object.values(CHARACTERS)) {
  char.sprites = DEFAULT_SPRITES;
}
