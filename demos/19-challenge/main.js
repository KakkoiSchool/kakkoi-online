// A12's room, plus a state machine. The game is in exactly ONE state at a
// time: walking, waiting, asked, fighting. Three blocks: ASK, AGREE, SCREEN.

import { joinRoom, selfId } from '../../vendor/trystero/nostr.js';

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const SIZE = 32, SPEED = 220, REACH = 90;
const player = { x: 60 + Math.random() * 360, y: 60 + Math.random() * 200 };
const others = {};

let state = 'walking';   // walking | waiting | asked | fighting
let them = null;         // who this conversation is with
function go(next, id) { state = next; them = id; }

// A12 unchanged: join the room, send where you are 10 times a second.
const RELAYS = ['wss://relay.snort.social', 'wss://nostr.sathoarder.com',
                'wss://nos.lol', 'wss://nostr.vulpem.com'];
const room = joinRoom({ appId: 'kakkoi-online', relayUrls: RELAYS }, 'demo19');
const [sendMove, onMove] = room.makeAction('move');
const [sendAsk, onAsk] = room.makeAction('ask');
const [sendReply, onReply] = room.makeAction('reply');
onMove((where, id) => { others[id] = where; });
setInterval(() => sendMove({ x: player.x, y: player.y }), 100);
room.onPeerJoin((id) => sendMove({ x: player.x, y: player.y }, id));
// They left: forget them, and if you were talking to them, stop waiting.
room.onPeerLeave((id) => { delete others[id]; if (id === them) go('walking', null); });

// ------------------------------------------------------------------ 1. ASK
// F challenges the nearest player. Y and N answer one. Which keys do
// anything at all depends on the state, so every key names its state.
const held = new Set();
addEventListener('keyup', (e) => held.delete(e.key));
addEventListener('keydown', (e) => {
  held.add(e.key);
  const k = e.key.toLowerCase();
  if (k === 'f' && state === 'walking') {
    const id = nearest();
    if (id) { sendAsk({}, id); go('waiting', id); }
  }
  if (k === 'y' && state === 'asked') { sendReply({ yes: true }, them); go('fighting', them); }
  if (k === 'n' && state === 'asked') { sendReply({ yes: false }, them); go('walking', null); }
});

function nearest() {
  let best = null, bestDistance = REACH;
  for (const id in others) {
    const d = Math.hypot(others[id].x - player.x, others[id].y - player.y);
    if (d < bestDistance) { bestDistance = d; best = id; }
  }
  return best;
}

// ---------------------------------------------------------------- 2. AGREE
// Every awkward case is answered here, and every answer is one line.
onAsk((_, id) => {
  if (state === 'waiting' && id === them) return go('fighting', id); // asked at once
  if (state !== 'walking') return sendReply({ yes: false }, id);     // busy: no
  go('asked', id);
});
onReply((answer, id) => {
  if (state !== 'waiting' || id !== them) return;                    // not for me
  if (answer.yes) go('fighting', id); else go('walking', null);
});

// --------------------------------------------------------------- 3. SCREEN
// One state, one screen. Walking also stops when you are not walking.
function update(dt) {
  if (state !== 'walking') return;
  let dx = 0, dy = 0;
  if (held.has('ArrowLeft') || held.has('a')) dx -= 1;
  if (held.has('ArrowRight') || held.has('d')) dx += 1;
  if (held.has('ArrowUp') || held.has('w')) dy -= 1;
  if (held.has('ArrowDown') || held.has('s')) dy += 1;
  player.x = Math.max(0, Math.min(canvas.width - SIZE, player.x + dx * SPEED * dt));
  player.y = Math.max(0, Math.min(canvas.height - SIZE, player.y + dy * SPEED * dt));
}
const short = (id) => (id || '').slice(0, 4);

function draw() {
  ctx.fillStyle = state === 'fighting' ? '#3a1420' : '#1b1b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center';
  if (state === 'fighting') {
    ctx.fillStyle = '#ffbf6b';
    ctx.fillText('FIGHT!   you  vs  ' + short(them), canvas.width / 2, canvas.height / 2);
    return;
  }
  ctx.fillStyle = '#ffbf6b';
  if (state === 'waiting') ctx.fillText('Waiting for ' + short(them) + ' to answer…', canvas.width / 2, 24);
  if (state === 'asked') ctx.fillText(short(them) + ' challenges you.   Y = yes,   N = no', canvas.width / 2, 24);
  ctx.textAlign = 'left';
  for (const id in others) {
    ctx.fillStyle = '#6bb8ff';
    ctx.fillRect(others[id].x, others[id].y, SIZE, SIZE);
    ctx.fillText(short(id), others[id].x, others[id].y - 6);
  }
  ctx.fillStyle = '#7ee081';
  ctx.fillRect(player.x, player.y, SIZE, SIZE);
  ctx.fillText(short(selfId) + ' (you)', player.x, player.y - 6);
}
let previous = performance.now();
requestAnimationFrame(function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.25);
  previous = now; update(dt); draw();
  requestAnimationFrame(frame);
});

window.getState = () => ({ state, them: short(them), me: short(selfId), you: player, others });
