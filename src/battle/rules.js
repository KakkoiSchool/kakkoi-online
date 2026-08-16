/**
 * Battle rules — PURE. No network, no DOM, no randomness of its own.
 *
 * This file is the one part of the game that can be fully unit tested, and both
 * players in a duel must compute byte-identical results from it. That is why it
 * imports nothing (lessons A22, A24; design doc §6).
 *
 * A duel is rock, paper, scissors and nothing else. No hit points, no charges,
 * no damage numbers: you pick one of three, the other player picks one of three,
 * and the triangle says who took the round. First to `winsNeeded` round wins
 * takes the duel; a draw simply replays the round. That is exactly the game
 * lessons A20–A22 teach, and the live game has to be the game the course builds.
 *
 * `actionWinner` below is the strike/block/charge triangle from an earlier
 * design that no lesson teaches. It is not used by the duel. It stays because
 * the tests are written against it and the shape may yet come back.
 */

/** The three moves, in the order the buttons show them. */
export const MOVES = ['rock', 'paper', 'scissors'];

/** rock beats scissors, scissors beats paper, paper beats rock. */
const BEATS = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

/** Is this string one of the three moves? Everything off the wire comes here first. */
export function isMove(move) {
  return typeof move === 'string' && MOVES.includes(move);
}

/** What `move` beats. */
export function beats(move) {
  return BEATS[move];
}

/**
 * One round, in words.
 *
 * Pure in the strictest sense: the same two moves always give the same answer
 * on both players' machines, which is the whole reason this file imports
 * nothing. `winner` is from the point of view of whoever passed `mine`.
 */
export function roundResult(mine, theirs) {
  if (!isMove(mine) || !isMove(theirs)) return null;
  if (mine === theirs) return { winner: 'nobody', why: `${mine} does not beat ${theirs}` };
  if (BEATS[mine] === theirs) return { winner: 'you', why: `${mine} beats ${theirs}` };
  return { winner: 'them', why: `${theirs} beats ${mine}` };
}

/**
 * Has anyone taken the duel yet? A score is `{ you, them }` counting round
 * wins; draws are in neither total, because a draw replays the round.
 */
export function matchWinner(score, needed) {
  if (score.you >= needed) return 'you';
  if (score.them >= needed) return 'them';
  return null;
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
