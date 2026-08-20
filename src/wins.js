/**
 * Duels won, chests earned, and what you are wearing.
 *
 * **It is counted in your own browser, and that is the whole honest story.**
 * There is no server here, so there is nowhere else a win could be counted and
 * nobody who could check. A child who opens the console and writes 100 into
 * `localStorage` gets a crown. This is exactly the trade the game already takes
 * for positions and moves — see "No server means" in the README — and the
 * lesson is worth more than the crown: *what can and cannot be enforced without
 * a referee.* There is no checksum here, because a checksum in a file you can
 * read is a lock with the key taped to it, and pretending otherwise teaches
 * something false.
 *
 * **Wins against Flint count.** This game usually has one person in it. A
 * reward that needed other people would be locked for most players most of the
 * time, and Flint takes about a third of his rounds, so he is not a free chest.
 *
 * **Chests survive "Start over".** They live in their own key beside the safety
 * card and the hints — the facts about the *person*, not the character. Picking
 * a new name and a new animal should not take away the hundred duels you played.
 *
 * Nothing here draws anything: `looks.js` paints a look, `ui/chest.js` opens the
 * chest, and this file only knows how many and which.
 */
import { loadTrophies, writeTrophies } from './save.js';
import { BARE } from './looks.js';

export function createWins({ looks = [] } = {}) {
  const saved = loadTrophies();

  let count = saved.wins;
  /** Look ids this person has earned, in the order they earned them. */
  const unlocked = saved.unlocked.filter((id) => looks.some((look) => look.id === id));
  let wearing = looks.some((look) => look.id === saved.wearing) ? saved.wearing : BARE;

  /** Chests earned but not yet opened, oldest first. */
  const waiting = [];

  /**
   * A duel can report itself finished more than once — the screen stays up
   * after the last round, and every repaint is another view of the same ending.
   * This is how a win gets counted exactly once: the duel has to go back to
   * walking before another one can be recorded.
   */
  let counted = false;

  const changed = [];
  const emit = () => { for (const fn of changed) fn(); };

  function remember() {
    writeTrophies({ wins: count, unlocked, wearing });
  }

  /**
   * Anything this many wins has earned that is not already accounted for.
   *
   * "Accounted for" is two things, and forgetting the second one is a bug worth
   * keeping the note for: a look is only `unlocked` once its chest has been
   * OPENED, so checking that alone puts the same unopened chest back in the
   * queue on every win after the one that earned it. Six wins gave nine chests.
   */
  function earned() {
    return looks.filter((look) => Number.isInteger(look.wins) &&
                                  count >= look.wins &&
                                  !unlocked.includes(look.id) &&
                                  !waiting.includes(look));
  }

  /**
   * Called with every view the duel emits. It watches for one thing: the moment
   * a duel ends with us having won it.
   */
  function saw(view) {
    if (!view || view.state === 'walking') { counted = false; return false; }
    if (counted || view.phase !== 'over') return false;
    if (view.outcome?.how !== 'you') return false;

    counted = true;
    count += 1;
    for (const look of earned()) waiting.push(look);
    remember();
    emit();
    return true;
  }

  /**
   * Open the oldest chest that is waiting. Returns the look inside, or null
   * when there is nothing to open — opening is the only way a look is unlocked,
   * so the ceremony can never be skipped by accident.
   */
  function open() {
    const look = waiting.shift();
    if (!look) return null;
    if (!unlocked.includes(look.id)) unlocked.push(look.id);
    remember();
    emit();
    return look;
  }

  /**
   * Hand somebody a look for something that is not a duel — there is one, and it
   * is for standing up when Aniki fell. It arrives unlocked rather than in a
   * chest: the fight was the ceremony.
   *
   * Returns true only the first time, so whatever calls it can say so.
   */
  function award(id) {
    const look = looks.find((l) => l.id === id);
    if (!look || unlocked.includes(id)) return false;
    unlocked.push(id);
    remember();
    emit();
    return true;
  }

  /** Wear one of the looks we have earned, or `BARE` to wear none. */
  function wear(id) {
    if (id !== BARE && !unlocked.includes(id)) return false;
    wearing = id;
    remember();
    emit();
    return true;
  }

  return {
    saw,
    open,
    wear,
    award,
    onChange: (fn) => changed.push(fn),
    get count() { return count; },
    get wearing() { return wearing; },
    get unlocked() { return [...unlocked]; },
    /** Is a chest sitting there unopened? */
    get waiting() { return waiting.length; },
    /** How many more wins until the next thing, or 0 when there is no next thing. */
    get next() {
      const ahead = looks.filter((look) => Number.isInteger(look.wins) && look.wins > count)
        .sort((a, b) => a.wins - b.wins)[0];
      return ahead ? ahead.wins - count : 0;
    },
    has: (id) => unlocked.includes(id),
  };
}
