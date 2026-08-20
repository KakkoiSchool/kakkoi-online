/**
 * Aniki, Flint's big brother, on the hour.
 *
 * Everything about a boss that several people fight at once is easy except the
 * thing that matters: **without a referee, how do five browsers agree on what
 * happened?** There is no server here to be the referee, so the answer is three
 * separate answers, and they are the whole design.
 *
 * **1. When he is here, nobody has to say.** It is arithmetic on the clock every
 * browser already has: he stands in the plaza for the first `bossMinutes` of
 * every hour. No announcement, nobody has to be first, and somebody who arrives
 * late sees exactly what everybody else sees. A device with a badly-set clock
 * sees him at the wrong time, which is the honest cost of a fact you did not
 * have to send.
 *
 * **2. What he plays is a seeded dice, not a memory.** His move for round *r* is
 * a hash of (this hour, that round) — the same tiny sum in every browser, so
 * every browser gets the same move without a single packet. This is a real
 * departure from Flint, who leans against *your* favourite move, and it is
 * deliberate: in a fight with five people there is no "your", and an adaptive
 * boss would have to be told everybody's moves before choosing his own, so one
 * dropped packet would make two browsers compute *different Aniki moves*. Then
 * they would disagree about who got hit, which is the one thing that must not
 * wobble. Unpredictable-but-identical beats adaptive-but-inconsistent.
 *
 * **3. Damage splits in two, and only half of it is certain.** Your own lives
 * you work out from your move against his, both of which you hold with
 * certainty: no packet can make you wrong about your own health and nobody else
 * can take a life off you. His lives are an *estimate* — one hit for every
 * player whose move you SAW beat him — so somebody whose packet you missed
 * simply did not hit him as far as you know, and two people can see him on 3 and
 * 4 and finish the fight a round apart. That is the honest cost, it is written
 * down rather than hidden, and the achievement goes to anybody who was still
 * standing when their own browser saw him fall.
 *
 * **Rounds run on a timetable, not a handshake.** A duel waits for both players;
 * a raid cannot wait for five and must not break when one of them locks their
 * phone. So a round starts and ends by the clock, whatever anyone did. Miss one
 * — asleep, offline, thinking too long — and you neither deal damage nor take
 * it, which is kinder than punishing a dropped packet and makes joining halfway
 * through free: there is no state to catch up on.
 *
 * **His wounds last the hour; yours last the fight.** Ten lives against three is
 * a fight you are supposed to gather friends for, and this game usually has one
 * person in it. So when your three are gone you are out — but you can walk back
 * up to him and start again with three more, and *his* damage stays where it is
 * until the hour is over. A crowd fells him in a couple of minutes. One person
 * can still do it, slowly, which is the difference between a hard achievement
 * and an impossible one.
 */
import { MOVES, isMove, beats } from './battle/rules.js';
import { loadBoss, writeBoss } from './save.js';

/** `beats(a)` is the move a beats, so this is the comparison the fight needs. */
const wins = (a, b) => beats(a) === b;

export const HOUR_MS = 3600000;

/** What he plays in round `round` of hour `hour`. The same everywhere, always. */
export function moveFor(hour, round) {
  return MOVES[dice(hour, round) % MOVES.length];
}

/**
 * A hash of two whole numbers, mixed until the low bits are worth using.
 *
 * `Math.imul` is what makes this identical in every browser: plain `*` on
 * numbers this size becomes a float and stops being the same sum everywhere,
 * and "the same sum everywhere" is the entire point of it.
 */
export function dice(a, b) {
  let x = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663);
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return (x ^ (x >>> 16)) >>> 0;
}

