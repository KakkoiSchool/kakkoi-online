/**
 * The map maker.
 *
 * A separate page, not part of the game: the game stays small, and this is
 * allowed to be a desk with tools on it. It draws with the game's own atlas
 * code, validates with the game's own `map-check.js`, and writes the same
 * `data/maps/*.json` the game reads — so a map made here is not a special kind
 * of map, it is the only kind there is.
 *
 * Three ideas, and they are the whole file.
 *
 *   1. PAINT. A tile is a number. Pick one from the sheet, click a square, and
 *      that square becomes that number. Holding the button down paints every
 *      square you cross, which is how a wall gets drawn.
 *   2. CHECK. Before anybody proposes a map, walk it the way the player's feet
 *      would: `map-check.js` floods out from the starting square and reports
 *      what it could not reach. A room with the door drawn shut is a mistake no
 *      amount of looking at the file would find.
 *   3. PROPOSE. Open GitHub's own new-file page with the map already in it —
 *      see `submit.js` for why there is no API call and no token anywhere here.
 */
import { loadAtlas, drawTile } from '../src/sprites.js';
import { check, toJson, slug, MIN_SIDE, MAX_SIDE } from '../src/map-check.js';
import { plan, blankUrl, longWay, pathFor } from './submit.js';

const ATLAS = '../vendor/kenney/tiny-dungeon.png';
const CELL = 16;

/**
 * The two tiles a new map starts with, taken from the town rather than invented:
 * 48 is the floor it is paved with, 40 is the rock it is cut out of. Starting on
 * tile 0 would be starting on whatever happens to be first in the sheet.
 */
const FLOOR = 48;
const WALL = 40;

const sheet = document.querySelector('#sheet');
const mapCanvas = document.querySelector('#map');
const report = document.querySelector('#report');
const text = document.querySelector('#text');
const nameInput = document.querySelector('#name');
const tileHint = document.querySelector('#tileHint');

const atlas = loadAtlas(ATLAS, { cell: CELL, cols: 12 });

/** What is being painted with, and onto which of the two layers. */
const tool = { tile: 0, layer: 'ground', mode: 'paint' };

/** How many screen pixels one art pixel gets in the map view. */
let zoom = 2;

let map = blank(28, 20);
let reachable = new Set();

// ------------------------------------------------------------------ the map

/**
 * An empty room with a wall around it: the smallest thing that is already a
 * place, so that the first click improves something rather than starting one.
 */
function blank(width, height) {
  const ground = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const edge = col === 0 || row === 0 || col === width - 1 || row === height - 1;
      ground.push(edge ? WALL : FLOOR);
    }
  }
  return {
    name: nameInput?.value || 'A new place',
    atlas: 'dungeon',
    tileSize: CELL,
    width,
    height,
    spawn: { col: Math.floor(width / 2), row: Math.floor(height / 2) },
    solid: [WALL],
    ground,
    decor: new Array(width * height).fill(-1),
  };
}

function at(col, row) { return row * map.width + col; }

function paint(col, row) {
  if (col < 0 || row < 0 || col >= map.width || row >= map.height) return;
  const i = at(col, row);

  if (tool.mode === 'spawn') { map.spawn = { col, row }; draw(); return; }
  if (tool.mode === 'erase') {
    if (tool.layer === 'decor') map.decor[i] = -1;
    else map.ground[i] = FLOOR;
    draw();
    return;
  }
  if (tool.layer === 'decor') map.decor[i] = tool.tile;
  else map.ground[i] = tool.tile;
  draw();
}

/** Is this tile number one you cannot walk through? */
const isWall = (tile) => map.solid.includes(tile);

function toggleWall() {
  const i = map.solid.indexOf(tool.tile);
  if (i >= 0) map.solid.splice(i, 1);
  else map.solid.push(tool.tile);
  map.solid.sort((a, b) => a - b);
  paintTools();
  draw();
}

// --------------------------------------------------------------- the drawing

