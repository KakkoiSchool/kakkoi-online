/**
 * The duel screen: the challenge, the three buttons, and what just happened.
 *
 * DOM rather than canvas, for the same reason the rest of the interface is:
 * a button that is the right size for a thumb, reachable from a keyboard and
 * readable by a screen reader is free in HTML and a fortnight of work on a
 * canvas. The three move buttons are deliberately enormous — this game is
 * played on phones, and a move you cannot hit is not a move.
 *
 * It says what happened in **words** — "water beats fire" — and not just who
 * won, because a player who cannot see why they lost cannot get better. The
 * running score sits above the buttons the whole time.
 *
 * It knows nothing about the network, the NPC or crypto. It is handed a view of
 * the duel and draws it, and it calls back into `duel` when a finger lands.
 */
import { MOVES } from '../battle/rules.js';

const LOOK = {
  fire: { icon: '🔥', label: 'Fire' },
  water: { icon: '💧', label: 'Water' },
  earth: { icon: '🍃', label: 'Earth' },
};

const HEADING = { you: 'You take the round', them: 'They take the round', nobody: 'A draw' };

export function createDuelScreen({ root, duel }) {
  if (!root) return { root: null };

  const card = el('div', 'card duel-card');
  const title = el('h2', 'duel-title');
  const sub = el('p', 'duel-sub');

  const scoreRow = el('div', 'duel-score');
  const yourScore = el('span', 'duel-num');
  const theirScore = el('span', 'duel-num');
  const scoreGap = el('span', 'duel-dash', '—');
  scoreRow.append(yourScore, scoreGap, theirScore);

  const status = el('p', 'duel-status');
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

  // The two folded papers. Seeing both fingerprints sitting there while neither
  // move is known is the entire idea of commit–reveal, so it is on the screen.
  const folds = el('div', 'duel-folds');
  const myFold = el('code', 'duel-fold');
  const theirFold = el('code', 'duel-fold');
  folds.append(myFold, theirFold);

  const actions = el('div', 'duel-actions');
  const yes = button('Fight!', 'btn duel-yes', () => duel.accept());
  const no = button('No thanks', 'btn-outline duel-no', () => duel.decline());
  const leave = button('Leave', 'btn-outline duel-leave', () => duel.close());
  actions.append(yes, no, leave);

  card.append(title, sub, scoreRow, status, why, moves, folds, actions);
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
    show(moves, fighting);
    show(folds, fighting && v.phase !== 'over');
    show(yes, v.state === 'asked');
    show(no, v.state === 'asked');
    show(leave, v.state !== 'asked');

    yourScore.textContent = String(v.score.you);
    theirScore.textContent = String(v.score.them);

    if (v.state === 'waiting') {
      title.textContent = `Waiting for ${them}…`;
      sub.textContent = 'They have been asked for a duel. They may say no.';
      status.textContent = '';
      why.textContent = '';
      leave.textContent = 'Never mind';
      return;
    }

    if (v.state === 'asked') {
      title.textContent = `${them} challenges you!`;
      sub.textContent = 'First to three rounds. Fire, water, earth — water beats fire, fire beats earth, earth beats water.';
      status.textContent = '';
      why.textContent = '';
      return;
    }

    title.textContent = `You  vs  ${them}`;
    sub.textContent = `First to ${v.needed} rounds · round ${v.round}`;
    leave.textContent = v.phase === 'over' ? 'Back to the world' : 'Give up';

    for (const b of buttons) {
      b.disabled = v.phase !== 'choosing';
      b.classList.toggle('is-picked', v.myMove === b.dataset.move);
    }

    myFold.textContent = v.myCommit ? `your folded move  ${v.myCommit.slice(0, 12)}…` : 'your folded move  —';
    theirFold.textContent = v.theirCommit ? `their folded move ${v.theirCommit.slice(0, 12)}…` : 'their folded move —';

    if (v.phase === 'over') {
      const how = v.outcome?.how;
      title.textContent = how === 'cheat' ? 'Caught cheating!' : `You  vs  ${them}`;
      status.textContent = v.outcome?.text || '';
      why.textContent = how === 'cheat'
        ? `${v.last?.why || 'The fingerprints do not match'}, so the duel does not count.`
        : `Final score ${v.outcome.score.you} — ${v.outcome.score.them}.`;
      return;
    }

    if (v.phase === 'choosing') {
      status.textContent = 'Pick a move.';
      why.textContent = v.last
        ? `Last round: you played ${v.last.mine}, they played ${v.last.theirs}. ${v.last.why}.`
        : 'Neither of you can see the other’s move until you have both chosen.';
      return;
    }
    if (v.phase === 'folding' || v.phase === 'folded') {
      status.textContent = 'Your move is folded up.';
      why.textContent = v.theirCommit ? 'They have folded theirs too.' : `Waiting for ${them} to choose…`;
      return;
    }
    if (v.phase === 'shown') {
      status.textContent = 'Both folded. Unfolding…';
      why.textContent = 'Each move is fingerprinted again and checked against the paper it was folded in.';
      return;
    }
    if (v.phase === 'resolved' && v.last) {
      status.textContent = HEADING[v.last.winner];
      why.textContent = `You played ${v.last.mine}. They played ${v.last.theirs}. ${v.last.why}.`;
    }
  }

  duel.onChange(render);
  render(duel.view());
  return { root, card, buttons, render };
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
