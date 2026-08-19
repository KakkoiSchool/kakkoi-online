/**
 * The glyphs (new in this pass).
 *
 * The moves used to be emoji: ✊ ✋ ✌ in the buttons and in the face-off. Emoji
 * are drawn by the operating system, so the game's own art was the only thing
 * on the screen the game controlled — a rock was a grey fist on one phone, a
 * yellow cartoon hand on another, and a flat outline on a third, at whatever
 * size and weight that vendor felt like. None of them are pixel art.
 *
 * These are: 16×16, `shapeRendering="crispEdges"`, drawn as rectangles on the
 * same grid as the tiles. One <symbol> each, defined once in index.html, used
 * by reference everywhere — a move button, a face-off box, and a bubble over
 * somebody's head are then literally the same picture at three sizes.
 *
 * `SHEET` is a string on purpose: it is injected once at boot, so there is no
 * request to make and nothing to cache, and it works offline like the rest.
 */

export const GLYPHS = ['rock', 'paper', 'scissors', 'win', 'lose', 'think', 'gear'];

/** One <svg><use> for a glyph. `name` is never anything but a key above. */
export function glyph(name) {
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><use href="#g-${name}"></use></svg>`;
}

export const SHEET = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <symbol id="g-rock" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="6" y="4" width="4" height="1" fill="#b9b9cc"/>
    <rect x="5" y="5" width="6" height="1" fill="#c9c9dd"/>
    <rect x="4" y="6" width="8" height="1" fill="#c9c9dd"/>
    <rect x="3" y="7" width="10" height="2" fill="#b0b0c4"/>
    <rect x="4" y="9" width="8" height="1" fill="#8b8ba0"/>
    <rect x="5" y="10" width="6" height="1" fill="#6f6f86"/>
    <rect x="6" y="5" width="2" height="1" fill="#eef0ff"/>
    <rect x="5" y="7" width="2" height="1" fill="#e3e5f5"/>
  </symbol>
  <symbol id="g-paper" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="4" y="3" width="8" height="10" fill="#f3f3fb"/>
    <rect x="10" y="3" width="2" height="2" fill="#c3c3d8"/>
    <rect x="6" y="6" width="4" height="1" fill="#9a9ab5"/>
    <rect x="6" y="8" width="4" height="1" fill="#9a9ab5"/>
    <rect x="6" y="10" width="3" height="1" fill="#9a9ab5"/>
    <rect x="4" y="12" width="8" height="1" fill="#c3c3d8"/>
  </symbol>
  <symbol id="g-scissors" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="4" y="2" width="1" height="1" fill="#d6d8ea"/>
    <rect x="5" y="3" width="1" height="1" fill="#d6d8ea"/>
    <rect x="6" y="4" width="1" height="1" fill="#d6d8ea"/>
    <rect x="7" y="5" width="2" height="2" fill="#eef0ff"/>
    <rect x="11" y="2" width="1" height="1" fill="#d6d8ea"/>
    <rect x="10" y="3" width="1" height="1" fill="#d6d8ea"/>
    <rect x="9" y="4" width="1" height="1" fill="#d6d8ea"/>
    <rect x="6" y="7" width="1" height="1" fill="#b6b8cc"/>
    <rect x="9" y="7" width="1" height="1" fill="#b6b8cc"/>
    <rect x="4" y="8" width="4" height="4" fill="#ff7ab8"/>
    <rect x="5" y="9" width="2" height="2" fill="#191927"/>
    <rect x="8" y="8" width="4" height="4" fill="#ff7ab8"/>
    <rect x="9" y="9" width="2" height="2" fill="#191927"/>
  </symbol>
  <symbol id="g-win" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="4" y="5" width="2" height="3" fill="#7ce07c"/>
    <rect x="10" y="5" width="2" height="3" fill="#7ce07c"/>
    <rect x="4" y="10" width="1" height="1" fill="#7ce07c"/>
    <rect x="5" y="11" width="6" height="1" fill="#7ce07c"/>
    <rect x="11" y="10" width="1" height="1" fill="#7ce07c"/>
  </symbol>
  <symbol id="g-lose" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="4" y="5" width="2" height="3" fill="#9fc7ff"/>
    <rect x="10" y="5" width="2" height="3" fill="#9fc7ff"/>
    <rect x="4" y="12" width="1" height="1" fill="#9fc7ff"/>
    <rect x="5" y="11" width="6" height="1" fill="#9fc7ff"/>
    <rect x="11" y="12" width="1" height="1" fill="#9fc7ff"/>
  </symbol>
  <symbol id="g-think" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="3" y="7" width="2" height="2" fill="#e8e8ef"/>
    <rect x="7" y="7" width="2" height="2" fill="#e8e8ef"/>
    <rect x="11" y="7" width="2" height="2" fill="#e8e8ef"/>
  </symbol>
  <symbol id="g-gear" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="6" y="2" width="4" height="2" fill="currentColor"/>
    <rect x="6" y="12" width="4" height="2" fill="currentColor"/>
    <rect x="2" y="6" width="2" height="4" fill="currentColor"/>
    <rect x="12" y="6" width="2" height="4" fill="currentColor"/>
    <rect x="4" y="4" width="8" height="8" fill="currentColor"/>
    <rect x="6" y="6" width="4" height="4" fill="#191927"/>
  </symbol>
</defs></svg>`;

/** Put the sheet in the page. Idempotent: calling it twice is not a bug. */
export function installGlyphs(target = document.body) {
  if (document.getElementById('g-rock')) return;
  const holder = document.createElement('div');
  holder.innerHTML = SHEET;
  target.prepend(holder.firstElementChild);
}
