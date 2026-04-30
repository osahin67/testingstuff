// Sprite animation engine.
//
// Two classes:
//   SpriteAnimation  — one clip from a horizontal sprite strip (auto-sizes from image)
//   AnimationController — per-fighter state machine; drives SpriteAnimations from
//                         gameplay state (Player) each tick.
//
// CRITICAL SYNC CONTRACT
// ──────────────────────
// For attack clips, AnimationController NEVER calls anim.tick().  Instead it calls
// anim.forceFrame(), computing the sprite frame directly from the Player's combat
// phase counter (startup / active / recovery).  This is the one guarantee that makes
// hitbox windows and visible animation frames permanently locked together.
//
//   sprite frame bands for a 6-frame attack strip (startup:2, active:2, recovery:2):
//     frames 0-1  →  startup  (no hitbox)
//     frames 2-3  →  ACTIVE   (hitbox live)       ← only these frames deal damage
//     frames 4-5  →  recovery (no hitbox)
//
// Changing the `attackSync` config is the authoritative way to tune which pixels
// correspond to damage.  The combat resolver in combat.js independently enforces the
// same phase boundaries — they will always agree.

// ─── SpriteAnimation ─────────────────────────────────────────────────────────

export class SpriteAnimation {
  /**
   * @param {object} cfg
   * @param {HTMLImageElement|null} cfg.image
   * @param {number}  cfg.frameCount   number of frames in the strip
   * @param {number}  cfg.fps          playback speed (used by tick(); ignored for attacks)
   * @param {boolean} cfg.loop         loop when done?
   */
  constructor({ image, frameCount, fps = 12, loop = true }) {
    this.image      = image;
    this.frameCount = frameCount;
    this.fps        = fps;
    this.loop       = loop;

    // Derive per-frame dimensions from the actual image.
    // Assumes a single-row horizontal strip: total_width / frameCount.
    this.frameWidth  = image ? Math.floor(image.width / frameCount) : 0;
    this.frameHeight = image ? image.height : 0;

    this.frame    = 0;     // current frame index (0-based)
    this.subframe = 0;     // fractional tick accumulator
    this.done     = false; // true once a non-looping anim finishes
  }

  reset() { this.frame = 0; this.subframe = 0; this.done = false; }

  // Advance by one game tick (1/60 s). Used for idle/fall/death animations.
  tick() {
    if (this.done) return;
    this.subframe += this.fps / 60;
    while (this.subframe >= 1) {
      this.subframe -= 1;
      this.frame++;
      if (this.frame >= this.frameCount) {
        if (this.loop) { this.frame = 0; }
        else { this.frame = this.frameCount - 1; this.done = true; return; }
      }
    }
  }

  // Force a specific frame index; used by AnimationController for attack sync.
  forceFrame(n) {
    this.frame = Math.max(0, Math.min(this.frameCount - 1, Math.floor(n)));
  }

  /**
   * Draw with the character's feet anchored at (feetX, feetY).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} feetX   world-space feet center x
   * @param {number} feetY   world-space feet y
   * @param {number} scale   uniform draw scale
   * @param {boolean} facingRight   false → mirror horizontally
   * @param {number} footRatio  0-1: where in the sprite the feet are (1 = bottom edge)
   * @returns {boolean} false if no image was available (caller should fall back)
   */
  /**
   * xOffset: pixels to shift the sprite horizontally BEFORE mirroring.
   * Positive nudges the sprite toward the facing direction; useful when the
   * character isn't perfectly centred in the sprite frame.
   */
  draw(ctx, feetX, feetY, scale = 1, facingRight = true, footRatio = 0.92, xOffset = 0) {
    if (!this.image || this.frameWidth === 0) return false;

    const dw = this.frameWidth  * scale;
    const dh = this.frameHeight * scale;
    const sx = this.frame * this.frameWidth;

    // Centre the frame on feetX, then apply the tunable offset.
    const destX = feetX - dw / 2 + xOffset * scale;
    const destY = feetY - dh * footRatio;

    ctx.save();
    if (!facingRight) {
      // Mirror around feetX so the character faces the opponent.
      // The xOffset is already baked into destX and mirrors correctly.
      ctx.translate(feetX * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      this.image,
      sx, 0, this.frameWidth, this.frameHeight,
      destX, destY, dw, dh,
    );
    ctx.restore();
    return true;
  }
}

// ─── AnimationController ──────────────────────────────────────────────────────

export class AnimationController {
  /**
   * @param {object} anims  { idle, attack1, attack2, fall, death } → SpriteAnimation
   * @param {object} cfg
   * @param {number} cfg.scale       uniform draw scale for all clips
   * @param {number} cfg.footRatio   0-1, where feet sit in the sprite frame
   * @param {object} cfg.attackSync  per-anim-state sprite-frame phase split:
   *   { attack1: { startup, active, recovery }, attack2: { ... } }
   *   Each number is the count of SPRITE frames allocated to that phase.
   *   startup + active + recovery must equal the clip's frameCount.
   */
  constructor(anims, cfg = {}) {
    this.anims     = anims;
    this.scale     = cfg.scale     ?? 1.0;
    this.footRatio = cfg.footRatio ?? 0.92;
    this.xOffset   = cfg.xOffset   ?? 0;    // horizontal nudge in sprite-pixels
    this.syncCfg   = cfg.attackSync ?? {};

    this.hasSprites = Object.values(anims).some(a => a?.image !== null);
    this.state      = 'idle';
  }

