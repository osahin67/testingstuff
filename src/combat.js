// Combat resolver.  Each tick we:
//   1) Resolve player-vs-player body collisions (push apart).
//   2) Check each attacker's active hitbox against the opponent's hurtbox.
//   3) If a hit lands, decide block vs. hit and apply damage / stun.
//
// Hitboxes only register once per attack instance (tracked in `hasHit`) so
// multi-active-frame moves can't double-tap a single opponent.

import { COMBO_SCALING, CHIP_RATIO, BODY } from './constants.js';

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// Push two players apart so their bodies don't visually overlap.
export function resolveBodyCollision(p1, p2) {
  const a = p1.hurtbox(), b = p2.hurtbox();
  if (!aabb(a, b)) return;
  const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  if (overlap <= 0) return;
  const push = overlap / 2 + 0.1;
  if (p1.x < p2.x) { p1.x -= push; p2.x += push; }
  else             { p1.x += push; p2.x -= push; }
}

// Resolve attacker hits on defender.
function resolveSide(attacker, defender) {
  const hb = attacker.activeHitbox();
  if (!hb) return;
  if (attacker.attack.hasHit.has(defender.id)) return;
  const def = defender.hurtbox();
  if (!aabb(hb, def)) return;

  attacker.attack.hasHit.add(defender.id);

  const a = hb.meta;

  // Determine block.  Defender must be in a state where blocking is possible:
  //   - on ground, not in hitstun, not in their own attack
  //   - holding back relative to attacker
  //   - block height matches the attack height
  const canBlock = defender.onGround && defender.hitstun === 0 && !defender.isAttacking();
  let blocked = false;
  if (canBlock) {
    if (a.height === 'high' && defender.blockingHigh) blocked = true;
    else if (a.height === 'low' && defender.blockingLow) blocked = true;
    else if (a.height === 'mid' && (defender.blockingHigh || defender.blockingLow)) blocked = true;
  }

  // Damage scaling for combos
  let dmg = a.damage;
  if (defender.comboHits > 0 && !blocked) {
    const idx = Math.min(defender.comboHits, COMBO_SCALING.length - 1);
    dmg = Math.max(1, Math.floor(dmg * COMBO_SCALING[idx]));
  }
  if (blocked) dmg = Math.max(1, Math.floor(a.damage * CHIP_RATIO));

  defender.applyHit({
    damage: dmg,
    hitstun: a.hitstun,
    blockstun: a.blockstun,
    pushback: a.pushback,
    blocked,
  });
  // attacker also gets a small pushback so spacing resets after trades
  attacker.vx = -attacker.facing * (a.pushback * 0.25);
}

export function resolveCombat(p1, p2) {
  resolveBodyCollision(p1, p2);
  resolveSide(p1, p2);
  resolveSide(p2, p1);
}
