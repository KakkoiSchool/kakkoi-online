// A square you can move. Every frame does the same three things, in order:
// NOTICE what the player is doing, DECIDE where the square goes, DRAW it.

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');

const SIZE = 32;          // the square, in pixels
const SPEED = 220;        // pixels per second — per SECOND, not per frame
const player = { x: 100, y: 100 };

// ---------------------------------------------------------------- 1. NOTICE
// Which keys are held right now. keydown fires repeatedly while a key is down
// and keyup once when it is released, so a Set of held keys is the honest
// answer to "is the player pressing left?".
const held = new Set();
addEventListener('keydown', (e) => held.add(e.key));
addEventListener('keyup', (e) => held.delete(e.key));

// Where a finger, mouse or pen is, while it is pressed. Pointer Events are one
// API for all three — no separate touch handling, and it works on a phone.
let pointer = null;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointer = at(e); });
canvas.addEventListener('pointermove', (e) => { if (pointer) pointer = at(e); });
canvas.addEventListener('pointerup', () => { pointer = null; });

// The event gives page coordinates; the canvas has its own. Convert.
function at(e) {
  const box = canvas.getBoundingClientRect();
  return { x: e.clientX - box.left, y: e.clientY - box.top };
}

// ---------------------------------------------------------------- 2. DECIDE
// dt is how long the previous frame took, in seconds. Multiplying by it is what
// makes the square move at the same speed on a 60Hz and a 144Hz screen.
function update(dt) {
  let dx = 0;
  let dy = 0;

  if (held.has('ArrowLeft') || held.has('a')) dx -= 1;
  if (held.has('ArrowRight') || held.has('d')) dx += 1;
  if (held.has('ArrowUp') || held.has('w')) dy -= 1;
  if (held.has('ArrowDown') || held.has('s')) dy += 1;

  // A held pointer wins: head straight for it, and stop once we are there.
  if (pointer) {
    const toX = pointer.x - (player.x + SIZE / 2);
    const toY = pointer.y - (player.y + SIZE / 2);
    const distance = Math.hypot(toX, toY);
    if (distance > 1) { dx = toX / distance; dy = toY / distance; }
  }

  player.x += dx * SPEED * dt;
  player.y += dy * SPEED * dt;

  // Stay on screen.
  player.x = Math.max(0, Math.min(canvas.width - SIZE, player.x));
  player.y = Math.max(0, Math.min(canvas.height - SIZE, player.y));
}

// ------------------------------------------------------------------ 3. DRAW
// Clear first: a canvas keeps whatever was drawn last frame, so without this
// the square smears a trail across the screen.
function draw() {
  ctx.fillStyle = '#1b1b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#7ee081';
  ctx.fillRect(player.x, player.y, SIZE, SIZE);
}

// The loop: ask the browser to call us back before it next paints.
let previous = performance.now();
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.25);
  previous = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