export function createBoss({ tuning = {}, net = null, now = Date.now } = {}) {
  const minutes = num(tuning.bossMinutes, 10);
  const lives = int(tuning.bossLives, 10);
  const mine = int(tuning.playerLives, 3);
  const roundMs = int(tuning.bossRoundMs, 8000);
  const chooseMs = Math.min(int(tuning.bossChooseMs, 5000), roundMs - 500);

  const saved = loadBoss();

  /** Hits landed on him this hour, by anybody we have heard from. */
  let hits = 0;
  /** The hour those hits belong to; a new hour is a new Aniki. */
  let hour = Math.floor(now() / HOUR_MS);
  /** Did he fall this hour, and were we there when he did? */
  let felled = false;
  let ours = false;

  if (saved.hour === hour) { hits = saved.hits; felled = saved.felled; ours = saved.ours; }

  let joined = false;
  let lives_ = mine;
  /** The round we last resolved, so each one is scored exactly once. */
  let scored = -1;
  /** What we picked, for which round. */
  let picked = { round: -1, move: null };
  /** peer id -> what they picked, for which round. */
  const others = new Map();
  /** What the last resolved round did, for the screen to show. */
  let last = null;
  /**
   * The round and the phase the screen was last told about.
   *
   * This fight is driven by a clock rather than by messages, so "something
   * changed" is not always something somebody did: a round opening is a change,
   * and if nobody says so the three move buttons stay disabled through the whole
   * of the next round. That was a real bug and this is the fix — the screen
   * hears from us twice a round, and the bar between those two moments is drawn
   * per frame by `ui/boss-screen.js` without going through here.
   */
  let told = { round: -1, phase: '' };

  const changed = [];
  const sounds = [];
  const emit = () => { const v = view(); for (const fn of changed) fn(v); };
  const sound = (name) => { for (const fn of sounds) fn(name); };

  if (net) {
    net.expect('raid');
    net.onMessage((kind, payload, id) => {
      if (kind !== 'raid') return;
      const peer = net.peer(id);
      if (!peer) { net.dropped.gone++; return; }
      // Doubt, the same as everywhere else: a round number that is not this
      // round, or a move that is not one of the three, is somebody else's
      // problem and is counted rather than believed.
      if (!payload || typeof payload !== 'object' ||
          !Number.isInteger(payload.r) || !isMove(payload.m)) { net.dropped.message++; return; }
      if (payload.r !== roundNow()) { net.dropped.message++; return; }
      others.set(id, { round: payload.r, move: payload.m, name: peer.name });
    });
  }

  // ------------------------------------------------------------- the clock

  const hourOf = (t) => Math.floor(t / HOUR_MS);
  const intoHour = (t) => t - hourOf(t) * HOUR_MS;

  /** Is he standing in the plaza at this moment? */
  function present(t = now()) {
    return intoHour(t) < minutes * 60000;
  }

  function roundNow(t = now()) {
    return Math.floor(intoHour(t) / roundMs);
  }

  /** How far into the current round we are, and therefore what may be done. */
  function phase(t = now()) {
    const into = intoHour(t) % roundMs;
    return into < chooseMs ? 'choosing' : 'showing';
  }

  /** Milliseconds until he arrives, or until he leaves if he is already here. */
  function clock(t = now()) {
    const into = intoHour(t);
    return present(t) ? minutes * 60000 - into : HOUR_MS - into;
  }

  // -------------------------------------------------------------- the fight

  function join() {
    if (!present() || felled || joined) return false;
    joined = true;
    lives_ = mine;
    scored = roundNow();          // whatever round is running, we start at the next
    picked = { round: -1, move: null };
    last = null;
    emit();
    return true;
  }

  function leave() {
    if (!joined) return false;
    joined = false;
    picked = { round: -1, move: null };
    emit();
    return true;
  }

  /** Choose, for the round that is running. Once per round, while it is open. */
  function play(move) {
    if (!joined || !isMove(move)) return false;
    if (phase() !== 'choosing') return false;
    const round = roundNow();
    if (picked.round === round) return false;
    picked = { round, move };
    if (net) net.send('raid', { r: round, m: move });
    emit();
    return true;
  }

  /**
   * Called every frame. Everything that happens to anybody happens here, at the
   * moment a round ends — which is a moment the clock decides and not a message.
   */
  function update() {
    const t = now();
    const nowHour = hourOf(t);
    if (nowHour !== hour) {                     // a new hour is a new Aniki
      hour = nowHour;
      hits = 0;
      felled = false;
      ours = false;
      joined = false;
      others.clear();
      remember();
      emit();
      return;
    }

    if (!present(t)) {
      if (joined) { joined = false; emit(); }
      return;
    }

    const round = roundNow(t);
    const now_ = phase(t);

    if (round === scored || now_ !== 'showing') {
      // Nothing to score, but the clock has still moved the fight along: a new
      // round has opened, or this one has closed for choosing.
      if (round !== told.round || now_ !== told.phase) {
        told = { round, phase: now_ };
        emit();
      }
      return;
    }

    // The round that has just closed. Everybody resolves the same one, from the
    // same move of his, at the same moment on their own clock.
    scored = round;
    told = { round, phase: now_ };
    resolve(round);
  }

  function resolve(round) {
    const his = moveFor(hour, round);

    // Ours, which nothing can make us wrong about.
    const ourMove = picked.round === round ? picked.move : null;
    let hurt = false;
    if (joined && ourMove && wins(his, ourMove)) {
      lives_ -= 1;
      hurt = true;
    }

    // His, which is only ever what we saw. Everybody who played a move that
    // beats his takes one off him — including us.
    const landed = [];
    if (ourMove && wins(ourMove, his)) landed.push({ id: 'you', name: 'You', move: ourMove });
    for (const [id, said] of others) {
      if (said.round !== round) continue;
      if (wins(said.move, his)) landed.push({ id, name: said.name, move: said.move });
    }
    if (!felled) hits += landed.length;

    last = { round, his, ours: ourMove, hurt, landed, left: Math.max(0, lives - hits) };
    others.clear();

    if (hits >= lives && !felled) {
      felled = true;
      // Standing when he fell — that is the whole of what the achievement means,
      // and it is decided here, by this browser, about this player.
      ours = joined && lives_ > 0;
      joined = false;
      sound('match');
    } else if (lives_ <= 0 && joined) {
      joined = false;                            // out, until you walk back up
      sound('lose');
    } else if (landed.length) {
      sound('win');
    } else if (hurt) {
      sound('lose');
    }

    remember();
    emit();
  }

  function remember() {
    writeBoss({ hour, hits, felled, ours });
  }

  function view(t = now()) {
    return {
      present: present(t),
      felled,
      /** Did WE beat him this hour? The achievement asks this and nothing else. */
      ours,
      joined,
      hour,
      round: roundNow(t),
      phase: phase(t),
      /** Milliseconds until he arrives, or until he goes. */
      clock: clock(t),
      /** How far through the choosing window, 0 to 1, for a bar to fill. */
      progress: Math.min(1, (intoHour(t) % roundMs) / chooseMs),
      his: Math.max(0, lives - hits),
      hisMost: lives,
      yours: Math.max(0, lives_),
      yoursMost: mine,
      picked: picked.round === roundNow(t) ? picked.move : null,
      last,
      /** Everybody else we have heard from this round. */
      others: [...others.values()].filter((o) => o.round === roundNow(t)),
    };
  }

  return {
    join,
    leave,
    play,
    update,
    view,
    moveFor: (round) => moveFor(hour, round),
    onChange: (fn) => changed.push(fn),
    onSound: (fn) => sounds.push(fn),
    get busy() { return joined; },
    get present() { return present(); },
    get felled() { return felled; },
    get ours() { return ours; },
  };
}

function int(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
