// Basic samurai AI.
//
// The AI does not read raw button presses — it produces an `input` object of
// the same shape as keyboard input.  This keeps Player code agnostic and the
// AI honest (it only "knows" what a player would).
//
// Behavior summary:
//   * Maintain spacing relative to the character's medium-attack range.
//   * When in range and opponent is recovering / neutral, attack.
//   * If opponent is in startup of a long move, sometimes back off or block.
//   * React with a small randomized delay on stimulus (not frame-perfect).

import { emptyInput } from './input.js';

export class AIController {
  constructor({ self, opponent, difficulty = 0.7 }) {
    this.self = self;
    this.opponent = opponent;
    this.difficulty = difficulty;     // 0..1 — higher = more reactive
    this.reactCounter = 0;            // ticks down before next decision
    this.intent = 'neutral';          // 'neutral' | 'pressure' | 'retreat' | 'block'
    this.intentTimer = 0;
    this.lastSeenAttack = null;
  }

  // Returns an input object for this frame.
  update() {
    const me = this.self, op = this.opponent;
    const input = emptyInput();

    // Don't fight while stunned — Player handles that anyway, but avoid
    // burning decisions during stun.
    if (me.isStunned() || me.isAttacking()) return input;

    const dx = op.x - me.x;
    const absDx = Math.abs(dx);
    const facingRight = dx >= 0;

    // Choose a "preferred" range: just outside medium attack reach.
    const myMid = me.character.attacks.medium;
    const myLight = me.character.attacks.light;
    const preferred = (myMid?.range || 100) - 8;
    const lightReach = myLight?.range || 70;

    // React to opponent attack startups: small delay, then block.
    if (op.isAttacking() && op.attack.phase === 'startup') {
      if (this.lastSeenAttack !== op.attack) {
        this.lastSeenAttack = op.attack;
        // delay between 4 and 14 frames depending on difficulty
        this.reactCounter = Math.floor(14 - this.difficulty * 10 + Math.random() * 4);
        this.intent = 'block';
        this.intentTimer = 30;
      }
    }
    if (op.isAttacking() === false) this.lastSeenAttack = null;

    if (this.reactCounter > 0) this.reactCounter--;

    // Decay intent
    if (this.intentTimer > 0) {
      this.intentTimer--;
    } else {
      // Pick a new neutral intent occasionally
      if (Math.random() < 0.04) {
        const r = Math.random();
        this.intent = r < 0.55 ? 'pressure' : (r < 0.85 ? 'neutral' : 'retreat');
        this.intentTimer = 30 + Math.floor(Math.random() * 60);
      }
    }

    // ---- Output decisions ----

    // Block intent (after react delay): hold back.
    if (this.intent === 'block' && this.reactCounter === 0) {
      if (facingRight) input.left = true; else input.right = true;
      // Crouch-block low pokes 50% of the time when blocking
      if (Math.random() < 0.5) input.down = true;
      return input;
    }

    // Move toward / away from preferred range
    const tooFar  = absDx > preferred + 12;
    const tooClose= absDx < lightReach * 0.55;
    if (this.intent === 'retreat' || tooClose) {
      if (facingRight) input.left = true; else input.right = true;
    } else if (tooFar) {
      if (facingRight) input.right = true; else input.left = true;
    }

    // Attack decisions: only when in range and opponent is interruptible
    const opponentVulnerable = !op.blockingHigh && !op.blockingLow;
    const inLight = absDx <= lightReach;
    const inMid   = absDx <= (myMid?.range || 100);
    const inHeavy = absDx <= (me.character.attacks.heavy?.range || 120);

    // small random per-frame chance to throw a button
    const aggression = 0.04 + this.difficulty * 0.06;

    if (!me.isAttacking()) {
      if (inLight && Math.random() < aggression * 1.2) {
        input.light = true;
      } else if (inMid && Math.random() < aggression * 0.6) {
        input.medium = true;
      } else if (inHeavy && opponentVulnerable && op.isStunned()
                 && op.hitstun > (me.character.attacks.heavy?.startup || 16)) {
        // punish window: heavy when opponent is locked in stun long enough
        input.heavy = true;
      }
    }

    // Occasional jump-in if mid range and not currently pressuring with pokes
    if (inMid && !inLight && this.intent === 'pressure'
        && Math.random() < 0.01 + this.difficulty * 0.01 && me.onGround) {
      input.up = true; input.upEdge = true;
      // bias jump direction forward
      if (facingRight) input.right = true; else input.left = true;
    }

    // Occasional crouch poke
    if (inLight && Math.random() < 0.015) {
      input.down = true;
      if (Math.random() < 0.5) input.light = true;
    }

    return input;
  }
}
