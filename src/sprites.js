/**
 * Atlases: one big image, many small pictures in a grid (lesson A14).
 *
 * A picture is a number. Number n lives at column n % cols, row floor(n / cols),
 * and every cell is `cell` pixels square. That is the whole idea — everything
 * else in this file is bookkeeping so the rest of the game can say
 * `drawTile(ctx, atlas, 40, x, y, 2)` and stop thinking about it.
 */

/**
 * Start loading an atlas. Returns immediately with an object whose `.ready`
 * promise resolves when the image is actually usable.
 */
export function loadAtlas(src, { cell = 16, cols } = {}) {
  const img = new Image();
  const atlas = { img, src, cell, cols, loaded: false };

  atlas.ready = new Promise((resolve, reject) => {
    img.addEventListener('load', () => {
      atlas.loaded = true;
      // The sheet knows its own width, so a wrong `cols` is a bug we can catch.
      const actual = Math.floor(img.naturalWidth / cell);
      if (cols && cols !== actual) {
        console.warn(`atlas ${src}: told ${cols} columns, image has ${actual}`);
      }
      atlas.cols = actual;
      atlas.rows = Math.floor(img.naturalHeight / cell);
      resolve(atlas);
    }, { once: true });
    img.addEventListener('error', () => reject(new Error(`could not load ${src}`)), { once: true });
  });

  img.src = src;
  return atlas;
}

/** Draw picture `index` with its top-left corner at x, y, blown up `scale` times. */
export function drawTile(ctx, atlas, index, x, y, scale = 1) {
  if (!atlas.loaded || index < 0) return;
  const { cell, cols } = atlas;
  const sx = (index % cols) * cell;
  const sy = Math.floor(index / cols) * cell;
  const size = cell * scale;
  ctx.drawImage(atlas.img, sx, sy, cell, cell, Math.round(x), Math.round(y), size, size);
}
