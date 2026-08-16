/**
 * Kakkoi Online — boot and wiring only.
 *
 * Every idea in here lives in its own module: the loop, the input, the atlases,
 * the world and its collision, the camera and the drawing, the save, and who
 * you are. This file's whole job is to load them, hand them to each other in
 * the right order, and run the loop.
 *
 * Stage 1 is a world you can walk around, stage 2 puts other people in it, and
 * stage 3 is the fight, the computer opponent standing in the plaza, and sound.
 */
import { startLoop } from './loop.js';
import { createInput } from './input.js';
import { loadAtlas } from './sprites.js';
import { loadWorld } from './world.js';
import { createCamera, drawMap, drawActor, drawNameplate, drawBubble, drawMarker } from './render.js';
import { createIdentity, loadMonsters, persist } from './identity.js';
import { askIdentity, showSafetyCard } from './ui/onboarding.js';
import { joinRoom } from './net.js';
import { createChat } from './chat.js';
import { createChatBar } from './ui/chatbar.js';
import { createDuel } from './duel.js';
import { createNpc } from './npc.js';
import { createAudio } from './audio.js';
import { createDuelScreen } from './ui/duel-screen.js';

const canvas = document.querySelector('#world');
if (!canvas) throw new Error('no #world canvas in index.html');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('canvas 2d context unavailable');
ctx.imageSmoothingEnabled = false;   // pixel art: never smooth it

const overlay = document.querySelector('#overlay');
const hudName = document.querySelector('#hud-name');
const hudPlace = document.querySelector('#hud-place');
const hudOnline = document.querySelector('#hud-online');
const statusEl = document.querySelector('#status');
const nearbyBtn = document.querySelector('#nearby');
const soundBtn = document.querySelector('#soundBtn');
const musicBtn = document.querySelector('#musicBtn');

const say = (text) => { if (statusEl) statusEl.textContent = text; };

// The player's collision box, in world pixels. It is smaller than the sprite
// and sits at its feet, so a monster's head can overlap the wall above it,
// exactly like every top-down game you have ever played.
const BOX = { w: 20, h: 14 };

