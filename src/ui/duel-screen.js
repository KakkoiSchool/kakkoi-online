/**
 * The duel screen: the challenge, the three moves, and — the point of the whole
 * panel — **the two moves meeting**.
 *
 * DOM rather than canvas, for the same reason the rest of the interface is: a
 * button that is the right size for a thumb, reachable from a keyboard and
 * readable by a screen reader is free in HTML and a fortnight of work on a
 * canvas. The three move buttons are deliberately enormous — this game is played
 * on phones, and a move you cannot hit is not a move.
 *
 * **Show, do not narrate.** An earlier version put `Pick a move.` in the
 * headline and what had just happened underneath it, smaller: *"Last round: you
 * played rock, they played paper."* You never saw the moves meet — the thing
 * that happened was demoted beneath the prompt for the next thing. Now the two
 * moves sit side by side, large, all the way through a round: yours appears when
 * you pick it, theirs is a question mark until the reveal, and the winner is
 * ringed. `roundGapMs` holds it there before the next round opens, so a result
 * is something you watched rather than something you read about afterwards.
 *
 * **Three states that look different, not just read differently.** Choosing is
 * lit and the buttons are live; waiting is dimmed and pulsing with your move
 * already committed; the reveal is the loudest thing on the screen. A player who
 * cannot tell "your turn" from "their turn" at a glance is playing a slower game
 * than the one we wrote.
 *
 * It knows nothing about the network or the NPC. It is handed a view of the duel
 * and draws it, and it calls back into `duel` when a finger lands.
 */
import { MOVES } from '../battle/rules.js';

const LOOK = {
  rock: { icon: '🪨', label: 'Rock' },
  paper: { icon: '📄', label: 'Paper' },
  scissors: { icon: '✂️', label: 'Scissors' },
};

