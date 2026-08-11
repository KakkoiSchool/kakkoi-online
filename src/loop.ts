/**
 * Fixed-timestep game loop (lesson A12).
 *
 * The simulation always advances in equal slices (1/60 s). Rendering happens as
 * often as the browser allows. This is why a slow computer runs the same game as
 * a fast one, just with fewer drawn frames.
 */

const STEP = 1 / 60;         // seconds per simulation step
const MAX_CATCHUP = 0.25;    // never simulate more than 0.25 s in one frame

export interface LoopHandlers {
  /** Advance the world by exactly `dt` seconds. Always the same `dt`. */
  update(dt: number): void;
  /** Draw the current state. */
  render(): void;
}

export function startLoop(handlers: LoopHandlers): () => void {
  let previous = performance.now();
  let accumulator = 0;
  let running = true;

  function frame(now: number): void {
    if (!running) return;

    // Elapsed real time, clamped: after a tab has been hidden for a minute we
    // must not try to simulate that whole minute at once.
    const elapsed = Math.min((now - previous) / 1000, MAX_CATCHUP);
    previous = now;
    accumulator += elapsed;

    while (accumulator >= STEP) {
      handlers.update(STEP);
      accumulator -= STEP;
    }

    handlers.render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return () => { running = false; };
}
