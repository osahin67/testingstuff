// Player / fighter state machine.
//
// Each player runs at a fixed 60 fps tick.  Combat state is FRAME-driven:
// attacks advance through startup/active/recovery counters rather than
// real-time durations, so AI and gameplay tuning can reason about precise
// frame advantage values.
//
// States:
//   'idle' | 'walkF' | 'walkB' | 'crouch' | 'jump'
//   'attack'                     -- with phase: 'startup' | 'active' | 'recovery'
//   'hitstun' | 'blockstun' | 'knockdown'

import { STAGE, PHYSICS, BODY } from './constants.js';

export class Player {
  constructor({ id, character, x, facing, isP1 }) {
    this.id = id;
    this.isP1 = isP1;
    this.character = character;          // CHARACTER definition object
    this.x = x;
    this.y = STAGE.groundY;              // feet
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;                // +1 right, -1 left
    this.onGround = true;

    this.hp = character.maxHP;
    this.maxHP = character.maxHP;

    this.state = 'idle';
    this.crouching = false;

    // Active attack
    this.attack = null;     // { name, def, phase, frame, hasHit:Set }
    this.cooldown = 0;      // generic attack lockout (e.g. on whiff after jump land)

    // Stun counters
    this.hitstun = 0;
    this.blockstun = 0;
    this.knockdown = 0;

    // Block state — passive: if the player holds "back" while no attack/stun, they block.
    this.blockingHigh = false;
    this.blockingLow  = false;

    // Dash
    this.dashTimer = 0;
    this.dashDir = 0;

    // Combo tracking (defender side, but stored here for damage scaling on attacker)
    this.comboHits = 0;
    this.comboTimer = 0;

    // Round/score
    this.roundsWon = 0;

    // Last input snapshot (for AI debug / facing logic)
    this.input = null;
  }

  // -------- Geometry --------

  bodyHeight() { return this.crouching ? BODY.crouchHeight : BODY.height; }

  // Hurtbox in world coords (axis-aligned).
  hurtbox() {
    const h = this.bodyHeight();
    return {
      x: this.x - BODY.width / 2,
      y: this.y - h,
      w: BODY.width,
      h: h,
    };
  }

  // Hitbox of currently active attack frame, or null.
  activeHitbox() {
    if (!this.attack || this.attack.phase !== 'active') return null;
    const hb = this.attack.def.hitbox;
    return {
      x: this.x + (this.facing > 0 ? hb.x : -hb.x - hb.w),
      y: this.y + hb.y,
      w: hb.w,
      h: hb.h,
      meta: this.attack.def,
      attackKey: this.attack.name,
    };
  }

  // -------- Lifecycle --------

  reset(x, facing) {
    this.x = x;
    this.y = STAGE.groundY;
    this.vx = this.vy = 0;
    this.facing = facing;
    this.hp = this.maxHP;
    this.state = 'idle';
    this.crouching = false;
    this.attack = null;
    this.cooldown = 0;
    this.hitstun = this.blockstun = this.knockdown = 0;
    this.dashTimer = 0; this.dashDir = 0;
    this.comboHits = 0; this.comboTimer = 0;
    this.onGround = true;
  }

  isStunned() {
    return this.hitstun > 0 || this.blockstun > 0 || this.knockdown > 0;
  }
  isAttacking() { return !!this.attack; }
  isAirborne()  { return !this.onGround; }
  isDead()      { return this.hp <= 0; }

  // -------- Per-frame update --------

