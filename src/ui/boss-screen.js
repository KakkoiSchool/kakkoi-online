/**
 * The raid panel: Aniki's lives, your lives, and everybody else in the fight.
 *
 * It looks like the duel screen on purpose — same card, same three enormous
 * buttons, same black edge — because it is the same three moves and a player
 * should not have to learn a second interface to use what they already know.
 * What it adds is the two things a duel does not have: **a clock**, because a
 * round here ends whether or not you chose, and **other people**, because the
 * whole point of him is that you are not supposed to do this alone.
 *
 * The one number it is careful about is his: it is labelled as what *you* have
 * seen, not as the truth, because his lives are an estimate assembled from the
 * moves that reached this browser. See the note at the top of `src/boss.js` —
 * pretending otherwise on the screen would be the interface telling a lie the
 * code is honest about.
 */
import { MOVES } from '../battle/rules.js';
import { glyph } from './glyphs.js';

const LOOK = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

export function createBossScreen({ root, boss }) {
  if (!root) return { root: null };

  const card = el('div', 'card duel-card boss-card');

  const title = el('h2', 'duel-title', 'Aniki');
  const sub = el('p', 'duel-sub');

  // The two rows of lives. His are hearts we have *seen* him lose; yours are
  // yours, and nothing anybody sends can change them.
  const hisRow = lives('boss-his', 'Aniki');
  const yourRow = lives('boss-yours', 'You');

  // How long is left of this round. It is a clock, not a turn: it runs out.
  const timerBox = el('div', 'boss-timer');
  const timerFill = el('div', 'boss-timer-fill');
  timerBox.append(timerFill);

  const banner = el('p', 'duel-banner');
  const why = el('p', 'duel-why');

  // Everybody else who has played this round, as they arrive.
  const crowd = el('div', 'boss-crowd');

  const moves = el('div', 'duel-moves');
  const buttons = MOVES.map((move) => {
    const b = el('button', 'btn duel-move');
    b.type = 'button';
    b.dataset.move = move;
    const picture = el('span', 'duel-move-icon');
    picture.innerHTML = glyph(move);
    b.append(picture, el('span', 'duel-move-name', LOOK[move]));
    b.addEventListener('click', () => { boss.play(move); b.blur(); });
    return b;
  });
  moves.append(...buttons);

  const actions = el('div', 'duel-actions');
  const leave = button('Leave the fight', 'btn-outline duel-give-up', () => boss.leave());
  actions.append(leave);

  const top = el('div', 'duel-top');
  top.append(title, sub, hisRow.row, yourRow.row, timerBox, banner, why, crowd);
  card.append(top, moves, actions);
  root.append(card);

  function render(v) {
    if (!v.joined) { root.hidden = true; return; }
    root.hidden = false;

    sub.textContent = `Round ${v.round} · his wounds last the hour, yours last the fight`;
    hisRow.set(v.his, v.hisMost);
    yourRow.set(v.yours, v.yoursMost);

    timerFill.style.width = `${Math.round((1 - v.progress) * 100)}%`;
    timerBox.classList.toggle('is-closed', v.phase !== 'choosing');

    for (const b of buttons) {
      b.disabled = v.phase !== 'choosing' || Boolean(v.picked);
      b.classList.toggle('is-picked', v.picked === b.dataset.move);
    }

    if (v.phase === 'choosing' && !v.picked) {
      banner.textContent = 'Pick a move';
      why.textContent = 'Everybody chooses at once, and the round ends when the bar runs out.';
    } else if (v.phase === 'choosing') {
      banner.textContent = 'In.';
      why.textContent = 'Waiting for the round to close.';
    } else {
      banner.textContent = v.last ? sentence(v.last) : 'Showing…';
      why.textContent = v.last ? hits(v.last) : '';
    }

    card.dataset.phase = v.phase === 'choosing' ? 'choosing' : 'resolved';

    // Who else is in this round. Names come from the peer list, and a move is
    // one of three words — there is no text from another computer on this
    // screen, the same rule the chat bubbles follow.
    crowd.replaceChildren();
    for (const other of v.others) {
      const tag = el('span', 'boss-other');
      const picture = el('span', 'boss-other-icon');
      picture.innerHTML = glyph(other.move);
      tag.append(picture, el('span', 'boss-other-name', other.name));
      crowd.append(tag);
    }
  }

  /**
   * The bar, and only the bar, every frame.
   *
   * Everything else on this panel changes twice a round and is drawn when it
   * does. The clock changes continuously, and one style write a frame is what
   * that costs — repainting the whole card thirty times a second to move a bar
   * would be thirty rebuilds of a list of names for nothing.
   */
  function tick(v) {
    if (root.hidden) return;
    timerFill.style.width = `${Math.round((1 - v.progress) * 100)}%`;
  }

  boss.onChange(render);
  render(boss.view());
  return { root, card, buttons, render, tick };
}

/** What the round that just closed did, in one line. */
function sentence(last) {
  if (last.landed.length && last.hurt) return `He played ${last.his}. Traded.`;
  if (last.landed.length) return `He played ${last.his}. Hit!`;
  if (last.hurt) return `He played ${last.his}. That one hurt.`;
  return `He played ${last.his}.`;
}

function hits(last) {
  if (!last.landed.length) return 'Nobody landed one that round.';
  const names = last.landed.map((who) => who.name).join(', ');
  return `${names} got through — he is on ${last.left}.`;
}

/** A row of hearts, and the number, because ten hearts is hard to count. */
function lives(className, label) {
  const row = el('div', `boss-lives ${className}`);
  const who = el('span', 'boss-lives-name', label);
  const pips = el('span', 'boss-pips');
  const count = el('span', 'boss-lives-count');
  row.append(who, pips, count);
  return {
    row,
    set(now, most) {
      count.textContent = `${now}/${most}`;
      if (pips.childElementCount !== most) {
        pips.replaceChildren();
        for (let i = 0; i < most; i++) pips.append(el('span', 'boss-pip'));
      }
      [...pips.children].forEach((pip, i) => pip.classList.toggle('is-gone', i >= now));
    },
  };
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
