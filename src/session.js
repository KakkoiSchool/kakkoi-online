/**
 * One window at a time, and it is the newest one.
 *
 * Open the game twice in the same browser and both tabs read the same save, so
 * both of them are honestly *you* — same name, same monster, same id. They then
 * join the room as two separate players and walk around next to each other,
 * which is confusing to look at and unfair to everybody else in the world.
 *
 * The fix is a rule, not a lock: **the newest window owns the game.** Every tab
 * makes a random session id when it boots and shouts a CLAIM down a
 * `BroadcastChannel`. Any tab already playing hears it and gets out of the way —
 * but politely, and in this exact order:
 *
 *   1. write its live state down (the save on disk is up to half a second old),
 *   2. HAND that state over to the claimer, so the new window carries on from
 *      where the old one actually was rather than from the stale copy on disk,
 *   3. stop the loop, leave the peer-to-peer room so it vanishes from the world,
 *      and put a calm card on the screen.
 *
 * The claimer waits a few hundred milliseconds for a handover, and if none
 * arrives it simply uses `localStorage` like it always did. Nothing here can
 * fail in a way that stops the game starting.
 *
 * **`BroadcastChannel` is same-origin, on purpose.** That is exactly the shape
 * of this problem — two tabs of the same site, sharing one `localStorage`. It is
 * not, and must not be used as, a way to talk to a different origin: two
 * browsers, or `localhost` and `127.0.0.1`, are genuinely two players and are
 * meant to be.
 */

export const CHANNEL = 'kakkoi-online-session';

/** How long a claiming tab waits for the old one to answer. */
export const HANDOVER_WAIT_MS = 400;

function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 's-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Everything that arrives on the channel was written by another copy of this
 * page — but a browser extension, a stale build, or a bug can put anything on a
 * channel, and a bad handover would move the player somewhere silly. So it gets
 * the same treatment `net.js` gives a stranger: checked field by field, and
 * dropped whole if any of it does not fit.
 */
function cleanState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const x = Number(state.x);
  const y = Number(state.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Number.isInteger(state.monster)) return null;
  return {
    id: typeof state.id === 'string' ? state.id : '',
    name: String(state.name ?? '').slice(0, 12),
    monster: state.monster,
    x,
    y,
    safety: state.safety === true,
  };
}

/**
 * createSession() -> {
 *   id, active, dropped,
 *   claim(): Promise<state|null>,     // shout, wait, maybe be handed the world
 *   attach({ snapshot, deactivate }), // how to save, and how to stop
 *   close()
 * }
 */
export function createSession({ waitMs = HANDOVER_WAIT_MS, channelName = CHANNEL } = {}) {
  const id = randomId();

  let channel = null;
  try {
    channel = new BroadcastChannel(channelName);
  } catch (err) {
    // Very old browsers, and a couple of privacy modes. Without a channel there
    // is no takeover, which is precisely how the game behaved before — one
    // missing feature, not a broken game.
    console.warn('session: no BroadcastChannel here, two tabs will both play —', err.message);
  }

  /** Do we own the game right now? */
  let active = true;
  /** How the game saves itself and how it stops. Set once the world exists. */
  let hooks = null;
  /** Set while a claim is in flight; called with the handover state, or null. */
  let pending = null;

  const dropped = { message: 0 };
  const listeners = [];

  function post(message) {
    if (channel) channel.postMessage(message);
  }

  /** Somebody newer wants the game. Save, hand over, stop. In that order. */
  function standDown(claimer) {
    if (!active) return;                     // already paused: nothing to give
    active = false;

    let state = null;
    try {
      state = hooks?.snapshot ? hooks.snapshot() : null;
    } catch (err) {
      console.warn('session: could not snapshot before handing over —', err.message);
    }
    post({ k: 'handover', from: id, to: claimer, state });

    // A claim of our own is now pointless: we just lost.
    if (pending) { const finish = pending; pending = null; finish(null); }

    // If the world does not exist yet (two tabs opened in the same instant),
    // `attach` will notice we are inactive and stop it the moment it does.
    try { hooks?.deactivate?.(); } catch (err) { console.warn('session: deactivate failed —', err.message); }
    for (const fn of listeners) fn(false);
  }

  if (channel) {
    channel.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || typeof message !== 'object' ||
          typeof message.k !== 'string' || typeof message.from !== 'string') {
        dropped.message++;
        return;
      }
      if (message.from === id) return;                       // our own shout

      if (message.k === 'claim') { standDown(message.from); return; }
      if (message.k === 'handover') {
        if (message.to !== id) return;                       // not ours to read
        if (pending) { const finish = pending; pending = null; finish(cleanState(message.state)); }
        return;
      }
      dropped.message++;
    });
  }

  /**
   * Say "I have the game now", and wait a moment in case an older window is
   * still holding it. Resolves with that window's live state, or null.
   */
  function claim() {
    active = true;
    if (!channel) return Promise.resolve(null);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (state) => {
        if (settled) return;
        settled = true;
        pending = null;
        clearTimeout(timer);
        resolve(state);
      };
      pending = finish;
      const timer = setTimeout(() => finish(null), waitMs);
      post({ k: 'claim', from: id });
    });
  }

  return {
    id,
    dropped,
    channelName,
    get active() { return active; },
    claim,

    /**
     * Hand the session the two things it needs from the game: how to take a
     * snapshot (which also writes the save), and how to stop.
     */
    attach({ snapshot, deactivate }) {
      hooks = { snapshot, deactivate };
      // We may have lost the game while it was still loading.
      if (!active) { try { deactivate(); } catch { /* nothing to do */ } }
    },

    /** Told whenever ownership changes. `true` means we have it. */
    onChange(fn) { listeners.push(fn); },

    close() { if (channel) channel.close(); channel = null; },
  };
}
