/**
 * Watching somebody else's fight.
 *
 * A duel is a private conversation: `duel.js` talks down one `link` to one
 * opponent, and the rest of the room hears none of it. That is the right shape
 * for the fight itself — but it meant that walking past two people mid-duel
 * showed you two monsters standing perfectly still, and the moves, the faces and
 * the whole point of the thing were invisible to everyone except the two people
 * who were already looking at the duel screen.
 *
 * So this file adds one broadcast, and it is deliberately the smallest one that
 * works: **each fighter tells the room what is over their own head.** Not who
 * they are fighting, not the score, not the state machine — one of six pictures,
 * as a number. A bystander draws each peer's own report over that peer, which
 * needs no agreement about whose duel is whose and stays right when two duels
 * are happening at once.
 *
 * **What the room may see, and when.** `duelFaces()` below is the public view of
 * a duel, and it is not the same as the private one. While a round is being
 * chosen it says `think` for both sides *even when a move has been committed* —
 * the move you picked is yours until the reveal, and putting it over your head
 * early would show it to everyone in the plaza before your opponent has
 * answered. The moves appear at the reveal, which is the moment worth watching,
 * and the win/lose faces come at the end, when there is a result to react to.
 *
 * **Flint is the exception, and he has to be.** Every browser runs its own copy
 * of the computer opponent (`npc.js`), so nobody else's copy knows he is in a
 * fight. A player duelling Flint therefore sends his face along with their own,
 * in the same packet, and everyone else paints it onto their own Flint. If two
 * people fight him at the same moment the room sees whichever arrived last over
 * the one Flint on the screen — which is wrong, and is the cheapest wrong answer
 * available. The alternative is a second identity for a character who only
 * exists locally.
 *
 * **Cost.** A packet goes out when the picture changes and at no other time —
 * roughly a dozen for a whole duel, against the ten a second the position
 * broadcast is already sending. Nothing here runs per frame except `update()`,
 * which is a clock check over a handful of peers. ISSUES.md #1 is a phone
 * getting hot; this is not going to be the reason.
 */

/**
 * The six pictures, in the order the wire numbers them. What crosses the network
 * is an index into this list and never a word — the same rule `chat.js` follows
 * for phrases, and for the same reason: a number this build does not recognise
 * is dropped, and there is no path from another computer to a string on this
 * screen.
 */
export const SHOWN = ['think', 'rock', 'paper', 'scissors', 'win', 'lose'];

/** How long a reported face is believed without being repeated. */
const HOLD_MS = 20000;

/**
 * What the room may see of a duel: one picture for each side, or nothing at all
 * when there is no fight on.
 *
 * `main.js` draws this over the two heads itself, so its own view of its own
 * duel never has to go near the network to come back.
 */
export function duelFaces(view) {
  const none = { you: null, them: null };
  if (!view || view.state !== 'fighting') return none;

  // Choosing, or waiting on the other side: nobody's move is public yet.
  if (view.phase === 'choosing' || view.phase === 'waiting') return { you: 'think', them: 'think' };

  // The reveal. Both moves, side by side, over the heads that played them —
  // this is the part you can read from across the plaza.
  if (view.phase === 'resolved') {
    return view.last ? { you: view.last.mine, them: view.last.theirs } : { you: 'think', them: 'think' };
  }

  if (view.phase === 'over') {
    const how = view.outcome?.how;
    if (how === 'you') return { you: 'win', them: 'lose' };
    if (how === 'them') return { you: 'lose', them: 'win' };
    return none;                 // somebody left: there is nothing to celebrate
  }

  return none;
}

/**
 * Start telling the room about our duel, and listening for everybody else's.
 *
 *   createSpectate({ net, duel, npc }) -> {
 *     update(now), against, npcFace, faceOf(id), sent
 *   }
 */
