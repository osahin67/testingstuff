// Global game constants. Tuning lives here.

export const FPS = 60;
export const FRAME_MS = 1000 / FPS;

export const STAGE = {
  width: 1024,
  height: 576,
  groundY: 480,        // y-coord of the floor (top of ground)
  leftWall: 24,
  rightWall: 1000,
};

export const PHYSICS = {
  gravity: 0.85,        // px / frame^2
  jumpCutMul: 0.5,      // unused but reserved
  airDrag: 0.0,
  pushSpeed: 1.4,       // body collision separation per frame
};

// Round / match
export const MATCH = {
  roundsToWin: 2,        // best of 3
  roundTime: 60,         // seconds
  ko_freeze: 90,         // frames of slowdown after KO
  intro_frames: 90,
  victory_frames: 150,
};

// Default body sizes (hurtbox proxy; characters can override partially)
export const BODY = {
  width: 56,
  height: 110,
  crouchHeight: 70,
};

// Damage scaling for combos
export const COMBO_SCALING = [1.0, 0.8, 0.65, 0.5, 0.4, 0.3, 0.25, 0.2];

// Default minimum chip damage on block
export const CHIP_RATIO = 0.06;
