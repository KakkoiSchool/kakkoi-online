import {
  BISHOP,
  BLACK,
  KING,
  KNIGHT,
  ROOK,
  WHITE,
  applyLegalAction,
  getResult,
  isInCheck,
  legalActionsUnchecked,
  positionKey,
} from './rules.js';

const VALUES = { [KING]: 0, [ROOK]: 500, [BISHOP]: 320, [KNIGHT]: 300 };
const MATE = 1_000_000;

/** Deterministic alpha-beta search. A Web Worker can call this without UI coupling. */
export function chooseAction(position, { depth = 4 } = {}) {
  const actions = orderActions(position, legalActionsUnchecked(position));
  if (!actions.length) return null;
  const player = position.turn;
  const cache = { has: () => false, get: () => undefined, set: () => {} };
  let bestAction = actions[0];
  let bestScore = -Infinity;

  for (const action of actions) {
    const score = search(applyLegalAction(position, action), depth - 1, -Infinity, Infinity, player, cache);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction;
}

function search(position, depth, alpha, beta, maximizingPlayer, cache) {
  const result = getResult(position);
  if (result) {
    if (result.type === 'draw') return 0;
    return result.winner === maximizingPlayer ? MATE + depth : -MATE - depth;
  }
  if (depth <= 0) return evaluate(position, maximizingPlayer);

  const key = `${positionKey(position)}|${depth}|${maximizingPlayer}`;
  if (cache.has(key)) return cache.get(key);

  const maximizing = position.turn === maximizingPlayer;
  let value = maximizing ? -Infinity : Infinity;
  for (const action of orderActions(position, legalActionsUnchecked(position))) {
    const child = search(applyLegalAction(position, action), depth - 1, alpha, beta, maximizingPlayer, cache);
    if (maximizing) {
      value = Math.max(value, child);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, child);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  cache.set(key, value);
  return value;
}

function evaluate(position, player) {
  const enemy = player === WHITE ? BLACK : WHITE;
  let score = 0;
  for (const occupant of position.board) {
    if (!occupant) continue;
    const deployed = VALUES[occupant.piece] + (occupant.piece === KING ? 0 : 20);
    score += occupant.owner === player ? deployed : -deployed;
  }
  score += (legalActionsUnchecked({ ...position, turn: player }).length -
            legalActionsUnchecked({ ...position, turn: enemy }).length) * 2;
  if (isInCheck(position, enemy)) score += 30;
  if (isInCheck(position, player)) score -= 30;
  return score;
}

function orderActions(position, actions) {
  return [...actions].sort((a, b) => actionPriority(position, b) - actionPriority(position, a));
}

function actionPriority(position, action) {
  if (action.type === 'move' && position.board[action.to]) return 100 + VALUES[position.board[action.to].piece];
  if (action.type === 'move') return 20;
  if (action.type === 'drop') return 10 + VALUES[action.piece] / 100;
  return 0;
}
