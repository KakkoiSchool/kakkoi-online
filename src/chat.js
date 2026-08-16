/**
 * Stage 2 — preset chat. Not built yet.
 *
 * Preset phrases only, and there is no text input anywhere in this game. What
 * goes over the wire is the INDEX of a phrase, never the text: an index that
 * is not a whole number inside the list is dropped on arrival, so there is no
 * way to make another player's screen say something you wrote.
 */
export const PHRASES = [];
export const NOT_BUILT_YET = 'stage 2';
