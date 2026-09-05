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
import { loadPlaces } from './places.js';
import { createCamera, fitCanvas, createMapLayer, drawMap, drawActor, drawMarker } from './render.js';
import { applyScale } from './ui/scale.js';
import { installGlyphs } from './ui/glyphs.js';
import { drawTags } from './ui/bubbles.js';
import { createIdentity, loadMonsters, persist } from './identity.js';
import { askIdentity, showSafetyCard, showHowToPlay, confirmReset } from './ui/onboarding.js';
import { joinRoom } from './net.js';
import { createChat } from './chat.js';
import { createChatBar } from './ui/chatbar.js';
import { createDuel } from './duel.js';
import { createNpc, ANIKI, anikiBody } from './npc.js';
import { createBoss } from './boss.js';
import { createBossScreen } from './ui/boss-screen.js';
import { createSpectate, duelFaces } from './spectate.js';
import { loadLooks, createLooks, BARE } from './looks.js';
import { createWins } from './wins.js';
import { openChest, showWardrobe } from './ui/chest.js';
import { createAudio } from './audio.js';
import { createDuelScreen } from './ui/duel-screen.js';
import { createSession } from './session.js';
import { createPausedCard } from './ui/paused.js';
import { createSettings } from './ui/settings.js';
import { createHelp } from './ui/help.js';
import { writeSave, clearSave, writeSafetySeen } from './save.js';
import { createBuild, buildWords } from './build.js';

const canvas = document.querySelector('#world');
if (!canvas) throw new Error('no #world canvas in index.html');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('canvas 2d context unavailable');
ctx.imageSmoothingEnabled = false;   // pixel art: never smooth it

// The pixel glyph sheet, before anything can ask for a glyph out of it: the ⚙
// in the corner is an <svg><use> pointing into it, and it is in the page from
// the moment this module runs.
installGlyphs();

// The service worker, and the one question it can answer that nobody else can:
// which cached build is actually serving this device. Registered at module
// scope, before `boot()` starts awaiting things, because it waits for `load`
// and `load` is not going to wait for us. See src/build.js.
const build = createBuild();
build.register();

