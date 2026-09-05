import { chromium } from 'playwright';
const base = 'http://127.0.0.1:8899'; const id = '11111111-2222-4333-8444-555555555555';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
{ const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } }); const page = await ctx.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('schness-clock', '3+2')); await page.clock.install();
  await page.goto(`${base}/game.html?game=${id}&mode=bot`); await page.clock.runFor(500);
  await page.click('.square.placement'); for (let i = 0; i < 40 && (await page.evaluate(() => document.querySelector('#turn-title').textContent)) !== 'Your turn'; i++) await page.clock.runFor(250);
  await page.click('.square:has(.piece-white.piece-king)');
  const sel = await page.evaluate(() => [...document.querySelectorAll('.square')].filter((b) => b.getAttribute('aria-selected') === 'true').map((b) => b.getAttribute('aria-label')));
  await page.clock.runFor(200_000);
  const before = await page.evaluate(() => ({ hidden: document.querySelector('#result-overlay').hidden, role: document.querySelector('.result-card').getAttribute('role'), focused: document.activeElement?.className }));
  await page.keyboard.press('Escape');
  const after = await page.evaluate(() => ({ hidden: document.querySelector('#result-overlay').hidden, focused: document.activeElement?.id }));
  console.log('[aria-selected]', sel); console.log('[result card] before Escape:', before, '| after Escape:', after, '| errors:', errors.length);
  await ctx.close(); }
for (const reduce of ['no-preference', 'reduce']) { const ctx = await browser.newContext({ reducedMotion: reduce }); const page = await ctx.newPage();
  await page.goto(`${base}/game.html?game=${id}&mode=online`); await page.waitForTimeout(600);
  const anim = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.pulse i')); return { name: s.animationName, duration: s.animationDuration, count: s.animationIterationCount }; });
  console.log(`[dots ${reduce}]`, anim); await ctx.close(); }
{ const ctx = await browser.newContext(); const page = await ctx.newPage(); await page.goto(`${base}/index.html`); await page.click('[data-open-rules]');
  console.log('[rules dialog]', await page.evaluate(() => document.querySelector('#rules-dialog .rules-gotchas').textContent.replace(/\s+/g, ' ').trim().slice(0, 260))); await ctx.close(); }
await browser.close();
