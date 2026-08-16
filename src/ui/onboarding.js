/**
 * First run: what is your name, and which monster are you?
 *
 * This is DOM, not canvas. Text, buttons and focus rings are miserable to
 * build on a canvas and free in HTML — so the world is a canvas and everything
 * you read or click sits on top of it in real elements, styled by Basecoat.
 */
import { drawTile } from '../sprites.js';
import { cleanName, MAX_NAME } from '../identity.js';

const ELEMENT_LABEL = { fire: 'Fire', water: 'Water', earth: 'Earth' };

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
  const card = panel(`Pick your monster, ${identity.name}`,
    'Your monster is also your element. Fire beats earth, earth beats water, water beats fire.');

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
    button.className = `monster-card element-${monster.element}`;
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

    const element = document.createElement('span');
    element.className = 'badge monster-element';
    element.textContent = ELEMENT_LABEL[monster.element] || monster.element;

    button.append(swatch, name, element);
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
