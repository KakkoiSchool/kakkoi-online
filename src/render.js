/**
 * Drawing (lesson A16): a camera, the tiles it can see, and the monsters
 * standing on them.
 *
 * The camera is one subtraction. It says how far the world has slid; every
 * drawn thing takes that away from its own world position. Clamping it to the
 * map means you never see past the end of the world.
 */
import { drawTile } from './sprites.js';

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

export function drawMap(ctx, world, atlas, camera) {
  const t = world.tile;
  const firstCol = Math.max(0, Math.floor(camera.x / t));
  const lastCol = Math.min(world.cols - 1, Math.floor((camera.x + ctx.canvas.width) / t));
  const firstRow = Math.max(0, Math.floor(camera.y / t));
  const lastRow = Math.min(world.rows - 1, Math.floor((camera.y + ctx.canvas.height) / t));

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
 */
export const BOB_HZ = 7;

export function drawActor(ctx, atlas, actor, camera, scale) {
  const sprite = atlas.cell * scale;
  const bob = actor.moving && Math.floor(actor.walked * BOB_HZ) % 2 === 1 ? -scale : 0;
  const x = actor.x + actor.w / 2 - sprite / 2 - camera.x;
  const y = actor.y + actor.h - sprite - camera.y + bob;

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

  drawTile(ctx, atlas, actor.cell, x, y, scale);
  return { x, y, sprite };
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
