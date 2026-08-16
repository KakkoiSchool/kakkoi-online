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
    return true;
  } catch (err) {
    console.warn('save: could not write —', err.message);
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing we can do */ }
}
