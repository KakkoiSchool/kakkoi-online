/**
 * The card an old window shows after a newer one has taken the game.
 *
 * Nothing has gone wrong, and the wording has to make that obvious to a
 * twelve-year-old who is about to think they broke it: it says what happened,
 * where their monster went, and how to bring it back here. No red, no warning
 * triangle, no error code — the same voice as the safety card.
 */

export function createPausedCard({ root, onResume }) {
  if (!root) return { show() {}, hide() {} };

  const card = document.createElement('section');
  card.className = 'card paused-card';
  card.setAttribute('role', 'status');

  const title = document.createElement('h2');
  title.className = 'paused-title';
  title.textContent = 'This window is paused';

  const body = document.createElement('p');
  body.className = 'paused-body';
  body.textContent = 'You opened Kakkoi Online in another window, so your monster ' +
                     'is playing over there now. Nothing is lost — everything you did ' +
                     'came with it.';

  const button = document.createElement('button');
  button.className = 'btn paused-resume';
  button.type = 'button';
  button.textContent = 'Play here instead';
  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Bringing it back…';
    onResume?.();
  });

  card.append(title, body, button);

  return {
    show() {
      button.disabled = false;
      button.textContent = 'Play here instead';
      root.replaceChildren(card);
      root.hidden = false;
      button.focus();
    },
    hide() {
      root.hidden = true;
      root.replaceChildren();
    },
    get button() { return button; },
  };
}
