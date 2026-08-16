/**
 * The fight (lessons A19, A20, A22).
 *
 * Three ideas, stacked:
 *
 *   1. A STATE MACHINE. The game is in exactly one state at a time — `walking`,
 *      `waiting`, `asked`, `fighting` — and every awkward case is one line in
 *      here rather than a special case scattered through the rest of the game.
 *      Refused, both-challenged-at-once, they-left-mid-duel and they-went-quiet
 *      all end the same way: back to `walking`, never stuck.
 *
 *   2. THREE MOVES. fire, water, earth. Who won a round is decided by
 *      `battle/rules.js`, which is pure, so both browsers compute the same
 *      answer from the same two moves. First to `winsNeeded` rounds takes the
 *      duel; a draw replays the round. No hit points, no charges. The monster
 *      you picked is a costume in a duel — it changes nothing.
 *
 *   3. NO PEEKING. Neither side can wait to see the other's move. Each sends a
 *      fingerprint of its move first, and only sends the move itself once the
 *      other fingerprint has arrived. When a move turns up it is fingerprinted
 *      again and checked against what that player folded before either of us
 *      knew anything: if the two do not match, the move was swapped after the
 *      fact, and the duel ends as caught cheating instead of quietly counting.
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

/** A hex fingerprint of some text: same text in, same 64 characters out. */
export async function fingerprint(text) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('no crypto.subtle here — open the game over http://localhost or https, not file://');
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * What actually gets fingerprinted. The round number is in there so a
 * fingerprint from round 1 cannot be replayed in round 2, and the secret is in
 * there because there are only three moves — without it anyone could fingerprint
 * fire, water and earth themselves and see which one matched.
 */
export function foldedText(round, move, secret) {
  return `${round}:${move}:${secret}`;
}

export async function fold(round, move) {
  const secret = randomSecret();
  return { move, secret, hash: await fingerprint(foldedText(round, move, secret)) };
}

const HASH = /^[0-9a-f]{64}$/;
const SECRET = /^[0-9a-f]{1,64}$/;

export function createDuel({ tuning = {} } = {}) {
  const needed = int(tuning.winsNeeded, 3);
  const timeoutMs = int(tuning.commitTimeoutMs, 10000);
  const gapMs = int(tuning.roundGapMs, 2200);

  let state = 'walking';          // walking | waiting | asked | fighting
  let link = null;                // who this conversation is with
  let score = { you: 0, them: 0 };
  let round = 0;
  let phase = 'idle';             // choosing | folding | folded | shown | resolved | over
  let mine = null;                // { move, secret, hash }
  let theirCommit = null;         // their fingerprint, arriving before their move exists
  let theirShown = null;          // { move, secret } once they unfold
  let shown = false;              // have WE unfolded yet?
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
   * something, cleared the moment it turns up. `commitTimeoutMs` is the same ten
   * seconds whether we are waiting for an answer, a fingerprint or a move.
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
      offered.onMessage((kind) => { if (kind === 'ask') offered.send('reply', { yes: false }); });
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
    if (kind === 'commit') return theirFold(payload);
    if (kind === 'reveal') return theirUnfold(payload);
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
    theirCommit = null;
    theirShown = null;
    shown = false;
    clearTimers();
    emit();
  }

  /** Pick a move: fold it, then say only the fingerprint out loud. */
  async function play(move) {
    if (state !== 'fighting' || phase !== 'choosing' || !isMove(move)) return false;
    const at = round;
    phase = 'folding';
    emit();

    let folded;
    try {
      folded = await fold(round, move);
    } catch (err) {
      phase = 'choosing';
      notice(err.message);
      emit();
      return false;
    }
    if (state !== 'fighting' || round !== at || phase !== 'folding') return false;

    mine = folded;
    phase = 'folded';
    link.send('commit', { round, hash: mine.hash });
    waitOn(`${who()} stopped answering`);
    emit();
    maybeShow();
    return true;
  }

  function theirFold(payload) {
    if (!payload || payload.round !== round || theirCommit) return;
    if (typeof payload.hash !== 'string' || !HASH.test(payload.hash)) return;
    theirCommit = payload.hash;
    emit();
    maybeShow();
  }

  /** Nobody unfolds until both folded papers are on the table. */
  function maybeShow() {
    if (shown || !mine || !theirCommit) return;
    shown = true;
    phase = 'shown';
    link.send('reveal', { round, move: mine.move, secret: mine.secret });
    waitOn(`${who()} stopped answering`);
    emit();
    if (theirShown) resolve();
  }

  function theirUnfold(payload) {
    if (!payload || payload.round !== round || theirShown) return;
    if (!isMove(payload.move)) return;
    if (typeof payload.secret !== 'string' || !SECRET.test(payload.secret)) return;
    theirShown = { move: payload.move, secret: payload.secret };
    if (shown) resolve();
  }

  /**
   * Both moves are on the table. Check theirs against the fingerprint they
   * folded, then ask the pure rules who won.
   */
  async function resolve() {
    if (timer) { clearTimeout(timer); timer = null; }
    const at = round;

    const again = await fingerprint(foldedText(round, theirShown.move, theirShown.secret));
    if (state !== 'fighting' || round !== at || phase === 'over') return;

    if (again !== theirCommit) {
      last = {
        round,
        mine: mine.move,
        theirs: theirShown.move,
        winner: 'nobody',
        why: `${who()} showed ${theirShown.move}, but that is not the move that was folded`,
      };
      return finish('cheat', `${who()} was caught cheating`);
    }

    const result = roundResult(mine.move, theirShown.move);
    if (result.winner !== 'nobody') score[result.winner] += 1;
    last = { round, mine: mine.move, theirs: theirShown.move, winner: result.winner, why: result.why };
    phase = 'resolved';
    sound(result.winner === 'you' ? 'win' : result.winner === 'them' ? 'lose' : 'draw');
    emit();

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
    // other two endings are one-sided, so the other player is told: otherwise
    // they sit looking at three buttons waiting for somebody who has gone.
    if ((how === 'cheat' || how === 'gone') && link) link.send('quit', { why: how });
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
    theirCommit = null;
    theirShown = null;
    shown = false;
    outcome = null;
    last = null;
    emit();
  }

  function view() {
    return {
      state,
      phase,
      round,
      needed,
      score: { ...score },
      them: link ? { id: link.id, name: link.name } : null,
      /** Our own fingerprint is visible from the first moment. Our move is not. */
      myCommit: mine ? mine.hash : null,
      myMove: phase === 'shown' || phase === 'resolved' || phase === 'over' ? mine?.move ?? null : null,
      theirCommit,
      theirMove: theirShown ? theirShown.move : null,
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
        state, phase, round, shown, outcome,
        score: { ...score },
        mine: mine ? { ...mine } : null,
        theirCommit,
        theirShown: theirShown ? { ...theirShown } : null,
        them: link ? link.id : null,
      };
    },
  };
}

function int(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
