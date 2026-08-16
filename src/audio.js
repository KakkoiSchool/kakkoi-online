/**
 * Sound (lesson A17). Three rules, and they are the whole file.
 *
 * 1. **OFF by default.** Ten unmuted laptops in one classroom is miserable, and
 *    somebody may be listening to something else. There is one obvious button
 *    for effects and one for music, and until the first is pressed this game is
 *    completely silent.
 *
 * 2. **A browser refuses to play before you have touched the page.** That is a
 *    rule, not a bug: a page may not make noise you did not ask for. So every
 *    `play()` in here ends in a `.catch` — a refused sound records itself and is
 *    forgotten, and never breaks the frame it happened in.
 *
 * 3. **Small.** Six short effects and one music loop, plain `Audio` elements.
 *    No Web Audio graph, no library, no synthesis. The music is 637 kB and is
 *    only fetched if somebody actually asks for music.
 */

const SFX = {
  step: './audio/step.wav',
  ping: './audio/ping.wav',
  win: './audio/strike.wav',        // you took the round
  lose: './audio/block.wav',        // they took the round
  draw: './audio/charge.wav',       // nobody did
  match: './audio/win.wav',         // the whole duel
};

const MUSIC = './audio/music-loop.mp3';

export function createAudio({ tuning = {} } = {}) {
  const stepEvery = num(tuning.stepEveryPx, 26);
  const sfxVolume = clamp01(num(tuning.sfxVolume, 0.6));
  const musicVolume = clamp01(num(tuning.musicVolume, 0.35));

  let on = false;
  let music = null;
  let wantMusic = false;
  let walked = 0;

  const state = {
    /** What the browser said the first time we asked to play with nothing clicked. */
    firstPlayError: null,
    lastError: null,
  };

  const clips = new Map();

  function clip(name) {
    if (clips.has(name)) return clips.get(name);
    const el = new Audio(SFX[name]);
    el.volume = sfxVolume;
    el.addEventListener('error', () => { state.lastError = `${name}: file did not load`; });
    clips.set(name, el);
    return el;
  }

  /** Every play in this file goes through here, and none of them can throw. */
  function start(el, label) {
    const played = el.play();
    if (played && typeof played.catch === 'function') {
      played.catch((err) => { state.lastError = `${label}: ${err.name}`; });
    }
  }

  /**
   * Ask to play before anybody has touched the page, and write down the refusal.
   * Silent either way: the volume is zero and it is stopped immediately. This is
   * here because "it was refused" is a thing worth being able to see, both in a
   * lesson and when a player says the sound is broken.
   */
  function probe() {
    const el = new Audio(SFX.ping);
    el.volume = 0;
    const played = el.play();
    if (!played || typeof played.then !== 'function') return;
    played.then(() => { el.pause(); state.firstPlayError = null; })
          .catch((err) => { state.firstPlayError = `${err.name}: ${err.message}`; });
  }

  function enable(next = !on) {
    on = !!next;
    if (!on) {
      if (music) music.pause();
      return on;
    }
    // The click that turned the sound on is the interaction the browser wanted,
    // so this is the moment to warm the short effects up.
    for (const name of Object.keys(SFX)) clip(name);
    if (wantMusic) playMusic(true);
    return on;
  }

  function playMusic(next = !wantMusic) {
    wantMusic = !!next;
    if (!wantMusic) { if (music) music.pause(); return false; }
    if (!on) { state.lastError = 'music: sound is off'; return false; }
    if (!music) {
      // 637 kB, fetched only when somebody actually asks for music.
      music = new Audio(MUSIC);
      music.loop = true;
      music.volume = musicVolume;
      music.addEventListener('error', () => { state.lastError = 'music: file did not load'; });
    }
    start(music, 'music');
    return true;
  }

  return {
    /** One-shot effect. Does nothing at all while the sound is off. */
    play(name) {
      if (!on || !SFX[name]) return false;
      const el = clip(name);
      el.currentTime = 0;             // an Audio already playing will not restart
      start(el, name);
      return true;
    },

    /** A footstep every `stepEveryPx` pixels walked. Called from the loop. */
    walk(distance) {
      if (!on || !(distance > 0)) { if (!(distance > 0)) walked = 0; return false; }
      walked += distance;
      if (walked < stepEvery) return false;
      walked = 0;
      return this.play('step');
    },

    probe,
    enable,
    toggle: () => enable(!on),
    music: playMusic,
    toggleMusic: () => playMusic(!wantMusic),

    get on() { return on; },
    get musicOn() { return wantMusic && !!music && !music.paused; },
    get musicWanted() { return wantMusic; },
    get firstPlayError() { return state.firstPlayError; },
    get lastError() { return state.lastError; },
    get loaded() { return [...clips.keys()]; },
  };
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }
