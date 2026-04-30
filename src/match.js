// Round / match orchestration.
//
// The Match has phases:
//   'intro'     -> "ROUND N" banner, no inputs
//   'fight'     -> active gameplay, timer counting down
//   'roundEnd'  -> KO or timeout banner, brief freeze
//   'matchEnd'  -> overall winner, waits for reset (F5) or auto-restart

import { MATCH, FPS, STAGE } from './constants.js';

export class Match {
  constructor(p1, p2) {
    this.p1 = p1; this.p2 = p2;
    this.round = 1;
    this.phase = 'intro';
    this.phaseTimer = MATCH.intro_frames;
    this.timeRemaining = MATCH.roundTime;
    this.banner = { title: 'ROUND 1', sub: 'READY' };
  }

  reset() {
    this.p1.roundsWon = 0;
    this.p2.roundsWon = 0;
    this.round = 1;
    this._beginRound();
  }

  _beginRound() {
    this.p1.reset(STAGE.width * 0.30, +1);
    this.p2.reset(STAGE.width * 0.70, -1);
    this.phase = 'intro';
    this.phaseTimer = MATCH.intro_frames;
    this.timeRemaining = MATCH.roundTime;
    this.banner = { title: `ROUND ${this.round}`, sub: 'READY' };
  }

  // Returns true if gameplay should tick this frame.
  preTick() {
    if (this.phase === 'intro') {
      this.phaseTimer--;
      if (this.phaseTimer <= 30) this.banner = { title: `ROUND ${this.round}`, sub: 'FIGHT!' };
      if (this.phaseTimer <= 0) {
        this.phase = 'fight';
        this.banner = null;
      }
      return false;
    }
    if (this.phase === 'roundEnd' || this.phase === 'matchEnd') {
      this.phaseTimer--;
      if (this.phaseTimer <= 0) {
        if (this.phase === 'matchEnd') {
          // Auto-restart entire match after the victory pause.
          this.reset();
        } else {
          this.round++;
          this._beginRound();
        }
      }
      return this.phase === 'roundEnd' ? true : false;   // freeze on matchEnd
    }
    return true;
  }

  postTick() {
    if (this.phase !== 'fight') return;

    this.timeRemaining -= 1 / FPS;
    if (this.timeRemaining < 0) this.timeRemaining = 0;

    const p1Dead = this.p1.isDead();
    const p2Dead = this.p2.isDead();
    const timeUp = this.timeRemaining <= 0;

    if (p1Dead || p2Dead || timeUp) {
      let winner = null;
      if (p1Dead && p2Dead) winner = null;
      else if (p1Dead) winner = this.p2;
      else if (p2Dead) winner = this.p1;
      else {
        // time up — higher HP wins
        if (this.p1.hp > this.p2.hp) winner = this.p1;
        else if (this.p2.hp > this.p1.hp) winner = this.p2;
      }
      if (winner) winner.roundsWon++;

      const matchOver = this.p1.roundsWon >= MATCH.roundsToWin
                     || this.p2.roundsWon >= MATCH.roundsToWin;

      if (matchOver) {
        const champ = (this.p1.roundsWon > this.p2.roundsWon) ? this.p1 : this.p2;
        this.banner = { title: 'WINNER', sub: champ.character.name };
        this.phase = 'matchEnd';
        this.phaseTimer = MATCH.victory_frames;
      } else {
        this.banner = winner
          ? { title: 'K.O.', sub: `${winner.character.name} wins the round` }
          : { title: 'DRAW', sub: '' };
        this.phase = 'roundEnd';
        this.phaseTimer = MATCH.ko_freeze;
      }
    }
  }
}
