// Talking, safely. Three things: PICK a phrase from a fixed list, SEND its
// number, SHOW what arrives — after checking it is really one of the phrases.
// There is no place to type. That is the whole safety plan.

import { joinRoom, selfId } from '../../vendor/trystero/nostr.js';

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const SIZE = 32;
const SPEED = 220;
const SHOW_FOR = 3000;              // how long a phrase stays up, in milliseconds
const player = { x: 100, y: 100, said: '', until: 0 };
const others = {};                  // id -> { x, y, said, until }

// Move, exactly as in A10 and A12.
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
  player.x = Math.max(0, Math.min(canvas.width - SIZE, player.x + dx * SPEED * dt));
  player.y = Math.max(0, Math.min(canvas.height - SIZE, player.y + dy * SPEED * dt));
}

// The noticeboards the browsers use to find each other, as in A12.
const RELAYS = ['wss://relay.snort.social', 'wss://nostr.sathoarder.com',
                'wss://eu.purplerelay.com', 'wss://nostr.vulpem.com'];
const room = joinRoom({ appId: 'kakkoi-online', relayUrls: RELAYS }, 'demo-chat');
const [sendMove, onMove] = room.makeAction('move');
const [sendSay, onSay] = room.makeAction('say');
room.onPeerLeave((id) => { delete others[id]; });
onMove((where, id) => {
  others[id] = { ...others[id], x: where.x, y: where.y };
});
setInterval(() => sendMove({ x: player.x, y: player.y }), 100);

// -------------------------------------------------------------------- 1. PICK
// The only things anyone can say. No text box exists, so nothing else is
// possible to send from this page.
const PHRASES = ["Hi!", "Nice one!", "Let's fight!", "Follow me", "Good game", "Bye"];

for (let i = 0; i < PHRASES.length; i++) {
  const button = document.createElement('button');
  button.textContent = PHRASES[i];
  button.addEventListener('click', () => say(i));
  document.querySelector('#phrases').append(button);
}

// -------------------------------------------------------------------- 2. SEND
// Send the phrase's NUMBER, never its words. Number 2 means "Let's fight!"
// because both pages have the same list.
function say(i) {
  sendSay(i);
  player.said = PHRASES[i];
  player.until = performance.now() + SHOW_FOR;
}

// -------------------------------------------------------------------- 3. SHOW
// Never believe what another computer sends you. Check the number is a whole
// number, and that it points at a phrase we actually have. If not, drop it.
onSay((i, id) => {
  if (!Number.isInteger(i) || i < 0 || i >= PHRASES.length) {
    window.dropped = (window.dropped || 0) + 1;
    return;
  }
  others[id] = { ...others[id], said: PHRASES[i], until: performance.now() + SHOW_FOR };
});

function draw() {
  ctx.fillStyle = '#1b1b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '13px system-ui, sans-serif';

  for (const id in others) {
    paint(others[id], '#6bb8ff', id.slice(0, 4));
  }
  paint(player, '#7ee081', selfId.slice(0, 4) + ' (you)');
}

function paint(who, colour, label) {
  if (who.x === undefined) return;
  ctx.fillStyle = colour;
  ctx.fillRect(who.x, who.y, SIZE, SIZE);
  ctx.fillText(label, who.x, who.y - 4);
  if (who.until > performance.now()) {
    ctx.fillStyle = '#fff';
    ctx.fillText(who.said, who.x, who.y - 20);
  }
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

// For checking from the console.
Object.assign(window, { others, player, say, sendSay, PHRASES });
