/**
 * Is this map a place a person can actually play in?
 *
 * The editor asks before it will let anybody propose a map, and the tests ask
 * the same questions of the same code. It is in `src/` rather than in `editor/`
 * on purpose: the game is the thing that has to survive a bad map, so the rule
 * about what a map may be belongs with the game.
 *
 * There is no build step and no check job in CI (see `DESIGN.md`), so this is
 * the only gate a map goes through before a human looks at it. It is written to
 * be told to a twelve-year-old: every problem it finds says what is wrong and
 * where, and the last of them — *you cannot get out of here* — is answered by
 * walking the map the way the player would.
 */
import { createWorld } from './world.js';
import { paintable } from './tiles.js';

/** As big as a map may be. Past this it is not a room, it is a wallpaper. */
export const MAX_SIDE = 96;
export const MIN_SIDE = 8;

/** How much floor has to be reachable from the spawn for it to be a place. */
export const MIN_FLOOR = 12;

/**
 * check(map, { cells, allowed }) -> { ok, problems: [...], reachable: Set<index>, floor }
 *
 * `cells` is how many pictures the atlas has, so a tile number that is not in
 * the sheet can be named. `allowed` is the shorter list of the ones a map may
 * actually use (`tiles.js`), and it defaults to that list on purpose: this is
 * the gate every map goes through, including one an AI wrote and somebody
 * pasted in, so the rule has to hold without anybody remembering to ask for it.
 * Pass `allowed: null` to check a map's shape without that rule.
 *
 * Everything is a *problem*, never an exception: a map being wrong is the
 * ordinary case here, and the editor prints the list.
 */
export function check(map, { cells = Infinity, allowed = paintable } = {}) {
  const problems = [];
  const say = (what) => problems.push(what);

  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return { ok: false, problems: ['This is not a map at all.'], reachable: new Set(), floor: 0 };
  }

  const name = String(map.name ?? '').trim();
  if (!name) say('The map has no name.');
  if (name.length > 40) say('The name is longer than 40 letters.');

  const { width, height } = map;
  const sides = [['width', width], ['height', height]];
  for (const [which, n] of sides) {
    if (!Number.isInteger(n)) say(`The ${which} is not a whole number.`);
    else if (n < MIN_SIDE) say(`The ${which} is ${n}; the smallest a map may be is ${MIN_SIDE}.`);
    else if (n > MAX_SIDE) say(`The ${which} is ${n}; the biggest a map may be is ${MAX_SIDE}.`);
  }
  if (problems.length) return { ok: false, problems, reachable: new Set(), floor: 0 };

  const wanted = width * height;
  for (const layer of ['ground', 'decor']) {
    const list = map[layer];
    if (!Array.isArray(list)) { say(`There is no ${layer} layer.`); continue; }
    if (list.length !== wanted) {
      say(`The ${layer} layer has ${list.length} squares; ${width}x${height} needs ${wanted}.`);
      continue;
    }
    const low = layer === 'decor' ? -1 : 0;
    const bad = list.findIndex((n) => !Number.isInteger(n) || n < low || n >= cells);
    if (bad >= 0) {
      say(`The ${layer} layer has ${list[bad]} at column ${bad % width}, row ${Math.floor(bad / width)}, ` +
          `and the tile sheet only goes up to ${cells - 1}.`);
      continue;
    }
    // And of the pictures that do exist, the ones a map is allowed to be made
    // of. The sheet has monsters in it; a map does not get to have any.
    if (allowed) {
      const off = list.findIndex((n) => n >= 0 && !allowed.has(n));
      if (off >= 0) {
        say(`The ${layer} layer has tile ${list[off]} at column ${off % width}, row ${Math.floor(off / width)}. ` +
            `The map maker does not paint that one: it draws places — floors, walls, doors and furniture — ` +
            `and nothing alive, armed or magic. Pick a tile from the palette instead.`);
      }
    }
  }

  if (!Array.isArray(map.solid) || map.solid.some((n) => !Number.isInteger(n))) {
    say('The list of tiles you cannot walk through is missing or has something odd in it.');
  }

  const spawn = map.spawn;
  if (!spawn || !Number.isInteger(spawn.col) || !Number.isInteger(spawn.row)) {
    say('There is nowhere for a player to start.');
  } else if (spawn.col < 0 || spawn.row < 0 || spawn.col >= width || spawn.row >= height) {
    say(`The starting square (${spawn.col}, ${spawn.row}) is off the edge of the map.`);
  }

  checkDoors(map, width, height, say);

  if (problems.length) return { ok: false, problems, reachable: new Set(), floor: 0 };

  // Everything above was about the file. This is about the place: walk it.
  const world = createWorld(map);
  if (world.isSolid(spawn.col, spawn.row)) {
    say('The starting square is inside a wall.');
    return { ok: false, problems, reachable: new Set(), floor: 0 };
  }

  const reachable = walk(world, spawn);
  if (reachable.size < MIN_FLOOR) {
    say(`Only ${reachable.size} squares can be reached from the start. ` +
        `A map needs at least ${MIN_FLOOR} to be somewhere rather than a cupboard.`);
  }

  // And the question a size alone cannot answer: is any of the floor you drew
  // walled off from the rest? A cupboard of twelve squares passes the count
  // above and is still a mistake. Every square that is not a wall is somewhere
  // the player is meant to be able to stand, so anything they cannot reach is
  // either a door you forgot or a room you meant to fill in. The town that
  // ships has none: 653 squares of floor, 653 of them reachable.
  // A door drawn into a wall, or into a room the player cannot get to, is a door
  // that does not exist. It is checked here rather than above because it takes
  // the same flood fill the rest of this section runs on.
  for (const door of Array.isArray(map.doors) ? map.doors : []) {
    if (!door || !Number.isInteger(door.col) || !Number.isInteger(door.row)) continue;
    if (door.col >= width || door.row >= height) continue;
    if (!reachable.has(door.row * width + door.col)) {
      say(`The door at (${door.col}, ${door.row}) is inside a wall, or in a part of the ` +
          `map the player cannot walk to. Nobody can ever use it.`);
    }
  }

  const cutOff = countFloor(world) - reachable.size;
  if (cutOff > 0) {
    say(`${cutOff} ${cutOff === 1 ? 'square' : 'squares'} of floor cannot be reached from the start ` +
        `— they are behind a wall. Knock a door through, or fill them in.`);
  }

  return { ok: problems.length === 0, problems, reachable, floor: reachable.size, cutOff };
}

