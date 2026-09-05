/**
 * Settings: one control, and a small panel behind it.
 *
 * There used to be four bare text toggles sitting in a row under the world —
 * `Sound: off`, `Music: off`, `Start over`, `Learn to build this` — which is
 * four decisions asked of a player who has not started playing yet, and it made
 * the page look unfinished. They are all still here; they are just behind a ⚙
 * in the corner, where a thing you touch twice a year belongs.
 *
 * This module owns nothing but the opening and the closing. The buttons inside
 * the panel are wired where they always were, in `src/main.js`, because what
 * they do is the game's business and not this file's.
 *
 * The panel is positioned out of flow over the canvas, like everything else on
 * this screen: opening it must not move the world by a pixel.
 */

/**
 * `onOpen` is called every time the panel is opened, and exists for one row in
 * it: the build line, which reports which cached copy of the game is answering
 * and how many relays are up. Both of those are true only at the moment they
 * are read, so they are read when somebody looks — not once at boot, when the
 * relays have not connected yet and the answer would be a confident lie.
 */
export function createSettings({ button, panel, install, onOpen = () => {} }) {
  if (!button || !panel) return { open: () => {}, close: () => {}, get isOpen() { return false; } };

  wireInstall(install);

  const isOpen = () => !panel.hidden;

  function open() {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    // Whatever this asks for, it must not be able to stop the panel opening.
    try { onOpen(); } catch (err) { console.warn('settings: onOpen threw —', err.message); }
  }

  function close() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation();          // the document listener below would undo it
    if (isOpen()) close(); else open();
    button.blur();                // give the arrows back to the world
  });

  // Anywhere else closes it — including the canvas, so a tap meant for the floor
  // puts the panel away instead of being eaten by it.
  document.addEventListener('pointerdown', (e) => {
    if (!isOpen()) return;
    if (panel.contains(e.target)) return;
    close();
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { close(); button.focus(); }
  });

  return { open, close, get isOpen() { return isOpen(); } };
}

/**
 * "Install", but only when there is really something to install.
 *
 * Browsers hide their own install affordance three menus deep, so for most
 * people this is the only place they will find it — and the game only just
 * became installable. But an install prompt is not ours to invent: Chrome hands
 * one over in `beforeinstallprompt` when it decides the site qualifies, and
 * nothing else can start one. Firefox and iOS Safari never fire it at all.
 *
 * So the button starts hidden and is only shown once we are actually holding a
 * prompt, and it goes again the moment the game is installed or the prompt is
 * used — a button that cannot do the thing it names is worse than no button.
 */
function wireInstall(button) {
  if (!button) return;

  let prompt = null;

  const hide = () => { button.hidden = true; prompt = null; };

  // Already running as an installed app: there is nothing left to offer.
  if (matchMedia('(display-mode: standalone)').matches) return hide();

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // keep it, rather than letting the browser
    prompt = e;                  // show its own bar at its own moment
    button.hidden = false;
  });

  addEventListener('appinstalled', hide);

  button.addEventListener('click', async () => {
    if (!prompt) return hide();
    const held = prompt;
    hide();                      // a prompt may only be used once, ever
    try {
      await held.prompt();
    } catch (err) {
      console.warn('install: the browser refused the prompt —', err.message);
    }
  });
}
