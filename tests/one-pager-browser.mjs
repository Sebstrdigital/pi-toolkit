// Optional real-browser acceptance check. Run on HomeLab with an existing
// Playwright installation; no package installation or server is needed.
// node one-pager-browser.mjs EXAMPLE.html REVIEW.html HOSTILE.html EVIDENCE_DIR
// PLAYWRIGHT_MODULE=/absolute/playwright BROWSER_EXECUTABLE=/absolute/chromium
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [example, review, hostile, output] = process.argv.slice(2).map(p => resolve(p));
if (!output) throw Error('Supply example, review, hostile HTML paths and an existing evidence directory');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const checks = [];
let pages = 0;
try {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.setOffline(true);
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(pathToFileURL(example).href); pages++;
  await page.getByRole('heading', { name: 'One artifact, complementary modes' }).waitFor();
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  assert.ok(icon.startsWith('data:image/svg+xml,'));
  const iconSize = await page.evaluate(src => new Promise((resolveImage, reject) => {
    const image = new Image();
    image.onload = () => resolveImage([image.naturalWidth, image.naturalHeight]);
    image.onerror = () => reject(new Error('Embedded favicon failed to load'));
    image.src = src;
  }), icon);
  assert.deepEqual(iconSize, [32, 32]);
  checks.push('Shared embedded SVG favicon decodes and loads offline under the page CSP');
  assert.equal(await page.locator('svg').count(), 1);
  assert.equal(await page.locator('#review').count(), 0);
  await page.getByRole('button', { name: 'Expand all details' }).click();
  assert.equal(await page.locator('details:not([open])').count(), 0);
  await page.getByRole('button', { name: 'Collapse details' }).click();
  assert.equal(await page.locator('details[open]').count(), 0);
  await page.locator('a[href="#document-1"]').click();
  await page.locator('#document-1[open]').waitFor();
  checks.push('Offline example, diagram, expand/collapse, source-link reveal');
  await page.screenshot({ path: resolve(output, 'example-desktop.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: resolve(output, 'example-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, 'example-mobile.png'), fullPage: true });
  checks.push('Dark theme and mobile layout without page-level horizontal overflow');

  await page.setViewportSize({ width: 1100, height: 850 });
  await page.goto(pathToFileURL(review).href); pages++;
  assert.equal(await page.locator('[data-decision]').first().inputValue(), 'pending');
  assert.equal(await page.locator('#overall').inputValue(), 'pending');
  const originalHash = await page.locator('#document-meta').textContent().then(JSON.parse);
  assert.match(originalHash.sources[0].sha256, /^[a-f0-9]{64}$/);
  await page.locator('[data-decision]').first().selectOption('changes');
  const comment = 'Please clarify <scope> & stop conditions.';
  await page.locator('[data-comment]').first().fill(comment);
  await page.locator('#overall').selectOption('accept');
  await page.locator('#overall-comment').fill('Conditional feedback only.');
  await page.getByText('Overall acceptance differs', { exact: false }).waitFor();
  await page.reload();
  assert.equal(await page.locator('[data-decision]').first().inputValue(), 'changes');
  assert.equal(await page.locator('[data-comment]').first().inputValue(), comment);
  const downloadJSON = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review JSON' }).click();
  const json = await downloadJSON;
  const jsonPath = resolve(output, 'review-export.json'); await json.saveAs(jsonPath);
  const value = JSON.parse(readFileSync(jsonPath, 'utf8'));
  assert.equal(value.kind, 'one-pager-review-draft');
  assert.equal(value.decisions[0].position, 'changes');
  assert.equal(value.decisions[0].comment, comment);
  assert.equal(value.decisions[1].position, 'pending');
  assert.equal(value.overall.position, 'accept');
  assert.equal(value.contentHash, originalHash.contentHash);
  assert.match(value.authority, /Not implementation authorization/);
  const downloadText = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review text' }).click();
  const txt = await downloadText; const txtPath = resolve(output, 'review-export.txt'); await txt.saveAs(txtPath);
  assert.match(readFileSync(txtPath, 'utf8'), /Second synthetic decision: pending/);
  assert.ok(readFileSync(txtPath, 'utf8').includes(comment));
  checks.push('Pending defaults, contradictory-position warning, reload persistence, JSON/text exports include unreviewed decisions and source identities');
  await page.screenshot({ path: resolve(output, 'review-desktop.png'), fullPage: true });

  // Deny browser APIs to verify graceful file/private-browser fallback paths.
  const denied = await browser.newContext(); await denied.setOffline(true);
  await denied.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Clipboard denied'); } } });
  });
  const fallback = await denied.newPage(); fallback.on('pageerror', error => errors.push(error.message));
  await fallback.goto(pathToFileURL(review).href); pages++;
  await fallback.getByText('Browser storage unavailable', { exact: false }).waitFor();
  await fallback.getByRole('button', { name: 'Copy review' }).click();
  await fallback.getByRole('button', { name: 'Select/copy preview, or download' }).waitFor();
  assert.ok(await fallback.evaluate(() => window.getSelection().toString().includes('Review draft:')));
  checks.push('Storage-denied and clipboard-denied fallbacks remain usable');

  await page.goto(pathToFileURL(hostile).href); pages++;
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.equal(await page.locator('img').count(), 0);
  checks.push('Hostile source/prose remain inert escaped text');
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  checks.push('Zero HTTP(S) requests and zero uncaught browser errors');
  writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify({ status: 'pass', browser: browser.version(), offline: true, pages, checks }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'pass', pages, checks, output }));
} finally { await browser.close(); }
