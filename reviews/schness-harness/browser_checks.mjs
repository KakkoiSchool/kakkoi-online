import { chromium } from 'playwright';
const base = 'http://127.0.0.1:8899';
const uuid = () => '11111111-2222-4333-8444-555555555555';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

// 1. Tap targets at the shortest phone still in use, bot mode (reserve tiles) and online (invite card).
for (const [w, h] of [[320, 568], [320, 640], [360, 640]]) {
  for (const mode of ['bot', 'online']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${base}/game.html?game=${uuid()}&mode=${mode}`);
    await page.waitForTimeout(800);
    const sel = mode === 'bot' ? ['.bank-piece', '.text-button', '.reset', '.rail-button', '.moves-link', '.square'] : ['#copy-invite', '#invite-url', '#cancel-search', '.text-button'];
    const rows = await page.evaluate((sel) => sel.map((s) => { const els = [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null); const hs = els.map((e) => Math.round(e.getBoundingClientRect().height)); const ws = els.map((e) => Math.round(e.getBoundingClientRect().width)); return `${s}: h=${[...new Set(hs)].join('/') || 'hidden'} w=${[...new Set(ws)].join('/')}`; }), sel);
    const scroll = await page.evaluate(() => `${document.documentElement.scrollHeight}px tall page in ${innerHeight}px`);
    console.log(`[${w}x${h} ${mode}] ${scroll}\n   ${rows.join('\n   ')}`);
    await ctx.close();
  }
}

// 2. CSP: play a bot game start under the meta policy; collect console errors / CSP violations.
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(`${base}/game.html?game=${uuid()}&mode=bot`);
  await page.waitForTimeout(1500);
  const swState = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active ? 'active' : r.installing ? 'installing' : r.waiting ? 'waiting' : 'registered') : 'none'; });
  // place white king (any marked square), wait for bot to place, then make a move.
  await page.click('.square.placement');
  await page.waitForFunction(() => document.querySelector('#turn-title').textContent === 'Your turn', null, { timeout: 15000 });
  const plies1 = await page.evaluate(() => document.querySelectorAll('.move-cell').length);
  await page.click('.bank-piece:not(:disabled)');
  await page.click('.square.target');
  await page.waitForFunction((n) => document.querySelectorAll('.move-cell').length >= n + 2, plies1, { timeout: 30000 });
  const plies2 = await page.evaluate(() => document.querySelectorAll('.move-cell').length);
  const cspTag = await page.evaluate(() => document.querySelector('meta[http-equiv]')?.content.slice(0, 40));
  console.log(`[csp] tag present: ${Boolean(cspTag)}; service worker: ${swState}; plies before/after: ${plies1}/${plies2} (bot replied through the module worker); console errors: ${errors.length}`);
  for (const e of errors) console.log('   ', e.slice(0, 200));
  await ctx.close();
}

// 3. Time forfeit copy: 3+2 clock, let White's (human) clock run out via a fake clock.
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('schness-clock', '3+2'));
  await page.clock.install();
  await page.goto(`${base}/game.html?game=${uuid()}&mode=bot`);
  await page.clock.runFor(1000);
  const before = await page.evaluate(() => document.querySelector('#human-clock').textContent);
  await page.clock.runFor(185_000);
  const after = await page.evaluate(() => ({ clock: document.querySelector('#human-clock').textContent, overlayHidden: document.querySelector('#result-overlay').hidden, eyebrow: document.querySelector('#result-eyebrow').textContent, headline: document.querySelector('#result-headline').textContent, detail: document.querySelector('#result-detail').textContent, toast: document.querySelector('#announcement').textContent }));
  console.log(`[flag] clock ${before} -> ${after.clock}; overlay shown: ${!after.overlayHidden}; card: "${after.eyebrow} / ${after.headline}" — "${after.detail}"; toast: "${after.toast}"`);
  await ctx.close();
}
await browser.close();
