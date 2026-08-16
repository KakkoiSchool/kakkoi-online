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
import { joinRoom as trysteroJoin, selfId } from '../vendor/trystero/nostr.js';
import { cleanName } from './identity.js';

/**
 * The noticeboards where two browsers leave a note saying "I am here".
 * Several, because any one of them can be busy, full, or simply gone —
 * verbatim from `demos/12-other-people/main.js`, which is the list currently
 * known to work.
 */
export const RELAYS = ['wss://relay.snort.social', 'wss://nostr.sathoarder.com',
                       'wss://nos.lol', 'wss://nostr.vulpem.com'];

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
export function joinRoom({ world, identity, monsters, tuning, roomId = ROOM_ID }) {
  const room = trysteroJoin({ appId: APP_ID, relayUrls: RELAYS }, roomId);

  const [sendMove, onMove] = room.makeAction('move');
  const [sendHello, onHello] = room.makeAction('hello');

  const interpDelay = number(tuning.interpDelayMs, 150);
  const posEvery = 1000 / Math.max(1, number(tuning.posHz, 10));

  /** id -> peer record. The only thing this module keeps. */
  const peers = new Map();

  /** Everything we refused, by reason. Handy in the console, honest in a lesson. */
  const dropped = { position: 0, monster: 0, name: 0, message: 0 };

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
      element: fallback.element,
      /** The last position this peer told us about — raw, checked, authoritative. */
      x: null,
      y: null,
      /** Where we actually draw them: `interpDelayMs` behind, slid smooth. */
      body: { x: 0, y: 0, w: 20, h: 14, cell: fallback.cell, moving: false, walked: 0 },
      /** The last preset phrase they picked, and when it stops showing. */
      said: '',
      saidIndex: -1,
      saidUntil: 0,
      history: [],
      seenAt: performance.now(),
    };
    peers.set(id, peer);
    return peer;
  }

  room.onPeerJoin((id) => {
    const peer = peers.get(id) || makePeer(id);
    // Tell the newcomer who we are, and where. They do the same to us: trystero
    // fires this on both sides, so nobody has to ask.
    sendHello(greeting(), id);
    sendPosition(lastBox, id);
    for (const fn of joinHandlers) fn(peer);
  });

  room.onPeerLeave((id) => {
    const peer = peers.get(id);
    peers.delete(id);
    for (const fn of leaveHandlers) fn(id, peer);
  });

  // -------------------------------------------------------------- listening

  /**
   * A name and a monster. The name is cleaned the same way our own was — a
   * stranger's name lands in our nameplate, so it gets the same trimming and
   * the same "letters, digits, spaces, - and _ only" rule.
   */
  onHello((data, id) => {
    const peer = peers.get(id) || makePeer(id);
    if (!data || typeof data !== 'object') { dropped.message++; return; }

    const name = cleanName(data.name);
    if (name) peer.name = name;
    else dropped.name++;

    applyMonster(peer, data.monster);
  });

  onMove((data, id) => {
    const peer = peers.get(id) || makePeer(id);
    if (!data || typeof data !== 'object') { dropped.position++; return; }

    const x = Number(data.x);
    const y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
        x < -world.tile || y < -world.tile ||
        x > world.width + world.tile || y > world.height + world.tile) {
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
  function applyMonster(peer, id) {
    const monster = Number.isInteger(id) ? monsters.find((m) => m.id === id) : undefined;
    if (!monster) { dropped.monster++; return false; }
    peer.monster = monster.id;
    peer.element = monster.element;
    peer.body.cell = monster.cell;
    return true;
  }

  // ---------------------------------------------------------------- talking

  function greeting() {
    return { name: identity.name, monster: identity.monster };
  }

  /** Whole pixels: half a pixel of a peer's position is not worth the bytes. */
  let lastBox = { x: 0, y: 0 };
  let lastSent = null;
  let timer = null;

  function sendPosition(box, to) {
    if (!box) return null;
    const packet = { x: Math.round(box.x), y: Math.round(box.y), m: identity.monster };
    sendMove(packet, to);
    if (!to) lastSent = packet;
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

  function send(kind, payload, to) {
    return action(kind).send(payload, to);
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
      const moved = Math.hypot(at.x - peer.body.x, at.y - peer.body.y);
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
    peers.clear();
    room.leave();
  }

  return {
    selfId,
    roomId,
    room,
    dropped,
    onPeerJoin: (fn) => joinHandlers.push(fn),
    onPeerLeave: (fn) => leaveHandlers.push(fn),
    onPosition: (fn) => positionHandlers.push(fn),
    onMessage: (fn) => messageHandlers.push(fn),
    /** Register a kind now so its first arrival is not a surprise. */
    expect: (kind) => { action(kind); },
    send,
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
