/**
 * The phrase bar: one button per preset phrase, and nothing else.
 *
 * It is DOM rather than canvas because a button that is the right size for a
 * finger, keyboard-reachable and readable by a screen reader is free in HTML
 * and a week of work on a canvas. The buttons are deliberately chunky — the
 * game is played on phones, and a phrase you cannot hit is not a phrase.
 *
 * Notice what is not here: an input. See `src/chat.js` for why.
 */

export function createChatBar({ root, chat }) {
  if (!root) return { root: null, buttons: [] };

  const buttons = chat.PHRASES.map((phrase, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn phrase-btn';
    button.dataset.phrase = String(i);
    button.textContent = phrase;
    button.addEventListener('click', () => {
      chat.say(i);
      // Give the keyboard back to the world: a focused button eats the arrows.
      button.blur();
    });
    return button;
  });

  root.replaceChildren(...buttons);
  root.hidden = false;
  return { root, buttons };
}