async function loadJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function boot() {
  say('loading…');

  const dungeon = loadAtlas('./vendor/kenney/tiny-dungeon.png', { cell: 16, cols: 12 });
  const creatures = loadAtlas('./vendor/opengameart/tiny-creatures.png', { cell: 16, cols: 10 });

  const [world, monsters, tuning] = await Promise.all([
    loadWorld('./data/maps/town.json'),
    loadMonsters('./data/monsters.json'),
    loadJSON('./data/tuning.json'),
    dungeon.ready,
    creatures.ready,
  ]);

  const identity = createIdentity(monsters);

  // Sound, before anything has been clicked. `probe()` asks to play at once and
  // writes down the refusal: it is the browser's rule that a page may not make
  // noise nobody asked for, and being able to see that it happened is worth one
  // silent, zero-volume attempt.
  const audio = createAudio({ tuning });
  audio.probe();

  // First run asks two questions, in the DOM. A returning player skips both.
  say('who are you?');
  await askIdentity({ root: overlay, identity, monsters, atlas: creatures });

  // One card, once, before the world appears: what other people can see, that
  // nobody is in charge here, and what to do if somebody is unkind. The save
  // remembers it, so a returning player never sees it twice.
  if (!identity.safetySeen) {
    await showSafetyCard({ root: overlay });
    identity.safetySeen = true;
  }

  const player = spawn(world, identity);
  const camera = createCamera(canvas, world);
  camera.follow(player);

  const input = createInput(canvas);
  const speed = Number(tuning.walkSpeed) || 150;
  const saveEvery = Number(tuning.saveEveryMs) || 500;

  hudName.textContent = identity.name;
  hudPlace.textContent = `${identity.creature.name} · ${world.name}`;
  say('');

  // ------------------------------------------------------------ other people
  const net = joinRoom({ world, identity, monsters, tuning });
  net.follow(player);                       // says where we are, posHz times a second

  const chat = createChat({ net, self: player });
  createChatBar({ root: document.querySelector('#chatbar'), chat });

  // A lone player has to be able to tell an empty world from a broken one, so
  // this always says something — and says the lonely case kindly, because it
  // is going to be the usual case.
  const showOnline = () => {
    const others = net.count();
    hudOnline.textContent = others === 0
      ? 'Just you here for now'
      : `${others + 1} here — you and ${others === 1 ? '1 other' : `${others} others`}`;
  };
  net.onPeerJoin(showOnline);
  net.onPeerLeave(showOnline);
  showOnline();

  // ------------------------------------------------------------------ sound
  // Off until one of these two buttons is pressed, and the press is also the
  // interaction the browser was waiting for.
  soundBtn.addEventListener('click', () => {
    const on = audio.toggle();
    soundBtn.textContent = `Sound: ${on ? 'on' : 'off'}`;
    soundBtn.setAttribute('aria-pressed', String(on));
    if (!on) { musicBtn.textContent = 'Music: off'; musicBtn.setAttribute('aria-pressed', 'false'); }
    else audio.play('ping');
    soundBtn.blur();
  });

  musicBtn.addEventListener('click', () => {
    if (!audio.on) return say('Turn the sound on first.');
    const playing = audio.toggleMusic();
    musicBtn.textContent = `Music: ${playing ? 'on' : 'off'}`;
    musicBtn.setAttribute('aria-pressed', String(playing));
    musicBtn.blur();
  });

  // ------------------------------------------------------------- the fight
  //
  // Flint stands in the plaza so there is always somebody to fight — this game
  // will usually have one person in it. He is challenged exactly the way a
  // person is, and `duel.js` is never told which one it has.
  const npc = createNpc({ monsters, world, tuning });

  const duel = createDuel({ tuning });
  createDuelScreen({ root: document.querySelector('#duel'), duel });
  duel.onSound((name) => audio.play(name));
  duel.onNotice((text) => { say(text); setTimeout(() => { if (statusEl.textContent === text) say(''); }, 4000); });
  duel.onChange(() => { if (duel.state !== 'walking') hideNearby(); });

  // Somebody out there has started talking duel to us.
  net.onLink((link) => duel.receive(link));

  const reach = Number(tuning.challengeReachPx) || 64;
  const middle = (body) => ({ x: body.x + body.w / 2, y: body.y + body.h / 2 });

  /** Everyone in the world who could be challenged, peer or not. */
  function challengeable() {
    const list = [{ id: npc.id, name: npc.name, body: npc.body, link: () => npc.link() }];
    for (const peer of net.peers()) {
      if (peer.x === null) continue;
      list.push({ id: peer.id, name: peer.name, body: peer.body, link: () => net.linkTo(peer.id) });
    }
    return list;
  }

  /** The closest of them, if you are standing near enough to reach out. */
  function nearestTarget() {
    const me = middle(player);
    let best = null;
    let bestDistance = reach;
    for (const target of challengeable()) {
      const at = middle(target.body);
      const distance = Math.hypot(at.x - me.x, at.y - me.y);
      if (distance < bestDistance) { bestDistance = distance; best = target; }
    }
    return best;
  }

  let near = null;

  function hideNearby() { nearbyBtn.hidden = true; }

  function showNearby(target) {
    if (!target || duel.state !== 'walking') return hideNearby();
    const label = `Challenge ${target.name}`;
    if (nearbyBtn.textContent !== label) nearbyBtn.textContent = label;
    nearbyBtn.hidden = false;
  }

  const startFight = () => {
    if (!near || duel.state !== 'walking') return;
    audio.play('ping');
    duel.challenge(near.link());
    hideNearby();
  };

  nearbyBtn.addEventListener('click', () => { startFight(); nearbyBtn.blur(); });

  // F is the same key A19 uses, and it only does anything while walking.
  addEventListener('keydown', (e) => {
    if (e.key !== 'f' && e.key !== 'F') return;
    if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.isContentEditable)) return;
    startFight();
  });

  let sinceSave = 0;

  startLoop({
    update(dt) {
      // In a duel you are not also walking around. A19's state machine again:
      // one state at a time, and the keys that do nothing here do nothing.
      const wish = duel.busy ? { dx: 0, dy: 0 } : steer(input, player, camera);
      const before = { x: player.x, y: player.y };

      // One axis at a time — that is what makes sliding along a wall work.
      world.moveX(player, wish.dx * speed * dt);
      world.moveY(player, wish.dy * speed * dt);

      const moved = Math.hypot(player.x - before.x, player.y - before.y);
      player.moving = moved > 0.01;
      player.walked = player.moving ? player.walked + dt : 0;
      audio.walk(moved);

      camera.follow(player);

      // Who is within arm's reach? Recomputed every frame because everyone in
      // it is moving, and it is a handful of distances.
      near = duel.busy ? null : nearestTarget();
      if (near) showNearby(near); else hideNearby();

      // Peers arrive ten times a second and are drawn sixty, so this slides
      // them along instead of letting them teleport. It touches no network.
      const now = performance.now();
      net.update(now, dt);
      chat.update(now);

      sinceSave += dt * 1000;
      if (sinceSave >= saveEvery) { sinceSave = 0; persist(identity, player); }
    },

    render() {
      ctx.fillStyle = '#0c0c12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawMap(ctx, world, dungeon, camera);

      // Everyone in the room, sorted by how far down the screen their feet are,
      // so a monster standing in front of another one is drawn in front of it.
      const cast = [
        { id: '', body: player, name: identity.name, self: true },
        { id: npc.id, body: npc.body, name: npc.name, self: false },
        ...net.peers()
          .filter((peer) => peer.x !== null)
          .map((peer) => ({ id: peer.id, body: peer.body, name: peer.name, said: peer.said, self: false })),
      ].sort((a, b) => (a.body.y + a.body.h) - (b.body.y + b.body.h));

      const now = performance.now();
      for (const who of cast) {
        const drawn = drawActor(ctx, creatures, who.body, camera, world.scale);
        const middleX = drawn.x + drawn.sprite / 2;
        drawNameplate(ctx, who.name, middleX, drawn.y - 2, { self: who.self });
        const said = who.self ? player.said : who.said;
        if (said) drawBubble(ctx, said, middleX, drawn.y - 17);
        // An arrow over whoever the "Challenge" button is currently about.
        if (near && who.id === near.id) drawMarker(ctx, middleX, drawn.y - 16, now);
      }
    },
  });

  // A tab can be closed or hidden at any moment; write once more on the way out.
  const flush = () => persist(identity, player);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // A handle for verification, and for the stages that come next.
  globalThis.game = {
    world, player, camera, identity, monsters, input, tuning, flush,
    net, chat, duel, npc, audio,
    /** Who the Challenge button is about right now, or null. */
    get near() { return near; },
  };
}

