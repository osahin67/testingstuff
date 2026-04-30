# Sengoku Duel — 2D Samurai Fighting Game

A Street Fighter–style 2D fighter set in feudal Japan. Combat is **strictly grounded** — no projectiles, no powers, no magic. Fighters differ only in **weapon, range, speed, and frame data**.

## File structure

```
index.html              # entry point + styles + control help
src/
  main.js               # bootstrap, fixed-timestep loop, character switching
  constants.js          # tunables (gravity, stage, match config)
  characters.js         # weapon archetypes + frame-perfect attack tables
  input.js              # keyboard manager (edge-triggered + held)
  player.js             # fighter state machine (movement, attacks, stun)
  combat.js             # hitbox/hurtbox resolver + body collision
  ai.js                 # spacing-aware AI controller
  render.js             # canvas rendering + debug overlay
  match.js              # round/timer/KO/best-of-3 logic
```

## Running

This uses native ES modules, so it must be served over HTTP (not opened with `file://`).

```bash
# from the repo root
python3 -m http.server 8000
# then visit http://localhost:8000
```

Any static server works (`npx http-server`, `npx serve`, etc.).

## Controls

| Action      | Player 1     | Player 2 (when AI off) |
|-------------|--------------|------------------------|
| Walk        | A / D        | ← / →                  |
| Crouch      | S            | ↓                      |
| Jump        | W            | ↑                      |
| Dash        | Left Shift   | /                      |
| Light       | J            | Numpad 1               |
| Medium      | K            | Numpad 2               |
| Heavy       | L            | Numpad 3               |

**Block:** hold *back* (away from opponent). Standing block stops mid + overhead (jumping) attacks; crouching block stops mid + low attacks. Unblockable mix-ups come from mixing crouching attacks (low) with jumping attacks (overhead).

### Global

| Key | Action |
|-----|--------|
| F1  | Toggle debug overlay (hitboxes, hurtboxes, frame data) |
| F2  | Toggle AI for Player 2 |
| F3  | Toggle AI for Player 1 |
| F5  | Reset match |
| 1-4 | Select Player 1 character (Katana / Nodachi / Wakizashi / Yari) |
| 5-8 | Select Player 2 character |

## Combat model

- **Frame-based, not time-based.** Every attack has explicit `startup`, `active`, and `recovery` frame counters, all advanced once per fixed 60 fps tick. Frame advantage on hit/block emerges from the difference between defender stun and attacker recovery — there are no canned cancels.
- **Hitboxes vs hurtboxes.** Each fighter has a hurtbox sized to their body (taller standing, shorter crouching). Active attacks expose a single hitbox AABB on their active frames; hits register at most once per attack instance per opponent.
- **Block height.** Attacks declare `'high' | 'mid' | 'low'`. Standing blocks high+mid; crouching blocks low+mid. Jumping attacks are inherently high (overhead) and can only be standing-blocked.
- **Damage scaling.** Every additional hit in a combo scales damage down (1.0 → 0.8 → 0.65 → 0.5 → …). Block damage is small chip damage only.
- **Body collision.** Players cannot pass through each other; bodies push apart on overlap.

## Roster

| ID         | Archetype          | Walk | Range  | Notes |
|------------|--------------------|------|--------|-------|
| `katana`   | Balanced           | 3.0  | medium | Round all-rounder |
| `nodachi`  | Slow / long reach  | 2.2  | long   | Big hits, severe recovery |
| `wakizashi`| Fast / short reach | 3.8  | short  | Frame traps, low damage |
| `yari`     | Spear zoner        | 2.5  | longest| Pokes from outside everything |

## Extending

Add a new fighter by appending an entry to `CHARACTERS` in `src/characters.js` (and its key to `CHARACTER_LIST`). The Player class consumes any character with the standard attack keys (`light`, `medium`, `heavy`, `cLight`, `cHeavy`, `jLight`, `jHeavy`).
