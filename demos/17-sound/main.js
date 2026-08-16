// A10's square, plus sound. Three blocks: LOAD the files, PLAY one when
// something happens, and LET THE PLAYER TURN IT OFF.

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const statusEl = document.querySelector('#status');
const loadedEl = document.querySelector('#loaded');
const soundBtn = document.querySelector('#soundBtn');
const musicBtn = document.querySelector('#musicBtn');

const SIZE = 32;
const SPEED = 220;
const player = { x: 100, y: 140 };
const held = new Set();
addEventListener('keydown', (e) => held.add(e.key));
addEventListener('keyup', (e) => held.delete(e.key));

function say(text) { statusEl.textContent = text; }
function loaded(text) { loadedEl.textContent = text; }

// -------------------------------------------------------------- 1. LOAD
// One Audio for each file. Making it does not play it, and does not even
// finish downloading it. Loading and playing are two different jobs.
const step = new Audio('../../audio/step.wav');
const music = new Audio('../../audio/music-loop.mp3');
music.loop = true;
music.volume = 0.4;

// Two separate lines on the page, because loading and playing fail separately.
// `once: true` — canplaythrough fires again every time a sound is rewound.
step.addEventListener('canplaythrough', () => loaded('step.wav loaded.'), { once: true });
step.addEventListener('error', () => loaded('step.wav did NOT load.'));
music.addEventListener('error', () => loaded('music-loop.mp3 did NOT load.'));

// Ask to play with nobody having touched the page yet. The browser says no.
// This is a rule, not a bug: a page may not make noise you did not ask for.
music.play()
  .then(() => { music.pause(); say('Played with no click. That is unusual.'); })
  .catch((err) => { window.firstPlayError = err.name + ': ' + err.message;
                    say('Refused before any click — ' + err.name); });

// -------------------------------------------------------------- 2. PLAY
// A footstep every 26 pixels walked. An Audio that is already playing will
// not start again, so wind it back to the beginning first.
let walked = 0;

function footstep() {
  if (!soundOn) return;
  step.currentTime = 0;
  step.play().catch((err) => say('Footstep refused — ' + err.name));
}

function update(dt) {
  let dx = 0;
  let dy = 0;
  if (held.has('ArrowLeft') || held.has('a')) dx -= 1;
  if (held.has('ArrowRight') || held.has('d')) dx += 1;
  if (held.has('ArrowUp') || held.has('w')) dy -= 1;
  if (held.has('ArrowDown') || held.has('s')) dy += 1;

  player.x = Math.max(0, Math.min(canvas.width - SIZE, player.x + dx * SPEED * dt));
  player.y = Math.max(0, Math.min(canvas.height - SIZE, player.y + dy * SPEED * dt));

  walked += Math.hypot(dx, dy) * SPEED * dt;
  if (walked > 26) { walked = 0; footstep(); }
}

// ------------------------------------------------- 3. TURN IT OFF (and on)
// Sound starts OFF. A room full of laptops all making noise at once is
// horrible, and somebody may be listening to something else.
let soundOn = false;

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.textContent = 'Sound: ' + (soundOn ? 'on' : 'off');
  if (!soundOn) { music.pause(); say('Sound off. Everything is silent.'); }
  else say('Sound on. Walk around.');
});

musicBtn.addEventListener('click', () => {
  if (!soundOn) return say('Turn the sound on first.');
  if (music.paused) music.play().then(() => say('Music playing.'))
                                .catch((err) => say('Music refused — ' + err.name));
  else { music.pause(); say('Music stopped.'); }
});

function draw() {
  ctx.fillStyle = '#1b1b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = soundOn ? '#7ee081' : '#4a6a4c';
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

// For checking from the console.
window.step = step; window.music = music;
window.isSoundOn = () => soundOn;
