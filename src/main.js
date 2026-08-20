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
import { createCamera, fitCanvas, createMapLayer, drawMap, drawActor, drawMarker } from './render.js';
import { applyScale } from './ui/scale.js';
import { installGlyphs } from './ui/glyphs.js';
import { drawTags, duelBubble } from './ui/bubbles.js';
import { createIdentity, loadMonsters, persist } from './identity.js';
import { askIdentity, showSafetyCard, showHowToPlay, confirmReset } from './ui/onboarding.js';
import { joinRoom } from './net.js';
import { createChat } from './chat.js';
import { createChatBar } from './ui/chatbar.js';
import { createDuel } from './duel.js';
import { createNpc } from './npc.js';
import { createAudio } from './audio.js';
import { createDuelScreen } from './ui/duel-screen.js';
import { createSession } from './session.js';
import { createPausedCard } from './ui/paused.js';
import { createSettings } from './ui/settings.js';
import { createHelp } from './ui/help.js';
import { writeSave, clearSave, writeSafetySeen } from './save.js';

const canvas = document.querySelector('#world');
if (!canvas) throw new Error('no #world canvas in index.html');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('canvas 2d context unavailable');
ctx.imageSmoothingEnabled = false;   // pixel art: never smooth it

// The pixel glyph sheet, before anything can ask for a glyph out of it: the ⚙
// in the corner is an <svg><use> pointing into it, and it is in the page from
// the moment this module runs.
installGlyphs();

