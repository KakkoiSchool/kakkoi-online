/**
 * Drawing (lesson A16): a camera, the tiles it can see, and the monsters
 * standing on them.
 *
 * The camera is one subtraction. It says how far the world has slid; every
 * drawn thing takes that away from its own world position. Clamping it to the
 * map means you never see past the end of the world.
 */
import { drawTile } from './sprites.js';
import { WORLD_SCALE } from './world.js';

/**
 * Make the canvas exactly as big as the space it has been given.
 *
 * It used to be a fixed 640x480 stretched by CSS to whatever width was left
 * over, which cost twice: on a phone the world got about a third of the screen,
 * and 640 real pixels shown across 374 of them meant one art pixel landed on
 * 1.17 screen pixels — so the pixel art was quietly resampled, which is the one
 * thing pixel art must never be.
 *
 * Now the drawing surface IS the box, one canvas pixel per CSS pixel, and the
 * art inside it is drawn at a whole-number scale: `world.scale` (always 2) times
 * `zoom` (1 or 2, chosen for the device by `ui/scale.js`). Both dimensions are
 * snapped down to a multiple of that product, so an art pixel can never straddle
 * a boundary, and the size is set in real `px` on the element as well, so the
 * browser is never asked to stretch anything either.
 *
 * It no longer stops at the size of the world. The world is not endless, but
 * refusing to grow past it was what letterboxed the game inside a big window,
 * and `createCamera` already handles a canvas larger than the map — the clamp's
 * `Math.max(0, …)` wins and the map sits against the corner, with the page's
 * background showing past its edges.
 *
 * Resizing a canvas resets its 2D context — including `imageSmoothingEnabled`
 * and any transform — so that is set again here, every time, rather than once at
 * boot.
 *
 * `scale` is `world.scale`, and it defaults to `WORLD_SCALE` — the same constant
 * the world itself defaults to — so this can be called before the map has
 * finished loading. That is what makes the loading screen the size of the screen
 * instead of a 640x480 box in the middle of it.
 */
export function fitCanvas({ canvas, ctx, box, scale = WORLD_SCALE, zoom = 1 }) {
  const step = scale * zoom;
  const fit = (available) => {
    const wanted = Math.floor(available);
    return Math.max(step, wanted - (wanted % step));
  };

  const width = fit(box.clientWidth);
  const height = fit(box.clientHeight);
  if (canvas.width === width && canvas.height === height) return { width, height, changed: false };

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.imageSmoothingEnabled = false;
  return { width, height, changed: true };
}

/**
 * The camera, in world pixels.
 *
 * `view.zoom` is how many screen pixels one world pixel gets — 1 on a phone, 2
 * on anything roomier. So the piece of the world on screen is the canvas
 * divided by it, and that is the only place the zoom appears here: everything
 * else in this file, and everything in the game, stays in world pixels, which
 * is what the save and the network are written in.
 */
export function createCamera(canvas, world, view = { zoom: 1 }) {
  const across = () => canvas.width / view.zoom;
  const down = () => canvas.height / view.zoom;

  const camera = {
    x: 0,
    y: 0,

    follow(target) {
      camera.x = target.x + target.w / 2 - across() / 2;
      camera.y = target.y + target.h / 2 - down() / 2;
      camera.clamp();
    },

    // Stop at the edges. If the map is smaller than what fits on screen,
    // Math.max(0, …) wins and the map sits against the top-left corner.
    clamp() {
      camera.x = Math.max(0, Math.min(world.width - across(), camera.x));
      camera.y = Math.max(0, Math.min(world.height - down(), camera.y));
      // Whole pixels only, or the tile grid shimmers as you walk.
      camera.x = Math.round(camera.x);
      camera.y = Math.round(camera.y);
    },
  };
  return camera;
}

/**
 * The tile map only changes when the camera moves or the canvas resizes -
 * the tiles under it never do, today. Redrawing all ~650 of them from
 * scratch every frame, whether or not the camera had gone anywhere, was one
 * of the two things this game was doing 60 (or 120) times a second for no
 * reason (see ISSUES.md #1). So the map is painted once, onto a canvas
 * nobody sees, and kept until the camera or the canvas size actually change;
 * every other frame is one `drawImage` that blits the same pixels back.
 *
 * The cache lives for as long as the game does, so it is made once in
 * `main.js` and threaded through here rather than kept as module state -
 * a second canvas element on the page would otherwise be a strange thing to
 * find hiding in a module that draws to whatever canvas it is handed.
 */
export function createMapLayer() {
  return {
    canvas: document.createElement('canvas'),
    // NaN so the very first call never matches and always paints.
    x: NaN, y: NaN, width: NaN, height: NaN, zoom: NaN,
  };
}

