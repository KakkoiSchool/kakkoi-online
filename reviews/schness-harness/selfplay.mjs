import { chooseAction } from './bot.js';
import { applyAction, legalActions, getResult, createInitialPosition, actionKey } from './rules.js';
const [dw, db, cap] = [Number(process.argv[2] ?? 3), Number(process.argv[3] ?? 3), Number(process.argv[4] ?? 200)];
const tally = { white: 0, black: 0, draw: 0, unfinished: 0 }; const lengths = []; const reasons = {}; let slowest = 0;
for (let wk = 12; wk <= 15; wk++) for (let bk = 0; bk <= 3; bk++) {
  let p = applyAction(applyAction(createInitialPosition(), { type: 'place-king', to: wk }), { type: 'place-king', to: bk });
  let plies = 2, result = null;
  while (plies < cap) { const t = performance.now(); const a = chooseAction(p, { depth: p.turn === 'white' ? dw : db }); slowest = Math.max(slowest, performance.now() - t);
    if (!a) break; p = applyAction(p, a); plies++; result = getResult(p); if (result) break; }
  lengths.push(plies);
  if (!result) tally.unfinished++; else if (result.type === 'draw') { tally.draw++; reasons[result.reason] = (reasons[result.reason] ?? 0) + 1; } else tally[result.winner]++;
  process.stdout.write(`wk${wk} bk${bk}: ${result ? (result.type === 'draw' ? result.reason : result.winner + ' wins') : 'unfinished'} in ${Math.ceil(plies/2)} moves\n`);
}
console.log({ depths: [dw, db], tally, reasons, meanMoves: (lengths.reduce((a, b) => a + b, 0) / lengths.length / 2).toFixed(1), slowestMoveMs: slowest.toFixed(0) });
