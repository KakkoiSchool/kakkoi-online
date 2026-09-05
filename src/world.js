/**
 * The world: a map of tile numbers, the rule that some of them are solid
 * (lessons A15 + A16), and the squares that are a way out of it (M8).
 *
 * The map is data, not code — `data/maps/town.json`. Two layers of tile
 * numbers, `ground` (always drawn) and `decor` (drawn on top, -1 means
 * nothing), plus a list of which tile numbers you cannot walk through.
 *
 * Collision is deliberately tile-based rather than a list of rectangles: with
 * a grid you never search the whole map, you just work out which squares the
 * player's box touches and look those up.
 *
 * **A world has a name and an id, and they are different things.** The name is
 * what a person reads in the corner of the screen — "Kakkoi Town", "The Lantern
 * Caves" — and it can be changed, translated or misspelled without breaking
 * anything. The id is the FILE the map came out of, so `data/maps/town.json` is
 * `town`, and it is what a door points at and what one browser tells another
 * about where its player is standing. Deriving it from the filename rather than
 * reading it out of the file is deliberate: two maps cannot then claim the same
 * id, and a student who loads the town in the map maker, changes it and proposes
 * it as their own has not accidentally proposed a second thing called `town`.
 * See `src/places.js`, which is what actually hands the id in.
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

export async function loadWorld(url, id = '') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`map ${url}: ${response.status}`);
  return createWorld(await response.json(), WORLD_SCALE, id);
}

export function createWorld(data, scale = WORLD_SCALE, id = '') {
  const solid = new Set(data.solid || []);
  const tile = data.tileSize * scale;   // one tile on screen, in pixels

  // Doors, looked up by the square they are on. A map has a handful of them at
  // most, and they are asked about every time the player's feet move onto a new
  // square, so the lookup is a Map from tile index rather than a search through
  // a list — the same reasoning as `solid` above, for the same reason.
  const doors = Array.isArray(data.doors) ? data.doors : [];
  const doorAt = new Map();
  for (const door of doors) {
    if (!door || !Number.isInteger(door.col) || !Number.isInteger(door.row)) continue;
    doorAt.set(door.row * data.width + door.col, door);
  }

  const world = {
    /** Which file this came out of. See the note at the top. */
    id,
    name: data.name || 'somewhere',
    cols: data.width,
    rows: data.height,
    tile,
    scale,
    tileSize: data.tileSize,
    ground: data.ground,
    decor: data.decor || [],
    solid,
    doors,
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

    /**
     * The way out of here from this square, if this square is one.
     *
     * A door is a place, not a picture: it is a square listed in the map's own
     * `doors`, and whatever tile happens to be painted there is only what it
     * looks like. That is on purpose — the tile sheet has one doorway picture
     * and the town uses it as scenery in a dozen places, so "you walk through
     * anything that looks like a door" would teleport somebody out of the world
     * every time they walked past a house.
     */
    doorAt(col, row) {
      return doorAt.get(row * world.cols + col) || null;
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
