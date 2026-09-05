export const BOARD_SIZE = 4;
export const WHITE = 'white';
export const BLACK = 'black';
export const KING = 'king';
export const ROOK = 'rook';
export const BISHOP = 'bishop';
export const KNIGHT = 'knight';
export const BANK_PIECES = Object.freeze([ROOK, BISHOP, KNIGHT]);

const PLAYERS = new Set([WHITE, BLACK]);
const PIECES = new Set([KING, ...BANK_PIECES]);
const ORTHOGONAL = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAGONAL = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
// Built once: `[...ORTHOGONAL, ...DIAGONAL]` inline allocated a new array on
// every king attack lookup, and that runs once per candidate move per node.
const KING_STEPS = [...ORTHOGONAL, ...DIAGONAL];
const KNIGHT_STEPS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const PIECE_CODE = { [KING]: 'K', [ROOK]: 'R', [BISHOP]: 'B', [KNIGHT]: 'N' };

export function opponent(player) {
  return player === WHITE ? BLACK : WHITE;
}

export function createInitialPosition() {
  return {
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    banks: {
      [WHITE]: [...BANK_PIECES],
      [BLACK]: [...BANK_PIECES],
    },
    turn: WHITE,
    phase: 'place-white-king',
    repetitions: {},
  };
}

/** Create a checked position for tests, saved games, and network snapshots. */
export function createPosition({ board, banks, turn = WHITE, phase = 'play', repetitions = {} }) {
  const position = {
    board: board.map((occupant) => occupant ? occupantOf(occupant.owner, occupant.piece) : null),
    banks: {
      [WHITE]: [...banks[WHITE]],
      [BLACK]: [...banks[BLACK]],
    },
    turn,
    phase,
    repetitions: { ...repetitions },
  };
  validatePosition(position);
  return position;
}

/**
 * The exported entry point: validates, then generates. Everything outside the
 * engine comes through here, including a move arriving from a peer.
 */
export function legalActions(position) {
  validatePosition(position);
  return generateLegalActions(position);
}

/**
 * The same generation without the guard, for a caller that produced the
 * position itself — the bot's search, which visits tens of thousands of
 * positions this engine just built and re-validated every one of them.
 * Never call this on anything that came from outside the engine.
 */
export function legalActionsUnchecked(position) {
  return generateLegalActions(position);
}

function generateLegalActions(position) {
  if (position.phase === 'place-white-king') {
    return homeRank(WHITE)
      .filter((to) => !position.board[to])
      .map((to) => ({ type: 'place-king', to }));
  }
  if (position.phase === 'place-black-king') {
    return homeRank(BLACK)
      .filter((to) => !position.board[to])
      .map((to) => ({ type: 'place-king', to }));
  }

  const player = position.turn;
  const enemy = opponent(player);
  const candidates = [];

  for (let from = 0; from < position.board.length; from += 1) {
    const occupant = position.board[from];
    if (!occupant || occupant.owner !== player) continue;
    for (const to of pseudoMoves(position.board, from, occupant.piece, player)) {
      if (position.board[to]?.piece === KING) continue;
      candidates.push({ type: 'move', from, to });
    }
  }

  for (const piece of position.banks[player]) {
    for (let to = 0; to < position.board.length; to += 1) {
      if (!position.board[to]) candidates.push({ type: 'drop', piece, to });
    }
  }

  /*
   * Legality is a question about the board alone, so this builds only the
   * board the action would leave behind. It used to clone the whole position
   * — sixteen occupant spreads, both banks and the repetition map — once per
   * candidate, thirty-odd times per search node, to answer it.
   */
  return candidates.filter((action) => {
    const next = boardAfter(position, action);
    if (boardInCheck(next, player)) return false;
    // A drop can defend our king, but it may never give check itself.
    if (action.type === 'drop' && boardInCheck(next, enemy)) return false;
    return true;
  });
}

export function applyAction(position, action) {
  const legal = legalActions(position);
  const wanted = actionKey(action);
  if (!legal.some((candidate) => actionKey(candidate) === wanted)) {
    throw new Error(`Illegal action: ${wanted}`);
  }
  return applyUnchecked(position, action, true);
}

/**
 * Apply an action already known to be legal for this exact position — it must
 * have come from `legalActions(position)` and nothing may have changed since.
 *
 * `applyAction` re-derives the entire legal move list and string-matches the
 * action against it. That is exactly right for a move arriving from a peer,
 * where the list is the security boundary, and it is pure waste inside a
 * search that generated the move itself one line earlier: it doubled move
 * generation at every node and allocated an `actionKey` string per candidate.
 * Only the bot should use this.
 */
export function applyLegalAction(position, action) {
  return applyUnchecked(position, action, true);
}

export function isSquareAttacked(position, square, byPlayer) {
  assertSquare(square);
  return boardAttacks(position.board, square, byPlayer);
}

