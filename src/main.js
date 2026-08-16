/**
 * Kakkoi Online — boot and wiring only.
 *
 * Every idea in here lives in its own module: the loop, the input, the atlases,
 * the world and its collision, the camera and the drawing, the save, and who
 * you are. This file's whole job is to load them, hand them to each other in
 * the right order, and run the loop.
 *
 * Stage 1 is a world you can walk around; stage 2 puts other people in it.
 * `duel.js` and `npc.js` are still deliberately empty — stage 3 plugs in here.
 */
import { startLoop } from './loop.js';
import { createInput } from './input.js';
import { loadAtlas } from './sprites.js';
import { loadWorld } from './world.js';
import { createCamera, drawMap, drawActor, drawNameplate, drawBubble } from './render.js';
import { createIdentity, loadMonsters, persist } from './identity.js';
import { askIdentity, showSafetyCard } from './ui/onboarding.js';
import { joinRoom } from './net.js';
import { createChat } from './chat.js';
import { createChatBar } from './ui/chatbar.js';

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

  let sinceSave = 0;

  startLoop({
    update(dt) {
      const wish = steer(input, player, camera);
      const before = { x: player.x, y: player.y };

      // One axis at a time — that is what makes sliding along a wall work.
      world.moveX(player, wish.dx * speed * dt);
      world.moveY(player, wish.dy * speed * dt);

      player.moving = Math.abs(player.x - before.x) > 0.01 || Math.abs(player.y - before.y) > 0.01;
      player.walked = player.moving ? player.walked + dt : 0;

      camera.follow(player);

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
        { body: player, name: identity.name, self: true },
        ...net.peers()
          .filter((peer) => peer.x !== null)
          .map((peer) => ({ body: peer.body, name: peer.name, said: peer.said, self: false })),
      ].sort((a, b) => (a.body.y + a.body.h) - (b.body.y + b.body.h));

      for (const who of cast) {
        const drawn = drawActor(ctx, creatures, who.body, camera, world.scale);
        drawNameplate(ctx, who.name, drawn.x + drawn.sprite / 2, drawn.y - 2, { self: who.self });
        const said = who.self ? player.said : who.said;
        if (said) drawBubble(ctx, said, drawn.x + drawn.sprite / 2, drawn.y - 17);
      }
    },
  });

  // A tab can be closed or hidden at any moment; write once more on the way out.
  const flush = () => persist(identity, player);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // A handle for verification, and for the stages that come next.
  globalThis.game = { world, player, camera, identity, monsters, input, tuning, flush, net, chat };
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
