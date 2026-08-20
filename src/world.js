/**
 * The world: a map of tile numbers, and the rule that some of them are solid
 * (lessons A15 + A16).
 *
 * The map is data, not code — `data/maps/town.json`. Two layers of tile
 * numbers, `ground` (always drawn) and `decor` (drawn on top, -1 means
 * nothing), plus a list of which tile numbers you cannot walk through.
 *
 * Collision is deliberately tile-based rather than a list of rectangles: with
 * a grid you never search the whole map, you just work out which squares the
 * player's box touches and look those up.
 */

const EPS = 0.0001;   // keeps a box that ends exactly on a tile line out of the next tile

/**
 * How many screen pixels one art pixel is, in the world's own coordinates.
 *
 * This is the size of the coordinate space itself — the player's box,
 * `walkSpeed`, `challengeReachPx`, every saved position and every position that
 * goes over the wire are all measured in world pixels, which are art pixels
 * times this. It is a constant on purpose and must stay one: two browsers that
 * disagreed about it would disagree about where everybody is standing. How far
 * the art is zoomed in on THIS screen is a different number, and it lives in
 * `ui/scale.js`.
 *
 * Named here rather than left as a bare 2 because `render.js` needs the same
 * number before there is a world to read it from — see `fitCanvas`.
 */
export const WORLD_SCALE = 2;

export async function loadWorld(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`map ${url}: ${response.status}`);
  return createWorld(await response.json());
}

export function createWorld(data, scale = WORLD_SCALE) {
  const solid = new Set(data.solid || []);
  const tile = data.tileSize * scale;   // one tile on screen, in pixels

  const world = {
    name: data.name || 'somewhere',
    cols: data.width,
    rows: data.height,
    tile,
    scale,
    tileSize: data.tileSize,
    ground: data.ground,
    decor: data.decor || [],
    solid,
    spawn: data.spawn || { col: 1, row: 1 },
    get width() { return world.cols * tile; },
    get height() { return world.rows * tile; },

    /** Is the tile at this column/row something you cannot walk through? */
    isSolid(col, row) {
      if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) return true;
      const i = row * world.cols + col;
      return solid.has(world.ground[i]) || solid.has(world.decor[i]);
    },

    tileAt(col, row) {
      const i = row * world.cols + col;
      return { ground: world.ground[i], decor: world.decor[i] ?? -1 };
    },

    /** Top-left pixel of a tile, for spawning things on a whole square. */
    pixelOf(col, row) {
      return { x: col * tile, y: row * tile };
    },

    /**
     * Move a box along ONE axis and stop it at the first solid tile.
     *
     * Doing x and y as two separate calls is what makes sliding work: walk
     * diagonally into a wall and the blocked axis is refused while the free
     * one still happens, so you slide along the wall instead of sticking.
     */
    moveX(box, amount) {
      if (!amount) return 0;
      const before = box.x;
      for (const step of substeps(amount, tile)) stepX(world, box, step);
      box.x = clamp(box.x, 0, world.width - box.w);
      return box.x - before;
    },

    moveY(box, amount) {
      if (!amount) return 0;
      const before = box.y;
      for (const step of substeps(amount, tile)) stepY(world, box, step);
      box.y = clamp(box.y, 0, world.height - box.h);
      return box.y - before;
    },
  };

  return world;
}

// A very long frame (a tab that was hidden, a slow phone) could otherwise move
// the box straight through a wall. Never travel more than half a tile at once.
function substeps(amount, tile) {
  const max = tile / 2;
  const steps = [];
  let left = Math.abs(amount);
  const sign = Math.sign(amount);
  while (left > max) { steps.push(max * sign); left -= max; }
  steps.push(left * sign);
  return steps;
}

function stepX(world, box, amount) {
  const t = world.tile;
  let x = box.x + amount;
  const top = Math.floor(box.y / t);
  const bottom = Math.floor((box.y + box.h - EPS) / t);

  if (amount > 0) {
    const col = Math.floor((x + box.w - EPS) / t);
    for (let row = top; row <= bottom; row++) {
      if (world.isSolid(col, row)) { x = col * t - box.w; break; }
    }
  } else {
    const col = Math.floor(x / t);
    for (let row = top; row <= bottom; row++) {
      if (world.isSolid(col, row)) { x = (col + 1) * t; break; }
    }
  }
  box.x = x;
}

function stepY(world, box, amount) {
  const t = world.tile;
  let y = box.y + amount;
  const left = Math.floor(box.x / t);
  const right = Math.floor((box.x + box.w - EPS) / t);

  if (amount > 0) {
    const row = Math.floor((y + box.h - EPS) / t);
    for (let col = left; col <= right; col++) {
      if (world.isSolid(col, row)) { y = row * t - box.h; break; }
    }
  } else {
    const row = Math.floor(y / t);
    for (let col = left; col <= right; col++) {
      if (world.isSolid(col, row)) { y = (row + 1) * t; break; }
    }
  }
  box.y = y;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