function draw() {
  const size = CELL * zoom;
  mapCanvas.width = map.width * size;
  mapCanvas.height = map.height * size;
  const ctx = mapCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0c0c12';
  ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const i = at(col, row);
      const x = col * size;
      const y = row * size;
      drawTile(ctx, atlas, map.ground[i], x, y, zoom);
      if (map.decor[i] >= 0) drawTile(ctx, atlas, map.decor[i], x, y, zoom);
      // Green over everywhere the player can actually get to, after a Check.
      // It is the answer and the explanation at once: this is where your feet
      // can go, and everything unlit is somewhere they cannot.
      if (reachable.size && !reachable.has(i)) {
        ctx.fillStyle = 'rgba(6, 6, 10, 0.55)';
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  // The starting square, which is the one square a map cannot do without.
  const sx = map.spawn.col * size;
  const sy = map.spawn.row * size;
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = Math.max(2, zoom);
  ctx.strokeRect(sx + 1, sy + 1, size - 2, size - 2);

  text.value = toJson(map);
}

function drawSheet() {
  const ctx = sheet.getContext('2d');
  const scale = 1;
  sheet.width = atlas.cols * CELL;
  sheet.height = atlas.rows * CELL;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, sheet.width, sheet.height);
  ctx.drawImage(atlas.img, 0, 0);

  // A ring around every tile that has been called a wall, and a full box around
  // the one being painted with.
  for (let n = 0; n < atlas.cols * atlas.rows; n++) {
    const x = (n % atlas.cols) * CELL;
    const y = Math.floor(n / atlas.cols) * CELL;
    if (isWall(n)) {
      ctx.strokeStyle = '#ff7ab8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
    }
    if (n === tool.tile) {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
    }
  }
  void scale;
}

// ------------------------------------------------------------------- clicks

function squareFrom(event, canvas, size) {
  const box = canvas.getBoundingClientRect();
  const x = (event.clientX - box.left) * (canvas.width / box.width);
  const y = (event.clientY - box.top) * (canvas.height / box.height);
  return { col: Math.floor(x / size), row: Math.floor(y / size) };
}

let painting = false;

mapCanvas.addEventListener('pointerdown', (e) => {
  painting = true;
  mapCanvas.setPointerCapture(e.pointerId);
  const { col, row } = squareFrom(e, mapCanvas, CELL * zoom);
  paint(col, row);
});

mapCanvas.addEventListener('pointermove', (e) => {
  if (!painting) return;
  const { col, row } = squareFrom(e, mapCanvas, CELL * zoom);
  paint(col, row);
});

for (const done of ['pointerup', 'pointercancel']) {
  mapCanvas.addEventListener(done, () => { painting = false; });
}

sheet.addEventListener('pointerdown', (e) => {
  const { col, row } = squareFrom(e, sheet, CELL);
  const n = row * atlas.cols + col;
  if (n < 0 || n >= atlas.cols * atlas.rows) return;
  tool.tile = n;
  tool.mode = 'paint';
  paintTools();
  drawSheet();
});

// -------------------------------------------------------------------- tools

const buttons = {
  ground: document.querySelector('#layerGround'),
  decor: document.querySelector('#layerDecor'),
  solid: document.querySelector('#solidBtn'),
  spawn: document.querySelector('#spawnBtn'),
  erase: document.querySelector('#eraseBtn'),
};

function paintTools() {
  buttons.ground.setAttribute('aria-pressed', String(tool.layer === 'ground'));
  buttons.decor.setAttribute('aria-pressed', String(tool.layer === 'decor'));
  buttons.spawn.setAttribute('aria-pressed', String(tool.mode === 'spawn'));
  buttons.erase.setAttribute('aria-pressed', String(tool.mode === 'erase'));
  buttons.solid.setAttribute('aria-pressed', String(isWall(tool.tile)));
  tileHint.textContent = `Tile ${tool.tile}${isWall(tool.tile) ? ' — a wall' : ''}`;
}

buttons.ground.addEventListener('click', () => { tool.layer = 'ground'; tool.mode = 'paint'; paintTools(); });
buttons.decor.addEventListener('click', () => { tool.layer = 'decor'; tool.mode = 'paint'; paintTools(); });
buttons.spawn.addEventListener('click', () => { tool.mode = tool.mode === 'spawn' ? 'paint' : 'spawn'; paintTools(); });
buttons.erase.addEventListener('click', () => { tool.mode = tool.mode === 'erase' ? 'paint' : 'erase'; paintTools(); });
buttons.solid.addEventListener('click', toggleWall);

document.querySelector('#zoomBtn').addEventListener('click', () => {
  zoom = zoom === 2 ? 1 : 2;
  document.querySelector('#zoomBtn').textContent = `Zoom ×${zoom === 2 ? 2 : 1}`;
  draw();
});

document.querySelector('#newBtn').addEventListener('click', () => {
  const w = clampSide(document.querySelector('#mapW').value);
  const h = clampSide(document.querySelector('#mapH').value);
  map = blank(w, h);
  reachable = new Set();
  hideReport();
  draw();
});

document.querySelector('#townBtn').addEventListener('click', async () => {
  const response = await fetch('../data/maps/town.json');
  const town = await response.json();
  adopt(town);
});

nameInput.addEventListener('input', () => { map.name = nameInput.value; draw(); });

function clampSide(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 20;
  return Math.max(MIN_SIDE, Math.min(MAX_SIDE, n));
}

