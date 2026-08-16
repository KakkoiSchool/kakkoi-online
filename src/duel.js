/**
 * The fight (lessons A19, A20).
 *
 * Two ideas, stacked:
 *
 *   1. A STATE MACHINE. The game is in exactly one state at a time — `walking`,
 *      `waiting`, `asked`, `fighting` — and every awkward case is one line in
 *      here rather than a special case scattered through the rest of the game.
 *      Refused, both-challenged-at-once, they-left-mid-duel and they-went-quiet
 *      all end the same way: back to `walking`, never stuck.
 *
 *   2. THREE MOVES. rock, paper, scissors. Each player picks one; when both have
 *      picked, the round is shown. Who won is decided by `battle/rules.js`, which
 *      is pure, so both browsers compute the same answer from the same two moves.
 *      First to `winsNeeded` rounds takes the duel; a draw replays the round. No
 *      hit points, no charges. The monster you picked is a costume in a duel —
 *      it changes nothing.
 *
 * **Your move goes straight to the other player.** An earlier version folded it
 * into a SHA-256 fingerprint first, swapped fingerprints, and only then swapped
 * moves, so that neither side could wait and see. That is real cryptography, and
 * it was most of why the duel read as complicated to the people actually playing
 * it. The honest cost of sending the move directly is written down in `DESIGN.md`
 * and repeated here because it belongs next to the code: whoever's move arrives
 * first has shown their hand, so somebody who edited the game's own code could
 * answer it. Between five friends that is a fine trade for a duel a child can
 * follow. It is a game of rock, paper, scissors, not a bank.
 *
 * **How it talks.** This file has never heard of trystero, and cannot tell a
 * person from a computer. It is handed a `link`:
 *
 *     { id, name, send(kind, payload), onMessage(fn), onClose(fn), close() }
 *
 * `net.linkTo(peerId)` makes one that goes over the wire; `npc.link()` makes one
 * that goes to `src/npc.js`. There is deliberately no `if (isNpc)` anywhere
 * below — if there were, the computer opponent would be a second, less-tested
 * copy of the fight, and the one you practise against would not be the one you
 * play.
 */
import { MOVES, isMove, roundResult, matchWinner } from './battle/rules.js';

export { MOVES };

