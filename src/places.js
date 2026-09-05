/**
 * Every place there is, and the doors between them (M8).
 *
 * Until now the game loaded one map at boot and that was the world. This is the
 * file that makes "the world" plural: it reads `data/maps/maps.json`, loads
 * every map named in it, and hands back a lookup from a map's id to its world.
 *
 * **Why load them all at boot rather than when somebody opens a door.** Because
 * a door that pauses is a door that feels broken, and because the whole game is
 * meant to work with no network at all — a map fetched at the moment it is
 * walked into is a map that is missing on a train. Two maps of a few kilobytes
 * each is nothing next to the two atlases that were already being waited for.
 * This is a decision with a limit in it, and the limit is written down in
 * `MAX_PLACES` below: if this ever becomes a game with forty student maps in
 * it, that is the moment to load them on the way through the door instead, and
 * this comment is the note saying so.
 *
 * **A map's id is its filename**, not a field inside it — see the note at the
 * top of `world.js`. `maps.json` lists ids; this file turns each into
 * `data/maps/<id>.json`.
 *
 * **The doors are checked here, once, out loud.** `map-check.js` can only see
 * one map at a time, so it can tell you a door is shaped wrong but never that
 * it leads nowhere. That question needs all of them at once, which is this
 * file, and it is answered at boot with a console warning naming the map and
 * the door — because the alternative is a child walking into a wall that was
 * supposed to be a corridor and having no idea why. A door that leads nowhere
 * is dropped rather than crashed on: the rest of the world is still a world.
 */
import { loadWorld } from './world.js';

/**
 * How many maps this way of doing it is willing to load at boot. Not a
 * technical limit — a reminder. See the note above.
 */
export const MAX_PLACES = 12;

/** A map id is a filename, so it may only be the things a filename may be. */
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * loadPlaces('./data/maps/maps.json') -> {
 *   start, get(id), has(id), all(), ids
 * }
 */
export async function loadPlaces(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`maps ${url}: ${response.status}`);
  const listing = await response.json();

  const ids = (Array.isArray(listing.places) ? listing.places : []).filter((id) => {
    if (typeof id === 'string' && ID.test(id)) return true;
    console.warn(`places: "${id}" is not a usable map name and was skipped`);
    return false;
  });

  if (!ids.length) throw new Error(`${url} does not name any maps`);
  if (ids.length > MAX_PLACES) {
    console.warn(`places: ${ids.length} maps is more than this loads at boot; see MAX_PLACES`);
  }

  const folder = url.replace(/[^/]*$/, '');
  const worlds = await Promise.all(ids.map((id) => loadWorld(`${folder}${id}.json`, id)));

  const byId = new Map();
  for (const world of worlds) byId.set(world.id, world);

  // Where a player with no save, or a save naming a map that has since been
  // removed, begins. It has to be a map we actually loaded or there is no game.
  const start = byId.has(listing.start) ? listing.start : ids[0];
  if (start !== listing.start) {
    console.warn(`places: the starting map "${listing.start}" is not in the list; using "${start}"`);
  }

  for (const world of worlds) checkDoors(world, byId);

  return {
    start,
    ids: [...byId.keys()],
    has: (id) => byId.has(id),
    /** The world with this id, or null. Never throws: an id can come off the wire. */
    get: (id) => byId.get(id) || null,
    all: () => [...byId.values()],
  };
}

/**
 * Does every door in this map lead to a real square in a real map?
 *
 * Three ways it can fail, and all three are the kind of mistake somebody makes
 * once: naming a map that is not in `maps.json`, landing outside the map, and
 * landing inside a wall. The last is the one worth the trouble — it is invisible
 * in the file, it needs the target map's collision to answer, and what it does
 * to a player is drop them somewhere they cannot walk out of.
 *
 * A door that fails is removed from the world it is in. The map still works;
 * that one square is just a square again.
 */
function checkDoors(world, byId) {
  const kept = [];
  for (const door of world.doors) {
    const to = byId.get(door.to);
    const where = `${world.id} (${door.col}, ${door.row})`;

    if (!to) {
      console.warn(`places: the door at ${where} leads to "${door.to}", which is not a map here`);
      continue;
    }
    const at = door.spawn;
    if (!at || !Number.isInteger(at.col) || !Number.isInteger(at.row) ||
        at.col < 0 || at.row < 0 || at.col >= to.cols || at.row >= to.rows) {
      console.warn(`places: the door at ${where} arrives off the edge of ${to.id}`);
      continue;
    }
    if (to.isSolid(at.col, at.row)) {
      console.warn(`places: the door at ${where} arrives inside a wall in ${to.id}`);
      continue;
    }
    kept.push(door);
  }

  if (kept.length !== world.doors.length) rebuildDoors(world, kept);
}

/**
 * Take the broken doors back out of a world that has already been made.
 *
 * `createWorld` builds its lookup once, so removing a door means rebuilding it.
 * It is done by writing over the two things that hold doors rather than by
 * making a second world, because everything else — `main.js`, the camera, the
 * net — is about to be handed this exact object.
 */
function rebuildDoors(world, doors) {
  const lookup = new Map();
  for (const door of doors) lookup.set(door.row * world.cols + door.col, door);
  world.doors = doors;
  world.doorAt = (col, row) => lookup.get(row * world.cols + col) || null;
}
