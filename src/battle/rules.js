/**
 * Battle rules — PURE. No network, no DOM, no randomness of its own.
 *
 * This file is the one part of the game that can be fully unit tested, and both
 * players in a duel must compute byte-identical results from it. That is why it
 * imports nothing (lessons A22, A24; design doc §6).
 *
 * Elements are the strings 'fire', 'water', 'earth'.
 * Actions are the strings 'strike', 'block', 'charge'.
 *
 * Scaffold: the action triangle is here so tests can be written first. Damage
 * resolution lands in M3.
 */

/** water beats fire, fire beats earth, earth beats water. */
const BEATS = {
  water: 'fire',
  fire: 'earth',
  earth: 'water',
};

export function elementMultiplier(attacker, defender, advantage = 2, resist = 0.5) {
  if (BEATS[attacker] === defender) return advantage;
  if (BEATS[defender] === attacker) return resist;
  return 1;
}

/**
 * Who wins the action triangle: strike > charge > block > strike.
 * Returns 1 if a wins, -1 if b wins, 0 when both players chose the same action.
 */
export function actionWinner(a, b) {
  if (a === b) return 0;
  const beats = {
    strike: 'charge',
    charge: 'block',
    block: 'strike',
  };
  return beats[a] === b ? 1 : -1;
}