export function createSpectate({ net, duel, npc }) {
  // Register the action now, so the first packet to arrive is not the thing that
  // creates the handler that was supposed to hear it.
  net.expect('fight');

  /** Who we are fighting. Remembered because the duel lets its link go the */
  /** moment the fight ends, and the result still has to be drawn over them. */
  let against = null;

  /**
   * The last thing we told the room, so that we only ever say it once — and it
   * starts as the packet that means "nothing over my head", because that is
   * already true of everybody. Without that, accepting a challenge opens with a
   * broadcast announcing that we are not fighting.
   */
  const NOTHING = JSON.stringify({ m: -1 });
  let sent = NOTHING;

  /** What somebody reported for Flint, when to stop believing it, and WHO said */
  /** so — his face is cleared by the player who claimed him and by nobody else, */
  /** or the next person to finish a duel anywhere wipes it mid-fight. */
  let npcFace = '';
  let npcUntil = 0;
  let npcFrom = '';

  function packet() {
    const view = duel.view();
    if (view.them) against = view.them.id;
    else if (view.state === 'walking') against = null;

    const faces = duelFaces(view);
    if (!faces.you) return { m: -1 };                  // not fighting: clear us

    const out = { m: SHOWN.indexOf(faces.you) };
    // Flint's side rides along, because no other browser knows he is busy.
    if (against === npc.id) out.n = SHOWN.indexOf(faces.them);
    return out;
  }

  /** Say it, but only if it is not what we said last time. */
  function tell() {
    const out = packet();
    const key = JSON.stringify(out);
    if (key === sent) return false;
    sent = key;
    net.send('fight', out);
    return true;
  }

  duel.onChange(tell);

  // Somebody who walks in halfway through a duel would otherwise see two
  // monsters standing still until the next round. They get the current picture
  // on arrival, and nobody else pays for it.
  net.onPeerJoin((peer) => {
    const out = packet();
    if (out.m >= 0) net.send('fight', out, peer.id);
  });

  /**
   * Everything below arrived from a computer we do not control, so every field
   * is checked before it becomes something on the screen. A number that is not
   * one of the six pictures is counted and thrown away.
   */
  net.onMessage((kind, payload, id) => {
    if (kind !== 'fight') return;
    const peer = net.peer(id);
    if (!peer || !payload || typeof payload !== 'object') { net.dropped.message++; return; }

    const mine = face(payload.m);
    if (mine === null) { net.dropped.message++; return; }

    const now = performance.now();
    peer.fight = mine;
    peer.fightUntil = mine ? now + HOLD_MS : 0;

    if (payload.n === undefined) {
      // They have stopped fighting. If Flint was theirs, he has stopped too:
      // the packet that says "nothing over my head" is the only notice his side
      // is ever going to get, because he has no browser of his own to send one.
      if (!mine && npcFrom === id) forgetNpc();
      return;
    }

    const theirs = face(payload.n);
    if (theirs === null) { net.dropped.message++; return; }
    npcFace = theirs;
    npcUntil = theirs ? now + HOLD_MS : 0;
    npcFrom = theirs ? id : '';
  });

  // A tab closed mid-duel takes its peer record with it, and would otherwise
  // leave Flint wearing the last thing that player saw for the whole hold.
  net.onPeerLeave((id) => { if (npcFrom === id) forgetNpc(); });

  function forgetNpc() {
    npcFace = '';
    npcUntil = 0;
    npcFrom = '';
  }

  /**
   * Forget a face nobody has repeated.
   *
   * Every way a duel can end sends a clear, and a peer who closes the tab is
   * removed from the room with everything on their record — so this is only
   * insurance. It is cheap insurance: without it, one packet that never arrived
   * leaves somebody wearing a victory face for the rest of the session.
   */
  function update(now) {
    if (npcUntil && npcUntil < now) forgetNpc();
    for (const peer of net.peers()) {
      if (peer.fightUntil && peer.fightUntil < now) { peer.fight = ''; peer.fightUntil = 0; }
    }
  }

  return {
    update,
    /** What this id is showing, as far as the room has been told. */
    faceOf: (id) => (id === npc.id ? npcFace : net.peer(id)?.fight || ''),
    get against() { return against; },
    get npcFace() { return npcFace; },
    /** For checking from the console. */
    get sent() { return sent; },
  };
}

/** A wire number as one of the six words, `''` for "nothing", or null for junk. */
function face(value) {
  if (value === -1) return '';
  if (!Number.isInteger(value) || value < 0 || value >= SHOWN.length) return null;
  return SHOWN[value];
}