/**
 * The doors, as far as one map on its own can tell.
 *
 * `doors` is optional: a map with none is a place you can only be put down in,
 * which is what every map in this game was until M8 and is still a perfectly
 * good thing for a map to be.
 *
 * **What cannot be checked from here.** Whether `to` names a map that exists,
 * and whether the square it arrives on is inside a wall, are questions about a
 * map this function has never seen. They are answered at boot instead, by
 * `src/places.js`, which has all of them at once. So this checks the half that
 * is local — the door is on this map, it is somewhere you could stand, it says
 * where it goes, and it says where you come out — and says nothing about the
 * far end.
 */
function checkDoors(map, width, height, say) {
  if (map.doors === undefined) return;
  if (!Array.isArray(map.doors)) return say('The list of doors is not a list.');
  if (map.doors.length > 8) {
    say(`There are ${map.doors.length} doors; a map may have up to 8.`);
  }

  const seen = new Set();
  map.doors.forEach((door, n) => {
    const which = `Door ${n + 1}`;
    if (!door || typeof door !== 'object' || Array.isArray(door)) {
      return say(`${which} is not a door.`);
    }
    if (!Number.isInteger(door.col) || !Number.isInteger(door.row) ||
        door.col < 0 || door.row < 0 || door.col >= width || door.row >= height) {
      return say(`${which} is not on the map.`);
    }
    const at = door.row * width + door.col;
    if (seen.has(at)) {
      say(`${which} is on the same square as another door, (${door.col}, ${door.row}).`);
    }
    seen.add(at);

    // A map id is a filename, so it may only be what a filename may be — see the
    // note at the top of `world.js`.
    if (typeof door.to !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(door.to)) {
      say(`${which} does not say which map it goes to, or names one in a way a ` +
          `file cannot be named: lower case letters, digits and dashes only.`);
    }

    const to = door.spawn;
    if (!to || !Number.isInteger(to.col) || !Number.isInteger(to.row) ||
        to.col < 0 || to.row < 0) {
      say(`${which} does not say where you come out.`);
    }
  });
}

/** Every square that is not a wall — everywhere the player is meant to stand. */
export function countFloor(world) {
  let floor = 0;
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) if (!world.isSolid(col, row)) floor++;
  }
  return floor;
}

/**
 * Every square you can get to from the start, by walking.
 *
 * A flood fill: stand on a square, look at its four neighbours, and keep the
 * ones you have not seen and can stand on. Repeat until there is nothing new.
 * It is the same question the player's feet ask, which is why it catches the
 * mistake no amount of reading the file would — a room with the door drawn shut.
 */
export function walk(world, from) {
  const seen = new Set();
  const queue = [[from.col, from.row]];
  seen.add(from.row * world.cols + from.col);

  while (queue.length) {
    const [col, row] = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= world.cols || r >= world.rows) continue;
      const i = r * world.cols + c;
      if (seen.has(i) || world.isSolid(c, r)) continue;
      seen.add(i);
      queue.push([c, r]);
    }
  }
  return seen;
}

/**
 * A map as a file, written the way `data/maps/town.json` is written: the
 * settings one per line so a person can read them, and the two big layers on a
 * line each so that a pull request shows a change to a room and not a wall of
 * seventeen hundred numbers.
 */
export function toJson(map) {
  const rows = [
    `  "name": ${JSON.stringify(map.name)}`,
    `  "atlas": ${JSON.stringify(map.atlas || 'dungeon')}`,
    `  "tileSize": ${map.tileSize || 16}`,
    `  "width": ${map.width}`,
    `  "height": ${map.height}`,
    `  "spawn": { "col": ${map.spawn.col}, "row": ${map.spawn.row} }`,
    `  "solid": [${map.solid.join(', ')}]`,
  ];

  // The map maker has no door tool, and a map with no doors should not grow an
  // empty list just for passing through it. But a map that HAS doors must come
  // out of here with them: `editor/main.js` adopts a loaded map whole, so the
  // only way to lose them is to forget them here — and losing them silently
  // would turn "I opened the town in the map maker and looked at it" into a
  // pull request that seals the town shut.
  if (Array.isArray(map.doors) && map.doors.length) {
    const doors = map.doors.map((door) =>
      `    { "col": ${door.col}, "row": ${door.row}, "to": ${JSON.stringify(door.to)}, ` +
      `"spawn": { "col": ${door.spawn.col}, "row": ${door.spawn.row} } }`);
    rows.push(`  "doors": [\n${doors.join(',\n')}\n  ]`);
  }

  rows.push(`  "ground": [${map.ground.join(',')}]`);
  rows.push(`  "decor": [${map.decor.join(',')}]`);
  return `{\n${rows.join(',\n')}\n}\n`;
}

/** A name a file can have: lower case, no spaces, nothing surprising. */
export function slug(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'a-new-place';
}
