/**
 * The line that says what to do — in the words that match the device, and only
 * for as long as it is needed.
 *
 * It used to say *"Arrow keys or WASD to walk… F challenges whoever you are
 * standing next to"* on every device, including a phone, which has none of those
 * things. Naming a key that is not there is worse than saying nothing: a child
 * reads it, looks for the key, and decides the game is broken.
 *
 * **What device is this?** Asked as a capability and then corrected by what
 * actually happens. `(pointer: coarse)` and `(hover: none)` are the first guess;
 * the first `keydown` says keyboard and the first touch `pointerdown` says touch,
 * whichever comes later wins. Hybrids are real — a tablet with a keyboard, a
 * laptop with a touchscreen — and neither a user-agent string nor a width
 * breakpoint gets them right. A narrow window on a desktop is still a desktop.
 *
 * **Two hints, dismissed separately.** How to walk and how to pick a fight are
 * learned at different moments. Walking a few tiles retires the movement line and
 * nothing else; starting a challenge retires the challenge line and nothing else.
 * Somebody who has explored the whole map without ever challenging anyone still
 * sees the half they have not used.
 *
 * **And it is remembered**, in its own `localStorage` key beside the safety card,
 * because knowing how to walk is a fact about the person and not about the
 * character they are currently playing.
 */
import { loadLearned, writeLearned } from '../save.js';

/**
 * How far counts as "they can walk", in tiles. Three is far enough to be a
 * deliberate journey across a room and not a frame of drift or an accidental
 * tap, and short enough that the line is gone before it is in the way.
 */
export const LEARNED_TILES = 3;

const WORDS = {
  keyboard: {
    move: 'Arrow keys or WASD to walk.',
    challenge: 'F challenges whoever you are standing next to.',
  },
  touch: {
    move: 'Touch the floor to walk.',
    challenge: 'Walk up to somebody and tap Challenge.',
  },
};

export function createHelp({ root, world }) {
  if (!root) return { update() {}, challenged() {}, get learned() { return null; } };

  const tileSize = world?.tile || 32;
  const enough = LEARNED_TILES * tileSize;

  // What we knew about this person before today.
  const learned = loadLearned();

  let mode = matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches
    ? 'touch'
    : 'keyboard';

  const move = span();
  const challenge = span();
  root.append(move, challenge);

  function draw() {
    move.textContent = WORDS[mode].move;
    challenge.textContent = WORDS[mode].challenge;
    move.hidden = learned.move;
    challenge.hidden = learned.challenge;
    // Faded, not removed: it is out of flow either way, so nothing on the screen
    // moves — but a line that dissolves is kinder than one that blinks out.
    root.classList.toggle('is-gone', learned.move && learned.challenge);
  }

  /** The device told us what it really is. Say the same thing in its words. */
  function setMode(next) {
    if (mode === next) return;
    mode = next;
    draw();
  }

  addEventListener('keydown', (e) => {
    // A keyboard shortcut from a phone's on-screen keyboard is not walking, but
    // there is no text input in this game at all, so any key here is a real one.
    if (!e.isTrusted) return;
    setMode('keyboard');
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    if (e.isTrusted && e.pointerType === 'touch') setMode('touch');
  }, { passive: true });

  let walked = 0;

  function remember() { writeLearned(learned); draw(); }

  draw();

  return {
    /** Called every frame with how far the player actually moved, in pixels. */
    update(distance) {
      if (learned.move || !(distance > 0)) return;
      walked += distance;
      if (walked < enough) return;
      learned.move = true;
      remember();
    },

    /** Called when a challenge is actually started, by key or by button. */
    challenged() {
      if (learned.challenge) return;
      learned.challenge = true;
      remember();
    },

    /**
     * The same two sentences, for whoever else needs them in this device's
     * words — the "How to play" card in the ⚙ menu is the one that does.
     */
    get words() { return { ...WORDS[mode] }; },

    /** For checking from the console. */
    get learned() { return { ...learned, mode, walked: Math.round(walked), enough }; },
  };
}

function span() {
  const node = document.createElement('span');
  node.className = 'help-line';
  return node;
}
