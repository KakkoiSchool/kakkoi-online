/**
 * Which copy of the game is this, really?
 *
 * Registering the service worker used to be three lines of inline script at the
 * bottom of `index.html`, with a comment saying it did not deserve a module.
 * That was true when all it did was register. It is not true now, and the reason
 * is ISSUES.md.
 *
 * Two of the three open issues in that file are made harder by the same thing:
 * **a device can be running a build that is months old and look exactly like one
 * that is current.** The service worker answers from its cache, so the game
 * starts, the world appears, everything works — with the old relay list, the old
 * position code, the old everything. Issue #2 (two devices cannot see each
 * other) lists a stale worker as its strongest candidate and says, in bold, to
 * confirm the cache version on both devices before testing. Issue #3 is about
 * the caches themselves. Neither can be settled by looking at the game, and both
 * were being investigated on phones, where there is no console to look in.
 *
 * So this module asks the question out loud. `describe()` talks to the worker
 * that is genuinely serving this page and reports what IT says its version is —
 * not what this copy of the source hopes. `src/main.js` prints the answer in the
 * settings panel, next to the peer id and the relay count, which is the rest of
 * what issue #2 needs somebody to be able to read off a phone.
 *
 * Nothing here is allowed to stop the game. A service worker is an improvement
 * to something that already works: every call below can fail, time out, or find
 * no worker at all, and the answer for all of those is a sentence saying so.
 */

/** How long to wait for the worker to answer before giving up on it. */
const REPLY_MS = 1500;

/**
 * The page is over http, or in a browser with no service workers, or in a
 * private window that pretends there are none. All three are the same thing
 * here: no cache, no version, nothing to report.
 */
function unavailable(why) {
  return { supported: false, controlled: false, version: null, leftovers: [], receipt: null, why };
}

export function createBuild() {
  const secure = location.protocol === 'https:' ||
                 location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const supported = 'serviceWorker' in navigator && secure;

  /** Whether this page was already being served by a worker when it loaded. */
  const wasControlled = supported && Boolean(navigator.serviceWorker.controller);
  const updateHandlers = [];

  if (supported) {
    // A new worker calls `skipWaiting()` and `clients.claim()`, so it can take
    // this page over WHILE IT IS RUNNING — and the modules already loaded came
    // from the old cache. That is a page running two builds at once, which is a
    // fine way to spend an afternoon wondering why a fix did not work.
    //
    // Reloading here would be wrong: it would happen mid-duel, mid-raid, and
    // without asking. So we say it, once, and let the player choose their
    // moment. `wasControlled` is what tells a real update from the very first
    // registration, which claims an uncontrolled page and is not news.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!wasControlled) return;
      for (const fn of updateHandlers) fn();
    });
  }

  return {
    supported,

    /**
     * Register the worker. Deliberately called after `load`, and deliberately
     * wrapped: nothing about caching is allowed to stop the game starting.
     */
    register() {
      if (!supported) return;
      addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('sw: not registered —', err.message);
        });
      });
    },

    /** A newer worker has taken this page over; what is on screen is the old build. */
    onUpdate(fn) { updateHandlers.push(fn); },

    /**
     * Ask the worker which build it is. Never rejects.
     *
     * The reply comes from the worker, not from this file, which is the whole
     * point: this file is part of the new build by definition — it was loaded
     * by it — and the question is what the CACHE is serving.
     */
    async describe() {
      if (!supported) {
        return unavailable(secure ? 'this browser has no service workers' : 'not over https');
      }

      // What is on disk, which we can read without the worker's help — and which
      // is the only answer available when nothing is controlling the page yet.
      let leftovers = [];
      try {
        const names = await caches.keys();
        leftovers = names.filter((name) => name.startsWith('kakkoi-online-'));
      } catch (err) {
        console.warn('build: could not list the caches —', err.message);
      }

      const worker = navigator.serviceWorker.controller;
      if (!worker) {
        return {
          supported: true, controlled: false, version: null, receipt: null,
          leftovers,
          why: 'no worker is serving this page yet — reload once',
        };
      }

      const answer = await ask(worker);
      if (!answer) {
        return {
          supported: true, controlled: true, version: null, receipt: null, leftovers,
          why: 'the worker did not answer',
        };
      }

      return {
        supported: true,
        controlled: true,
        version: answer.version,
        receipt: answer.receipt || null,
        // The worker's own list is the better one: it was taken inside the
        // worker, after any sweep it has done.
        leftovers: Array.isArray(answer.leftovers) ? answer.leftovers : leftovers,
        why: '',
      };
    },
  };
}

/**
 * One question, one answer, and a time limit.
 *
 * A worker that has been stopped by the browser is started again by the message
 * — usually. "Usually" is why there is a timeout: a panel that waits forever for
 * a reply is a panel that never opens.
 */
function ask(worker) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      navigator.serviceWorker.removeEventListener('message', hear);
      resolve(value);
    };
    const hear = (event) => {
      if (event.data?.kakkoi === 'build') finish(event.data);
    };
    navigator.serviceWorker.addEventListener('message', hear);
    setTimeout(() => finish(null), REPLY_MS);
    try {
      worker.postMessage({ kakkoi: 'build' });
    } catch (err) {
      console.warn('build: could not ask the worker —', err.message);
      finish(null);
    }
  });
}

/**
 * The build line, as a sentence a twelve-year-old can read off a phone and a
 * grown-up can act on.
 *
 * It is written here rather than in `main.js` because the wording IS the
 * feature: the whole point is that somebody on the other end of a phone call
 * can say what it says, and the two of you can tell whether you are on the same
 * build without either of you owning a laptop.
 */
export function buildWords(state) {
  if (!state.supported) return `Offline copy: none — ${state.why}.`;
  if (!state.version) return `Offline copy: ${state.why}.`;

  const parts = [`Offline copy: ${state.version}`];
  const missing = state.receipt?.missing?.length || 0;
  if (missing) parts.push(`${missing} of ${state.receipt.files} files missing`);
  // Anything of ours besides the live one. One extra is what an install that has
  // not finished looks like, and it goes away by itself; several is worth
  // knowing about. See ISSUES.md #3.
  const stale = state.leftovers.filter((name) => name !== state.version);
  if (stale.length) parts.push(`${stale.length} old ${stale.length === 1 ? 'cache' : 'caches'} still on disk`);
  return `${parts.join(' · ')}.`;
}
