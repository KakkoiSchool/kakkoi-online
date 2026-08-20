/**
 * The chest, and the wardrobe.
 *
 * A reward that appears silently is not a reward. Opening a chest is three
 * beats — *there is a chest*, *here is what was in it*, *here is you wearing
 * it* — because the middle one is the moment the hundred duels were for, and it
 * deserves more than a line in the corner.
 *
 * Both panels here draw the player's own monster, live, from the same sheet the
 * world draws it from and through the same `looks.js`. That matters more than it
 * sounds: a preview painted a different way is a preview that can lie, and the
 * one thing a wardrobe must not do is show you something other than what
 * everybody else will see.
 */
import { drawTile } from '../sprites.js';
import { BARE } from '../looks.js';

/**
 * Open one chest, as a promise that resolves when the card is dismissed.
 *
 * `wins.open()` is called by this file, at the moment the lid comes up, so a
 * look cannot be unlocked without the ceremony having happened.
 */
export function openChest({ root, wins, looks, identity, atlas }) {
  root.hidden = false;
  return new Promise((resolve) => {
    const card = document.createElement('section');
    card.className = 'card onboarding-card chest-card';

    const title = document.createElement('h2');
    title.className = 'onboarding-title';
    title.textContent = 'A chest!';

    const why = document.createElement('p');
    why.textContent = `${wins.count} duels won. This was waiting for you.`;

    const stage = document.createElement('div');
    stage.className = 'chest-stage';
    const shut = document.createElement('div');
    shut.className = 'chest-box';
    stage.append(shut);

    const open = document.createElement('button');
    open.className = 'btn onboarding-confirm';
    open.type = 'button';
    open.textContent = 'Open it';

    card.append(title, why, stage, open);
    root.replaceChildren(card);
    open.focus();

    open.addEventListener('click', () => {
      const look = wins.open();
      if (!look) { finish(); return; }

      title.textContent = look.name;
      why.textContent = look.blurb || '';
      stage.replaceChildren(preview(look.id, { looks, identity, atlas }));

      const wear = document.createElement('button');
      wear.className = 'btn onboarding-confirm';
      wear.type = 'button';
      wear.textContent = 'Wear it';
      wear.addEventListener('click', () => { wins.wear(look.id); finish(); });

      const later = document.createElement('button');
      later.className = 'btn-outline chest-later';
      later.type = 'button';
      later.textContent = 'Keep it for later';
      later.addEventListener('click', finish);

      const row = document.createElement('div');
      row.className = 'reset-actions';
      row.append(wear, later);
      open.replaceWith(row);
      wear.focus();
    });

    function finish() {
      root.hidden = true;
      root.replaceChildren();
      resolve();
    }
  });
}

/**
 * Everything that can be worn, earned or not.
 *
 * The locked ones are shown, greyed, with what they cost. A wardrobe with three
 * empty spaces in it says what the next hundred duels are for; a wardrobe that
 * hides them says nothing at all.
 */
export function showWardrobe({ root, wins, looks, identity, atlas }) {
  root.hidden = false;
  return new Promise((resolve) => {
    const card = document.createElement('section');
    card.className = 'card onboarding-card safety-card';

    const title = document.createElement('h2');
    title.className = 'onboarding-title';
    title.textContent = 'What you are wearing';

    const tally = document.createElement('p');
    tally.textContent = wins.next
      ? `${wins.count} duels won — ${wins.next} more to the next chest.`
      : `${wins.count} duels won. There is nothing left to find.`;

    const grid = document.createElement('div');
    grid.className = 'monster-grid look-grid';

    const buttons = new Map();
    const choose = (id) => {
      if (!wins.wear(id)) return;
      for (const [other, button] of buttons) button.setAttribute('aria-pressed', String(other === id));
    };

    for (const entry of [{ id: BARE, name: 'As you were', wins: 0 }, ...looks.all]) {
      const owned = entry.id === BARE || wins.has(entry.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = owned ? 'monster-card' : 'monster-card is-locked';
      button.disabled = !owned;
      button.dataset.look = String(entry.id);

      button.append(preview(owned ? entry.id : BARE, { looks, identity, atlas }));

      const name = document.createElement('span');
      name.className = 'monster-name';
      // A look with no number of wins on it cannot come out of a chest, so the
      // locked label has to say what it does take. There is one, and it is him.
      name.textContent = owned ? entry.name
        : Number.isInteger(entry.wins) ? `${entry.wins} wins`
        : 'Beat Aniki';
      button.append(name);

      button.addEventListener('click', () => choose(entry.id));
      buttons.set(entry.id, button);
      grid.append(button);
    }

    const ok = document.createElement('button');
    ok.className = 'btn onboarding-confirm';
    ok.type = 'button';
    ok.textContent = 'Done';
    ok.addEventListener('click', () => {
      root.hidden = true;
      root.replaceChildren();
      resolve();
    });

    card.append(title, tally, grid, ok);
    root.replaceChildren(card);
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(id === wins.wearing));
    ok.focus();
  });
}

/** Your own monster, wearing one particular look, at eight times life size. */
function preview(id, { looks, identity, atlas }) {
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.className = 'monster-swatch';
  canvas.width = atlas.cell * scale;
  canvas.height = atlas.cell * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const monster = identity.creature;
  drawTile(ctx, looks.atlasFor(id), monster.cell, 0, 0, scale);
  for (const [px, py, w, h, colour] of looks.overlayFor(id, monster) || []) {
    ctx.fillStyle = colour;
    ctx.fillRect(px * scale, py * scale, w * scale, h * scale);
  }
  return canvas;
}