export function createDuelScreen({ root, duel }) {
  if (!root) return { root: null };

  const card = el('div', 'card duel-card');
  const title = el('h2', 'duel-title');
  const sub = el('p', 'duel-sub');

  // ---- the score, always with both names on it. A bare "1 — 0" tells you the
  // numbers and not whose they are, which is the one thing you wanted to know.
  const scoreRow = el('div', 'duel-score');
  const yourName = el('span', 'duel-side', 'You');
  const yourScore = el('span', 'duel-num');
  const theirScore = el('span', 'duel-num');
  const theirName = el('span', 'duel-side');
  scoreRow.append(yourName, yourScore, el('span', 'duel-dash', '—'), theirScore, theirName);

  // ---- the face-off: your move and their move, facing each other, the whole
  // round long. This is the part a child looks at.
  const face = el('div', 'duel-face');
  const mineSide = side('You');
  const versus = el('span', 'duel-vs', 'vs');
  const theirSide = side('Them');
  face.append(mineSide.box, versus, theirSide.box);

  const banner = el('p', 'duel-banner');
  const why = el('p', 'duel-why');

  const moves = el('div', 'duel-moves');
  const buttons = MOVES.map((move) => {
    const b = el('button', 'btn duel-move');
    b.type = 'button';
    b.dataset.move = move;
    b.append(el('span', 'duel-move-icon', LOOK[move].icon), el('span', 'duel-move-name', LOOK[move].label));
    b.addEventListener('click', () => { duel.play(move); b.blur(); });
    return b;
  });
  moves.append(...buttons);

  const actions = el('div', 'duel-actions');
  const yes = button('Fight!', 'btn duel-yes', () => duel.accept());
  const no = button('No thanks', 'btn-outline duel-no', () => duel.decline());
  const leave = button('Leave', 'btn-outline duel-leave', () => duel.close());
  actions.append(yes, no, leave);

  // Everything above the buttons is one block, and it is the block that gives
  // way. On a short window — a phone held sideways, a browser window dragged
  // short — the three moves and the button that leaves must be on screen without
  // scrolling, because they are how you play. The score, the face-off and the
  // sentence compress first and, at the very end, scroll inside this box.
  const top = el('div', 'duel-top');
  top.append(title, sub, scoreRow, face, banner, why);

  card.append(top, moves, actions);
  root.append(card);

  // The link is let go the instant the duel ends, so remember who it was —
  // "You lost to They" would be a poor way to end a fight.
  let them = 'They';

  function render(v) {
    if (v.state === 'walking') { root.hidden = true; return; }
    root.hidden = false;

    if (v.them?.name) them = v.them.name;
    const fighting = v.state === 'fighting';

    show(scoreRow, fighting);
    show(face, fighting);
    show(moves, fighting);
    show(yes, v.state === 'asked');
    show(no, v.state === 'asked');
    show(leave, v.state !== 'asked');

    yourScore.textContent = String(v.score.you);
    theirScore.textContent = String(v.score.them);
    theirName.textContent = them;

    if (v.state === 'waiting') {
      card.dataset.phase = 'asking';
      title.textContent = `Waiting for ${them}…`;
      sub.textContent = 'They have been asked for a duel. They may say no.';
      banner.textContent = '';
      why.textContent = '';
      leave.textContent = 'Never mind';
      return;
    }

    if (v.state === 'asked') {
      card.dataset.phase = 'asked';
      title.textContent = `${them} challenges you!`;
      sub.textContent = 'First to three rounds. Rock beats scissors, scissors beats paper, paper beats rock.';
      banner.textContent = '';
      why.textContent = '';
      return;
    }

    title.textContent = `You  vs  ${them}`;
    sub.textContent = `First to ${v.needed} rounds · round ${v.round}`;
    leave.textContent = v.phase === 'over' ? 'Back to the world' : 'Give up';
    theirSide.name.textContent = them;

    for (const b of buttons) {
      b.disabled = v.phase !== 'choosing';
      b.classList.toggle('is-picked', v.myMove === b.dataset.move);
    }

    // The card carries the phase, and the CSS makes the three look different.
    card.dataset.phase = v.phase;

    if (v.phase === 'over') {
      // The last round played stays on the table under the final score: the duel
      // ends on the round that won it, and that round should still be visible.
      paint(mineSide, v.last?.mine ?? v.myMove, v.last?.winner === 'you');
      paint(theirSide, v.last?.theirs ?? v.theirMove, v.last?.winner === 'them');
      banner.textContent = v.outcome?.text || '';
      why.textContent = `Final score — you ${v.outcome.score.you}, ${them} ${v.outcome.score.them}.`;
      return;
    }

    if (v.phase === 'choosing') {
      paint(mineSide, null, false);
      paint(theirSide, null, false);
      banner.textContent = 'Pick a move';
      why.textContent = 'Rock beats scissors, scissors beats paper, paper beats rock.';
      return;
    }

    if (v.phase === 'waiting') {
      paint(mineSide, v.myMove, false);
      paint(theirSide, null, false);
      banner.textContent = v.theyChose ? 'Both in — showing…' : `Waiting for ${them}…`;
      why.textContent = v.theyChose
        ? 'You both chose.'
        : `You played ${LOOK[v.myMove].label.toLowerCase()}. ${them} has not chosen yet.`;
      return;
    }

    if (v.phase === 'resolved' && v.last) {
      paint(mineSide, v.last.mine, v.last.winner === 'you');
      paint(theirSide, v.last.theirs, v.last.winner === 'them');
      banner.textContent = sentence(v.last, them);
      why.textContent = `Round ${v.last.round} · you ${v.score.you}, ${them} ${v.score.them}`;
    }
  }

  duel.onChange(render);
  render(duel.view());
  return { root, card, buttons, render };
}

/**
 * One round in one plain sentence: what beat what, and who that gave the round
 * to. Both halves, always — "paper beats rock" alone leaves a child working out
 * whose paper it was.
 */
function sentence(last, them) {
  const { winner, mine, theirs, why } = last;
  if (winner === 'nobody') return `You both played ${LOOK[mine].label.toLowerCase()}. Nobody wins the round.`;
  const first = why.charAt(0).toUpperCase() + why.slice(1);
  return winner === 'you' ? `${first}. You win the round!` : `${first}. ${them} wins the round.`;
}

/** One half of the face-off: a name, a big move, and a mark if it won. */
function side(name) {
  const box = el('div', 'duel-side-box');
  const who = el('span', 'duel-face-name', name);
  const icon = el('span', 'duel-face-icon', '?');
  const label = el('span', 'duel-face-move', '—');
  const crown = el('span', 'duel-face-win', 'wins');
  box.append(who, icon, label, crown);
  return { box, name: who, icon, label, crown };
}

/** Show a move on one side of the face-off — or a question mark for "not yet". */
function paint(target, move, won) {
  const look = move ? LOOK[move] : null;
  target.icon.textContent = look ? look.icon : '?';
  target.label.textContent = look ? look.label : 'thinking…';
  target.box.classList.toggle('is-known', Boolean(look));
  target.box.classList.toggle('is-win', Boolean(won));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, onClick) {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', () => { onClick(); b.blur(); });
  return b;
}

function show(node, yes) { node.hidden = !yes; }