export function drawMap(ctx, layer, world, atlas, camera, zoom = 1) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const stale = layer.x !== camera.x || layer.y !== camera.y ||
                layer.width !== width || layer.height !== height ||
                layer.zoom !== zoom;

  if (stale) {
    if (layer.canvas.width !== width) layer.canvas.width = width;
    if (layer.canvas.height !== height) layer.canvas.height = height;
    const lctx = layer.canvas.getContext('2d');
    // Resizing a canvas resets its context, same trap as `fitCanvas` - set
    // every time a resize might have just happened, not once at boot.
    lctx.imageSmoothingEnabled = false;
    lctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    paintTiles(lctx, world, atlas, camera, width / zoom, height / zoom);
    layer.x = camera.x;
    layer.y = camera.y;
    layer.width = width;
    layer.height = height;
    layer.zoom = zoom;
  }

  // The blit is in screen pixels, so it goes under whatever transform the
  // caller has set rather than through it.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}

function paintTiles(ctx, world, atlas, camera, width, height) {
  const t = world.tile;
  const firstCol = Math.max(0, Math.floor(camera.x / t));
  const lastCol = Math.min(world.cols - 1, Math.floor((camera.x + width) / t));
  const firstRow = Math.max(0, Math.floor(camera.y / t));
  const lastRow = Math.min(world.rows - 1, Math.floor((camera.y + height) / t));

  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const i = row * world.cols + col;
      const x = col * t - camera.x;
      const y = row * t - camera.y;
      drawTile(ctx, atlas, world.ground[i], x, y, world.scale);
      const decor = world.decor[i];
      if (decor >= 0) drawTile(ctx, atlas, decor, x, y, world.scale);
    }
  }
}

/**
 * Draw one monster.
 *
 * Tiny Creatures has no walk frames, so a walking monster bobs one art pixel
 * up and down about seven times a second instead. That is motion without
 * inventing art — and it is a deliberate difference from the A14 demo, which
 * had a sheet with legs in it.
 *
 * **Facing.** Every creature on the sheet is drawn looking right, so walking
 * left is drawn by mirroring the sprite: slide the origin to the middle of it,
 * flip the x axis with `scale(-1, 1)`, and draw half a sprite to the left of
 * the new origin. `actor.facing` is +1 or -1 and is never zero — standing still
 * keeps whichever way you were last going, because a monster that snaps back to
 * facing right the moment you let go of the key looks broken.
 *
 * The flip is a transform, not a different picture, so smoothing has to be off
 * on the far side of it as well or the mirrored pixels come out fuzzy.
 */
export const BOB_HZ = 7;

export function drawActor(ctx, atlas, actor, camera, scale, overlay = null) {
  const sprite = atlas.cell * scale;
  const bob = actor.moving && Math.floor(actor.walked * BOB_HZ) % 2 === 1 ? -scale : 0;
  const x = actor.x + actor.w / 2 - sprite / 2 - camera.x;
  const y = actor.y + actor.h - sprite - camera.y + bob;
  const flipped = actor.facing === -1;

  // A soft shadow so the monster stands on the floor instead of hovering.
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(Math.round(actor.x + actor.w / 2 - camera.x),
              Math.round(actor.y + actor.h - camera.y - 2),
              sprite * 0.28, sprite * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (flipped) {
    const middle = Math.round(x + sprite / 2);
    ctx.save();
    ctx.translate(middle, 0);
    ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;   // still off on the other side of the flip
    drawTile(ctx, atlas, actor.cell, -sprite / 2, y, scale);
    // Inside the flip, so a pair of sunglasses turns around with the face it is
    // on rather than sliding off the back of the head.
    paintOverlay(ctx, overlay, -sprite / 2, y, scale);
    ctx.restore();
  } else {
    drawTile(ctx, atlas, actor.cell, x, y, scale);
    paintOverlay(ctx, overlay, x, y, scale);
  }

  // The name plate and the bubble are text, and they are DOM now — see
  // src/ui/bubbles.js. They are placed from the numbers returned here, and are
  // never mirrored, whichever way the monster is looking.
  return { x, y, sprite, flipped };
}

/**
 * Whatever this one is wearing, painted on top of it.
 *
 * The rectangles arrive in ART pixels with the sprite's own top-left corner as
 * the origin — `looks.js` has already moved them onto this creature's face —
 * so the only thing to do here is multiply by the scale the sprite was drawn
 * at. Whole numbers in, whole numbers out.
 */
function paintOverlay(ctx, overlay, x, y, scale) {
  if (!overlay) return;
  for (const [px, py, w, h, colour] of overlay) {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(x + px * scale), Math.round(y + py * scale), w * scale, h * scale);
  }
}

/**
 * The little arrow over whoever you are close enough to challenge.
 *
 * The affordance is the point: you find out you can fight somebody by walking
 * up to them, not by reading a list of names with a button beside each one.
 */
export function drawMarker(ctx, centerX, bottomY, now) {
  const lift = Math.round(Math.sin(now / 220) * 2);
  const y = Math.round(bottomY) - lift;
  ctx.save();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(Math.round(centerX) - 5, y - 6);
  ctx.lineTo(Math.round(centerX) + 5, y - 6);
  ctx.lineTo(Math.round(centerX), y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