const arena = document.querySelector('#arena');
const tags = document.querySelector('#tags');
const overlay = document.querySelector('#overlay');
const hudName = document.querySelector('#hud-name');
const hudPlace = document.querySelector('#hud-place');
const hudOnline = document.querySelector('#hud-online');
const statusEl = document.querySelector('#status');
const nearbyBtn = document.querySelector('#nearby');
const soundBtn = document.querySelector('#soundBtn');
const musicBtn = document.querySelector('#musicBtn');
const resetBtn = document.querySelector('#resetBtn');

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

  // The screen is the screen from the first paint.
  //
  // The canvas is 640x480 in the markup, and until this runs that is exactly
  // what it is: a small pale box in the middle of a dark page, sitting there
  // for the whole of loading and behind the name-and-monster cards on top of
  // it. Nothing has been drawn into it yet, so there is nothing to redraw —
  // this is only a size, and it costs one call to make the loading screen the
  // size of the game.
  //
  // `applyScale` goes with it, and that half matters more than it looks: every
  // length in `game.css` is a `rem`, so until the unit is set the first-run
  // cards are measured against the browser's default 16px instead of the 9-15
  // this window is entitled to. The first thing a new player ever sees was the
  // one screen not drawn to the game's own scale.
  //
  // `camera` does not exist yet — it needs the map. Once it does, the same
  // function keeps it centred, which is what a rotate or a drag needs.
  const view = { zoom: 1 };
  let camera = null;
  let follow = null;

  const fit = () => {
    view.zoom = applyScale(arena).zoom;
    fitCanvas({ canvas, ctx, box: arena, zoom: view.zoom });
    if (camera) camera.follow(follow);
  };
  fit();

  // A phone rotating, a window being dragged, the URL bar sliding away: all of
  // them change the box, and all of them arrive here — during loading and the
  // first-run questions as much as in the game.
  addEventListener('resize', fit);
  addEventListener('orientationchange', fit);

  // Before anything is loaded, this window claims the game from any older window
  // of the same browser. It is fired here, before the atlases, because
  // the answer only takes a few hundred milliseconds and loading takes longer —
  // by the time the map is parsed the handover has already landed or timed out.
  const session = createSession();
  const handover = session.claim();

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

  // If an older window answered, what it sent is newer than anything on disk:
  // it was standing somewhere at the moment we knocked, and the save is written
  // only twice a second. Adopt it over what `localStorage` said.
  const taken = await handover;
  if (taken) adopt(identity, monsters, taken);

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
    writeSafetySeen(true);      // at once, so "Start over" cannot resurrect it
  }

  const player = spawn(world, identity);

  // How big the interface is and how far the art is zoomed in are one decision,
  // taken in `ui/scale.js` from the size of the box, and taken again on every
  // resize. `view.zoom` is screen pixels per world pixel; the world's own
  // coordinates never change, so a phone and a desktop still agree about where
  // everybody is standing — see the note in `ui/scale.js`.
  //
  // The camera is made after the canvas has a size, because it centres on half
  // of what fits; from here on `fit()` centres it again on every resize.
  camera = createCamera(canvas, world, view);
  follow = player;
  fit();

  const mapLayer = createMapLayer();

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

  // ------------------------------------------------------ the small furniture
  const settings = createSettings({
    button: document.querySelector('#settingsBtn'),
    panel: document.querySelector('#settings'),
    install: document.querySelector('#installBtn'),
  });
  const help = createHelp({ root: document.querySelector('#controls'), world });

  // The two cards the menu can bring back. Both close the menu first: a panel
  // over the world with a menu still hanging open beside it reads as two things
  // happening at once.
  document.querySelector('#howBtn').addEventListener('click', () => {
    settings.close();
    showHowToPlay({ root: overlay, words: help.words });
  });

  document.querySelector('#safetyBtn').addEventListener('click', () => {
    settings.close();
    showSafetyCard({ root: overlay });
  });

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
  // The two switches are independent. Wanting a soundtrack and wanting a
  // footstep every four hundred milliseconds are different wishes, and either
  // press is the interaction the browser was waiting for.
  soundBtn.addEventListener('click', () => {
    const on = audio.toggle();
    soundBtn.textContent = `Sound: ${on ? 'on' : 'off'}`;
    soundBtn.setAttribute('aria-pressed', String(on));
    if (on) audio.play('ping');
    soundBtn.blur();
  });

  musicBtn.addEventListener('click', () => {
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
    help.challenged();          // they know how to do this now; stop saying it
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

  /**
   * What goes over somebody's head.
   *
   * A phrase if they have just said one — one of ours, looked up by number, so
   * there is no path from the network to a string on this screen. Otherwise
   * their side of the duel: the move they have committed to, or a face once the
   * round is decided.
   *
   * The duel half only ever applies to the two people IN the duel, because
   * nobody else is told that it is happening: a duel is a private conversation
   * between two peers and the room hears none of it. So a bystander walking past
   * two people fighting still sees two people standing still. Making that
   * visible needs the room to be told, which is a change to the protocol and not
   * to this file — it is written down in ISSUES.md rather than guessed at here.
   */
  function bubbleFor(who, fight) {
    const said = who.self ? player.said : who.said;
    if (said) return said;
    if (who.self) return duelBubble(fight, 'you');
    if (fight.them && who.id === fight.them.id) return duelBubble(fight, 'them');
    return null;
  }

  let sinceSave = 0;

  const loop = startLoop({
    update(dt) {
      // In a duel you are not also walking around. A19's state machine again:
      // one state at a time, and the keys that do nothing here do nothing.
      const wish = duel.busy ? { dx: 0, dy: 0 } : steer(input, player, camera, view.zoom);
      const before = { x: player.x, y: player.y };

      // One axis at a time — that is what makes sliding along a wall work.
      world.moveX(player, wish.dx * speed * dt);
      world.moveY(player, wish.dy * speed * dt);

      const moved = Math.hypot(player.x - before.x, player.y - before.y);
      player.moving = moved > 0.01;
      player.walked = player.moving ? player.walked + dt : 0;

      // Which way we are looking. Taken from what was ASKED for, not from what
      // the walls allowed: pushing west against a wall should still turn the
      // monster west. A zero never gets written, so letting go of the key keeps
      // the last facing instead of snapping back to the right.
      if (wish.dx > 0) player.facing = 1;
      else if (wish.dx < 0) player.facing = -1;

      audio.walk(player.moving, dt * 1000);
      // How far they actually went, not how long a key was held: a player pushed
      // against a wall for ten seconds has not learned anything about walking.
      help.update(moved);

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
      // Screen pixels, for the two things that are about the screen: wiping it,
      // and blitting the cached tile map back onto it.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0c0c12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawMap(ctx, mapLayer, world, dungeon, camera, view.zoom);

      // Everything from here is drawn in world pixels, and the zoom is the one
      // place the size of the screen gets in.
      ctx.setTransform(view.zoom, 0, 0, view.zoom, 0, 0);

      // Everyone in the room, sorted by how far down the screen their feet are,
      // so a monster standing in front of another one is drawn in front of it.
      const cast = [
        { id: 'you', body: player, name: identity.name, self: true },
        { id: npc.id, body: npc.body, name: npc.name, self: false },
        ...net.peers()
          .filter((peer) => peer.x !== null)
          .map((peer) => ({ id: peer.id, body: peer.body, name: peer.name, said: peer.said, self: false })),
      ].sort((a, b) => (a.body.y + a.body.h) - (b.body.y + b.body.h));

      const now = performance.now();
      const fight = duel.view();
      // What goes over each head, collected here and handed to the DOM layer in
      // one call: names and bubbles are text, and text belongs in elements.
      const tagged = [];

      for (const who of cast) {
        const drawn = drawActor(ctx, creatures, who.body, camera, world.scale);
        const middleX = drawn.x + drawn.sprite / 2;
        // An arrow over whoever the "Challenge" button is currently about.
        if (near && who.id === near.id) drawMarker(ctx, middleX, drawn.y - 16, now);

        tagged.push({
          id: who.id,
          name: who.name,
          self: who.self,
          // Canvas pixels for the layer over the canvas — and taken from where
          // the monster STANDS rather than from `drawn.y`, so a name does not
          // bob up and down with the sprite it belongs to.
          sx: middleX * view.zoom,
          sy: (who.body.y + who.body.h - drawn.sprite - camera.y) * view.zoom,
          sprite: drawn.sprite * view.zoom,
          bubble: bubbleFor(who, fight),
        });
      }

      drawTags(tags, tagged);
    },
  });

  // A tab can be closed or hidden at any moment; write once more on the way out.
  // Only while we still own the game, though: a paused window writing its old
  // position on the way out would overwrite the live window's save.
  // Set while this window is deliberately on its way out (starting over, or
  // taking the game back). Both of those write the save they want and then
  // reload, and the flush below must not undo that with a stale copy.
  let leaving = false;

  const flush = () => (session.active && !leaving ? persist(identity, player) : false);
  addEventListener('pagehide', flush);
  // A hidden tab should cost nothing. Saves are flushed, the position broadcast
  // stops, and the loop stops asking for frames — a phone in a pocket was
  // redrawing the world and sending its position ten times a second, which is
  // how a game makes a phone hot for no reason at all. We do NOT leave the room:
  // glancing at another app should not make you vanish for everybody else.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flush(); net.sleep(); loop.pause(); }
    else { loop.resume(); net.wake(); }
  });

  // ------------------------------------------------------- one window at a time
  const paused = createPausedCard({ root: document.querySelector('#paused'), onResume: resume });

  session.attach({
    /** Write the live state down, and hand the same thing to the new window. */
    snapshot() {
      persist(identity, player);
      return {
        id: identity.id,
        name: identity.name,
        monster: identity.monster,
        x: player.x,
        y: player.y,
        safety: identity.safetySeen,
      };
    },

    /**
     * Stop being in the world. Leaving the room is the part that matters: if we
     * only stopped drawing, everybody else would still see a second copy of us
     * standing there for as long as the tab was open.
     */
    deactivate() {
      loop.stop();
      net.leave();
      audio.music(false);
      hideNearby();
      say('paused — playing in another window');
      paused.show();
    },
  });

  /**
   * Take the game back. Claim it (which pauses the other window and collects
   * whatever it was doing), write that down, and start this window again from
   * the top. Reloading is the honest way to restart: joining a new room, a new
   * loop and a new set of peers by hand would be three chances to leave half of
   * the old one behind.
   */
  async function resume() {
    const state = await session.claim();
    leaving = true;                 // whatever happens now, do not write our own
    if (state) writeSave(state);    // no answer means the other window has gone,
    location.reload();              // and what it left on disk is the truth
  }

  // ------------------------------------------------------------- start over
  //
  // The only way to change your name or your animal used to be to clear
  // `localStorage` by hand, which nobody twelve years old is ever going to do.
  //
  // It is a reload, like taking the game back, and for the same reason: the
  // onboarding is the boot path. Clearing the save and reloading runs the real
  // name-and-animal flow rather than a second copy of it, and every part of the
  // game — the room, the loop, the camera, the peers — starts genuinely fresh
  // instead of being unpicked by hand.
  //
  // A paused window cannot get here: its card covers the whole screen, buttons
  // and all, so only the window that actually owns the game can start over.
  // That is on purpose — two windows resetting the same save at once is exactly
  // the half-state worth not having.
  resetBtn.addEventListener('click', async () => {
    resetBtn.blur();
    if (duel.busy) return say('Finish the fight first.');
    if (!session.active) return;

    const sure = await confirmReset({ root: overlay });
    if (!sure) return;

    leaving = true;
    net.leave();          // walk out properly, so nobody is left staring at a ghost
    clearSave();          // the character goes; the safety card stays read
    location.reload();
  });

  // A handle for verification, and for the stages that come next.
  globalThis.game = {
    world, player, camera, identity, monsters, input, tuning, flush,
    net, chat, duel, npc, audio, session, resume, settings, help, fit,
    get paused() { return !session.active; },
    /** Who the Challenge button is about right now, or null. */
    get near() { return near; },
  };
}