  // `opponentX` is needed so we can interpret "back" as block direction.
  update(input, opponentX) {
    this.input = input;

    if (this.knockdown > 0) {
      this.knockdown--;
      this._applyPhysics();
      return;
    }

    // tick combo timer
    if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer === 0) this.comboHits = 0; }

    if (this.cooldown > 0) this.cooldown--;

    // Stun first — overrides input for movement/attack
    if (this.hitstun > 0) {
      this.hitstun--;
      this._applyPhysics();
      if (this.hitstun === 0 && this.onGround) this.state = 'idle';
      return;
    }
    if (this.blockstun > 0) {
      this.blockstun--;
      // continue to honor block hold while in blockstun (visual)
      this._updateBlockState(input, opponentX);
      this._applyPhysics();
      if (this.blockstun === 0 && this.onGround) this.state = 'idle';
      return;
    }

    // Attack progression (frame-based)
    if (this.attack) {
      this._tickAttack();
      // While airborne the player can still drift; while grounded the attack
      // locks horizontal movement.
      if (!this.onGround) this._applyPhysics(); else this._applyPhysics(true);
      return;
    }

    // Update facing only when the player has agency (not mid-attack/stun)
    if (this.onGround) this.facing = (opponentX >= this.x) ? 1 : -1;

    // Dash continuation
    if (this.dashTimer > 0) {
      this.dashTimer--;
      this.vx = this.dashDir * this.character.dashSpeed;
      this._applyPhysics();
      if (this.dashTimer === 0) this.state = 'idle';
      return;
    }

    // Block detection (only meaningful on ground)
    this._updateBlockState(input, opponentX);

    // Crouch
    this.crouching = this.onGround && input.down && !input.up;

    // Jump (only if grounded)
    if (this.onGround && input.upEdge) {
      this.vy = this.character.jumpVel;
      // jump direction follows held movement
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.vx = dir * (this.character.walkSpeed * 1.05);
      this.onGround = false;
      this.state = 'jump';
      this.crouching = false;
    }

    // Dash (edge-triggered) — only on ground, only if a direction is held
    if (this.onGround && input.dashEdge && this.cooldown === 0) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir !== 0) {
        this.dashDir = dir;
        this.dashTimer = this.character.dashFrames;
        this.state = 'dash';
        this.cooldown = this.character.dashFrames + 6;
      }
    }

    // Walking (cancels block — that's by design; you have to commit to defend)
    if (this.onGround && !this.crouching && this.dashTimer === 0) {
      let move = 0;
      if (input.right) move += 1;
      if (input.left)  move -= 1;
      if (move !== 0) {
        const sameAsFacing = Math.sign(move) === this.facing;
        const speed = sameAsFacing ? this.character.walkSpeed : this.character.backSpeed;
        this.vx = move * speed;
        this.state = sameAsFacing ? 'walkF' : 'walkB';
      } else {
        this.vx = 0;
        this.state = 'idle';
      }
    } else if (this.crouching) {
      this.vx = 0;
      this.state = 'crouch';
    }

    // Attack initiation
    if (input.light || input.medium || input.heavy) {
      this._startAttack(input);
    }

    this._applyPhysics();
  }

  _updateBlockState(input, opponentX) {
    // "Back" relative to opponent.  Cannot block while airborne (intentional).
    if (!this.onGround) { this.blockingHigh = this.blockingLow = false; return; }
    const oppOnRight = opponentX >= this.x;
    const holdingBack = oppOnRight ? input.left : input.right;
    if (holdingBack) {
      this.blockingHigh = !input.down;
      this.blockingLow  = !!input.down;
    } else {
      this.blockingHigh = this.blockingLow = false;
    }
  }

  _startAttack(input) {
    const c = this.character.attacks;
    let key = null;
    if (!this.onGround) {
      if      (input.heavy)  key = 'jHeavy';
      else if (input.light || input.medium) key = 'jLight';
    } else if (this.crouching) {
      if      (input.heavy)  key = 'cHeavy';
      else if (input.light)  key = 'cLight';
      else if (input.medium) key = 'cHeavy';   // crouching has 2 buttons; map medium → heavy variant
    } else {
      if      (input.heavy)  key = 'heavy';
      else if (input.medium) key = 'medium';
      else if (input.light)  key = 'light';
    }
    if (!key || !c[key]) return;
    this.attack = { name: key, def: c[key], phase: 'startup', frame: 0, hasHit: new Set() };
    this.state = 'attack';
    if (this.onGround) this.vx = 0;
  }

  _tickAttack() {
    const a = this.attack;
    a.frame++;
    if (a.phase === 'startup' && a.frame > a.def.startup) {
      a.phase = 'active';
      a.frame = 1;
    } else if (a.phase === 'active' && a.frame > a.def.active) {
      a.phase = 'recovery';
      a.frame = 1;
    } else if (a.phase === 'recovery' && a.frame > a.def.recovery) {
      this.attack = null;
      if (this.onGround) this.state = 'idle';
    }
  }

  _applyPhysics(lockHorizontal = false) {
    if (lockHorizontal && this.onGround) this.vx = 0;

    if (!this.onGround) {
      this.vy += PHYSICS.gravity;
      this.x += this.vx;
      this.y += this.vy;
      if (this.y >= STAGE.groundY) {
        this.y = STAGE.groundY;
        this.vy = 0;
        this.onGround = true;
        // Landing cancels mid-air attack into recovery snap
        if (this.attack && this.attack.phase !== 'recovery') {
          this.attack.phase = 'recovery';
          this.attack.frame = 1;
        }
        if (!this.attack && !this.isStunned()) this.state = 'idle';
      }
    } else {
      this.x += this.vx;
    }

    // Stage clamps
    if (this.x < STAGE.leftWall + BODY.width / 2) this.x = STAGE.leftWall + BODY.width / 2;
    if (this.x > STAGE.rightWall - BODY.width / 2) this.x = STAGE.rightWall - BODY.width / 2;
  }

  // Called by combat resolver when this player gets hit / blocks.
  applyHit({ damage, hitstun, blockstun, pushback, blocked }) {
    if (blocked) {
      this.blockstun = Math.max(this.blockstun, blockstun);
      this.vx = -this.facing * pushback * 0.4;
      this.state = 'blockstun';
    } else {
      // Cancel any current attack
      this.attack = null;
      this.hitstun = Math.max(this.hitstun, hitstun);
      this.vx = -this.facing * pushback * 0.6;
      this.state = 'hitstun';
      // Combo bookkeeping
      this.comboHits++;
      this.comboTimer = hitstun + 12;
    }
    this.hp = Math.max(0, this.hp - damage);
  }
}
