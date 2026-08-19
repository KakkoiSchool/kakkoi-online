/**
 * The game loop (lesson A12).
 *
 * requestAnimationFrame asks the browser to call us back before the next repaint —
 * about 60 times a second on a normal screen, 144 on a fast one. So we cannot
 * count frames: we measure how many *seconds* passed and multiply movement by
 * that. Same speed on every machine.
 */

// A top-down pixel game at 30 fps looks the same as one at 60 or 120: nothing
// in it moves fast enough for the missing frames to read as stutter. Left
// alone, rAF runs at whatever the screen refreshes at (ISSUES.md #1: 120 on a
// fast phone), so this loop was doing update+render up to four times as often
// as this budget needs, for a picture nobody could tell apart from the capped
// one. That is where the phone heat was going.
const FRAME_BUDGET_MS = 1000 / 30;

export function startLoop(handlers) {
  let previous = performance.now();
  let running = true;

  function frame(now) {
    if (!running) return;

    // Not our turn yet: ask for the next repaint and do nothing else.
    // `previous` only advances on a frame that actually ran, so skipping some
    // rAF calls here cannot drift the clock; it just waits until one lands
    // roughly 33ms after the last one that did real work.
    if (now - previous < FRAME_BUDGET_MS) {
      requestAnimationFrame(frame);
      return;
    }

    // Seconds since the last RENDERED frame, clamped: after a tab has been
    // hidden for a minute we must not advance the world by a whole minute at
    // once.
    const dt = Math.min((now - previous) / 1000, 0.25);
    previous = now;

    handlers.update(dt);
    handlers.render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    /** Stop for good. */
    stop() { running = false; },
    /** Stop asking for frames while the tab is hidden. */
    pause() { running = false; },
    /** Start again, without advancing the world by however long we were away. */
    resume() {
      if (running) return;
      running = true;
      previous = performance.now();
      requestAnimationFrame(frame);
    },
  };
}
