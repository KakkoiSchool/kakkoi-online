/**
 * Stage 2 — other people (lessons A12 and A13).
 *
 * This is the ONLY module allowed to know that trystero exists. Everything else
 * talks to the shape below, so the rest of the game never learns what a relay
 * is.
 *
 * Three ideas, and they are the whole file:
 *
 *   1. JOIN.  Everyone who opens the game finds everyone else through a handful
 *      of public noticeboards ("relays"). No server holds the game; once two
 *      browsers have found each other they talk directly.
 *   2. TELL.  Ten times a second — `posHz` in `data/tuning.json`, not sixty and
 *      not every frame — we say where we are. Your monster is not interesting
 *      enough to be worth sixty messages a second to every player.
 *   3. DOUBT. Everything that arrives here was written by a computer we do not
 *      control. Every field is checked before it becomes game state, and
 *      anything that does not fit is dropped and counted, never crashed on.
 *
 * Smooth movement. Position arrives ten times a second but we draw sixty, so a
 * peer would jump 15 pixels at a time. Instead every peer keeps a short list of
 * the positions it has sent us, and we draw it where it was `interpDelayMs`
 * ago, sliding between the two samples either side of that moment. Being an
 * eyeblink behind is invisible; teleporting is not.
 */
import { joinRoom as trysteroJoin, selfId, getRelaySockets } from '../vendor/trystero/nostr.js';
import { cleanName } from './identity.js';

/**
 * The noticeboards where two browsers leave a note saying "I am here".
 * Several, because any one of them can be busy, full, or simply gone —
 * verbatim from `demos/12-other-people/main.js`, which is the list currently
 * known to work.
 */
export const RELAYS = [
  'wss://relay.snort.social',
  'wss://nostr.sathoarder.com',
  'wss://nostr.vulpem.com',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://offchain.pub',
];

/** The demos use throwaway rooms. The real game has one town, and it is here. */
export const APP_ID = 'kakkoi-online';
export const ROOM_ID = 'town';

/** How many positions to remember per peer. A second's worth at 10Hz is plenty. */
const HISTORY = 12;

export { selfId };

/**
 * Join the world.
 *
 *   joinRoom({ world, identity, monsters, tuning }) -> {
 *     selfId, roomId,
 *     onPeerJoin(fn), onPeerLeave(fn),
 *     onPosition(fn), sendPosition(box, to), follow(box),
 *     onMessage(fn), send(kind, payload, to),
 *     peers(), peer(id), count(), update(now, dt), leave(), dropped
 *   }
 */
/**
 * A map id is a filename — see the note at the top of `world.js`. It arrives
 * over the wire from a computer we do not control, so it is checked like
 * everything else that does.
 */
