// Rendering layer.
//
// _drawFighter() tries sprite rendering first via the player's AnimationController.
// If no sprites are loaded it falls back to the original rectangle drawing so the
// game is always playable regardless of whether the sprite files are present.
//
// Debug overlay (F1):
//   • Green outline  = hurtbox
//   • Red fill+line  = active hitbox (exactly when damage can land)
//   • Bottom panel   = per-fighter frame data + current anim state/frame

import { STAGE, BODY } from './constants.js';

const SKY_GRADIENT_STOPS = [
  [0.0, '#241814'],
  [0.6, '#3a2418'],
  [1.0, '#1a0e0a'],
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.debug  = false;
  }

  /**
   * Main draw entry point called once per RAF.
   *
   * @param {object} state
   * @param {Player}              state.p1
   * @param {Player}              state.p2
   * @param {Match}               state.match
   * @param {{p1:bool,p2:bool}}   state.aiOn
   * @param {AnimationController} state.ac1   may be null if sprites not loaded
   * @param {AnimationController} state.ac2
   */
  draw(state) {
    const { p1, p2, match, aiOn, ac1, ac2 } = state;
    const ctx = this.ctx;

    this._drawStage(ctx);

    // Sync animation controllers from current player state (happens here, not
    // in the tick, so it runs once per rendered frame rather than per logic tick).
    ac1?.sync(p1);
    ac2?.sync(p2);

    // Draw back-to-front by x for slight depth feel.
    const pairs = (p1.x <= p2.x) ? [[p1, ac1], [p2, ac2]] : [[p2, ac2], [p1, ac1]];
    for (const [p, ac] of pairs) this._drawFighter(ctx, p, ac);

    if (this.debug) {
      this._drawHitboxes(ctx, p1);
      this._drawHitboxes(ctx, p2);
    }

    this._drawHUD(ctx, p1, p2, match, aiOn);
    if (match.banner) this._drawBanner(ctx, match.banner);
    if (this.debug) this._drawFrameData(ctx, p1, p2, ac1, ac2);
  }

  // ── Stage ─────────────────────────────────────────────────────────────────

  _drawStage(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, STAGE.height);
    for (const [t, c] of SKY_GRADIENT_STOPS) grad.addColorStop(t, c);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, STAGE.width, STAGE.height);

    ctx.fillStyle = '#15100c';
    ctx.beginPath();
    ctx.moveTo(0, STAGE.groundY - 90);
    for (let i = 0; i <= 12; i++) {
      const x = (i / 12) * STAGE.width;
      const y = STAGE.groundY - 90 - Math.sin(i * 1.7) * 38 - (i % 2 === 0 ? 22 : 0);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(STAGE.width, STAGE.groundY);
    ctx.lineTo(0, STAGE.groundY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0e0a08';
    ctx.fillRect(0, STAGE.groundY, STAGE.width, STAGE.height - STAGE.groundY);
    ctx.fillStyle = '#2c1d12';
    ctx.fillRect(0, STAGE.groundY, STAGE.width, 4);

    ctx.fillStyle = 'rgba(80, 50, 30, 0.4)';
    ctx.fillRect(STAGE.leftWall - 4, 0, 4, STAGE.groundY);
    ctx.fillRect(STAGE.rightWall,    0, 4, STAGE.groundY);
  }

  // ── Fighter ───────────────────────────────────────────────────────────────

  _drawFighter(ctx, p, ac) {
    // Ground shadow — always drawn regardless of sprite vs. rect.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(p.x, STAGE.groundY + 2, BODY.width * 0.55, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Try sprite first.
    const drewSprite = ac?.draw(ctx, p) ?? false;

    if (drewSprite) {
      // Stun tint overlay drawn on top of the sprite.
      if (p.hitstun > 0 && p.hitstun % 4 < 2) {
        this._drawTintOverlay(ctx, p, 'rgba(255, 80, 40, 0.38)');
      } else if (p.blockstun > 0 && p.blockstun % 4 < 2) {
        this._drawTintOverlay(ctx, p, 'rgba(120, 180, 255, 0.38)');
      }
    } else {
      // ── Fallback rectangle drawing ────────────────────────────────────────
      const hb = p.hurtbox();

      let body = p.character.color;
      if (p.hitstun   > 0) body = (p.hitstun   % 4 < 2) ? '#ff6a4a' : body;
      if (p.blockstun > 0) body = (p.blockstun % 4 < 2) ? '#aaccff' : body;

      ctx.fillStyle = body;
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);

      ctx.fillStyle = p.isP1 ? '#a83025' : '#2a4a8a';
      ctx.fillRect(hb.x, hb.y + hb.h * 0.45, hb.w, 8);

      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(hb.x + hb.w * 0.25, hb.y - 14, hb.w * 0.5, 18);

      ctx.fillStyle = '#f4c062';
      const eyeX = p.facing > 0 ? hb.x + hb.w * 0.65 : hb.x + hb.w * 0.2;
      ctx.fillRect(eyeX, hb.y - 8, hb.w * 0.15, 3);

      const weaponLen = (p.character.attacks.medium?.range || 100) * 0.85;
      const handX = p.x + p.facing * (BODY.width * 0.35);
      const handY = hb.y + hb.h * 0.40;
      ctx.strokeStyle = p.character.weaponColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(handX + p.facing * weaponLen, handY - 8);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Block outline — drawn over both sprite and rect.
    if (p.blockingHigh || p.blockingLow) {
      const hb = p.hurtbox();
      ctx.strokeStyle = '#88c0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(hb.x - 2, hb.y - 2, hb.w + 4, hb.h + 4);
      ctx.lineWidth = 1;
    }
  }

  // Semi-transparent colour rect that matches the hurtbox, used for hit/block flash.
  _drawTintOverlay(ctx, p, colour) {
    const hb = p.hurtbox();
    ctx.fillStyle = colour;
    ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
  }

  // ── Debug overlays ────────────────────────────────────────────────────────

  _drawHitboxes(ctx, p) {
    // Hurtbox — green
    const hb = p.hurtbox();
    ctx.strokeStyle = '#33ff66';
    ctx.lineWidth = 1;
    ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);

    // Active hitbox — red fill + outline
    const ah = p.activeHitbox();
    if (ah) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.35)';
      ctx.fillRect(ah.x, ah.y, ah.w, ah.h);
      ctx.strokeStyle = '#ff4040';
      ctx.strokeRect(ah.x, ah.y, ah.w, ah.h);
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  _drawHUD(ctx, p1, p2, match, aiOn) {
    this._healthBar(ctx, 30, 24, 420, 22, p1.hp / p1.maxHP, true);
    this._healthBar(ctx, STAGE.width - 30 - 420, 24, 420, 22, p2.hp / p2.maxHP, false);

    ctx.fillStyle = '#f4d27a';
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(p1.character.name + (aiOn.p1 ? ' [CPU]' : ' [P1]'), 30, 64);
    ctx.textAlign = 'right';
    ctx.fillText(p2.character.name + (aiOn.p2 ? ' [CPU]' : ' [P2]'), STAGE.width - 30, 64);

    ctx.fillStyle = '#f4c062';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath(); ctx.arc(460 + i * 16, 35, 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#f4c062'; ctx.stroke();
      if (p1.roundsWon > i) ctx.fill();
    }
    for (let i = 0; i < 2; i++) {
      ctx.beginPath(); ctx.arc(STAGE.width - 460 - i * 16, 35, 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#f4c062'; ctx.stroke();
      if (p2.roundsWon > i) ctx.fill();
    }

    ctx.fillStyle = '#fff3c0';
    ctx.font = 'bold 32px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(match.timeRemaining)).padStart(2, '0'), STAGE.width / 2, 44);

    if (p1.comboHits >= 2) {
      ctx.fillStyle = '#ffd870'; ctx.font = 'bold 22px Courier New'; ctx.textAlign = 'left';
      ctx.fillText(`${p1.comboHits} HITS`, 40, 100);
    }
    if (p2.comboHits >= 2) {
      ctx.fillStyle = '#ffd870'; ctx.font = 'bold 22px Courier New'; ctx.textAlign = 'right';
      ctx.fillText(`${p2.comboHits} HITS`, STAGE.width - 40, 100);
    }
  }

  _healthBar(ctx, x, y, w, h, ratio, leftAligned) {
    ctx.fillStyle = '#1a0e08'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#3a1414'; ctx.fillRect(x, y, w, h);
    const fillW = Math.max(0, w * ratio);
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, '#ffce4d'); grad.addColorStop(1, '#d23222');
    ctx.fillStyle = grad;
    if (leftAligned) ctx.fillRect(x + (w - fillW), y, fillW, h);
    else             ctx.fillRect(x, y, fillW, h);
    ctx.strokeStyle = '#f4c062'; ctx.strokeRect(x, y, w, h);
  }

  _drawBanner(ctx, banner) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, STAGE.height / 2 - 60, STAGE.width, 120);
    ctx.fillStyle = '#ffd870'; ctx.textAlign = 'center';
    ctx.font = 'bold 56px Courier New';
    ctx.fillText(banner.title, STAGE.width / 2, STAGE.height / 2 + 8);
    if (banner.sub) {
      ctx.font = 'bold 18px Courier New'; ctx.fillStyle = '#f4c062';
      ctx.fillText(banner.sub, STAGE.width / 2, STAGE.height / 2 + 40);
    }
    ctx.restore();
  }

  // ── Frame-data debug panel ────────────────────────────────────────────────

  _drawFrameData(ctx, p1, p2, ac1, ac2) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, STAGE.height - 124, 380, 116);
    ctx.fillRect(STAGE.width - 388, STAGE.height - 124, 380, 116);

    ctx.fillStyle = '#a8e6a8';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';
    this._writeDebugLines(ctx, p1, ac1, 16,                   STAGE.height - 106);
    this._writeDebugLines(ctx, p2, ac2, STAGE.width - 380, STAGE.height - 106);
  }

  _writeDebugLines(ctx, p, ac, x, y) {
    // Combat state
    const attackLine = p.attack
      ? `attack=${p.attack.name}  phase=${p.attack.phase}  f=${p.attack.frame}/${p.attack.def[p.attack.phase]}`
      : `attack=—`;

    // Animation state (only if sprites loaded)
    let animLine = 'anim=rectangles (no sprites)';
    if (ac?.hasSprites) {
      const anim = ac.anims[ac.state];
      let activeTag = '';
      if (ac.state === 'attack1' || ac.state === 'attack2') {
        const [lo, hi] = ac.activeFrameRange(ac.state);
        const f = anim?.frame ?? 0;
        activeTag = (f >= lo && f <= hi) ? ' ← HITBOX ACTIVE' : '';
      }
      animLine = `anim=${ac.state}  frame=${anim?.frame ?? '?'}/${(anim?.frameCount ?? 1) - 1}${activeTag}`;
    }

    const lines = [
      `${p.isP1 ? 'P1' : 'P2'} ${p.character.id}   state=${p.state}   facing=${p.facing > 0 ? '→' : '←'}`,
      `pos=(${p.x.toFixed(0)}, ${p.y.toFixed(0)})   onGround=${p.onGround}`,
      attackLine,
      `hitstun=${p.hitstun}  blockstun=${p.blockstun}  blkH=${p.blockingHigh ? 'Y' : '-'}  blkL=${p.blockingLow ? 'Y' : '-'}`,
      `hp=${p.hp}/${p.maxHP}  combo=${p.comboHits}`,
      animLine,
    ];
    for (let i = 0; i < lines.length; i++) {
      // Highlight the active-hitbox line in yellow
      ctx.fillStyle = (lines[i].includes('HITBOX ACTIVE')) ? '#ffdd44' : '#a8e6a8';
      ctx.fillText(lines[i], x, y + i * 16);
    }
  }
}
