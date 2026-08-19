/**
 * How big the interface is, and how far the art is zoomed in, on whatever you
 * are holding.
 *
 * There are no breakpoints in `game.css` except two, and they are there because
 * the SHAPE of the duel card changes, not its size. Everything else comes from
 * here: one whole number of pixels, set as the root font size, from which every
 * `rem` in the stylesheet is derived.
 *
 * **Why a whole number.** The interface is drawn in the same idiom as the art —
 * a 0.14rem border has to land on a pixel boundary or a black outline comes out
 * as two greys, which is exactly the smudge `image-rendering: pixelated` exists
 * to prevent. A fractional unit gives you fractional borders.
 *
 * **Why derived from the smaller side.** A phone in landscape is 844 wide and
 * 390 tall; sizing from width alone would give it desktop-sized chrome with no
 * room to put it. Taking the smaller of the two means the interface fits the
 * screen you actually have, in both orientations, with no orientation query.
 */

const MIN_UNIT = 9;
const MAX_UNIT = 15;

/** The UI unit, in whole pixels, for a box of this size. */
export function uiUnit(width, height) {
  const wanted = Math.floor(Math.min(width / 30, height / 26));
  return Math.max(MIN_UNIT, Math.min(MAX_UNIT, wanted));
}

/**
 * How far to zoom the world in, as a whole number.
 *
 * The world is no longer fitted whole into the screen. It used to be, and it
 * cost twice on a phone: the town got about a third of the display and the
 * monsters were too small to tell apart. Now the zoom is chosen for the device
 * and a small screen simply sees less of the town — which is how every game
 * this one is pretending to be has always worked.
 *
 * **This is not `world.scale`, and must never become it.** `world.scale` is the
 * size of the coordinate space itself: the player's box, `walkSpeed`,
 * `challengeReachPx`, every saved position and every position that goes over
 * the wire are all measured in world pixels, which are art pixels times
 * `world.scale`. Making that number depend on the size of the window would mean
 * a phone and a desktop disagreeing about where everybody is standing — my x of
 * 400 landing halfway across your map — and a window being dragged wider would
 * teleport the player. So the coordinate space is left exactly as it was, at
 * ×2, and the zoom below is applied by `render.js` as a transform on the way to
 * the screen. One art pixel ends up `world.scale * zoom` screen pixels across,
 * and both of those are whole numbers, which is the only thing pixel art asks.
 */
export function artZoom(width, height) {
  return Math.max(1, Math.min(2, Math.floor(Math.min(width, height) / 300)));
}

/**
 * Apply the unit to the document and report what was decided.
 *
 * Called from the same place `fitCanvas()` is called from, on boot and on every
 * resize — the unit, the zoom and the canvas size are one decision and must not
 * be made in two places that can disagree.
 */
export function applyScale(box, root = document.documentElement) {
  const width = box.clientWidth;
  const height = box.clientHeight;
  const unit = uiUnit(width, height);
  // Only touch the DOM when the answer changed: this runs on every resize
  // event, and setting a root font size reflows the entire page.
  if (root.style.fontSize !== `${unit}px`) root.style.fontSize = `${unit}px`;
  return { unit, zoom: artZoom(width, height), width, height };
}
