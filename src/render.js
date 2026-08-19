/**
 * Drawing (lesson A16): a camera, the tiles it can see, and the monsters
 * standing on them.
 *
 * The camera is one subtraction. It says how far the world has slid; every
 * drawn thing takes that away from its own world position. Clamping it to the
 * map means you never see past the end of the world.
 */
import { drawTile } from './sprites.js';

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
 * art inside it is drawn at a whole-number scale (`world.scale`, 2). Both
 * dimensions are snapped down to a multiple of that scale so an art pixel can
 * never straddle a boundary, and the size is set in real `px` on the element as
 * well, so the browser is never asked to stretch anything either.
 *
 * The world is not endless: past its own size there is nothing to show, so the
 * canvas stops growing there and the page's background frames it.
 *
 * Resizing a canvas resets its 2D context — including `imageSmoothingEnabled` —
 * so that is set again here, every time, rather than once at boot.
 */
export function fitCanvas({ canvas, ctx, box, world }) {
  const step = world.scale;
  const fit = (available, limit) => {
    const wanted = Math.min(Math.floor(available), limit);
    return Math.max(step, wanted - (wanted % step));
  };

  const width = fit(box.clientWidth, world.width);
  const height = fit(box.clientHeight, world.height);
  if (canvas.width === width && canvas.height === height) return { width, height, changed: false };

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.imageSmoothingEnabled = false;
  return { width, height, changed: true };
}

export function createCamera(canvas, world) {
  const camera = {
    x: 0,
    y: 0,

    follow(target) {
      camera.x = target.x + target.w / 2 - canvas.width / 2;
      camera.y = target.y + target.h / 2 - canvas.height / 2;
      camera.clamp();
    },

    // Stop at the edges. If the map is smaller than the canvas, Math.max(0, …)
    // wins and the map sits against the top-left corner.
    clamp() {
      camera.x = Math.max(0, Math.min(world.width - canvas.width, camera.x));
      camera.y = Math.max(0, Math.min(world.height - canvas.height, camera.y));
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
    x: NaN, y: NaN, width: NaN, height: NaN,
  };
}

export function drawMap(ctx, layer, world, atlas, camera) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const stale = layer.x !== camera.x || layer.y !== camera.y ||
                layer.width !== width || layer.height !== height;

  if (stale) {
    if (layer.canvas.width !== width) layer.canvas.width = width;
    if (layer.canvas.height !== height) layer.canvas.height = height;
    const lctx = layer.canvas.getContext('2d');
    // Resizing a canvas resets its context, same trap as `fitCanvas` - set
    // every time a resize might have just happened, not once at boot.
    lctx.imageSmoothingEnabled = false;
    paintTiles(lctx, world, atlas, camera, width, height);
    layer.x = camera.x;
    layer.y = camera.y;
    layer.width = width;
    layer.height = height;
  }

  ctx.drawImage(layer.canvas, 0, 0);
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

export function drawActor(ctx, atlas, actor, camera, scale) {
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
    ctx.restore();
  } else {
    drawTile(ctx, atlas, actor.cell, x, y, scale);
  }

  // The nameplate and the bubble are text: they are placed from these numbers
  // and are never mirrored, whichever way the monster is looking.
  return { x, y, sprite, flipped };
}

/**
 * A preset phrase, above the nameplate, for a few seconds.
 *
 * The text is looked up from our own PHRASES list by the number that arrived,
 * so what is drawn here is always one of ours — there is no path from the
 * network to a string on this screen.
 */
export function drawBubble(ctx, text, centerX, bottomY) {
  if (!text) return;
  ctx.save();
  ctx.font = 'bold 11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const width = Math.ceil(ctx.measureText(text).width) + 12;
  const height = 16;
  const x = Math.round(centerX - width / 2);
  const y = Math.round(bottomY - height);

  ctx.fillStyle = 'rgba(244, 244, 252, 0.94)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 5);
  ctx.fill();
  // The little tail that points at whoever said it.
  ctx.beginPath();
  ctx.moveTo(Math.round(centerX) - 3, y + height);
  ctx.lineTo(Math.round(centerX) + 3, y + height);
  ctx.lineTo(Math.round(centerX), y + height + 4);
  ctx.fill();

  ctx.fillStyle = '#14141c';
  ctx.fillText(text, Math.round(centerX), y + height / 2 + 0.5);
  ctx.restore();
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

/** The name above your head. Chunky on purpose: it is a pixel game. */
export function drawNameplate(ctx, text, centerX, baselineY, { self = false } = {}) {
  if (!text) return;
  ctx.save();
  ctx.font = 'bold 10px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const width = Math.ceil(ctx.measureText(text).width) + 8;
  const height = 13;
  const x = Math.round(centerX - width / 2);
  const y = Math.round(baselineY - height);

  ctx.fillStyle = 'rgba(12, 12, 18, 0.78)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = self ? '#ffd76a' : '#cfd2e6';
  ctx.fillText(text, Math.round(centerX), y + height / 2 + 0.5);
  ctx.restore();
}