/** Where the monster starts: where the save says, if that is still a real place. */
function spawn(world, identity) {
  const t = world.tile;
  const home = {
    x: world.spawn.col * t + (t - BOX.w) / 2,
    y: world.spawn.row * t + (t - BOX.h) - 4,
    w: BOX.w,
    h: BOX.h,
    cell: identity.creature.cell,
    moving: false,
    walked: 0,
    // The preset phrase above our own head, and when it should stop showing.
    said: '',
    saidIndex: -1,
    saidUntil: 0,
  };

  const saved = identity.position;
  if (!saved) return home;

  const box = { ...home, x: saved.x, y: saved.y };
  const insideMap = box.x >= 0 && box.y >= 0 &&
                    box.x + box.w <= world.width && box.y + box.h <= world.height;
  const corners = insideMap && [
    [box.x, box.y], [box.x + box.w - 1, box.y],
    [box.x, box.y + box.h - 1], [box.x + box.w - 1, box.y + box.h - 1],
  ].some(([px, py]) => world.isSolid(Math.floor(px / t), Math.floor(py / t)));

  if (!insideMap || corners) {
    console.warn('save put us off the map or inside a wall — back to the spawn');
    return home;
  }
  return box;
}

/**
 * What the player is asking for, as a vector no longer than 1.
 *
 * Two keys at once make a vector of length 1.41, so a diagonal would be 41%
 * faster than a straight line; shrinking both by the same amount fixes it.
 * A held finger wins over the keys: it is a direct instruction.
 */
function steer(input, player, camera) {
  const pointer = input.pointer;
  if (pointer) {
    const toX = pointer.x + camera.x - (player.x + player.w / 2);
    const toY = pointer.y + camera.y - (player.y + player.h / 2);
    const distance = Math.hypot(toX, toY);
    if (distance < 4) return { dx: 0, dy: 0 };
    return { dx: toX / distance, dy: toY / distance };
  }

  const { dx, dy } = input.keys;
  const shrink = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
  return { dx: dx * shrink, dy: dy * shrink };
}

boot().catch((err) => {
  console.error(err);
  say(`could not start: ${err.message}`);
});