const PLACE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function joinRoom({ world, places, identity, monsters, tuning, roomId = ROOM_ID }) {
  const room = trysteroJoin({ appId: APP_ID, relayUrls: RELAYS }, roomId);

  const [sendMove, onMove] = room.makeAction('move');
  const [sendHello, onHello] = room.makeAction('hello');
  const [sendDuel, onDuel] = room.makeAction('duel');

  const interpDelay = number(tuning.interpDelayMs, 150);
  const posEvery = 1000 / Math.max(1, number(tuning.posHz, 10));

  /**
   * Which map somebody is standing in, and where that leaves this file.
   *
   * The game has more than one place in it since M8, and the position protocol
   * had no way to say which one a pair of coordinates belongs to — which is
   * exactly why PLAN.md called the second map a milestone and not an afternoon.
   * (240, 500) means two different squares in two different maps, and drawing a
   * peer in the caves at the town's (240, 500) would put a stranger in the
   * middle of the plaza who is not there.
   *
   * The place does NOT ride in the position packet. That goes out `posHz` times
   * a second and ISSUES.md #1 is a phone getting hot; a map id changes when
   * somebody walks through a door, which is a handful of times an hour. So it
   * goes where the look goes: in the greeting everybody gets on arrival, and in
   * its own message when it changes. Exactly the pattern `sendLook` uses, for
   * exactly the same reason.
   *
   * `places` is optional. Given one map and no registry — which is how the
   * tests build a room — everybody is in the same place and there is nothing to
   * tell apart.
   */
  const home = places?.start || world?.id || '';
  const boundsFor = (peer) => (places ? places.get(peer.place) : world);

  /** id -> peer record. The only thing this module keeps. */
  const peers = new Map();

  /** Everything we refused, by reason. Handy in the console, honest in a lesson. */
  const dropped = { position: 0, monster: 0, name: 0, message: 0, gone: 0 };

  /**
   * Everybody trystero currently holds a connection to.
   *
   * Kept beside `peers` because the two answer different questions: `peers` is
   * what we know ABOUT people, and this is who is actually here. A packet can
   * outlive its sender — the last position somebody broadcast can arrive after
   * trystero has said they left — and without this, that packet would make them
   * a new record. See `present()`.
   */
  const here = new Set();

  const joinHandlers = [];
  const leaveHandlers = [];
  const positionHandlers = [];
  const messageHandlers = [];

  /** One trystero action per kind of message, made the first time it is used. */
  const actions = new Map();

  function action(kind) {
    if (actions.has(kind)) return actions.get(kind);
    if (typeof kind !== 'string' || !kind || kind.length > 12) {
      throw new Error(`net: "${kind}" is not a usable message kind`);
    }
    const [send, on] = room.makeAction(kind);
    on((payload, id) => {
      for (const fn of messageHandlers) fn(kind, payload, id);
    });
    const pair = { send, on };
    actions.set(kind, pair);
    return pair;
  }

  // ----------------------------------------------------------- who is here

  function makePeer(id) {
    const fallback = monsters[0];
    const peer = {
      id,
      name: id.slice(0, 4),
      monster: fallback.id,
      /** The last position this peer told us about — raw, checked, authoritative. */
      x: null,
      y: null,
      /** Where we actually draw them: `interpDelayMs` behind, slid smooth. */
      body: { x: 0, y: 0, w: 20, h: 14, cell: fallback.cell, moving: false, walked: 0, facing: 1 },
      /** The last preset phrase they picked, and when it stops showing. */
      said: '',
      saidIndex: -1,
      saidUntil: 0,
      /** What their duel is showing over their head, and when to stop */
      /** believing it. Set and expired by `src/spectate.js`. */
      fight: '',
      fightUntil: 0,
      /** Which look they are wearing, or 0 for none. See `src/looks.js`. */
      look: 0,
      /** Which map they are standing in. See the note on `home` above. */
      place: home,
      history: [],
      seenAt: performance.now(),
    };
    peers.set(id, peer);
    return peer;
  }

  /**
   * The record for somebody who is really in the room, made on demand.
   *
   * Every message goes through here rather than making a record for whoever
   * sent it. A player who closes their tab leaves one last position packet in
   * flight, and it can arrive AFTER `onPeerLeave` has removed them: the old code
   * cheerfully made them a fresh record, which — having missed the greeting that
   * carries the name — showed the first four letters of their peer id where
   * their name should be, standing wherever that final packet put them, for the
   * rest of the session. Nothing was ever going to arrive to move or remove
   * them, and you could still walk up to the ghost and challenge it.
   *
   * Returns null for somebody who is not here, and the caller drops the message.
   */
  function present(id) {
    if (peers.has(id)) return peers.get(id);
    if (!here.has(id)) return null;
    return makePeer(id);
  }

  room.onPeerJoin((id) => {
    here.add(id);
    const peer = peers.get(id) || makePeer(id);
    // Tell the newcomer who we are, and where. They do the same to us: trystero
    // fires this on both sides, so nobody has to ask.
    sendHello(greeting(), id);
    sendPosition(lastBox, id);
    for (const fn of joinHandlers) fn(peer);
  });

  room.onPeerLeave((id) => {
    here.delete(id);
    const peer = peers.get(id);
    // Close any duel with them BEFORE forgetting who they were: a link's name
    // is looked up from the peer list, and "sUSd left" is not what a person
    // needs to read when their opponent's tab closes mid-duel.
    const link = links.get(id);
    if (link) { links.delete(id); link.closed(); }
    peers.delete(id);
    for (const fn of leaveHandlers) fn(id, peer);
  });

  // ---------------------------------------------------------------- duelling
  //
  // A duel is a private conversation with one peer, so it gets its own little
  // object — a "link" — instead of a pile of global handlers. `src/duel.js` is
  // handed one of these and never learns what is behind it; `src/npc.js` makes
  // one of exactly the same shape that goes nowhere near the network, which is
  // why the fight code has no branch for "am I playing a computer".
  //
  // All five duel messages ride one trystero action with a `t` field, because a
  // duel is one conversation and one action keeps it in order.

  /** peer id -> link, for as long as a conversation with them is open. */
  const links = new Map();
  const linkHandlers = [];

  function makeLink(id) {
    const handlers = [];
    const closers = [];
    // Once they have gone, nothing more is said down this link. Without this,
    // the duel's parting "I am leaving" is posted to a peer who is already gone
    // and trystero warns about an id it no longer knows.
    let alive = true;
    const link = {
      id,
      get name() { return peers.get(id)?.name || id.slice(0, 4); },
      get monster() { return peers.get(id)?.monster ?? -1; },
      send(kind, payload = {}) { if (alive && peers.has(id)) sendDuel({ ...payload, t: kind }, id); },
      onMessage(fn) { handlers.push(fn); },
      onClose(fn) { closers.push(fn); },
      close() { if (links.get(id) === link) links.delete(id); },
      deliver(kind, payload) { for (const fn of handlers) fn(kind, payload); },
      closed() { alive = false; for (const fn of closers) fn(); },
    };
    links.set(id, link);
    return link;
  }

  /** Start (or carry on) a duel conversation with this peer. */
  function linkTo(id) {
    return links.get(id) || makeLink(id);
  }

  onDuel((data, id) => {
    if (!data || typeof data !== 'object' ||
        typeof data.t !== 'string' || data.t.length > 8) { dropped.message++; return; }
    // Somebody can start a duel before their greeting has landed, and a link
    // that has no peer record cannot answer. Make the record first — unless they
    // are not here at all, in which case there is nobody to duel.
    if (!present(id)) { dropped.gone++; return; }
    const fresh = !links.has(id);
    const link = linkTo(id);
    // Tell whoever cares about a brand new conversation BEFORE the message that
    // started it, so their handler is listening in time to hear it.
    if (fresh) for (const fn of linkHandlers) fn(link);
    link.deliver(data.t, data);
  });

  // -------------------------------------------------------------- listening

  /**
   * A name and a monster. The name is cleaned the same way our own was — a
   * stranger's name lands in our nameplate, so it gets the same trimming and
   * the same "letters, digits, spaces, - and _ only" rule.
   */
  onHello((data, id) => {
    const peer = present(id);
    if (!peer) { dropped.gone++; return; }
    if (!data || typeof data !== 'object') { dropped.message++; return; }

    const name = cleanName(data.name);
    if (name) peer.name = name;
    else dropped.name++;

    applyMonster(peer, data.monster);
    applyLook(peer, data.look);
    // Only if they said. A peer running a build from before there was anywhere
    // else to be has not got the field, and the right answer for them is the
    // starting map, which is where `makePeer` has already put them.
    if (data.place !== undefined) applyPlace(peer, data.place);
  });

  /**
   * Somebody has changed what they are wearing. Registered here rather than in
   * a module of its own because a look is part of a peer's appearance, which is
   * this file's business, and it is four lines.
   */
  action('look');
  messageHandlers.push((kind, payload, id) => {
    if (kind !== 'look') return;
    const peer = peers.get(id);
    if (!peer) { dropped.gone++; return; }
    applyLook(peer, payload?.l);
  });

  /**
   * Somebody has walked through a door. Registered beside the look above and
   * for the same reason: where a peer is standing is this file's business, and
   * it is four lines.
   *
   * Their position is deliberately forgotten on the way. The coordinates we
   * hold for them were measured in the map they have just left, and drawing
   * them at those numbers in the map they have just entered is the bug this
   * whole field exists to prevent — for the fifth of a second before their next
   * position packet lands, they would be standing somewhere they have never
   * been. `x === null` is the shape `main.js` already skips.
   */
  action('place');
  messageHandlers.push((kind, payload, id) => {
    if (kind !== 'place') return;
    const peer = peers.get(id);
    if (!peer) { dropped.gone++; return; }
    if (!applyPlace(peer, payload?.p)) return;
    peer.x = null;
    peer.y = null;
    peer.history.length = 0;
  });

  onMove((data, id) => {
    const peer = present(id);
    if (!peer) { dropped.gone++; return; }
    if (!data || typeof data !== 'object') { dropped.position++; return; }

    // Bounds belong to the map THEY are standing in, not the one we are: the
    // caves are smaller than the town, and checking a peer in the town against
    // the caves' edges would refuse half the town as impossible. A place this
    // build has not got has no bounds to check against and nowhere to be drawn,
    // so the position is dropped rather than believed.
    const bounds = boundsFor(peer);
    if (!bounds) { dropped.position++; return; }

    const x = Number(data.x);
    const y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
        x < -bounds.tile || y < -bounds.tile ||
        x > bounds.width + bounds.tile || y > bounds.height + bounds.tile) {
      dropped.position++;
      return;
    }

    // A monster id rides along with every position, so a peer whose greeting we
    // missed still gets drawn as the creature they actually picked.
    if (data.m !== undefined) applyMonster(peer, data.m);

    peer.x = x;
    peer.y = y;
    peer.seenAt = performance.now();
    peer.history.push({ t: peer.seenAt, x, y });
    if (peer.history.length > HISTORY) peer.history.shift();
    if (peer.history.length === 1) { peer.body.x = x; peer.body.y = y; }

    for (const fn of positionHandlers) fn(peer);
  });

  /**
   * A monster id off the end of the list is not a monster. Rather than draw a
   * random slice of the sheet — or crash — we count it and leave the peer as
   * whatever they were.
   */
  /**
   * A look is a small whole number and nothing else. We do NOT check it against
   * a list here: `looks.js` paints an id it does not know as nothing at all, and
   * a peer running a newer build with a fifth chest in it should not have their
   * whole greeting refused over a hat.
   */
  function applyLook(peer, id) {
    if (!Number.isInteger(id) || id < 0 || id > 999) { dropped.message++; return false; }
    peer.look = id;
    return true;
  }

  /**
   * A map this build has never heard of is not refused — it is remembered as
   * given. A peer on a newer build standing in a map we do not have is somebody
   * we cannot draw, which is the same answer as "somewhere else", and refusing
   * the field would leave them apparently standing in the town instead. What
   * IS refused is a value that is not a map name at all.
   */
  function applyPlace(peer, id) {
    if (typeof id !== 'string' || !PLACE.test(id)) { dropped.message++; return false; }
    peer.place = id;
    return true;
  }

  function applyMonster(peer, id) {
    const monster = Number.isInteger(id) ? monsters.find((m) => m.id === id) : undefined;
    if (!monster) { dropped.monster++; return false; }
    peer.monster = monster.id;
    peer.body.cell = monster.cell;
    return true;
  }

  // ---------------------------------------------------------------- talking

  function greeting() {
    return {
      name: identity.name,
      monster: identity.monster,
      look: identity.look || 0,
      place: identity.place || home,
    };
  }

  /**
   * Tell the room what we are wearing, now that it has changed.
   *
   * A look is in the greeting, which everybody gets on arrival, so this is only
   * for the moment somebody opens a chest or changes their mind — a handful of
   * packets in a session. It deliberately does NOT ride in the position packet:
   * that goes out ten times a second and ISSUES.md #1 is a phone getting hot.
   */
  function sendLook() {
    send('look', { l: identity.look || 0 });
  }

  /**
   * Tell the room we have gone through a door.
   *
   * Sent immediately, before the next position packet, so that nobody draws us
   * at our new coordinates on their old map. The position that follows is a
   * fresh one in the new place, and `sendPosition` is nudged into sending it
   * even though we may not have moved a pixel since — arriving somewhere else
   * standing exactly where we stood is a real thing that happens, and it is not
   * a reason to say nothing.
   */
  function sendPlace() {
    send('place', { p: identity.place || home });
    lastSent = null;
    sendPosition(lastBox);
  }

  /** Whole pixels: half a pixel of a peer's position is not worth the bytes. */
  let lastBox = { x: 0, y: 0 };
  let lastSent = null;
  let lastSentAt = 0;
  let timer = null;

  /**
   * How often to repeat a position that has not changed. See `sendPosition`.
   */
  const keepAlive = number(tuning.posKeepaliveMs, 2000);

  /** Positions we did not send because they said nothing new. Honest in a lesson. */
  const saved = { positions: 0 };

  /**
   * Say where we are — unless we have already said exactly that.
   *
   * The broadcast runs `posHz` times a second whether or not anybody has moved,
   * and in this game people stand still a great deal: reading the phrase bar,
   * deciding who to challenge, and — the big one — the whole length of a duel,
   * where `main.js` refuses to move the player at all and the position cannot
   * change by definition. Every one of those was ten identical packets a second
   * to every peer in the mesh, each one encoded, chunked and pushed down a data
   * channel at both ends. ISSUES.md #1 is a phone getting hot, and its first
   * suspect is the WebRTC mesh at `posHz` 10.
   *
   * So a packet that would repeat the last one is not sent. Nothing downstream
   * needs it: `sampleAt` in this same file already draws a peer with no newer
   * sample exactly where their last one put them, which is the correct answer
   * for somebody standing still.
   *
   * It is still repeated every `posKeepaliveMs`, for the two cases where
   * silence and stillness are not the same thing: a packet that went missing on
   * the way, and a peer whose idea of where we are is older than our idea of
   * where we are. Twice a second becomes once every two seconds, which is a
   * twentieth of the traffic and still five times more often than anyone needs.
   *
   * A packet aimed at ONE peer — the greeting pair sent the moment somebody
   * joins — always goes. They have never heard from us; "you already know this"
   * is exactly what is not true about them.
   */
  function sendPosition(box, to) {
    if (!box) return null;
    const packet = { x: Math.round(box.x), y: Math.round(box.y), m: identity.monster };
    if (to) { sendMove(packet, to); return packet; }

    const now = performance.now();
    const same = lastSent && lastSent.x === packet.x && lastSent.y === packet.y &&
                 lastSent.m === packet.m;
    if (same && now - lastSentAt < keepAlive) { saved.positions++; return null; }

    sendMove(packet);
    lastSent = packet;
    lastSentAt = now;
    return packet;
  }

  /** Start saying where this box is, `posHz` times a second, until we leave. */
  function follow(box) {
    lastBox = box;
    if (timer) clearInterval(timer);
    timer = setInterval(() => sendPosition(box), posEvery);
    sendHello(greeting());
    sendPosition(box);
  }

  /**
   * Stop and restart the position broadcast without leaving the room.
   *
   * A backgrounded tab still ran this ten times a second — a phone with the
   * screen off was sending its position into a WebRTC mesh forever, which is
   * both pointless and hot. `main.js` calls these on `visibilitychange`.
   * Leaving the room instead would make you vanish and reappear for everybody
   * else each time you glanced at another app.
   */
  function sleep() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function wake() {
    if (!timer && lastBox) {
      timer = setInterval(() => sendPosition(lastBox), posEvery);
      sendPosition(lastBox);
    }
  }

  function send(kind, payload, to) {
    return action(kind).send(payload, to);
  }

  /**
   * Which noticeboards are actually answering, right now.
   *
   * ISSUES.md #2 — two devices that never see each other — has three candidate
   * causes and no way to tell them apart from inside the game. This is the one
   * that can be checked without a second device: if the relays are not open,
   * nobody is going to find you and the answer is the network, not the game.
   * `src/main.js` prints "6 of 6 relays" in the settings panel, which is a thing
   * a child can read down a phone to somebody in another town.
   *
   * This is the only file allowed to know trystero exists, so the socket list is
   * flattened to `{ url, open }` here and nothing outside learns what a relay is
   * made of.
   */
  function relays() {
    let sockets = {};
    try {
      sockets = getRelaySockets() || {};
    } catch (err) {
      console.warn('net: could not read the relay sockets —', err.message);
    }
    return RELAYS.map((url) => {
      // Browsers normalise `wss://host` to `wss://host/`; trystero keys them by
      // whichever string it was handed, so look for both.
      const socket = sockets[url] || sockets[`${url}/`];
      return { url, open: socket?.readyState === WebSocket.OPEN };
    });
  }

  // ------------------------------------------------------------ drawing them

  /**
   * Slide every peer towards where they were `interpDelayMs` ago. Called once a
   * frame; nothing here talks to the network.
   */
  function update(now, dt) {
    const when = now - interpDelay;
    for (const peer of peers.values()) {
      const at = sampleAt(peer.history, when);
      if (!at) continue;
      const stepX = at.x - peer.body.x;
      const moved = Math.hypot(stepX, at.y - peer.body.y);
      // Which way a peer is looking is WORKED OUT here, from the direction they
      // are sliding, rather than sent over the wire. It costs nothing, needs no
      // new field in a `move` packet and no new version of the protocol, and a
      // peer walking left is exactly a peer whose x is going down. The threshold
      // keeps interpolation jitter from flipping them back and forth on the
      // spot, and a peer standing still keeps the way they were last facing.
      if (stepX > 0.05) peer.body.facing = 1;
      else if (stepX < -0.05) peer.body.facing = -1;
      peer.body.x = at.x;
      peer.body.y = at.y;
      peer.body.moving = moved > 0.35;
      peer.body.walked = peer.body.moving ? peer.body.walked + dt : 0;
      if (peer.saidUntil && peer.saidUntil < now) { peer.said = ''; peer.saidIndex = -1; peer.saidUntil = 0; }
      prune(peer.history, when);
    }
  }

  function leave() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const link of links.values()) link.closed();
    links.clear();
    peers.clear();
    here.clear();
    room.leave();
  }

  return {
    sleep,
    wake,
    selfId,
    roomId,
    room,
    dropped,
    saved,
    onPeerJoin: (fn) => joinHandlers.push(fn),
    onPeerLeave: (fn) => leaveHandlers.push(fn),
    onPosition: (fn) => positionHandlers.push(fn),
    onMessage: (fn) => messageHandlers.push(fn),
    /** A peer has started a duel conversation with us. */
    onLink: (fn) => linkHandlers.push(fn),
    linkTo,
    /** Register a kind now so its first arrival is not a surprise. */
    expect: (kind) => { action(kind); },
    send,
    relays,
    sendLook,
    sendPlace,
    /** Where a player with no opinion on the matter is standing. */
    home,
    sendPosition,
    follow,
    update,
    leave,
    peers: () => [...peers.values()],
    peer: (id) => peers.get(id),
    count: () => peers.size,
    get lastSent() { return lastSent; },
  };
}

/** Where a peer was at time `t`, sliding between the two samples either side. */
function sampleAt(history, t) {
  if (!history.length) return null;
  if (t <= history[0].t) return { x: history[0].x, y: history[0].y };

  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t > t) continue;
    const a = history[i];
    const b = history[i + 1];
    if (!b) return { x: a.x, y: a.y };          // nothing newer yet: sit still
    const span = b.t - a.t;
    const f = span > 0 ? (t - a.t) / span : 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  return { x: history[0].x, y: history[0].y };
}

/** Forget samples we have already walked past, but keep the one we came from. */
function prune(history, t) {
  while (history.length > 2 && history[1].t <= t) history.shift();
}

function number(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
