// A10's square, plus three things: CONNECT to a room, SEND where you are,
// DRAW everyone else. No server holds the game — the browsers talk directly.

import { joinRoom, selfId } from '../../vendor/p2p-core/p2p-core.js';

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');

const SIZE = 32;
const SPEED = 220;
const player = { x: 100, y: 100 };

// --------------------------------------------------------- NOTICE and DECIDE
// Exactly as in A10: a bag of held keys, and two numbers that change.
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
}

// -------------------------------------------------------------- 1. CONNECT
// p2p-core is the one networking library the course uses. It owns discovery,
// relay choices and WebRTC setup so this lesson never invents those pieces.
const room = joinRoom({
  app: 'kakkoi-online',
  room: 'demo',
  kinds: ['move'],
});

// Where every other player is, by their id. This is the only thing we keep.
const others = {};

room.onMessage('move', (where, id) => {
  if (!Number.isFinite(where?.x) || !Number.isFinite(where?.y)) return;
  others[id] = { x: where.x, y: where.y };
});

room.onPeerJoin((id) => {
  room.send('move', { x: player.x, y: player.y }, id);
});
room.onPeerLeave((id) => { delete others[id]; });

// ------------------------------------------------------------------ 2. SEND
// Ten times a second, not sixty. Your square is not that interesting, and
// sixty messages a second to every player is sixty times more than you need.
setInterval(() => room.send('move', { x: player.x, y: player.y }), 100);

// ------------------------------------------------------------------ 3. DRAW
// Your square in green, everyone else in blue with a short name above them.
function draw() {
  ctx.fillStyle = '#1b1b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '12px system-ui, sans-serif';
  for (const id in others) {
    ctx.fillStyle = '#6bb8ff';
    ctx.fillRect(others[id].x, others[id].y, SIZE, SIZE);
    ctx.fillText(id.slice(0, 4), others[id].x, others[id].y - 4);
  }

  ctx.fillStyle = '#7ee081';
  ctx.fillRect(player.x, player.y, SIZE, SIZE);
  ctx.fillText(selfId.slice(0, 4) + ' (you)', player.x, player.y - 4);
}

// The loop, unchanged from A10.
let previous = performance.now();
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.25);
  previous = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For checking from the console: who else is here, and where.
window.others = others;
window.player = player;
window.room = room; // room.status() is the first thing to inspect if connection fails.