const arena = document.querySelector('#arena');
const tags = document.querySelector('#tags');
const overlay = document.querySelector('#overlay');
const hudName = document.querySelector('#hud-name');
const hudPlace = document.querySelector('#hud-place');
const hudOnline = document.querySelector('#hud-online');
const statusEl = document.querySelector('#status');
const nearbyBtn = document.querySelector('#nearby');
const hudBoss = document.querySelector('#hud-boss');
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

  const [places, monsters, tuning, cosmetics] = await Promise.all([
    loadPlaces('./data/maps/maps.json'),
    loadMonsters('./data/monsters.json'),
    loadJSON('./data/tuning.json'),
    loadLooks('./data/cosmetics.json'),
    dungeon.ready,
    creatures.ready,
  ]);

  const identity = createIdentity(monsters);

  // ------------------------------------------------------------- where we are
  //
  // There is more than one map now (M8), so `world` is no longer the world: it
  // is whichever of them the player is standing in, and it changes when they
  // walk through a door. Everything below that used to close over one map now
  // closes over this variable, and `goThrough()` is the one place that moves it.
  //
  // The town is where Flint stands and where Aniki turns up on the hour. Both
  // of them are fixtures of a particular square in a particular map, so both are
  // town-only, and walking into the caves is genuinely walking away from the
  // fight. That is a design decision and not an oversight: it gives the town
  // something to be, and a second map full of the same three things as the first
  // one would not be a second place.
  const TOWN = places.start;

  // A save can name a map that has since been renamed or removed. The position
  // in it was measured in that map and means nothing in any other, so both go.
  if (identity.place && !places.has(identity.place)) {
    console.warn(`save: "${identity.place}" is not a map in this build — starting in ${TOWN}`);
    identity.setPlace('');
    identity.position = null;
  }

  let world = places.get(identity.place) || places.get(TOWN);
  identity.setPlace(world.id);

  // What can be worn, and what has been earned. `wins` is the counting and the
  // chests; `looks` is the painting. Neither knows about the other, and the
  // identity carries the answer to "what am I wearing" so that `net.js` can put
  // it in a greeting without either of them being involved.
  const looks = createLooks({ looks: cosmetics, atlas: creatures });
  const wins = createWins({ looks: cosmetics });
  identity.setLook(wins.wearing);

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
  const net = joinRoom({ world, places, identity, monsters, tuning });
  net.follow(player);                       // says where we are, posHz times a second

  const chat = createChat({ net, self: player });
  createChatBar({ root: document.querySelector('#chatbar'), chat });

  // ------------------------------------------------------ the small furniture
  // ------------------------------------------------ what copy of this is this
  //
  // The last row of the settings panel, and the only part of the interface that
  // is not for playing. Two of the three things in ISSUES.md are hard to
  // investigate for the same reason: a device running a months-old cached build
  // looks exactly like one running today's. Issue #2 says in bold to confirm the
  // cache version on both devices before testing, and both devices are phones.
  //
  // So it is on the screen: which build is answering, how many relays are up,
  // and who this browser is to everybody else. Read when the panel opens rather
  // than at boot, because at boot no relay has connected and the answer would be
  // "0 of 6" for everybody, forever.
  const aboutEl = document.querySelector('#about');

  async function showAbout() {
    if (!aboutEl) return;
    aboutEl.textContent = 'Looking…';
    const state = await build.describe();
    const relays = net.relays();
    const open = relays.filter((relay) => relay.open).length;
    aboutEl.textContent = [
      buildWords(state),
      `Relays: ${open} of ${relays.length} answering.`,
      `This browser is ${net.selfId.slice(0, 8)} to everybody else.`,
    ].join(' ');
  }

  // A newer worker has taken this page over, so what is on screen is the old
  // build and a reload is the whole fix. We say so instead of reloading: this
  // could land in the middle of a duel, and a game that restarts itself under
  // somebody is a worse bug than the one being fixed.
  build.onUpdate(() => say('A new version has arrived — reload when you are ready.'));

  const settings = createSettings({
    button: document.querySelector('#settingsBtn'),
    panel: document.querySelector('#settings'),
    install: document.querySelector('#installBtn'),
    onOpen: showAbout,
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

  // Everything that has been won, and everything that has not been won yet.
  document.querySelector('#looksBtn').addEventListener('click', async () => {
    settings.close();
    await showWardrobe({ root: overlay, wins, looks, identity, atlas: creatures });
    identity.setLook(wins.wearing);
    net.sendLook();
  });

  // A lone player has to be able to tell an empty world from a broken one, so
  // this always says something — and says the lonely case kindly, because it
  // is going to be the usual case.
  //
  // With no network at all it says so instead. "Just you here for now" is true
  // and misleading in the same breath — it sounds like an empty town, when what
  // has actually happened is that nobody can find you. The game itself carries
  // on: the world, your monster and Flint are all cached, and other players are
  // the one thing being offline takes away.
  /**
   * Somebody we can see: in the room, in THIS map, and has said where they are.
   *
   * Since M8 the second of those can be false, and it is the one that matters:
   * a peer in the caves has coordinates measured in the caves, and drawing them
   * at those numbers in the town would stand a stranger in the middle of the
   * plaza who is not there and cannot be talked to.
   */
  const alongside = (peer) => peer.x !== null && peer.place === world.id;

  const showOnline = () => {
    const all = net.peers();
    const others = all.filter(alongside).length;
    const elsewhere = all.filter((peer) => peer.place !== world.id).length;
    if (!navigator.onLine && all.length === 0) {
      hudOnline.textContent = 'No network — nobody can find you';
      hudOnline.classList.add('is-offline');
      return;
    }
    hudOnline.classList.remove('is-offline');
    // Counted for this map, and the rest of the world mentioned rather than
    // hidden: "Just you here for now" while four people are in the caves is
    // true about this room and a lie about the game.
    const here = others === 0
      ? 'Just you here for now'
      : `${others + 1} here — you and ${others === 1 ? '1 other' : `${others} others`}`;
    hudOnline.textContent = elsewhere
      ? `${here} · ${elsewhere} somewhere else`
      : here;
  };
  net.onPeerJoin(showOnline);
  net.onPeerLeave(showOnline);
  addEventListener('online', showOnline);
  addEventListener('offline', showOnline);
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
  const npc = createNpc({ monsters, world: places.get(TOWN), tuning });

  // Aniki, on the hour. He is not a duel and deliberately not in `duel.js`: a
  // boss five people fight at once is a different fight with the same three
  // moves, and `duel.js` is a tested one-against-one machine that should stay
  // one. He needs the network, because everybody's move is everybody's business.
  const aniki = { id: ANIKI.id, name: ANIKI.name, body: anikiBody(places.get(TOWN), monsters), look: ANIKI.look };
  const boss = createBoss({ tuning, net });
  const bossScreen = createBossScreen({ root: document.querySelector('#boss'), boss });

  const duel = createDuel({ tuning });
  createDuelScreen({ root: document.querySelector('#duel'), duel });
  duel.onSound((name) => audio.play(name));
  boss.onSound((name) => audio.play(name));

  // Standing when he fell is the whole of what the mark means, and `boss.js`
  // has already decided it about this player. Nothing is counted twice: `award`
  // only says yes the first time.
  // Which look that is comes from the data, not from a number written twice:
  // it is the one no chest can give, and `data/cosmetics.json` says which.
  const mark = cosmetics.find((look) => look.from === 'aniki');

  boss.onChange((v) => {
    if (!v.ours || !mark) return;
    if (wins.award(mark.id)) {
      say(`Aniki is down. You were standing — that is ${mark.name}.`);
      wins.wear(mark.id);
      identity.setLook(mark.id);
      net.sendLook();
    }
  });
  duel.onNotice((text) => { say(text); setTimeout(() => { if (statusEl.textContent === text) say(''); }, 4000); });
  duel.onChange(() => { if (duel.state !== 'walking') hideNearby(); });

  // Every duel that ends with us winning is one more towards a chest. `wins`
  // watches the same view the screen draws, and counts the ending once.
  //
  // The chest itself waits until the fight is over and the world is back: a
  // reward that lands on top of the last round would cover the thing it was for.
  duel.onChange(async (view) => {
    wins.saw(view);
    if (view.state !== 'walking' || !wins.waiting || overlay.hidden === false) return;
    await openChest({ root: overlay, wins, looks, identity, atlas: creatures });
    identity.setLook(wins.wearing);
    net.sendLook();
  });

  // Somebody out there has started talking duel to us — unless we are in the
  // raid, in which case they get the same polite no `duel.js` gives anybody who
  // asks while we are busy. Without this the duel card opens on top of the raid
  // panel and there are two fights on one screen.
  net.onLink((link) => {
    if (!boss.busy) { duel.receive(link); return; }
    link.onMessage((kind) => {
      if (kind !== 'ask') return;
      link.send('reply', { yes: false });
      link.close();
    });
  });

  // …and everybody who is not in this duel gets to watch it. One broadcast, of
  // one picture, whenever the picture changes — see src/spectate.js.
  const spectate = createSpectate({ net, duel, npc });

  const reach = Number(tuning.challengeReachPx) || 64;
  const middle = (body) => ({ x: body.x + body.w / 2, y: body.y + body.h / 2 });

  /**
   * Everyone in the world you could walk up to and start something with.
   *
   * Aniki is on this list only while he is standing there, and he is the one
   * entry with no `link`: what he starts is a raid, not a duel, so `startFight`
   * asks which it is. Everybody else answers the same questions as a peer.
   */
  function challengeable() {
    // Flint stands in the plaza and Aniki turns up in it; neither of them is
    // anywhere else, so in any other map the list starts empty. See the note on
    // TOWN above.
    const list = world.id === TOWN
      ? [{ id: npc.id, name: npc.name, body: npc.body, link: () => npc.link() }]
      : [];
    if (world.id === TOWN && boss.present && !boss.felled) {
      list.push({ id: aniki.id, name: aniki.name, body: aniki.body, boss: true });
    }
    for (const peer of net.peers()) {
      if (!alongside(peer)) continue;
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

  // ------------------------------------------------------------------- doors
  //
  // The square the player's feet are on, as an index into the current map. Feet
  // rather than the middle of the box, and the middle of the feet rather than a
  // corner, so that walking onto a door means what it looks like: the monster is
  // standing on it, not brushing past its edge.
  const footTile = () => {
    const t = world.tile;
    const col = Math.floor((player.x + player.w / 2) / t);
    const row = Math.floor((player.y + player.h - 1) / t);
    return { col, row, at: row * world.cols + col };
  };

  /**
   * Which square we were last on. A door fires when the feet ARRIVE on it, not
   * while they are on it, and this is what tells those apart.
   *
   * Without it, a door you are standing on fires every frame — and since the
   * far end of every door is a square in another map, that is a player bouncing
   * between two maps thirty times a second. Arriving sets it to the square we
   * arrive on, so even a door whose far end is another door lets go of you.
   */
  let standingOn = footTile().at;

  /**
   * Walk through a door: change which map is the world.
   *
   * Everything that was built out of the old map is rebuilt here, and there are
   * exactly three of them — the camera, which clamps to the map's size; the
   * player's position, which is measured in it; and what everybody else is told,
   * because a position without a map is a pair of numbers about nowhere. The
   * tile cache is not in the list only because `drawMap` notices for itself that
   * the map it painted is no longer the map it is being asked for.
   *
   * The save is written immediately rather than left to the twice-a-second
   * timer: shutting the lid on the threshold and coming back into the wrong map
   * is a small thing that would feel like the game losing your place.
   */
  function goThrough(door) {
    const next = places.get(door.to);
    if (!next) {
      // `places.js` drops doors that lead nowhere at boot, so this is the case
      // where something has gone wrong since — and standing in a doorway that
      // says nothing is worse than being told.
      say('That way is shut.');
      return;
    }

    world = next;
    identity.setPlace(world.id);

    const t = world.tile;
    player.x = door.spawn.col * t + (t - player.w) / 2;
    player.y = door.spawn.row * t + (t - player.h) - 4;

    camera = createCamera(canvas, world, view);
    camera.follow(player);
    standingOn = footTile().at;

    hudPlace.textContent = `${identity.creature.name} · ${world.name}`;
    near = null;
    hideNearby();

    // Tell the room before anything else moves: until this lands, everybody
    // else is holding coordinates of ours that belong to the map we have left.
    net.sendPlace();
    persist(identity, player);
    showOnline();
    audio.play('ping');
    say(world.name);
  }

  function hideNearby() { nearbyBtn.hidden = true; }

  function showNearby(target) {
    if (!target || duel.state !== 'walking' || boss.busy) return hideNearby();
    const label = target.boss ? `Take on ${target.name}` : `Challenge ${target.name}`;
    if (nearbyBtn.textContent !== label) nearbyBtn.textContent = label;
    nearbyBtn.hidden = false;
  }

  const startFight = () => {
    if (!near || duel.state !== 'walking' || boss.busy) return;
    help.challenged();          // they know how to do this now; stop saying it
    audio.play('ping');
    if (near.boss) boss.join();
    else duel.challenge(near.link());
    hideNearby();
  };

  nearbyBtn.addEventListener('click', () => { startFight(); nearbyBtn.blur(); });

  // F is the same key A19 uses, and it only does anything while walking.
  addEventListener('keydown', (e) => {
    if (e.key !== 'f' && e.key !== 'F') return;
    if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.isContentEditable)) return;
    startFight();
  });

  /** The record for a monster id, for the cosmetics that need to know a face. */
  const monsterOf = (id) => monsters.find((m) => m.id === id) || monsters[0];

  /**
   * What goes over somebody's head.
   *
   * A phrase if they have just said one — one of ours, looked up by number, so
   * there is no path from the network to a string on this screen. Otherwise
   * whatever their duel is showing.
   *
   * Our own fight is drawn from our own copy of it, for both heads in it: it is
   * on this machine already and a round is not worth a round trip. Everybody
   * else's comes off the wire, where each fighter reports their own head — and
   * Flint's, when it is Flint they are fighting, because every browser runs its
   * own copy of him and nobody else's knows he is busy.
   */
  function bubbleFor(who, faces) {
    const said = who.self ? player.said : who.said;
    if (said) return said;
    if (who.self) return faces.you;
    if (who.id === spectate.against) return faces.them;
    return spectate.faceOf(who.id) || null;
  }

  /**
   * When Aniki is due, or how long he is staying. It changes once a second at
   * most, so the badge is only rewritten when the words would actually differ —
   * a badge that repaints thirty times a second is thirty layouts for nothing.
   */
  let bossSaid = '';

  function showBoss() {
    const v = boss.view();
    const minutes = Math.max(0, Math.ceil(v.clock / 60000));
    const words = v.felled
      ? 'Aniki is down for this hour'
      : v.present
        ? `Aniki is here — ${minutes} min left`
        : `Aniki in ${minutes} min`;
    if (words === bossSaid) return;
    bossSaid = words;
    hudBoss.textContent = words;
    hudBoss.classList.toggle('is-here', v.present && !v.felled);
  }

  let sinceSave = 0;

  const loop = startLoop({
    update(dt) {
      // The hour, the round, and everything that happens to anybody in the raid.
      // It is driven by the clock rather than by a message, so it has to be
      // asked every frame — see src/boss.js.
      boss.update();
      showBoss();
      if (boss.busy) bossScreen.tick(boss.view());

      // In a duel — or a raid — you are not also walking around. A19's state
      // machine again: one state at a time, and the keys that do nothing here
      // do nothing.
      const busy = duel.busy || boss.busy;
      const wish = busy ? { dx: 0, dy: 0 } : steer(input, player, camera, view.zoom);
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

      // Standing somewhere new? Then this is the moment a door on that square
      // goes off. It is checked after the walking and before the camera, so the
      // camera that gets followed is the new map's.
      const foot = footTile();
      if (foot.at !== standingOn) {
        standingOn = foot.at;
        const door = world.doorAt(foot.col, foot.row);
        // `busy` cannot be true here — a duel refuses to move the player at all,
        // so the foot square cannot change during one — and it is checked anyway,
        // because "cannot happen" is how a fight ends up half in another map.
        if (door && !busy) goThrough(door);
      }

      camera.follow(player);

      // Who is within arm's reach? Recomputed every frame because everyone in
      // it is moving, and it is a handful of distances.
      near = busy ? null : nearestTarget();
      if (near) showNearby(near); else hideNearby();

      // Peers arrive ten times a second and are drawn sixty, so this slides
      // them along instead of letting them teleport. It touches no network.
      const now = performance.now();
      net.update(now, dt);
      chat.update(now);
      spectate.update(now);

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
      const inTown = world.id === TOWN;
      const cast = [
        { id: 'you', body: player, name: identity.name, self: true, look: identity.look, monster: identity.creature },
        // Flint, and only where Flint is.
        ...(inTown
          ? [{ id: npc.id, body: npc.body, name: npc.name, self: false, look: BARE, monster: monsterOf(npc.monster) }]
          : []),
        // Twice the size, and only while the clock says he is here — and only
        // in the plaza he turns up in.
        ...(inTown && boss.present && !boss.felled
          ? [{ id: aniki.id, body: aniki.body, name: aniki.name, self: false,
               look: aniki.look, monster: monsterOf(ANIKI.monster), big: ANIKI.size }]
          : []),
        ...net.peers()
          .filter(alongside)
          .map((peer) => ({
            id: peer.id, name: peer.name, said: peer.said, body: peer.body, self: false,
            look: peer.look, monster: monsterOf(peer.monster),
          })),
      ].sort((a, b) => (a.body.y + a.body.h) - (b.body.y + b.body.h));

      const now = performance.now();
      const faces = duelFaces(duel.view());
      // What goes over each head, collected here and handed to the DOM layer in
      // one call: names and bubbles are text, and text belongs in elements.
      const tagged = [];

      for (const who of cast) {
        // The sheet is the one this look calls for — a tint has its own,
        // recoloured once and kept — and the overlay is whatever is painted on
        // top of it, already moved onto this creature's face.
        const drawn = drawActor(ctx, looks.atlasFor(who.look), who.body, camera, world.scale * (who.big || 1),
                                looks.overlayFor(who.look, who.monster));
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
          bubble: bubbleFor(who, faces),
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

  // Going away, and coming back.
  //
  // A hidden tab should cost nothing. Saves are flushed, the position broadcast
  // stops, and the loop stops asking for frames — a phone in a pocket was
  // redrawing the world and sending its position ten times a second, which is
  // how a game makes a phone hot for no reason at all. We do NOT leave the room:
  // glancing at another app should not make you vanish for everybody else.
  //
  // Coming back is the half that was wrong. Locking a phone and unlocking it
  // left the game on screen and unable to move, until the page was reloaded.
  // `visibilitychange` was the only thing listened for, and it is not the only
  // thing that happens: a phone may freeze the page while it is away and thaw it
  // with a lifecycle `resume`, a browser may restore it from the back/forward
  // cache with `pageshow`, and the order they arrive in — or whether they arrive
  // at all — is a matter of opinion between browsers. So every one of them means
  // the same thing here, `wake()` is safe to call as often as they like, and
  // `loop.js` keeps its own watchdog for the case where none of them arrives.
  const sleep = () => { flush(); net.sleep(); loop.pause(); };
  const wake = () => { if (document.hidden) return; loop.resume(); net.wake(); };

  document.addEventListener('visibilitychange', () => (document.hidden ? sleep() : wake()));
  document.addEventListener('freeze', sleep);     // about to be put away for good
  document.addEventListener('resume', wake);      // …and thawed again
  addEventListener('pageshow', wake);             // restored from the bfcache
  addEventListener('focus', wake);                // tapped back into

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
        // Without this the new window opens in the town holding the caves'
        // coordinates, which is the same bug the `place` field exists to stop —
        // only against yourself.
        place: identity.place,
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
    player, identity, monsters, input, tuning, flush, places,
    // Both of these are swapped when a door is walked through, so they are read
    // when asked for rather than captured now.
    get world() { return world; },
    get camera() { return camera; },
    goThrough,
    net, chat, duel, npc, audio, session, resume, settings, help, fit, spectate, loop, wins, looks, boss,
    build, showAbout,
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
  // The map comes with the position and is checked in the same breath as it —
  // a map this build has not got is handled where the save's is, in `boot()`.
  if (typeof state.place === 'string') identity.setPlace(state.place);
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
