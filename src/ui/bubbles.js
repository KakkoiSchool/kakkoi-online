/**
 * Name plates, and the bubble over somebody's head.
 *
 * Both used to be drawn into the canvas by `render.js` — `drawNameplate()` and
 * `drawBubble()`. Canvas text costs three things: it cannot be read by a screen
 * reader or found by the browser's own find, it is measured in device pixels so
 * it fought the UI scale, and every glyph had to be laid out by hand. This layer
 * is DOM over the canvas instead, positioned from the numbers `drawActor()`
 * already returns, so nothing about the drawing had to change.
 *
 * The new part is what a bubble can hold. It was a phrase or nothing; now it is
 * a phrase, a move (the same pixel glyph the duel buttons use), or a face — won
 * the round, lost the round, still thinking. That means a duel is legible from
 * the world: you can walk past two people mid-fight and see what happened
 * without opening anything. WHICH of those to show is not decided here — this
 * file draws what it is handed; `src/spectate.js` works out what the room may
 * see and hears the same from everybody else.
 *
 * **Placement.** A bubble sits above its own head, measured after it is in the
 * page, and clamped to the top of the world so it can never leave the screen. It
 * is NOT pushed down to clear the help line — pushing a bubble down would put it
 * on top of the animal it belongs to. Occlusion is a layering question, and
 * `game.css` settles it: `#tags` is above `#controls` and below `#hud`.
 *
 * **Why the elements are kept and not rebuilt.** The obvious version of this
 * file throws the whole layer away and builds it again every frame — a dozen
 * elements is nothing. It is not nothing at 30 frames a second on a phone: it is
 * a few hundred elements a second, and worse, reading `offsetHeight` back out of
 * each new bubble forces the browser to lay the page out again *inside* the
 * frame. ISSUES.md #1 is a phone getting hot; this file is not going to be the
 * next reason. So a plate and a bubble are made once per person, moved by
 * writing two numbers, and only measured on the frame their contents actually
 * changed.
 */
import { glyph } from './glyphs.js';

const FACES = new Set(['win', 'lose', 'think']);
const MOVES = new Set(['rock', 'paper', 'scissors']);

/** layer element -> id -> the plate and bubble we are already showing for it. */
const shown = new WeakMap();

/**
 * Put the layer where the people are.
 *
 * `layer` is `#tags`. Each actor is what `main.js` knows anyway:
 *
 *     { id, name, self, sx, sy, sprite, bubble }
 *
 * where `sx`/`sy`/`sprite` are canvas pixels — the numbers `drawActor()`
 * returned, times the zoom — and `bubble` is `null`, a phrase to say, or one of
 * the glyph names above. The canvas is 1:1 with CSS pixels, so canvas pixels are
 * what this layer is positioned in and nothing needs converting.
 */
export function drawTags(layer, actors) {
  if (!layer) return;
  let tags = shown.get(layer);
  if (!tags) { tags = new Map(); shown.set(layer, tags); }

  for (const actor of actors) {
    let tag = tags.get(actor.id);
    if (!tag) {
      tag = { plate: element('tag-plate'), bubble: null, name: null, said: null, high: 0 };
      tags.set(actor.id, tag);
      layer.append(tag.plate);
    }
    tag.seen = true;

    // The plate hangs under the feet, and it is the one thing everybody has.
    if (tag.name !== actor.name) {
      tag.name = actor.name;
      tag.plate.textContent = actor.name;
    }
    tag.plate.classList.toggle('is-self', Boolean(actor.self));
    place(tag.plate, actor.sx, actor.sy + actor.sprite + 2);

    if (!actor.bubble) { drop(tag); continue; }

    if (tag.said !== actor.bubble) {
      tag.said = actor.bubble;
      if (!tag.bubble) { tag.bubble = element('tag-bubble'); layer.append(tag.bubble); }
      tag.bubble.className = `tag-bubble${kindClass(actor.bubble)}`;
      // A move or a face is a picture; anything else is one of OUR OWN phrases,
      // looked up from `chat.js` by the number that arrived. There is no path
      // from the network to a string on this screen.
      if (MOVES.has(actor.bubble) || FACES.has(actor.bubble)) tag.bubble.innerHTML = glyph(actor.bubble);
      else tag.bubble.textContent = actor.bubble;
      // The only measurement in the file, and it happens on the frame the
      // contents changed rather than on every frame: how tall a bubble is
      // depends on the UI unit, the glyph inside it and the font, which is three
      // things this module has no business predicting.
      tag.high = tag.bubble.offsetHeight;
    }

    place(tag.bubble, actor.sx, Math.max(6, actor.sy - tag.high - 4));
  }

  // Whoever was not in the list has left, or has walked out of the world.
  for (const [id, tag] of tags) {
    if (tag.seen) { tag.seen = false; continue; }
    tag.plate.remove();
    drop(tag);
    tags.delete(id);
  }
}

function element(className) {
  const node = document.createElement('div');
  node.className = className;
  return node;
}

/** Two numbers, and never a read: writing a style does not lay the page out. */
function place(node, left, top) {
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

function drop(tag) {
  if (!tag.bubble) return;
  tag.bubble.remove();
  tag.bubble = null;
  tag.said = null;
  tag.high = 0;
}

function kindClass(bubble) {
  if (bubble === 'win') return ' is-win';
  if (bubble === 'lose') return ' is-lose';
  if (bubble === 'think') return ' is-think';
  return '';
}
