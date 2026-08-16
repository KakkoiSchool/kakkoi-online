/**
 * Stage 2 — other people. Not built yet.
 *
 * This is the ONLY module allowed to know that trystero exists. Everything
 * else talks to the shape below, so the rest of the game never learns what a
 * relay is. Reuse the four-relay list from `demos/12-other-people/main.js`
 * verbatim when this is filled in, and send positions at `posHz` from
 * `data/tuning.json` — not every frame.
 *
 * Planned shape:
 *   joinRoom({ roomId, identity }) -> {
 *     onPeerJoin(fn), onPeerLeave(fn),
 *     onPosition(fn), sendPosition(box),
 *     onMessage(fn), send(kind, payload),
 *     peers(), leave()
 *   }
 *
 * Everything that arrives from the wire is a stranger's data: validate it and
 * drop what does not fit, never trust it into the game state directly.
 */
export const NOT_BUILT_YET = 'stage 2';