function boardAttacks(board, square, byPlayer) {
  for (let from = 0; from < board.length; from += 1) {
    const occupant = board[from];
    if (!occupant || occupant.owner !== byPlayer) continue;
    if (attacksSquare(board, from, occupant.piece, square)) return true;
  }
  return false;
}

/**
 * `attackSquares(...).includes(target)` with the array never built. Same
 * geometry, same ray rule — a ray reaches an occupied square and stops there
 * — but it answers on the first hit and allocates nothing. This is the single
 * hottest question in the engine: the legality filter asks it for every
 * enemy piece, for every candidate move, at every node of the search.
 */
function attacksSquare(board, from, piece, target) {
  const [row, column] = coordinates(from);
  if (piece === KNIGHT) return stepHits(row, column, KNIGHT_STEPS, target);
  if (piece === KING) return stepHits(row, column, KING_STEPS, target);
  if (piece === ROOK) return rayHits(board, row, column, ORTHOGONAL, target);
  if (piece === BISHOP) return rayHits(board, row, column, DIAGONAL, target);
  return false;
}

function stepHits(row, column, steps, target) {
  for (const [dr, dc] of steps) {
    if (squareAt(row + dr, column + dc) === target) return true;
  }
  return false;
}

function rayHits(board, row, column, directions, target) {
  for (const [dr, dc] of directions) {
    for (let distance = 1; distance < BOARD_SIZE; distance += 1) {
      const square = squareAt(row + dr * distance, column + dc * distance);
      if (square === null) break;
      if (square === target) return true;
      if (board[square]) break;
    }
  }
  return false;
}

/**
 * Every square holding a piece of byPlayer that attacks the given square.
 * isSquareAttacked stays separate because the bot's search calls it for its
 * early exit and does not need the full list.
 */
export function attackersOf(position, square, byPlayer) {
  assertSquare(square);
  const attackers = [];
  for (let from = 0; from < position.board.length; from += 1) {
    const occupant = position.board[from];
    if (!occupant || occupant.owner !== byPlayer) continue;
    if (attackSquares(position.board, from, occupant.piece).includes(square)) attackers.push(from);
  }
  return attackers;
}

export function kingSquare(position, player) {
  const square = position.board.findIndex(
    (occupant) => occupant?.owner === player && occupant.piece === KING,
  );
  return square === -1 ? null : square;
}

export function isInCheck(position, player) {
  return boardInCheck(position.board, player);
}

function boardInCheck(board, player) {
  // A plain loop, not findIndex: this is called twice per candidate move and
  // the callback allocation showed up as the largest single cost in a profile.
  for (let square = 0; square < board.length; square += 1) {
    const occupant = board[square];
    if (occupant && occupant.owner === player && occupant.piece === KING) {
      return boardAttacks(board, square, opponent(player));
    }
  }
  return false;
}

export function positionKey(position) {
  const board = position.board.map((occupant) => {
    if (!occupant) return '--';
    return `${occupant.owner[0]}${PIECE_CODE[occupant.piece]}`;
  }).join('');
  const whiteBank = [...position.banks[WHITE]].sort().map((piece) => PIECE_CODE[piece]).join('');
  const blackBank = [...position.banks[BLACK]].sort().map((piece) => PIECE_CODE[piece]).join('');
  return `${position.phase}|${position.turn}|${board}|${whiteBank}|${blackBank}`;
}

export function getResult(position) {
  if (position.phase !== 'play') return null;
  const key = positionKey(position);
  if ((position.repetitions[key] ?? 0) >= 3) {
    return { type: 'draw', reason: 'threefold-repetition' };
  }

  if (legalActions(position).length > 0) return null;
  if (isInCheck(position, position.turn)) {
    return { type: 'win', winner: opponent(position.turn), reason: 'checkmate' };
  }
  return { type: 'draw', reason: 'stalemate' };
}

export function actionKey(action) {
  if (!action || typeof action !== 'object') return 'invalid';
  if (action.type === 'place-king') return `place-king:${action.to}`;
  if (action.type === 'move') return `move:${action.from}:${action.to}`;
  if (action.type === 'drop') return `drop:${action.piece}:${action.to}`;
  return 'invalid';
}

function applyUnchecked(position, action, countRepetition) {
  const next = clonePosition(position, countRepetition);
  const player = position.turn;

  if (action.type === 'place-king') {
    next.board[action.to] = occupantOf(player, KING);
    if (position.phase === 'place-white-king') {
      next.phase = 'place-black-king';
      next.turn = BLACK;
    } else {
      next.phase = 'play';
      next.turn = WHITE;
    }
  } else if (action.type === 'move') {
    const moving = next.board[action.from];
    const captured = next.board[action.to];
    next.board[action.to] = moving;
    next.board[action.from] = null;
    if (captured) next.banks[captured.owner].push(captured.piece);
    next.turn = opponent(player);
  } else if (action.type === 'drop') {
    const bankIndex = next.banks[player].indexOf(action.piece);
    next.banks[player].splice(bankIndex, 1);
    next.board[action.to] = occupantOf(player, action.piece);
    next.turn = opponent(player);
  }

  if (countRepetition && next.phase === 'play') {
    const key = positionKey(next);
    next.repetitions[key] = (next.repetitions[key] ?? 0) + 1;
  }
  return next;
}

