import * as NEW from './rules.js';
import * as OLD from './old/rules.js';
import { chooseAction as chooseNew } from './bot.js';
import { chooseAction as chooseOld } from './old/bot.js';
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const keys = (R, p) => R.legalActions(p).map(R.actionKey).sort();
let positions = 0, mismatches = 0, botChecks = 0, botMismatch = 0, games = 0;
for (let g = 0; g < 400; g++) {
  let pOld = OLD.createInitialPosition(), pNew = NEW.createInitialPosition();
  games++;
  for (let ply = 0; ply < 120; ply++) {
    const ko = keys(OLD, pOld), kn = keys(NEW, pNew);
    positions++;
    if (JSON.stringify(ko) !== JSON.stringify(kn)) { mismatches++; console.log('LEGAL MISMATCH', OLD.positionKey(pOld), ko, kn); }
    if (OLD.isInCheck(pOld, 'white') !== NEW.isInCheck(pNew, 'white') || OLD.isInCheck(pOld, 'black') !== NEW.isInCheck(pNew, 'black')) { mismatches++; console.log('CHECK MISMATCH', OLD.positionKey(pOld)); }
    const ro = OLD.getResult(pOld), rn = NEW.getResult(pNew);
    if (JSON.stringify(ro) !== JSON.stringify(rn)) { mismatches++; console.log('RESULT MISMATCH', ro, rn); }
    if (ro) break;
    if (ply % 7 === 3 && pOld.phase === 'play') {
      botChecks++;
      const a = chooseOld(pOld, { depth: 2 }), b = chooseNew(pNew, { depth: 2 });
      if (OLD.actionKey(a) !== NEW.actionKey(b)) { botMismatch++; console.log('BOT MISMATCH', OLD.positionKey(pOld), a, b); }
    }
    const acts = NEW.legalActions(pNew); const pick = acts[Math.floor(rnd() * acts.length)];
    // apply the *same* action through both engines, compare full state
    pOld = OLD.applyAction(pOld, pick); pNew = NEW.applyAction(pNew, pick);
    if (OLD.positionKey(pOld) !== NEW.positionKey(pNew) || JSON.stringify(pOld.repetitions) !== JSON.stringify(pNew.repetitions)) { mismatches++; console.log('APPLY MISMATCH'); }
  }
}
console.log({ games, positions, mismatches, botChecks, botMismatch });
