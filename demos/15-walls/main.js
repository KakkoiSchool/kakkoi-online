// The square from A10, plus one idea: some places are solid.
// DESCRIBE where the solid things are, CHECK before you move, STOP at the edge.

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');

const SIZE = 32;
const SPEED = 220;
const player = { x: 60, y: 60 };

// --------------------------------------------------------------- 1. DESCRIBE
// A wall is not code. It is four numbers in a list: left, top, width, height.
// Because it is data, A16 can load a whole map into this array without a
// single line of this file changing.
const walls = [
  { x: 160, y: 40, w: 40, h: 200 },
  { x: 160, y: 240, w: 220, h: 40 },
  { x: 300, y: 60, w: 120, h: 40 },
];

// ------------------------------------------------------------------ 2. CHECK
// Two rectangles overlap only if they overlap left-to-right AND top-to-bottom.
// If either one of those is false, they miss each other completely.
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ------------------------------------------------------------------- 3. STOP
// Move one axis at a time. Ask "would I be inside a wall there?" BEFORE going.
// If the answer is yes, go as far as the wall's edge and no further.
// Doing x and y in separate steps is what lets you slide along a wall: the
// blocked direction is refused, the free one still happens.
function moveX(amount) {
  let x = player.x + amount;
  for (const wall of walls) {
    if (!overlaps({ x, y: player.y, w: SIZE, h: SIZE }, wall)) continue;
    x = amount > 0 ? wall.x - SIZE : wall.x + wall.w;
  }
  player.x = Math.max(0, Math.min(canvas.width - SIZE, x));
}

function moveY(amount) {
  let y = player.y + amount;
  for (const wall of walls) {
    if (!overlaps({ x: player.x, y, w: SIZE, h: SIZE }, wall)) continue;
    y = amount > 0 ? wall.y - SIZE : wall.y + wall.h;
  }
  player.y = Math.max(0, Math.min(canvas.height - SIZE, y));
}

// ---------------------------------------------------- NOTICE, DECIDE, DRAW
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
  if (dx !== 0) moveX(dx * SPEED * dt);
  if (dy !== 0) moveY(dy * SPEED * dt);
}

function draw() {
  ctx.fillStyle = '#1b1b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#5a4633';
  for (const wall of walls) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.fillStyle = '#7ee081';
  ctx.fillRect(player.x, player.y, SIZE, SIZE);
}

let previous = performance.now();
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.25);
  previous = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
