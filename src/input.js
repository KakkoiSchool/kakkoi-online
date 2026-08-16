/**
 * Input (lesson A10): what is the player asking for, right now?
 *
 * Two sources, one answer. Held keys are a Set, because keydown repeats and
 * keyup fires once. A finger, a mouse and a pen are all Pointer Events, so
 * there is no separate touch code and the game works on a phone.
 *
 * This module never moves anything. It reports; the game decides.
 */

const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);
const UP = new Set(['ArrowUp', 'w', 'W']);
const DOWN = new Set(['ArrowDown', 's', 'S']);
const STEERING = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

export function createInput(canvas) {
  const held = new Set();
  // Where a held pointer is, in canvas pixels (not page pixels).
  let pointer = null;

  // Typing your name is not steering. Anything aimed at a form control is
  // ignored, and losing the window clears every held key — otherwise you
  // tab away mid-walk and come back still walking.
  const isTyping = (target) =>
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

  const onKeyDown = (e) => {
    if (isTyping(e.target)) return;
    if (STEERING.has(e.key)) e.preventDefault();   // arrows scroll the page otherwise
    held.add(e.key);
  };
  const onKeyUp = (e) => held.delete(e.key);
  const onBlur = () => { held.clear(); pointer = null; };

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);

  // The event gives page coordinates and the canvas is stretched by CSS, so
  // scale by the ratio between the canvas's drawing size and its screen size.
  const at = (e) => {
    const box = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - box.left) * (canvas.width / box.width),
      y: (e.clientY - box.top) * (canvas.height / box.height),
    };
  };

  const onDown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointer = at(e);
    e.preventDefault();
  };
  const onMove = (e) => { if (pointer) pointer = at(e); };
  const onUp = () => { pointer = null; };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  return {
    /** -1, 0 or 1 on each axis from the keyboard. */
    get keys() {
      let dx = 0;
      let dy = 0;
      for (const key of held) {
        if (LEFT.has(key)) dx -= 1;
        if (RIGHT.has(key)) dx += 1;
        if (UP.has(key)) dy -= 1;
        if (DOWN.has(key)) dy += 1;
      }
      return { dx: Math.sign(dx), dy: Math.sign(dy) };
    },

    /** {x, y} in canvas pixels while a finger/mouse is held down, else null. */
    get pointer() { return pointer; },

    isHeld(key) { return held.has(key); },

    /** For tests: pretend a key is down/up without a real keyboard. */
    _press(key) { held.add(key); },
    _release(key) { held.delete(key); },
    _clear() { held.clear(); pointer = null; },

    dispose() {
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    },
  };
}
