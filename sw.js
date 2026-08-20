/**
 * The service worker: the game opens with no network at all.
 *
 * This is the only file in the repo that is NOT an ES module and NOT loaded by
 * `index.html`. The browser runs it beside the page, and from then on every
 * request the page makes goes past `fetch` below first.
 *
 * Three rules, and they are the whole file:
 *
 *   1. PRECACHE. On install, fetch the real file list — every file the game
 *      actually loads — and put it in a cache. It is written out by hand rather
 *      than crawled, because there is no build step here to crawl with, and a
 *      list you can read is a list you can check.
 *   2. CACHE FIRST, for exactly those files. They are the game; they only change
 *      when the game is redeployed, and a cache hit is why it opens offline.
 *      Anything else — the relays, anything a fork adds — goes straight to the
 *      network and is never cached, so nothing is ever served stale by accident.
 *   3. ONE CACHE, VERSIONED. `CACHE` has a version in its name and `activate`
 *      deletes every other cache this origin has. **Bump `CACHE` on every
 *      deploy that changes any file below.** A worker that keeps serving an old
 *      cache is how a PWA becomes unfixable: the fix ships, and nobody ever
 *      receives it, because the stale copy is what answers.
 *
 * What still needs the network: finding other players. Trystero's relays are
 * WebSockets to other origins, which never come near this file. Offline you get
 * the world, your saved character and Flint, and nobody else.
 *
 * This never touches `localStorage`. Saved characters are not ours to clear.
 */

const CACHE = 'kakkoi-online-v18';

/**
 * Every file the game loads, by hand. `./` and `./index.html` are both here on
 * purpose: they are two different cache keys and a home-screen launch asks for
 * the first one.
 */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',

  './src/ui/game.css',

  // The two families game.css asks for, vendored. A webfont fetched from a CDN
  // is a webfont that is missing on a plane, and this file exists so that the
  // game opens on a plane.
  './vendor/fonts/dotgothic16-latin.woff2',
  './vendor/fonts/space-grotesk-latin.woff2',

  './src/main.js',
  './src/loop.js',
  './src/input.js',
  './src/sprites.js',
  './src/world.js',
  './src/render.js',
  './src/save.js',
  './src/identity.js',
  './src/session.js',
  './src/net.js',
  './src/chat.js',
  './src/duel.js',
  './src/npc.js',
  './src/spectate.js',
  './src/looks.js',
  './src/wins.js',
  './src/boss.js',
  './src/audio.js',
  './src/battle/rules.js',
  './src/ui/onboarding.js',
  './src/ui/chatbar.js',
  './src/ui/duel-screen.js',
  './src/ui/paused.js',
  './src/ui/settings.js',
  './src/ui/help.js',
  './src/map-check.js',
  './src/tiles.js',
  './src/ui/scale.js',
  './src/ui/glyphs.js',
  './src/ui/bubbles.js',
  './src/ui/chest.js',
  './src/ui/boss-screen.js',

  // The map maker. It is not the game, and it is cached anyway: a map is made
  // with a tile sheet and a flood fill, neither of which needs a network, and
  // the one thing that does — proposing it on GitHub — says so for itself when
  // there is nothing to reach. `./editor/` and `./editor/index.html` are both
  // here for the same reason `./` and `./index.html` are: two cache keys, and a
  // link to a folder asks for the first one.
  './editor/',
  './editor/index.html',
  './editor/editor.css',
  './editor/main.js',
  './editor/submit.js',

  // trystero, and only the files it actually pulls in.
  './vendor/trystero/nostr.js',
  './vendor/trystero/node-crypto.js',
  './vendor/trystero/node-chunk.js',
  './vendor/trystero/src/strategy.js',
  './vendor/trystero/src/utils.js',
  './vendor/trystero/src/crypto.js',

  // The two atlases the game draws with. The other two sheets in vendor/ belong
  // to the demos and are deliberately not here.
  './vendor/kenney/tiny-dungeon.png',
  './vendor/opengameart/tiny-creatures.png',

  './data/maps/town.json',
  './data/monsters.json',
  './data/cosmetics.json',
  './data/tuning.json',

  // The six effects and the loop, exactly as src/audio.js names them.
  './audio/step-soft.wav',
  './audio/ping.wav',
  './audio/strike.wav',
  './audio/block.wav',
  './audio/charge.wav',
  './audio/win.wav',
  './audio/music-loop.mp3',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  // The tab icon, all three of it: without these an offline load has no icon.
  './icons/favicon.svg',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
];

/** The precache list as absolute URLs, for matching an incoming request against. */
const shellUrls = new Set(SHELL.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener('install', (event) => {
  // One file that 404s must not take the whole install down and leave the game
  // with no cache at all, so each is added on its own and a miss is only warned
  // about. `cache: 'reload'` skips the HTTP cache: precaching yesterday's copy
  // of a file we are installing today is the bug this whole file exists to
  // avoid.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (path) => {
      try {
        await cache.add(new Request(path, { cache: 'reload' }));
      } catch (err) {
        console.warn(`sw: could not precache ${path} — ${err.message}`);
      }
    }));
    // Take over as soon as this worker is ready rather than waiting for every
    // tab to close. Paired with clients.claim() below, a deploy reaches players
    // on their next reload instead of their next browser restart.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    // Everything that is not the current version goes. Without this the old
    // cache survives every deploy, and the stale copy is what answers.
    await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // A home-screen launch asks for `start_url`, which is the scope root; a reload
  // asks for `./index.html`. Both mean "the game", and both are answered with
  // the cached shell.
  //
  // ONLY those two. An earlier version answered EVERY navigation with the shell,
  // on the reasoning that offline there is nothing else to answer with — and
  // promptly served the game in place of `tests/rules.test.html`. The scope is
  // the whole origin, so "every navigation" is every other page in the repo and
  // every page a fork adds. Everything else falls through to the network and
  // fails on its own honest terms.
  const root = new URL('./', self.registration.scope).href;
  const shell = new URL('./index.html', self.registration.scope).href;
  const wanted = request.mode === 'navigate' && (url.href === root || url.href === shell)
    ? shell
    : url.href;

  if (!shellUrls.has(wanted)) return;   // not ours: the network can have it

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(wanted);
    if (hit) return hit;
    // Not in the cache — a file added since this worker installed, say. Fetch
    // it and keep it, so the next time offline it is there.
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(wanted, fresh.clone());
    return fresh;
  })());
});