/**
 * Take on the state an older window handed us.
 *
 * It is the same shape as the save, and it goes through the same doors: the
 * name is cleaned, a monster this build does not have is ignored, and the
 * position is only trusted if the monster was. `spawn()` still checks that the
 * spot is a real place, so a handover cannot put anybody inside a wall.
 */
function adopt(identity, monsters, state) {
  if (state.id) identity.id = state.id;
  if (state.name) identity.setName(state.name);
  if (state.safety) identity.safetySeen = true;

  const known = monsters.some((m) => m.id === state.monster);
  if (!known) return console.warn('session: handover named a monster this build has not got');
  identity.setMonster(state.monster);
  identity.position = { x: state.x, y: state.y };
  console.info('session: carried on from the window that had the game');
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
    /** +1 looking right, -1 looking left. Never 0: it is a memory, not a wish. */
    facing: 1,
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
function steer(input, player, camera, zoom = 1) {
  const pointer = input.pointer;
  if (pointer) {
    // The pointer is in canvas pixels and the player is in world pixels, which
    // are the same thing only at zoom 1. Undo the zoom before the subtraction,
    // or a tap on the far side of the screen asks for somewhere half as far
    // away as where the finger actually is.
    const toX = pointer.x / zoom + camera.x - (player.x + player.w / 2);
    const toY = pointer.y / zoom + camera.y - (player.y + player.h / 2);
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
