// The square from A10, plus one idea: it remembers. Close the tab, open it
// again, and the square is where you left it, still called by your name.
// WRITE it down, READ it back, COPE when what you read back is old or broken.

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const nameBox = document.querySelector('#name');

const SIZE = 32;
const SPEED = 220;

const KEY = 'kakkoi-save';   // one name in the drawer, one save
const VERSION = 2;           // stamped on everything we write

// ------------------------------------------------------------------ 1. WRITE
// One object, turned into text, under one key. Twice a second is plenty: the
// square moves 60 times a second, but nobody closes a tab 60 times a second,
// and writing constantly costs work for nothing.
function save() {
  const data = { version: VERSION, name: player.name, x: player.x, y: player.y };
  localStorage.setItem(KEY, JSON.stringify(data));
}
setInterval(save, 500);

// ------------------------------------------------------------------- 2. READ
// Text comes back out. getItem gives null when nothing was ever saved.
function read() {
  const text = localStorage.getItem(KEY);
  if (text === null) return null;
  return JSON.parse(text);
}

// ------------------------------------------------------------------- 3. COPE
// The save in someone's browser was written by an older version of this game.
// It may be from before we added names. It may be half-written rubbish. Every
// bad case ends the same way: start fresh instead of crashing.
function fresh() {
  return { x: 100, y: 100, name: '' };
}

function load() {
  let data;
  try {
    data = read();
  } catch (err) {
    console.warn('save is not readable, starting fresh:', err.message);
    return fresh();
  }
  if (data === null) return fresh();
  if (data.version !== VERSION) {
    console.warn('save is version', data.version, 'and we speak', VERSION, '- starting fresh');
    return fresh();
  }
  if (typeof data.x !== 'number' || typeof data.y !== 'number') {
    console.warn('save has no position in it, starting fresh');
    return fresh();
  }
  return { x: data.x, y: data.y, name: String(data.name || '') };
}

const player = load();
nameBox.value = player.name;
nameBox.addEventListener('input', () => { player.name = nameBox.value; });

// -------------------------------------------------------- NOTICE, DECIDE, DRAW
// Exactly as in A10. Keys typed into the name box are not steering.
const held = new Set();
addEventListener('keydown', (e) => { if (e.target !== nameBox) held.add(e.key); });
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
}

function draw() {
  ctx.fillStyle = '#1b1b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#7ee081';
  ctx.fillRect(player.x, player.y, SIZE, SIZE);
  ctx.fillStyle = '#e8e8ef';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(player.name, player.x + SIZE / 2, player.y - 6);
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
