/**
 * Battle rules — PURE. No network, no DOM, no randomness of its own.
 *
 * This file is the one part of the game that can be fully unit tested, and both
 * players in a duel must compute byte-identical results from it. That is why it
 * imports nothing (lessons A22, A24; design doc §6).
 *
 * Scaffold: types and the action triangle are here so tests can be written
 * first. Damage resolution lands in M3.
 */

export type Element = 'fire' | 'water' | 'earth';
export type Action = 'strike' | 'block' | 'charge';

/** water beats fire, fire beats earth, earth beats water. */
const BEATS: Record<Element, Element> = {
  water: 'fire',
  fire: 'earth',
  earth: 'water',
};

export function elementMultiplier(
  attacker: Element,
  defender: Element,
  advantage = 2,
  resist = 0.5,
): number {
  if (BEATS[attacker] === defender) return advantage;
  if (BEATS[defender] === attacker) return resist;
  return 1;
}

/**
 * Who wins the action triangle: strike > charge > block > strike.
 * Returns 0 when both players chose the same action.
 */
export function actionWinner(a: Action, b: Action): -1 | 0 | 1 {
  if (a === b) return 0;
  const beats: Record<Action, Action> = {
    strike: 'charge',
    charge: 'block',
    block: 'strike',
  };
  return beats[a] === b ? 1 : -1;
}