function pseudoMoves(board, from, piece, owner) {
  return attackSquares(board, from, piece).filter((to) => {
    const occupant = board[to];
    return !occupant || occupant.owner !== owner;
  });
}

function attackSquares(board, from, piece) {
  const [row, column] = coordinates(from);
  if (piece === KNIGHT) {
    return KNIGHT_STEPS
      .map(([dr, dc]) => squareAt(row + dr, column + dc))
      .filter((square) => square !== null);
  }
  if (piece === KING) {
    return KING_STEPS
      .map(([dr, dc]) => squareAt(row + dr, column + dc))
      .filter((square) => square !== null);
  }
  if (piece === ROOK) return raySquares(board, row, column, ORTHOGONAL);
  if (piece === BISHOP) return raySquares(board, row, column, DIAGONAL);
  return [];
}

function raySquares(board, row, column, directions) {
  const squares = [];
  for (const [dr, dc] of directions) {
    for (let distance = 1; distance < BOARD_SIZE; distance += 1) {
      const square = squareAt(row + dr * distance, column + dc * distance);
      if (square === null) break;
      squares.push(square);
      if (board[square]) break;
    }
  }
  return squares;
}

function homeRank(player) {
  const row = player === WHITE ? BOARD_SIZE - 1 : 0;
  return Array.from({ length: BOARD_SIZE }, (_, column) => row * BOARD_SIZE + column);
}

function squareAt(row, column) {
  if (row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE) return null;
  return row * BOARD_SIZE + column;
}

/**
 * The board an action would leave behind, shared occupant objects and all —
 * read-only, and only ever handed to `boardInCheck`. Occupants are replaced
 * rather than mutated everywhere in this engine, so sharing them is safe.
 */
function boardAfter(position, action) {
  const board = position.board.slice();
  if (action.type === 'move') {
    board[action.to] = board[action.from];
    board[action.from] = null;
  } else if (action.type === 'drop') {
    board[action.to] = occupantOf(position.turn, action.piece);
  } else {
    board[action.to] = occupantOf(position.turn, KING);
  }
  return board;
}

function coordinates(square) {
  return [Math.floor(square / BOARD_SIZE), square % BOARD_SIZE];
}

/**
 * `countRepetition: false` means the caller is about to read the board and
 * throw the position away — the legality filter, which does this once per
 * candidate move. The repetition map is shared rather than copied there: it
 * grows by one entry every ply, so copying it thirty times per search node
 * made the bot slower the longer the game ran, for no reason at all. A
 * position produced that way is read-only; nothing may write to its map.
 */
function clonePosition(position, copyRepetitions = true) {
  return {
    board: position.board.slice(),
    banks: {
      [WHITE]: [...position.banks[WHITE]],
      [BLACK]: [...position.banks[BLACK]],
    },
    turn: position.turn,
    phase: position.phase,
    repetitions: copyRepetitions ? { ...position.repetitions } : position.repetitions,
  };
}

function validatePosition(position) {
  if (!position || !Array.isArray(position.board) || position.board.length !== 16) {
    throw new Error('A Schness board must contain exactly 16 squares');
  }
  if (!PLAYERS.has(position.turn)) throw new Error('Invalid player turn');
  if (!['place-white-king', 'place-black-king', 'play'].includes(position.phase)) {
    throw new Error('Invalid game phase');
  }
  for (const occupant of position.board) {
    if (!occupant) continue;
    if (!PLAYERS.has(occupant.owner) || !PIECES.has(occupant.piece)) {
      throw new Error('Invalid board occupant');
    }
  }
  for (const player of PLAYERS) {
    if (!Array.isArray(position.banks?.[player]) ||
        position.banks[player].some((piece) => !BANK_PIECES.includes(piece))) {
      throw new Error('Invalid bank');
    }
  }
}

function assertSquare(square) {
  if (!Number.isInteger(square) || square < 0 || square >= 16) {
    throw new Error(`Invalid square: ${square}`);
  }
}

/** Occupants are immutable values: eight of them exist, frozen, and every board shares them. */
const OCCUPANTS = {};
for (const owner of PLAYERS) for (const piece of PIECES) OCCUPANTS[`${owner}:${piece}`] = Object.freeze({ owner, piece });
function occupantOf(owner, piece) { return OCCUPANTS[`${owner}:${piece}`]; }
