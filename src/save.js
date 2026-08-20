/**
 * The save (lesson A11): WRITE it down, READ it back, COPE when what comes
 * back is old or broken.
 *
 * Everything we write is stamped with a version. When this game ships a new
 * shape of save, the number goes up and every older save is politely thrown
 * away instead of being half-understood. A save is also just text in someone
 * else's browser: it can be edited, truncated, or written by a different site
 * entirely. Every bad case ends the same way — start fresh, never crash.
 */

export const KEY = 'kakkoi-online';
export const VERSION = 1;

/**
 * Whether this person has read the card about other people, kept in its own key.
 *
 * It is deliberately NOT part of the character. "Start over" throws the whole
 * character away, and a child trying all six animals must not be handed the same
 * three paragraphs about safety six times — it is the same person, at the same
 * computer, who has already read them. What the card is about is the person, so
 * that is where it is stored.
 */
export const SAFETY_KEY = 'kakkoi-online-safety';

/**
 * Which instructions this person no longer needs, kept in its own key for
 * exactly the same reason as the safety card: knowing how to walk, and knowing
 * how to pick a fight, are facts about the person at the keyboard. Starting a
 * new character must not re-teach somebody who already knows.
 *
 * Two independent facts — `move` and `challenge` — because they are learned at
 * different moments: somebody can wander around the whole map without ever
 * challenging anyone, and they should still be told how to do the half they
 * have not done.
 */
export const LEARNED_KEY = 'kakkoi-online-learned';

/**
 * Duels won, chests opened, and what is being worn — in its own key, for the
 * third time and the same reason. A hundred duels is a fact about the person at
 * the keyboard; "Start over" asks for a new name and a new animal and must not
 * take the hundred duels with them.
 *
 * There is nothing to stop anybody editing this. There is no server to check it
 * against, so a win is a claim — see the note at the top of `src/wins.js`.
 */
export const TROPHY_KEY = 'kakkoi-online-trophies';

function fresh() { return null; }

/** Read the save. Returns null when there is nothing usable. */
export function loadSave() {
  let text;
  try {
    text = localStorage.getItem(KEY);
  } catch (err) {
    console.warn('save: localStorage is not available —', err.message);
    return fresh();
  }
  if (text === null) return fresh();

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.warn('save: not readable JSON, starting fresh —', err.message);
    return fresh();
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    console.warn('save: not an object, starting fresh');
    return fresh();
  }
  if (data.version !== VERSION) {
    console.warn(`save: version ${data.version}, we speak ${VERSION} — starting fresh`);
    return fresh();
  }
  if (typeof data.x !== 'number' || typeof data.y !== 'number' ||
      !Number.isFinite(data.x) || !Number.isFinite(data.y)) {
    console.warn('save: no usable position, starting fresh');
    return fresh();
  }
  if (typeof data.monster !== 'number' || !Number.isInteger(data.monster)) {
    console.warn('save: no usable monster, starting fresh');
    return fresh();
  }

  return {
    version: VERSION,
    id: typeof data.id === 'string' ? data.id : '',
    name: String(data.name ?? '').slice(0, 12),
    monster: data.monster,
    x: data.x,
    y: data.y,
    // Stage 2 added this one. A field that can be missing does not need a new
    // version number: an old save simply has not seen the card yet, which is
    // exactly what `false` means. The version goes up when a field changes
    // meaning, not when one appears.
    safety: data.safety === true,
  };
}

/** Write the save. Quota errors are not worth crashing a game over. */
export function writeSave(state) {
  const data = {
    version: VERSION,
    id: state.id,
    name: state.name,
    monster: state.monster,
    x: Math.round(state.x),
    y: Math.round(state.y),
    safety: state.safety === true,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    if (data.safety) writeSafetySeen(true);
    return true;
  } catch (err) {
    console.warn('save: could not write —', err.message);
    return false;
  }
}

/** Has this person read the card about other people? Survives "Start over". */
export function loadSafetySeen() {
  try { return localStorage.getItem(SAFETY_KEY) === '1'; } catch { return false; }
}

export function writeSafetySeen(seen) {
  try { localStorage.setItem(SAFETY_KEY, seen ? '1' : '0'); return true; }
  catch { return false; }
}

/**
 * Which hints have been learned. Anything unreadable means "learned nothing",
 * which only costs somebody one more sight of a line they can already ignore.
 */
export function loadLearned() {
  try {
    const data = JSON.parse(localStorage.getItem(LEARNED_KEY) || '{}');
    return { move: data.move === true, challenge: data.challenge === true };
  } catch {
    return { move: false, challenge: false };
  }
}

export function writeLearned(learned) {
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify({
      move: learned.move === true,
      challenge: learned.challenge === true,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * What has been won. Anything unreadable means "nothing yet", which costs
 * somebody their chests and is still better than refusing to start.
 */
export function loadTrophies() {
  try {
    const data = JSON.parse(localStorage.getItem(TROPHY_KEY) || '{}');
    const wins = Number(data.wins);
    return {
      wins: Number.isInteger(wins) && wins >= 0 ? wins : 0,
      unlocked: Array.isArray(data.unlocked) ? data.unlocked.filter(Number.isInteger) : [],
      wearing: Number.isInteger(data.wearing) ? data.wearing : 0,
    };
  } catch {
    return { wins: 0, unlocked: [], wearing: 0 };
  }
}

export function writeTrophies(trophies) {
  try {
    localStorage.setItem(TROPHY_KEY, JSON.stringify({
      wins: trophies.wins,
      unlocked: trophies.unlocked,
      wearing: trophies.wearing,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * What Aniki has taken this hour, and whether he fell.
 *
 * His wounds last the hour, so a reload in the middle of a fight must not hand
 * him his lives back — and the hour it belongs to is stored with it, because an
 * hour later it is a different Aniki and none of it counts.
 */
export const BOSS_KEY = 'kakkoi-online-boss';

export function loadBoss() {
  try {
    const data = JSON.parse(localStorage.getItem(BOSS_KEY) || '{}');
    return {
      hour: Number.isInteger(data.hour) ? data.hour : -1,
      hits: Number.isInteger(data.hits) && data.hits >= 0 ? data.hits : 0,
      felled: data.felled === true,
      ours: data.ours === true,
    };
  } catch {
    return { hour: -1, hits: 0, felled: false, ours: false };
  }
}

export function writeBoss(state) {
  try {
    localStorage.setItem(BOSS_KEY, JSON.stringify({
      hour: state.hour, hits: state.hits, felled: state.felled === true, ours: state.ours === true,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Throw the character away. The safety, learned and trophy keys are left alone
 * on purpose — see the notes on them above.
 */
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing we can do */ }
}