function adopt(next) {
  map = next;
  nameInput.value = map.name || '';
  document.querySelector('#mapW').value = map.width;
  document.querySelector('#mapH').value = map.height;
  reachable = new Set();
  hideReport();
  paintTools();
  drawSheet();
  draw();
}

// -------------------------------------------------------- text, in and out

document.querySelector('#copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(toJson(map));
    say('good', 'Copied', ['The map is on your clipboard.']);
  } catch {
    text.select();
    say('bad', 'Could not reach the clipboard', ['The text is selected — press Ctrl+C or ⌘C.']);
  }
});

document.querySelector('#readBtn').addEventListener('click', () => {
  let next;
  try {
    next = JSON.parse(text.value);
  } catch (err) {
    say('bad', 'That is not readable as a map', [err.message]);
    return;
  }
  const result = check(next, { cells: atlas.cols * atlas.rows });
  if (!result.ok) { say('bad', 'That map has problems', result.problems); return; }
  adopt(next);
  say('good', 'Read it back', ['It is on the desk, and it checks out.']);
});

// ------------------------------------------------------------------- checks

document.querySelector('#checkBtn').addEventListener('click', () => runCheck());

function runCheck() {
  map.name = nameInput.value;
  const result = check(map, { cells: atlas.cols * atlas.rows });
  reachable = result.reachable;
  draw();
  if (result.ok) {
    say('good', 'This is a place', [
      `${result.floor} squares can be walked to from the start — everything lit up.`,
      `It would be saved as ${pathFor(slug(map.name))}.`,
    ]);
  } else {
    say('bad', 'Not yet', result.problems);
  }
  return result;
}

// ---------------------------------------------------------------- the network
//
// Everything on this page works with no network at all — the tile sheet, the
// town, the flood fill and the file are all here already, and `sw.js` keeps
// them. Exactly one thing needs to reach the outside world, and it is the
// button that hands the map to GitHub. So that is the only thing that stops,
// and it says why rather than opening a tab onto a browser error page.
//
// `navigator.onLine` is not a promise that the internet works — it means the
// device has *a* connection, so it can say yes on a wifi that goes nowhere.
// That is why the wording below is "your browser says", and why the button is
// still allowed to try when it says yes: this is a warning, not a gate.

const netBadge = document.querySelector('#net');
const submitBtn = document.querySelector('#submitBtn');

function showNet() {
  const off = !navigator.onLine;
  netBadge.hidden = !off;
  netBadge.textContent = off ? 'Offline' : '';
  submitBtn.disabled = off;
  submitBtn.title = off
    ? 'Your browser says there is no network. The map maker still works — this one button cannot.'
    : '';
}

addEventListener('online', showNet);
addEventListener('offline', showNet);
showNet();

// ------------------------------------------------------------------ propose

submitBtn.addEventListener('click', () => {
  if (!navigator.onLine) { sayOffline(); return; }

  const result = runCheck();
  if (!result.ok) return;

  const json = toJson(map);
  const made = plan(json, slug(map.name));
  if (!made.fits) {
    say('bad', 'Too big to carry in a link', longWay(made.size));
    open(blankUrl(), '_blank', 'noopener');
    return;
  }
  say('good', 'Over to GitHub', [
    'A new tab is opening with your map already written into it.',
    'Sign in, press "Propose new file", and it becomes a pull request for Cyril to read.',
    'Nothing here knows your GitHub account — see editor/submit.js for why it cannot.',
  ]);
  open(made.url, '_blank', 'noopener');
});

/** What you can still do with a map you cannot propose yet. */
function sayOffline() {
  say('bad', 'You are offline', [
    'Your browser says there is no network, so this map cannot go to GitHub right now.',
    'Nothing is lost. Press Copy below and keep the text somewhere — you can paste it back in with '
      + '"Read it back" later, or straight into GitHub when you are connected.',
    'Everything else here still works: the tiles, the town, Check, all of it.',
  ]);
}

function say(kind, heading, lines) {
  report.hidden = false;
  report.className = kind === 'good' ? 'is-good' : 'is-bad';
  report.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = heading;
  const ul = document.createElement('ul');
  for (const line of lines) {
    const li = document.createElement('li');
    li.textContent = line;
    ul.append(li);
  }
  report.append(h, ul);
}

function hideReport() { report.hidden = true; }

// --------------------------------------------------------------------- boot

atlas.ready.then(() => {
  drawSheet();
  paintTools();
  draw();
}).catch((err) => {
  say('bad', 'The tile sheet did not load', [err.message]);
});

/** A handle for checking from the console, and for the tests. */
globalThis.editor = {
  get map() { return map; },
  adopt,
  check: runCheck,
  paint,
  tool,
};