  // Reset to idle — call when a new round starts or character switches.
  reset() {
    this.state = 'idle';
    Object.values(this.anims).forEach(a => a?.reset());
  }

  /**
   * Derive animation state from player, advance the active clip, then return.
   * Must be called once per game tick, before draw().
   */
  sync(player) {
    if (!this.hasSprites) return;

    const next = this._deriveState(player);
    if (next !== this.state) {
      if (!this._canTransition(this.state, next, player)) return;
      this.state = next;
      this.anims[next]?.reset();
    }

    const anim = this.anims[this.state];
    if (!anim) return;

    const isAttack = this.state === 'attack1' || this.state === 'attack2';
    if (isAttack && player.attack) {
      // Combat-driven frame — hitbox and sprite are guaranteed in sync.
      anim.forceFrame(this._calcAttackFrame(player.attack, this.state));
    } else {
      anim.tick();
    }
  }

  draw(ctx, player) {
    if (!this.hasSprites) return false;
    const anim = this.anims[this.state];
    if (!anim) return false;
    return anim.draw(ctx, player.x, player.y, this.scale, player.facing > 0, this.footRatio, this.xOffset);
  }

  // Which sprite-frame range is "active" for a given attack state (for debug).
  activeFrameRange(animState) {
    const c = this.syncCfg[animState] ?? { startup: 2, active: 2, recovery: 2 };
    return [c.startup, c.startup + c.active - 1];
  }

  // ── private ──────────────────────────────────────────────────────────────

  _deriveState(p) {
    if (p.isDead())                         return 'death';
    if (!p.onGround || p.knockdown > 0)     return 'fall';
    if (p.hitstun > 0 && !p.onGround)      return 'fall';
    if (p.attack) {
      const n = p.attack.name;
      return (n === 'heavy' || n === 'cHeavy' || n === 'jHeavy') ? 'attack2' : 'attack1';
    }
    return 'idle';
  }

  // player is passed so we can check whether the attack truly finished vs. was
  // interrupted.  `player.attack === null` only becomes true at end of recovery.
  _canTransition(from, to, player) {
    if (from === 'death') return false;  // terminal state

    const inAttack = from === 'attack1' || from === 'attack2';
    if (inAttack) {
      // Death and airborne-knockdown always win.
      if (to === 'death' || to === 'fall') return true;
      // Any other transition (including idle) only allowed once the combat
      // system has cleared the attack (end of recovery or interrupted by hit).
      if (player.attack !== null) return false;
    }

    return true;
  }

  /**
   * Map the Player's live combat counter to a sprite frame index.
   *
   * The attack strip is conceptually split into three bands:
   *   [0 … cfg.startup-1]                 → startup
   *   [cfg.startup … +cfg.active-1]       → active  (visual hit window)
   *   [cfg.startup+cfg.active … end]      → recovery
   *
   * Progress within each game-frame band is lerped linearly across the
   * corresponding sprite-frame band.
   */
  _calcAttackFrame(atk, animState) {
    const c   = this.syncCfg[animState] ?? { startup: 2, active: 2, recovery: 2 };
    const def = atk.def;

    // atk.frame is 1-based within the current phase.
    const t = (atk.frame - 1) / Math.max(1, atk.phase === 'startup'  ? def.startup
                                              : atk.phase === 'active'   ? def.active
                                              : def.recovery);
    if (atk.phase === 'startup') {
      return Math.floor(t * c.startup);
    } else if (atk.phase === 'active') {
      return c.startup + Math.floor(t * c.active);
    } else {
      return c.startup + c.active + Math.floor(t * c.recovery);
    }
  }
}
