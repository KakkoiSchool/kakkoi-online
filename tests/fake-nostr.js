/**
 * A stand-in for trystero, for tests only. Never loaded by the game.
 *
 * `src/net.js` imports `../vendor/trystero/nostr.js` and nothing else knows that
 * file exists — which is the point of the module, and also what makes it awkward
 * to test: there is no network in here to drive. So the test page uses an import
 * map to point that one specifier at this file instead, and net.js runs
 * unmodified against a room we can shout into.
 *
 * The room this exposes is deliberately dumb. It records what was sent, and it
 * lets the test say "somebody joined", "somebody left", and "this arrived from
 * them" — in any order, including the order that used to be a bug.
 */

export const selfId = 'me-000000';

let latest = null;

export function joinRoom(config, roomId) {
  const joins = [];
  const leaves = [];
  const actions = new Map();
  const sent = [];

  const room = {
    left: false,
    makeAction(name) {
      // Trystero refuses a second action of the same name, and net.js relies on
      // making each one exactly once, so this refuses too.
      if (actions.has(name)) throw new Error(`fake-nostr: action "${name}" made twice`);
      const listeners = [];
      actions.set(name, listeners);
      return [
        (payload, to) => sent.push({ name, payload, to: to ?? null }),
        (fn) => listeners.push(fn),
      ];
    },
    onPeerJoin: (fn) => joins.push(fn),
    onPeerLeave: (fn) => leaves.push(fn),
    leave() { room.left = true; },
  };

  latest = {
    config,
    roomId,
    room,
    sent,
    /** trystero has opened a channel to somebody. */
    join: (id) => { for (const fn of [...joins]) fn(id); },
    /** …and lost it. */
    part: (id) => { for (const fn of [...leaves]) fn(id); },
    /** A message arriving from `from` on the action called `name`. */
    deliver(name, payload, from) {
      for (const fn of [...(actions.get(name) || [])]) fn(payload, from);
    },
    /** What has this browser put on the wire, of one kind? */
    outgoing: (name) => sent.filter((p) => p.name === name),
  };

  return room;
}

/** The room made by the most recent joinRoom() call. */
export const harness = () => latest;
