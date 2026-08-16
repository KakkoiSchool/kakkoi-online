/**
 * First run: what is your name, and which monster are you?
 *
 * This is DOM, not canvas. Text, buttons and focus rings are miserable to
 * build on a canvas and free in HTML — so the world is a canvas and everything
 * you read or click sits on top of it in real elements, styled by Basecoat.
 */
import { drawTile } from '../sprites.js';
import { cleanName, MAX_NAME } from '../identity.js';

/**
 * Runs the two panels in order and resolves once the player has a name and a
 * monster. If they already have both (a returning player) it resolves at once.
 */
export function askIdentity({ root, identity, monsters, atlas }) {
  if (identity.chosen) return Promise.resolve(identity);

  root.hidden = false;
  return new Promise((resolve) => {
    const done = () => {
      root.hidden = true;
      root.replaceChildren();
      resolve(identity);
    };
    if (!identity.name) askName(root, identity, () => askMonster(root, identity, monsters, atlas, done));
    else askMonster(root, identity, monsters, atlas, done);
  });
}

/**
 * The card about other people, shown once — on the first run, straight after
 * the monster picker and before the world appears.
 *
 * On the first run rather than "the first time somebody else is here", because
 * the first time somebody else is here is exactly the moment a player is least
 * likely to read anything. This game will often have one person in it, and a
 * child should already know the three facts below when the second person walks
 * in, not be handed them at the same instant.
 *
 * Plain and calm on purpose. It is not a warning, it is a description of how
 * the place works, and being frightening would be both unkind and useless.
 */
export function showSafetyCard({ root }) {
  root.hidden = false;
  return new Promise((resolve) => {
    const card = panel('Before you go in',
      'Kakkoi Online has no owner watching it. Here is what that means.');
    card.classList.add('safety-card');

    const list = document.createElement('ul');
    list.className = 'safety-list';
    for (const [heading, body] of [
      ['Other players can see three things',
       'The name you chose, the monster you picked, and where you are standing. That is all. Not your real name, not where you live, and nothing at all from your computer.'],
      ['Nobody is in charge here',
       'The game has no server and no moderators. The browsers talk straight to each other, so there is no one who can see what happens or step in.'],
      ['If someone is unkind, leave',
       'Close the tab. Nothing follows you out. Then tell an adult you trust — that is the part that actually helps.'],
    ]) {
      const item = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = heading;
      const p = document.createElement('p');
      p.textContent = body;
      item.append(strong, p);
      list.append(item);
    }

    const note = document.createElement('p');
    note.className = 'card-description';
    note.textContent = 'You can only say six set phrases in here. There is nowhere to type, so nobody can send you words they made up.';

    const ok = document.createElement('button');
    ok.className = 'btn onboarding-confirm';
    ok.type = 'button';
    ok.textContent = 'Got it';
    ok.addEventListener('click', () => {
      root.hidden = true;
      root.replaceChildren();
      resolve();
    });

    card.append(list, note, ok);
    root.replaceChildren(card);
    ok.focus();
  });
}

/**
 * "Start over": are you sure?
 *
 * One click must never throw a character away, so this is the step in between.
 * It is a DOM panel, the same one the other two screens use, and not the
 * browser's own `confirm()` — a native dialog freezes the page, cannot be
 * styled, and says "localhost:8840 says:" above whatever you wrote, which is
 * both ugly and slightly frightening.
 *
 * It is also not styled as a danger: starting over is a completely reasonable
 * thing to want, and a red button with a warning sign would suggest otherwise.
 *
 * Resolves true if they meant it.
 */
