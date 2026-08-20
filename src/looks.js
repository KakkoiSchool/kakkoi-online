/**
 * What you are wearing, and how it is painted.
 *
 * A look is one of two things, and both of them are `data/cosmetics.json`
 * rather than code:
 *
 *   - a **tint**, which rotates the hue of every pixel of the creature's own
 *     sprite. No new art is downloaded, and it works on all six animals without
 *     anybody drawing anything six times. It is also the plainest possible
 *     demonstration of the thing that makes a canvas a canvas: *a picture is a
 *     list of numbers, and you can do arithmetic on it.*
 *   - an **overlay**, a short list of rectangles painted on top, positioned from
 *     the `face` anchor in `data/monsters.json`. The six animals face different
 *     ways — the lion looks at you, the elephant looks right — so a fixed
 *     rectangle would put sunglasses on an elbow. The anchor says where the eyes
 *     are; everything is measured from there.
 *
 * **A tint is computed once.** Rotating 160×288 pixels is not something to do in
 * a frame, so the first time a look is asked for, the whole sheet is recoloured
 * into an offscreen canvas and kept. Six monsters share one sheet, so it is one
 * canvas per tint and not one per monster.
 *
 * **Nothing here decides what you have earned.** That is `wins.js`. This file
 * takes an id and paints it, including ids it has never heard of — which it
 * paints as nothing at all, because the id might have come off the network.
 */

/** No look. The wire uses 0 for it, so 0 must never be a real look's id. */
export const BARE = 0;

export async function loadLooks(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`cosmetics ${url}: ${response.status}`);
  const data = await response.json();
  const looks = Array.isArray(data.looks) ? data.looks : [];
  for (const look of looks) {
    if (!Number.isInteger(look.id) || look.id <= 0) throw new Error(`cosmetics: ${look.name} has no usable id`);
  }
  return looks;
}

/**
 * createLooks({ looks, atlas }) -> {
 *   has(id), get(id), atlasFor(id), overlayFor(id, monster), all
 * }
 *
 * `atlas` is the creatures sheet, already loaded.
 */
export function createLooks({ looks = [], atlas }) {
  /** id -> the recoloured sheet, made the first time somebody wears it. */
  const tinted = new Map();

  const get = (id) => looks.find((look) => look.id === id) || null;

  /**
   * The sheet to draw this look's wearer from: a recoloured copy for a tint,
   * and the original for everything else — including an id we do not know,
   * which is what a peer running a newer build looks like from here.
   */
  function atlasFor(id) {
    const look = get(id);
    if (!look || look.kind !== 'tint' || !atlas.loaded) return atlas;
    if (!tinted.has(id)) tinted.set(id, recolour(atlas, look));
    return tinted.get(id);
  }

  /**
   * The rectangles to paint on top, already moved to where this creature's face
   * is. In art pixels, with the sprite's own top-left as the origin, which is
   * what `render.js` draws in.
   */
  function overlayFor(id, monster) {
    const look = get(id);
    if (!look || look.kind !== 'overlay' || !Array.isArray(look.pixels)) return null;
    const face = monster?.face;
    if (!face) return null;
    return look.pixels.map(([dx, dy, w, h, colour]) => [face.x + dx, face.y + dy, w, h, colour]);
  }

  return {
    all: looks,
    get,
    has: (id) => Boolean(get(id)),
    atlasFor,
    overlayFor,
    /** For checking from the console: how many sheets have been recoloured. */
    get tints() { return tinted.size; },
  };
}

/**
 * A recoloured copy of the whole sheet.
 *
 * Every opaque pixel is turned into hue, saturation and lightness, the hue is
 * turned by `look.hue` degrees around the circle, and it is turned back. Hue is
 * the right axis: rotating it keeps every shadow a shadow and every highlight a
 * highlight, so the drawing survives and only the colour changes. Replacing the
 * colours outright would need a list per animal and would flatten the shading.
 *
 * The sheet is vendored and served from our own origin, so `getImageData` is
 * allowed to read it. A sheet fetched from somewhere else would taint the canvas
 * and throw here — which is worth knowing, and worth not doing.
 */
function recolour(atlas, look) {
  const canvas = document.createElement('canvas');
  canvas.width = atlas.img.naturalWidth;
  canvas.height = atlas.img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas.img, 0, 0);

  const picture = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = picture.data;
  const turn = Number(look.hue) || 0;
  const boost = Number.isFinite(look.saturate) ? look.saturate : 1;

  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;                       // nothing to colour
    const [h, s, l] = toHsl(px[i], px[i + 1], px[i + 2]);
    const [r, g, b] = toRgb((h + turn / 360 + 1) % 1, clamp01(s * boost), l);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }

  ctx.putImageData(picture, 0, 0);
  // The same shape as an atlas from sprites.js, with a canvas where the image
  // was: `drawImage` cannot tell the difference, so `drawTile` does not have to.
  return { ...atlas, img: canvas };
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

/** r,g,b in 0–255 to h,s,l in 0–1. */
function toHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];                     // grey has no hue
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return [h / 6, s, l];
}

/** h,s,l in 0–1 back to r,g,b in 0–255. */
function toRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)]
    .map((v) => Math.round(v * 255));
}

function hue(p, q, t) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}
