// A computer opponent, so you can fight when nobody else is online.
// GIVE IT A WAY TO CHOOSE · MAKE THE FIGHT CODE NOT CARE WHO IT IS FIGHTING.

const MOVES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

// --------------------------------------------- UNCHANGED FROM A20 (pure)
// Not one character of this had to change to add a computer player.
function compare(mine, theirs) {
  if (mine === theirs) return { winner: 'nobody', why: mine + ' does not beat ' + theirs };
  if (BEATS[mine] === theirs) return { winner: 'you', why: mine + ' beats ' + theirs };
  return { winner: 'them', why: theirs + ' beats ' + mine };
}

// ------------------------------------------------- 1. A WAY TO CHOOSE
// Everybody in a fight answers the same question: "what is your move?"
// Each answer below is a `chooseMove` function. Three fighters, three ways
// of deciding, one shape.

// You: your answer is whichever button you last pressed.
const human = { name: 'you', next: null, chooseMove: () => human.next };

// Dice: no memory, no plan, impossible to out-guess.
const dice = {
  name: 'dice',
  chooseMove: () => MOVES[Math.floor(Math.random() * MOVES.length)],
};

// Watcher: remembers your last 5 moves and leans against your favourite.
// One time in three it rolls a dice anyway, so it never becomes predictable
// itself. Without that floor, you could beat it every round by hand.
const watcher = {
  name: 'watcher',
  seen: [],
  remember(move) {
    watcher.seen.push(move);
    if (watcher.seen.length > 5) watcher.seen.shift();
  },
  chooseMove() {
    if (watcher.seen.length === 0 || Math.random() < 0.34) return dice.chooseMove();
    let favourite = watcher.seen[0];
    for (const move of MOVES) {
      const count = (m) => watcher.seen.filter((s) => s === m).length;
      if (count(move) > count(favourite)) favourite = move;
    }
    return MOVES.find((move) => BEATS[move] === favourite);
  },
};

// ----------------------------------- 2. THE FIGHT CODE DOES NOT CARE
// playRound asks two fighters for a move and compares the answers. It never
// checks which kind of fighter it has. Swap dice for watcher, or later for a
// real person over the network, and this function stays exactly as it is.
const score = { you: 0, them: 0, nobody: 0 };

function playRound(a, b) {
  const mine = a.chooseMove();
  const theirs = b.chooseMove();
  const result = compare(mine, theirs);
  score[result.winner] += 1;
  if (b.remember) b.remember(mine);
  show(mine, theirs, result, b);
}

// --------------------------------------------------------- screen
function opponent() {
  return document.querySelector('#smart').checked ? watcher : dice;
}

function show(mine, theirs, result, them) {
  const heading = { you: 'You win!', them: 'You lose.', nobody: 'A draw.' };
  document.querySelector('#who').textContent = heading[result.winner];
  document.querySelector('#why').textContent =
    'You played ' + mine + '. The ' + them.name + ' played ' + theirs + '. ' + result.why + '.';
  document.querySelector('#score').textContent =
    'won ' + score.you + ' · lost ' + score.them + ' · drew ' + score.nobody;
}

for (const button of document.querySelectorAll('#moves button')) {
  button.addEventListener('click', () => {
    human.next = button.dataset.move;
    playRound(human, opponent());
  });
}
