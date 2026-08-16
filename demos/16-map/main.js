// A world bigger than the screen. Three ideas: STORE the world as numbers,
// DRAW the tiles you can see, and FOLLOW the player with a camera.

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');

const CELL = 16;           // one picture in the sheet, in pixels
const SHEET_COLS = 12;     // pictures across the sheet
const ZOOM = 3;
const T = CELL * ZOOM;     // one tile on screen: 48 pixels

// ------------------------------------------------------------------ 1. STORE
// The world is not code. It is one number per square: which picture to use.
// 48 is sandy floor, 49 is sandy floor with specks, 40 is a stone wall.
const MAP_W = 24;          // 24 tiles across = 1152 pixels, on a 480 pixel canvas
const MAP_H = 16;          // 16 tiles down  =  768 pixels, on a 320 pixel canvas
const map = [
  40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,
  40,48,48,48,48,49,48,48,48,48,40,48,48,48,48,48,48,48,49,48,48,48,48,40,
  40,48,49,48,48,40,48,48,48,48,40,48,48,40,40,40,40,48,48,48,48,48,49,40,
  40,48,48,48,48,40,48,48,48,48,40,48,48,40,48,48,40,48,48,49,48,48,48,40,
  40,48,48,40,40,40,48,48,48,48,40,48,48,40,48,48,40,48,48,48,48,48,48,40,
  40,48,48,48,48,49,48,48,48,48,48,48,48,48,40,48,48,40,40,40,40,48,48,40,
  40,48,49,48,48,40,48,48,40,40,40,40,48,48,40,48,48,48,48,48,40,48,48,40,
  40,48,48,48,48,40,48,48,40,48,48,40,48,48,48,48,48,49,48,48,40,48,48,40,
  40,48,48,48,48,40,48,48,40,48,48,40,40,40,40,40,48,48,48,48,40,48,48,40,
  40,48,49,48,48,48,48,48,48,48,48,48,48,48,40,48,48,48,48,48,40,48,48,40,
  40,48,48,40,40,40,40,48,48,49,48,48,48,48,40,48,48,40,40,40,40,48,48,40,
  40,48,48,40,48,48,40,48,48,48,48,48,48,48,40,48,48,40,48,48,48,48,48,40,
  40,48,48,40,48,48,40,48,48,40,40,40,48,48,40,48,48,40,48,48,49,48,48,40,
  40,48,48,48,48,48,49,48,48,40,48,48,48,48,49,48,48,40,48,48,48,48,48,40,
  40,48,48,48,48,48,48,48,48,40,48,48,48,48,48,48,48,48,48,48,48,48,48,40,
  40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,
];

const sheet = new Image();
sheet.src = '../../vendor/kenney/tiny-dungeon.png';

// ------------------------------------------------------------------- 2. DRAW
// Only the tiles the camera can see. Drawing all 384 every frame would be
// mostly wasted work, and a real map is far bigger than this one.
function drawMap() {
  const firstCol = Math.floor(camera.x / T);
  const lastCol = Math.floor((camera.x + canvas.width) / T);
  const firstRow = Math.floor(camera.y / T);
  const lastRow = Math.floor((camera.y + canvas.height) / T);

  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const n = map[row * MAP_W + col];
      ctx.drawImage(sheet,
        (n % SHEET_COLS) * CELL, Math.floor(n / SHEET_COLS) * CELL, CELL, CELL,
        col * T - camera.x, row * T - camera.y, T, T);
    }
  }
}

// ----------------------------------------------------------------- 3. FOLLOW
// The camera is one subtraction. It says how far the world has slid, and every
// drawn thing takes that away from its own position. That is the whole trick.
const camera = { x: 0, y: 0 };
const SIZE = 32;
const SPEED = 200;
const player = { x: 120, y: 120 };

function follow() {
  camera.x = player.x + SIZE / 2 - canvas.width / 2;
  camera.y = player.y + SIZE / 2 - canvas.height / 2;
  // Stop at the edges, so you never see past the end of the world.
  camera.x = Math.max(0, Math.min(MAP_W * T - canvas.width, camera.x));
  camera.y = Math.max(0, Math.min(MAP_H * T - canvas.height, camera.y));
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
  player.x = Math.max(0, Math.min(MAP_W * T - SIZE, player.x));
  player.y = Math.max(0, Math.min(MAP_H * T - SIZE, player.y));
  follow();
}

function draw() {
  drawMap();
  ctx.fillStyle = '#7ee081';
  ctx.fillRect(Math.round(player.x - camera.x), Math.round(player.y - camera.y), SIZE, SIZE);
}

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
