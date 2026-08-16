// The square from A10 becomes a monster with moving legs. Two new ideas:
// CUT one small picture out of one big image, and CHANGE which picture, over time.

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');

const SPEED = 160;
const player = { x: 200, y: 130 };

// -------------------------------------------------------------------- 1. CUT
// One file. Inside it, 27 pictures in a grid: 9 across, 3 down, each 24 x 24.
// Picture number n sits at x = (n % 9) * 24, y = floor(n / 9) * 24.
const sheet = new Image();
sheet.src = '../../vendor/kenney/pixel-platformer-characters.png';

const CELL = 24;          // one picture in the sheet, in pixels
const COLS = 9;           // pictures across the sheet
const ZOOM = 3;           // draw it three times as big
const SIZE = CELL * ZOOM; // 72 pixels on screen

// Nine numbers: which little square to copy, and where to paste it.
function drawPicture(n, x, y) {
  const sx = (n % COLS) * CELL;
  const sy = Math.floor(n / COLS) * CELL;
  ctx.drawImage(sheet, sx, sy, CELL, CELL, x, y, SIZE, SIZE);
}

// ----------------------------------------------------------------- 2. CHANGE
// Picture 0 is the monster with its legs together, picture 1 has them apart.
// Show 0, then 1, then 0, then 1 and it walks. Stop moving and it stands on 0.
const STAND = 0;
const WALK = [0, 1];
const STEP = 0.14;        // seconds each picture stays up

let walked = 0;           // seconds spent walking
let frame = STAND;        // which picture to draw right now

function animate(dt, moving) {
  if (!moving) {
    walked = 0;
    frame = STAND;
    return;
  }
  walked += dt;
  frame = WALK[Math.floor(walked / STEP) % WALK.length];
}

// ----------------------------------------------------- NOTICE, DECIDE, DRAW
const held = new Set();
addEventListener('keydown', (e) => held.add(e.key));
addEventListener('keyup', (e) => held.delete(e.key));

function update(dt) {
  let dx = 0;
  let dy = 0;
  if (held.has('ArrowLeft') || held.has('a')) dx -= 1;
  if (held.has('ArrowRight') || held.has('d')) dx += 1;
  if (held.has('ArrowUp') || held.has('w')) dy -= 1;
  if (held.has('ArrowDown') || held.has('s')) dy += 1;

  player.x += dx * SPEED * dt;
  player.y += dy * SPEED * dt;
  player.x = Math.max(0, Math.min(canvas.width - SIZE, player.x));
  player.y = Math.max(0, Math.min(canvas.height - SIZE, player.y));

  animate(dt, dx !== 0 || dy !== 0);
}

function draw() {
  ctx.fillStyle = '#1b1b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPicture(frame, Math.round(player.x), Math.round(player.y));
}

// Keep the pixels square. Without this the browser blurs them when it zooms.
ctx.imageSmoothingEnabled = false;

let previous = performance.now();
function tick(now) {
  const dt = Math.min((now - previous) / 1000, 0.25);
  previous = now;
  update(dt);
  draw();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
