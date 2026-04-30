// Sprite sheet loader.
// Resolves null (not rejected) on missing files so the game degrades
// gracefully to placeholder rectangles when sprites aren't present.

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => { console.warn(`[sprites] not found: ${src}`); resolve(null); };
    img.src = src;
  });
}

/**
 * Load every animation clip defined in a sprite config object.
 *
 * @param {object} cfg   — character sprite config (see characters.js)
 * @returns {Promise<object>}  { idle, attack1, attack2, fall, death } → Image|null
 */
export async function loadCharacterSprites(cfg) {
  const base = cfg.basePath ?? 'sprites/';
  const result = {};
  await Promise.all(
    Object.entries(cfg.animations).map(async ([key, def]) => {
      result[key] = await loadImage(base + def.file);
    }),
  );
  return result;
}
