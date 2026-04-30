# Sprite Sheets

Drop your five PNG files here with these exact names:

| File          | Frames | Animation state     | Notes                          |
|---------------|--------|---------------------|--------------------------------|
| `idle.png`    | 6      | standing / walking  | loops                          |
| `attack1.png` | 6      | light / medium atk  | no loop; frame-synced to combat|
| `attack2.png` | 6      | heavy attack        | no loop; frame-synced to combat|
| `fall.png`    | 2      | airborne / knockdown| loops                          |
| `death.png`   | 8      | death               | no loop; freezes on last frame |

## Format

- Single-row horizontal strips (all frames left-to-right, one row).
- Frame dimensions are auto-derived: `frameWidth = image.width / frameCount`.
- Sprites should face **right** by default — the engine mirrors them for left-facing.

## Tuning the display

Edit `src/characters.js` → `DEFAULT_SPRITES`:

```js
scale:     1.0,   // increase/decrease until the character fills the hit area
footRatio: 0.92,  // 0-1: where in the frame the character's feet sit
                  // 1.0 = very bottom pixel; lower if there is a ground shadow
```

## Attack frame sync

The attack strips are divided into three visual bands driven by the combat engine:

```
attack1 / attack2 (6 frames):
  frames 0-1  → startup   (no hitbox)
  frames 2-3  → ACTIVE    (hitbox is live — damage can be dealt)
  frames 4-5  → recovery  (no hitbox)
```

To change which sprite frames correspond to the active window, edit `attackSync`:

```js
attackSync: {
  attack1: { startup: 2, active: 2, recovery: 2 },  // must sum to frameCount
  attack2: { startup: 2, active: 2, recovery: 2 },
},
```

Press **F1** in-game to see the debug overlay, which shows the current animation
state, frame index, and highlights `← HITBOX ACTIVE` in yellow when damage is live.
