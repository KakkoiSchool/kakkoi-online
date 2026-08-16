// Three moves: fire, water, earth. Pick one, see who won and why.
// CHOOSE a move (both sides) · COMPARE the two choices · SHOW the result.

// ----------------------------------------------------------------- 2. COMPARE
// A pure function: give it two moves, it gives back an answer. It never
// touches the screen, never asks the clock, never rolls a dice. Same two
// moves in, same answer out, every single time. That is what makes it the
// only part of the fight you can check is right without playing the game.

// water beats fire, fire beats earth, earth beats water.
const BEATS = { water: 'fire', fire: 'earth', earth: 'water' };

function compare(mine, theirs) {
  if (mine === theirs) return { winner: 'nobody', why: mine + ' does not beat ' + theirs };
  if (BEATS[mine] === theirs) return { winner: 'you', why: mine + ' beats ' + theirs };
  return { winner: 'them', why: theirs + ' beats ' + mine };
}

// A check you can run in your head, or in the console. No screen needed.
console.assert(compare('water', 'fire').winner === 'you', 'water should beat fire');
console.assert(compare('fire', 'water').winner === 'them', 'fire should lose to water');
console.assert(compare('earth', 'earth').winner === 'nobody', 'same move is a draw');

// ------------------------------------------------------------------ 1. CHOOSE
// Two choices have to arrive before anything can be compared. Yours comes from
// a button. Theirs, here, comes from a dice roll — in the real game it comes
// over the network, and nothing below this block has to know the difference.
const MOVES = ['fire', 'water', 'earth'];

function theirChoice() {
  return MOVES[Math.floor(Math.random() * MOVES.length)];
}

for (const button of document.querySelectorAll('#moves button')) {
  button.addEventListener('click', () => playRound(button.dataset.move));
}

// --------------------------------------------------------------------- 3. SHOW
// Words on the screen. This block does no thinking of its own: it is handed a
// result and puts it where a person can read it.
const score = { you: 0, them: 0, nobody: 0 };

function show(mine, theirs, result) {
  const heading = { you: 'You win!', them: 'You lose.', nobody: 'A draw.' };
  document.querySelector('#who').textContent = heading[result.winner];
  document.querySelector('#why').textContent =
    'You played ' + mine + '. They played ' + theirs + '. ' + result.why + '.';
  document.querySelector('#score').textContent =
    'won ' + score.you + ' · lost ' + score.them + ' · drew ' + score.nobody;
}

// ------------------------------------------------------------- one round
function playRound(mine) {
  const theirs = theirChoice();
  const result = compare(mine, theirs);
  score[result.winner] += 1;
  show(mine, theirs, result);
}
