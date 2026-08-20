/**
 * The game loop (lesson A12).
 *
 * requestAnimationFrame asks the browser to call us back before the next repaint —
 * about 60 times a second on a normal screen, 144 on a fast one. So we cannot
 * count frames: we measure how many *seconds* passed and multiply movement by
 * that. Same speed on every machine.
 *
 * **A loop made of one callback at a time is a loop that can be lost.** Each
 * frame asks for the next one, so the chain has exactly one link in flight, and
 * anything that breaks that link stops the game dead while leaving the last
 * picture on the screen — which looks exactly like a game that has crashed, and
 * can only be fixed by reloading the page. Two things break it, and both of them
 * happen to a phone that has been locked and unlocked:
 *
 *   1. **A frame that throws.** The old code asked for the next frame on the
 *      line *after* `update()` and `render()`, so one exception anywhere in the
 *      game — a save to a full disk, a sound in a state the browser did not
 *      like — ended the loop for good. Now the ask happens whatever the frame
 *      did, and the error is reported once rather than thirty times a second.
 *      This is the rule `audio.js` already follows for a refused sound: write it
 *      down, and never break the frame it happened in.
 *   2. **A frame the browser threw away.** A phone freezes a page it has put
 *      away, and a frozen page's pending callback does not survive. When the
 *      page comes back, `resume()` must be able to ask again — so it no longer
 *      returns early on the belief that the loop is already running, because
 *      that belief is exactly what is wrong.
 *
 * And because the event that says "you are back" is not something to bet on —
 * every browser and phone has its own opinion about which of `visibilitychange`,
 * `pageshow`, `focus` and the lifecycle `resume` to send, and in what order —
 * there is a watchdog below that checks the one thing that actually matters: a
 * visible game should be drawing. If it is not, it asks for a frame. That is
 * what makes this survive a lock and unlock even when no event arrives at all.
 */

// A top-down pixel game at 30 fps looks the same as one at 60 or 120: nothing
// in it moves fast enough for the missing frames to read as stutter. Left
// alone, rAF runs at whatever the screen refreshes at (ISSUES.md #1: 120 on a
// fast phone), so this loop was doing update+render up to four times as often
// as this budget needs, for a picture nobody could tell apart from the capped
// one. That is where the phone heat was going.
const FRAME_BUDGET_MS = 1000 / 30;

/** How long a visible game may go without drawing before we assume it is stuck. */
const STALL_MS = 1000;

/** How often to check that. Rare on purpose: this is a smoke alarm, not a clock. */
const WATCH_MS = 2000;

export function startLoop(handlers) {
  let previous = performance.now();
  let running = true;
  /** Set by `stop()` only: a window that has handed the game over stays stopped. */
  let stopped = false;
  let handle = 0;
  let lastFrame = performance.now();
  let faults = 0;

  /**
   * Ask for the next frame, cancelling anything already asked for.
   *
   * The cancel is what makes this safe to call from anywhere: waking up twice
   * cannot leave two loops running at double speed, and a frame the browser has
   * quietly dropped can simply be asked for again.
   */
  function schedule() {
    cancelAnimationFrame(handle);
    handle = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!running) return;

    // Not our turn yet: ask for the next repaint and do nothing else.
    // `previous` only advances on a frame that actually ran, so skipping some
    // rAF calls here cannot drift the clock; it just waits until one lands
    // roughly 33ms after the last one that did real work.
    if (now - previous < FRAME_BUDGET_MS) {
      schedule();
      return;
    }

    // Seconds since the last RENDERED frame, clamped: after a tab has been
    // hidden for a minute we must not advance the world by a whole minute at
    // once.
    const dt = Math.min((now - previous) / 1000, 0.25);
    previous = now;
    lastFrame = now;

    try {
      handlers.update(dt);
      handlers.render();
    } catch (err) {
      faults++;
      // Once. A frame that throws usually throws again on the next one, and a
      // console filling up at thirty lines a second hides the first line, which
      // is the one that says what went wrong.
      if (faults === 1) console.error('loop: a frame threw and was skipped —', err);
    }

    schedule();
  }

  /**
   * A visible game that is not stopped should be drawing. If it is not, the link
   * has been lost — the page was frozen and thawed, or the browser never sent
   * the event that says we are back — and all that is needed is to ask again.
   *
   * A timer is the right instrument for this precisely because it is not the one
   * that is broken: `setInterval` keeps arriving when `requestAnimationFrame`
   * has stopped. While the page is hidden this returns on its first line, and
   * the browser has throttled the timer to about once a minute anyway.
   */
  function check() {
    if (stopped || document.hidden) return;
    if (running && performance.now() - lastFrame < STALL_MS) return;
    running = true;
    previous = performance.now();
    lastFrame = previous;
    schedule();
  }

  const watchdog = setInterval(check, WATCH_MS);

  schedule();

  return {
    /** Stop for good: this window has handed the game to another one. */
    stop() {
      stopped = true;
      running = false;
      cancelAnimationFrame(handle);
      clearInterval(watchdog);
    },
    /** Stop asking for frames while the tab is hidden. */
    pause() {
      running = false;
      cancelAnimationFrame(handle);
    },
    /**
     * Start again, without advancing the world by however long we were away.
     *
     * Safe to call when we are already running, and deliberately does its work
     * anyway: after a freeze the loop believes it is running and is not.
     */
    resume() {
      if (stopped) return;
      running = true;
      previous = performance.now();
      lastFrame = previous;
      schedule();
    },
    /** For checking from the console. */
    get running() { return running; },
    get faults() { return faults; },
    get lastFrame() { return lastFrame; },
  };
}
