/**
 * Which pictures in the sheet the map maker will paint with.
 *
 * `vendor/kenney/tiny-dungeon.png` is a dungeon-crawler set, and the bottom
 * third of it is a cast: a wizard, a skeleton, a ghost, a red devil, a spider,
 * potions and wands. **None of that belongs in this game.** It was asked for
 * plainly — no magic, no ghosts, nothing occult — and there is a second reason
 * that would hold anyway: in Kakkoi the creatures on screen are *people*, one
 * sprite per player. A monster painted into the floor is a thing you can walk
 * through and cannot talk to, which is a worse lie than leaving it out.
 *
 * So the map maker paints the *place* — floors, walls, doors, stairs, fences,
 * furniture, and the three chests — and nothing that is alive, armed or magic.
 *
 * The vendored sheet itself is untouched, and deliberately: `vendor/` holds
 * pinned copies of other people's work exactly as they published it (see
 * `vendor/README.md`), and a file we have quietly edited is a file nobody can
 * check. The list below is the choice, made here where it can be read, and it
 * is enforced in two places at once:
 *
 *   - `editor/main.js` does not draw the other squares in the palette, so there
 *     is nothing to look at and nothing to click;
 *   - `map-check.js` refuses a map that uses one, so pasting a ghost into the
 *     text box and pressing "Read it back" is refused too — which is the path
 *     that matters, because that is the one an AI could write.
 *
 * Numbers are tile positions in the sheet, counting left to right, top to
 * bottom, starting at 0. They are listed a sheet-row at a time so that this
 * file can be compared against the picture by eye.
 */

export const PAINTABLE = Object.freeze([
  // Rows 0-3: cave walls, cut stone, windows, doorways and stairs.
  // 7 and 8 are a fountain running with something green, and 19 and 20 are a
  // carved demon's face — the same fixture, spitting. Those four are out.
  0, 1, 2, 3, 4, 5, 6, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 45, 46, 47,

  // Row 4: floors — sand, flagstones, the edges between them.
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,

  // Rows 5-6: furniture. 60, 61 and 62 are left out for a duller reason —
  // they are the sheet's own marker squares (a cursor, a crossed-out box), not
  // scenery, and painting one into a room would just look like a mistake.
  63, 64, 65, 66, 67, 68, 69, 70, 71,
  72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,

  // Row 7: the chests and the last of the fencing. 84-88 are people and a
  // skeleton; 92 is a chest with teeth. The town already stands on 90.
  89, 90, 91, 93, 94, 95,
]);

const set = new Set(PAINTABLE);

/** Is this tile one the map maker offers? */
export function isPaintable(tile) {
  return set.has(tile);
}

/** The same list as a Set, for `map-check.js`. */
export const paintable = set;
