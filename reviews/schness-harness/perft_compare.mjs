import * as NEW from './rules.js';
import * as OLD from './old/rules.js';
function perft(R, p, d) { const a = R.legalActions(p); if (d === 1) return a.length; let t = 0; for (const x of a) t += perft(R, R.applyAction(p, x), d - 1); return t; }
for (const [name, R] of [['old', OLD], ['new', NEW]]) {
  for (let d = 1; d <= 5; d++) { const t = performance.now(); const n = perft(R, R.createInitialPosition(), d); console.log(name, 'perft', d, n, `${(performance.now() - t).toFixed(0)}ms`); }
}
