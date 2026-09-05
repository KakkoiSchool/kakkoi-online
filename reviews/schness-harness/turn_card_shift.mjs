import { chromium } from 'playwright';
const base = 'http://127.0.0.1:8899';
const uuid = () => '11111111-2222-4333-8444-555555555555';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const measure = () => {
  const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), h: Math.round(b.height), bottom: Math.round(b.bottom + scrollY) }; };
  const all = [...document.querySelectorAll('main *')].filter((e) => e.getClientRects().length && getComputedStyle(e).position !== 'fixed');
  const lastBottom = Math.max(...all.map((e) => Math.round(e.getBoundingClientRect().bottom + scrollY)));
  return { title: document.querySelector('#turn-title').textContent, detail: document.querySelector('#turn-detail').textContent.slice(0, 30), card: r('#turn-card'), detailEl: r('#turn-detail'), deselect: r('#deselect'), you: r('.player.you'), rail: r('#match-rail'), board: r('#board'), page: document.documentElement.scrollHeight, inner: innerHeight, lastBottom, gap: document.documentElement.scrollHeight - lastBottom, mainPadB: getComputedStyle(document.querySelector('main')).paddingBottom };
};
for (const [w, h, mobile] of [[390, 844, true], [1280, 800, false], [740, 360, true], [360, 640, true], [320, 568, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  await page.goto(`${base}/game.html?game=${uuid()}&mode=bot`);
  await page.waitForTimeout(600);
  const log = [];
  log.push(['place-king', await page.evaluate(measure)]);
  await page.click('.square.placement');
  await page.waitForFunction(() => document.querySelector('#turn-title').textContent === 'Your turn', null, { timeout: 15000 });
  await page.waitForTimeout(300);
  log.push(['your-turn', await page.evaluate(measure)]);
  await page.click('.bank-piece:not(:disabled)');
  await page.waitForTimeout(200);
  log.push(['selected-bank', await page.evaluate(measure)]);
  await page.click('.bank-piece.selected');
  await page.waitForTimeout(200);
  log.push(['deselected', await page.evaluate(measure)]);
  await page.click('.square:has(.piece-white)');
  await page.waitForTimeout(200);
  log.push(['selected-board', await page.evaluate(measure)]);
  console.log(`\n=== ${w}x${h} ===`);
  for (const [k, m] of log) console.log(k.padEnd(15), JSON.stringify(m));
  await ctx.close();
}
await browser.close();
