/**
 * The game loop (lesson A12).
 *
 * requestAnimationFrame asks the browser to call us back before the next repaint —
 * about 60 times a second on a normal screen, 144 on a fast one. So we cannot
 * count frames: we measure how many *seconds* passed and multiply movement by
 * that. Same speed on every machine.
 */

export function startLoop(handlers) {
  let previous = performance.now();
  let running = true;

  function frame(now) {
    if (!running) return;

    // Seconds since the last frame, clamped: after a tab has been hidden for a
    // minute we must not advance the world by a whole minute at once.
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