export function createDuel({ tuning = {} } = {}) {
  const needed = int(tuning.winsNeeded, 3);
  const timeoutMs = int(tuning.answerTimeoutMs, 10000);
  const gapMs = int(tuning.roundGapMs, 2200);

  let state = 'walking';          // walking | waiting | asked | fighting
  let link = null;                // who this conversation is with
  let score = { you: 0, them: 0 };
  let round = 0;
  let phase = 'idle';             // choosing | waiting | resolved | over
  let mine = null;                // the move we chose this round
  let theirs = null;              // the move they chose, once it has arrived
  let last = null;                // the round just played, in words
  let outcome = null;             // how the whole duel ended
  let timer = null;
  let gap = null;

  const changed = [];
  const notices = [];
  const sounds = [];
  const emit = () => { const v = view(); for (const fn of changed) fn(v); };
  const notice = (text) => { if (text) for (const fn of notices) fn(text); };
  const sound = (name) => { for (const fn of sounds) fn(name); };

  const who = () => (link ? link.name : 'They');

  // --------------------------------------------------------------- the link

  function attach(next) {
    detach();
    link = next;
    link.onMessage(handle);
    link.onClose(() => lost(`${who()} left`));
  }

  function detach() {
    if (link) link.close();
    link = null;
    clearTimers();
  }

  function clearTimers() {
    if (timer) clearTimeout(timer);
    if (gap) clearTimeout(gap);
    timer = null;
    gap = null;
  }

  /**
   * Nobody waits forever. Armed the moment we are waiting on the other side for
   * something, cleared the moment it turns up. `answerTimeoutMs` is the same ten
   * seconds whether we are waiting for a yes, a no, or a move.
   */
  function waitOn(why) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; lost(why); }, timeoutMs);
  }

  /** They went quiet, or left, or closed the tab. One ending, three doors. */
  function lost(why) {
    if (state === 'fighting') return finish('gone', why);
    if (state === 'walking') return detach();      // a link we adopted and never used
    notice(`${why}.`);
    detach();
    state = 'walking';
    emit();
  }

  // ------------------------------------------------------------------ 1. ASK

  /** Ask someone for a duel. `target` is any link: a peer's, or the NPC's. */
  function challenge(target) {
    if (state !== 'walking' || !target) return false;
    attach(target);
    link.send('ask', {});
    state = 'waiting';
    waitOn(`${who()} never answered`);
    emit();
    return true;
  }

  /**
   * Somebody has started talking to us. The transport calls this with a link the
   * moment a duel message arrives from someone we were not already talking to.
   * Busy means the ask that is about to arrive gets a polite no — and we do not
   * adopt their link, because we already have one.
   */
  function receive(offered) {
    if (!offered || (link && offered.id === link.id)) return;
    if (state !== 'walking') {
      // Say no, then LET THE LINK GO. Leaving this little refuse-everything
      // handler attached is how the same person becomes permanently unable to
      // challenge us: the transport only announces a conversation it has never
      // seen before, so their next ask would be answered by this handler again
      // — for the rest of the session, long after the duel it was busy with had
      // ended. Closing it means their next ask arrives as a new conversation.
      offered.onMessage((kind) => {
        if (kind !== 'ask') return;
        offered.send('reply', { yes: false });
        offered.close();
      });
      return;
    }
    attach(offered);
    waitOn('');   // adopted but silent: let go again rather than hold it forever
  }

  function accept() {
    if (state !== 'asked') return false;
    link.send('reply', { yes: true });
    start();
    return true;
  }

  function decline() {
    if (state !== 'asked') return false;
    link.send('reply', { yes: false });
    notice('You said no.');
    detach();
    state = 'walking';
    emit();
    return true;
  }

  // ---------------------------------------------------------------- 2. AGREE
  // Every awkward case is answered here, and every answer is one line.

  function handle(kind, payload) {
    if (kind === 'ask') {
      if (state === 'waiting') return start();              // we asked each other at once
      if (state === 'asked') return;                        // they asked twice
      if (state !== 'walking') return link.send('reply', { yes: false });
      state = 'asked';
      if (timer) { clearTimeout(timer); timer = null; }
      sound('ping');
      emit();
      return;
    }
    if (kind === 'reply') {
      if (state !== 'waiting') return;
      if (payload && payload.yes === true) return start();
      notice(`${who()} said no.`);
      detach();
      state = 'walking';
      emit();
      return;
    }
    if (kind === 'quit') {
      if (state === 'fighting') return finish('quit', `${who()} left the duel`);
      if (state === 'waiting' || state === 'asked') { detach(); state = 'walking'; emit(); }
      return;
    }
    if (state !== 'fighting' || phase === 'over') return;
    if (kind === 'move') return theirMove(payload);
  }

  // ----------------------------------------------------------- 3. THE ROUNDS

  function start() {
    score = { you: 0, them: 0 };
    round = 0;
    last = null;
    outcome = null;
    state = 'fighting';
    nextRound();
  }

  function nextRound() {
    round += 1;
    phase = 'choosing';
    mine = null;
    theirs = null;
    clearTimers();
    emit();
  }

  /** Pick a move: it is sent, and then we wait for theirs. */
  function play(move) {
    if (state !== 'fighting' || phase !== 'choosing' || !isMove(move)) return false;
    mine = move;
    phase = 'waiting';
    link.send('move', { round, move });
    waitOn(`${who()} stopped answering`);
    emit();
    if (theirs) resolve();
    return true;
  }

  /**
   * Their move, off the wire. Everything about it is checked before it is
   * believed: the right round, one of the three moves, and only once.
   *
   * It is held, not shown. `view()` keeps a move that arrived before ours was
   * chosen out of sight until the round resolves — seeing it early would make
   * the choice meaningless for the honest player as well.
   */
  function theirMove(payload) {
    if (!payload || payload.round !== round || theirs) return;
    if (!isMove(payload.move)) return;
    theirs = payload.move;
    emit();                      // "they have chosen" — never *what* they chose
    if (mine) resolve();
  }

  /** Both moves are in. Ask the pure rules who took the round. */
  function resolve() {
    if (timer) { clearTimeout(timer); timer = null; }

    const result = roundResult(mine, theirs);
    if (result.winner !== 'nobody') score[result.winner] += 1;
    last = { round, mine, theirs, winner: result.winner, why: result.why };
    phase = 'resolved';
    sound(result.winner === 'you' ? 'win' : result.winner === 'them' ? 'lose' : 'draw');
    emit();

    // The result stays on screen on its own for a moment before the next round
    // opens. A round that vanished the instant it was decided was the single
    // biggest reason the duel was hard to follow.
    const done = matchWinner(score, needed);
    gap = setTimeout(() => {
      gap = null;
      if (state !== 'fighting' || phase !== 'resolved') return;
      if (done) finish(done, null);
      else nextRound();
    }, gapMs);
  }

  /**
   * The duel is over, however it ended. The screen stays up saying what
   * happened; `close()` is what puts us back in the world.
   */
  function finish(how, text) {
    if (state !== 'fighting' || phase === 'over') return;
    clearTimers();
    outcome = {
      how,
      score: { ...score },
      text: text || (how === 'you' ? 'You win the duel!' : 'You lost the duel.'),
    };
    // A duel that ends on its own — three round wins — ends on both machines at
    // the same moment, because both computed it from the same two moves. The
    // other endings are one-sided, so the other player is told: otherwise they
    // sit looking at three buttons waiting for somebody who has gone.
    if (how === 'gone' && link) link.send('quit', { why: how });
    phase = 'over';
    sound(how === 'you' ? 'match' : how === 'them' ? 'lose' : 'ping');
    if (link) link.close();
    link = null;
    clearTimers();
    emit();
  }

  /** Walk away: from a challenge, from waiting, or from the finished screen. */
  function close() {
    if (state === 'fighting' && phase !== 'over' && link) link.send('quit', {});
    detach();
    state = 'walking';
    phase = 'idle';
    score = { you: 0, them: 0 };
    mine = null;
    theirs = null;
    outcome = null;
    last = null;
    emit();
  }

  function view() {
    const shown = phase === 'resolved' || phase === 'over';
    return {
      state,
      phase,
      round,
      needed,
      score: { ...score },
      them: link ? { id: link.id, name: link.name } : null,
      myMove: mine,
      /** That they have chosen is public; what they chose waits for the reveal. */
      theyChose: theirs !== null,
      theirMove: shown ? theirs : null,
      last,
      outcome,
    };
  }

  return {
    MOVES,
    challenge,
    receive,
    accept,
    decline,
    play,
    close,
    view,
    onChange: (fn) => changed.push(fn),
    onNotice: (fn) => notices.push(fn),
    onSound: (fn) => sounds.push(fn),
    get state() { return state; },
    get busy() { return state !== 'walking'; },
    /** For checking from the console: the whole machine, in one object. */
    get debug() {
      return {
        state, phase, round, outcome,
        score: { ...score },
        mine,
        theirs,
        them: link ? link.id : null,
      };
    },
  };
}

function int(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