export function confirmReset({ root }) {
  root.hidden = false;
  return new Promise((resolve) => {
    const card = panel('Start over?',
      'You will pick a new name and a new animal, and you will begin again at the entrance. ' +
      'Everyone else stays where they are.');

    const finish = (answer) => {
      root.hidden = true;
      root.replaceChildren();
      resolve(answer);
    };

    const yes = document.createElement('button');
    yes.className = 'btn reset-yes';
    yes.type = 'button';
    yes.textContent = 'Yes, start over';
    yes.addEventListener('click', () => finish(true));

    const no = document.createElement('button');
    no.className = 'btn-outline reset-no';
    no.type = 'button';
    no.textContent = 'No, keep playing';
    no.addEventListener('click', () => finish(false));

    const row = document.createElement('div');
    row.className = 'reset-actions';
    row.append(yes, no);

    card.append(row);
    root.replaceChildren(card);
    no.focus();          // the safe answer is the one under your finger
  });
}

function panel(title, description) {
  const card = document.createElement('section');
  card.className = 'card onboarding-card';
  const h = document.createElement('h2');
  h.className = 'card-title';
  h.textContent = title;
  const p = document.createElement('p');
  p.className = 'card-description';
  p.textContent = description;
  card.append(h, p);
  return card;
}

function askName(root, identity, next) {
  const card = panel('Kakkoi Online', 'What are you called down here?');

  const label = document.createElement('label');
  label.className = 'label';
  label.htmlFor = 'name-input';
  label.textContent = `Name (up to ${MAX_NAME} characters)`;

  const input = document.createElement('input');
  input.className = 'input';
  input.id = 'name-input';
  input.maxLength = MAX_NAME;
  input.autocomplete = 'off';
  input.placeholder = 'Kiri';
  input.value = identity.name;

  const button = document.createElement('button');
  button.className = 'btn';
  button.type = 'submit';
  button.textContent = 'Continue';

  const hint = document.createElement('p');
  hint.className = 'card-description onboarding-hint';
  hint.textContent = ' ';

  const form = document.createElement('form');
  form.className = 'onboarding-form';
  form.append(label, input, button);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanName(input.value);
    if (!name) {
      hint.textContent = 'A name needs at least one letter or number.';
      input.focus();
      return;
    }
    identity.setName(name);
    next();
  });

  card.append(form, hint);
  root.replaceChildren(card);
  input.focus();
}

function askMonster(root, identity, monsters, atlas, done) {
  // Nothing is printed under the animals but their names. A duel is rock, paper,
  // scissors and is decided entirely by the move you pick each round, so the
  // animal you choose is a costume: it changes nothing at all in a fight, and
  // any badge under it would promise otherwise.
  const card = panel(`Pick your monster, ${identity.name}`,
    'Pick whichever you like the look of.');

  const grid = document.createElement('div');
  grid.className = 'monster-grid';

  let picked = monsters[0].id;
  const buttons = new Map();

  const select = (id) => {
    picked = id;
    for (const [otherId, button] of buttons) {
      button.setAttribute('aria-pressed', String(otherId === id));
    }
  };

  for (const monster of monsters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'monster-card';
    button.dataset.monsterId = String(monster.id);

    const swatch = document.createElement('canvas');
    swatch.width = 64;
    swatch.height = 64;
    swatch.className = 'monster-swatch';
    const ctx = swatch.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawTile(ctx, atlas, monster.cell, 0, 0, 64 / atlas.cell);

    const name = document.createElement('span');
    name.className = 'monster-name';
    name.textContent = monster.name;

    button.append(swatch, name);
    button.addEventListener('click', () => select(monster.id));
    button.addEventListener('dblclick', () => { select(monster.id); finish(); });
    buttons.set(monster.id, button);
    grid.append(button);
  }

  const confirm = document.createElement('button');
  confirm.className = 'btn onboarding-confirm';
  confirm.type = 'button';
  confirm.textContent = 'Enter the dungeon';
  const finish = () => { identity.setMonster(picked); done(); };
  confirm.addEventListener('click', finish);

  card.append(grid, confirm);
  root.replaceChildren(card);
  select(picked);
  buttons.get(picked).focus();
}
