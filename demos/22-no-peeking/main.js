// No peeking: neither player can wait to see the other's move before choosing.
// HIDE your move · SHOW both at once · CHECK that nobody swapped theirs.
// Both players are on this one page so you can watch the whole thing.

const MOVES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

// --------------------------------------------------------------------- 1. HIDE
// A fingerprint of your move. crypto.subtle.digest turns any text into 64
// characters that always come out the same for the same text, and that nobody
// can read backwards. That is the folded piece of paper.
//
// The secret word matters. There are only three moves, so without it anyone
// could fingerprint rock, paper and scissors themselves and see which one matches.
// With a random secret mixed in, there is nothing left to try.
async function fingerprint(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fold(move) {
  const secret = randomSecret();
  return { move, secret, folded: await fingerprint(move + ':' + secret) };
}

// -------------------------------------------------------------------- 3. CHECK
// Pure: it is given what someone showed you and what they folded earlier, and
// it fingerprints the shown move again. Same fingerprint, honest. Different
// fingerprint, they swapped their move after seeing yours.
async function check(shown, folded) {
  return (await fingerprint(shown.move + ':' + shown.secret)) === folded;
}

// --------------------------------------------------------------- 2. SHOW BOTH
// Nobody unfolds until both papers are on the table. Here that is one click;
// in the real game each side sends its fingerprint first and only sends the
// move once the other fingerprint has arrived.
let you = null;
let them = null;

async function reveal() {
  const yourShown = { move: you.move, secret: you.secret };
  const theirShown = { move: them.move, secret: them.secret };

  // Both sides are checked every time, even though both are honest here.
  // window.lastCheck lets you try it yourself from the console — see the lesson.
  const youHonest = await check(yourShown, you.folded);
  const theyHonest = await check(theirShown, them.folded);
  window.lastCheck = { youHonest, theyHonest, yourShown, theirShown };
  showResult(yourShown, theirShown, youHonest, theyHonest);
}

// ------------------------------------------------------------------- screen
function showResult(yourShown, theirShown, youHonest, theyHonest) {
  const verdict = document.querySelector('#verdict');
  const why = document.querySelector('#why');
  if (!youHonest || !theyHonest) {
    verdict.textContent = 'Caught cheating!';
    why.textContent = 'Somebody showed a move they never folded. The fingerprints do not match, '
      + 'so the round does not count.';
    document.body.dataset.state = 'caught';
    return;
  }
  const result = yourShown.move === theirShown.move ? 'A draw.'
    : BEATS[yourShown.move] === theirShown.move ? 'You win!' : 'You lose.';
  verdict.textContent = result;
  why.textContent = 'You showed ' + yourShown.move + '. They showed ' + theirShown.move
    + '. Both fingerprints match what was folded, so the round counts.';
  document.body.dataset.state = 'honest';
}

for (const button of document.querySelectorAll('#moves button')) {
  button.addEventListener('click', async () => {
    you = await fold(button.dataset.move);
    them = await fold(MOVES[Math.floor(Math.random() * MOVES.length)]);
    document.querySelector('#folded').textContent =
      'your folded note:  ' + you.folded.slice(0, 32) + '…\n'
      + 'their folded note: ' + them.folded.slice(0, 32) + '…';
    document.querySelector('#verdict').textContent = 'Both folded.';
    document.querySelector('#why').textContent = 'Neither move can be read from those. Now unfold.';
    document.querySelector('#reveal').disabled = false;
  });
}

document.querySelector('#reveal').addEventListener('click', reveal);
