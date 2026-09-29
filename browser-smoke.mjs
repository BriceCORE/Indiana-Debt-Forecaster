import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run from any directory. No production server, account, or external service is required.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.BROWSER_OUTPUT_DIR || path.join(root, '.cache/browser-smoke'));
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', {
  paths: process.env.BROWSER_MODULES ? [process.env.BROWSER_MODULES] : undefined,
}));
const data = JSON.parse(await readFile(path.join(root, 'site-data.json'), 'utf8'));
const mount = '/indiana-debt-forecaster/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(mount)) { response.writeHead(404).end(); return; }
    const file = path.resolve(root, pathname.slice(mount.length) || 'index.html');
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${mount}`;
const errors = [], failedRequests = [], externalRequests = [], checks = [];
let browser;

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const decimalDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 1, minimumFractionDigits: 1 });
const compact = value => {
  const n = Number(value) || 0;
  for (const [divisor, suffix] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (Math.abs(n) >= divisor) return decimalDollars.format(n / divisor) + suffix;
  }
  return dollars.format(n);
};
const selectedYear = item => Math.max(2027, Math.min(2036, item.drops.total.year || item.defaultStartYear));
const byId = id => data.districts.find(item => item.id === id);

try {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('data:')) externalRequests.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });

  async function ready(url) {
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('#loading-state'));
    assert.equal(await page.locator('a[href*="chatgpt"], a[href*="multistate"]').count(), 0, 'Standalone pages must not link to GPT-hosted or excluded pages');
    assert.ok((await page.locator('#scope-label').innerText()).includes(`${data.districts.length} districts`));
    assert.ok(await page.locator('.core-logo').evaluate(image => image.complete && image.naturalWidth > 0));
  }

  async function checkDistrict(item, year, scenario = 'Base', term = '20', structure = 'level') {
    assert.equal(await page.locator('#district-search').inputValue(), item.name);
    assert.equal(await page.locator('#district-select').inputValue(), item.id);
    assert.equal(await page.locator('#county-select').inputValue(), item.county);
    assert.equal(await page.locator('#capacity-value').innerText(), compact(item.capacityMatrix[scenario][year][term][structure]));
    assert.equal(await page.locator('#annual-space-value').innerText(), compact(item.scenarioForecasts[scenario].annual[year].available));
    assert.equal(await page.locator('#ordinary-drop-value').innerText(), compact(item.drops.ordinary.amount));
    assert.equal(await page.locator('#referendum-drop-value').innerText(), compact(item.drops.referendum.amount));
    assert.equal(await page.locator('#start-year-output').innerText(), String(year));
    assert.equal(await page.locator('#debt-chart .hover-zone').count(), 20);
    assert.equal(new URL(page.url()).searchParams.get('district'), item.id);
    assert.equal(new URL(page.url()).searchParams.get('year'), String(year));
  }

  const lake = byId('LAKE CENTRAL SCHOOL CORPORATION');
  await ready('');
  await checkDistrict(lake, selectedYear(lake));
  assert.equal(await page.locator('#issues-body tr').count(), Math.min(lake.issues.length, 10));
  await page.click('#show-issues');
  assert.equal(await page.locator('#issues-body tr').count(), lake.issues.length);
  await page.click('#show-issues');
  const inspectedYear = 2027;
  await page.locator(`.hover-zone[data-year="${inspectedYear}"]`).press('Enter');
  const activeIssues = lake.issues.filter(issue => Number(issue.annualPayments?.[inspectedYear]) > 0);
  assert.equal(await page.locator('#chart-inspector .issue-payment-row').count(), activeIssues.length);
  assert.match(await page.locator('#chart-inspector h3').innerText(), new RegExp(String(inspectedYear)));
  assert.ok((await page.locator('#chart-inspector h3').innerText()).includes(dollars.format(activeIssues.reduce((sum, issue) => sum + Number(issue.annualPayments[inspectedYear]), 0))));
  await page.locator('#chart-inspector .issue-payment-row').first().click();
  assert.equal(await page.locator('#issues-body tr.issue-highlight').count(), 1);
  await page.click('.inspector-close');
  assert.equal(await page.locator('#chart-inspector').isVisible(), false);
  checks.push('Nested-path entry point, district metrics, debt chart inspection, obligation table expansion');

  const adams = data.districts[0];
  await page.fill('#district-search', adams.shortName);
  await page.locator('#district-search').press('Enter');
  await checkDistrict(adams, selectedYear(adams));
  await page.fill('#district-search', 'zzzz no matching Indiana district');
  assert.match(await page.locator('#district-results').innerText(), /No districts match/);
  await page.click('#capacity-value');
  await page.locator('#district-results').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#district-select').inputValue(), adams.id);
  assert.equal(await page.locator('#district-results').isVisible(), false);
  await page.fill('#district-search', 'Lake');
  assert.ok(await page.locator('#district-results .district-result').count() > 1);
  await page.click('#capacity-value');
  await page.locator('#district-results').waitFor({ state: 'hidden' });
  await page.selectOption('#county-select', lake.county);
  assert.equal(await page.locator('#district-select option').count(), data.districts.filter(item => item.county === lake.county).length + 1);
  await page.selectOption('#district-select', lake.id);
  await checkDistrict(lake, selectedYear(lake));
  checks.push('District and county search, keyboard selection, empty search, county browsing');

  await page.locator('#start-year').fill('2033');
  for (const scenario of ['Conservative', 'Base', 'Growth']) {
    await page.click(`[data-scenario="${scenario}"]`);
    for (const term of ['10', '15', '20']) {
      await page.click(`[data-term="${term}"]`);
      for (const structure of ['level', 'wrapped']) {
        await page.click(`[data-structure="${structure}"]`);
        await checkDistrict(lake, 2033, scenario, term, structure);
      }
    }
  }
  for (const year of [2027, 2036]) {
    await page.locator('#start-year').fill(String(year));
    await checkDistrict(lake, year, 'Growth', '20', 'wrapped');
  }
  checks.push('All 18 scenario/term/structure combinations and service-year boundaries match bundled data');

  for (const item of [adams, data.districts.find(item => !item.issues.length), data.districts.find(item => item.opportunityEligible === false)].filter(Boolean)) {
    await ready(`index.html?district=${encodeURIComponent(item.id)}&year=2031`);
    await checkDistrict(item, 2031);
  }
  await ready(`index.html?district=${encodeURIComponent(lake.id)}&year=2033`);
  await page.screenshot({ path: path.join(output, 'district-desktop.png'), fullPage: true });
  await page.screenshot({ path: path.join(output, 'district-desktop-viewport.png') });
  checks.push('Shareable district/year links, including zero obligations and incomplete source schedules');

  const reduction = (schedule, year) => Math.max(0, Number(schedule[year - 1] || 0) - Number(schedule[year] || 0));
  function expectedOverview(year, rank, lane) {
    const signals = data.districts.map(item => {
      const ordinary = reduction(item.schedules.ordinary, year);
      const referendum = reduction(item.schedules.referendum, year);
      const identified = ordinary + referendum + reduction(item.schedules.pension, year);
      const capacity = Number(item.capacityMatrix.Base[year]['20'].level || 0);
      const selected = lane === 'ordinary' ? ordinary : lane === 'referendum' ? referendum : identified;
      return { item, ordinary, referendum, identified, capacity, selected, value: rank === 'capacity' ? capacity : selected };
    });
    const candidates = signals.filter(signal => signal.item.opportunityEligible !== false && signal.value > 0)
      .sort((a, b) => b.value - a.value || b.capacity - a.capacity || b.identified - a.identified || a.item.name.localeCompare(b.item.name));
    return { signals, candidates };
  }
  async function checkOverview(year, rank, lane) {
    const { signals, candidates } = expectedOverview(year, rank, lane);
    const sum = field => signals.reduce((total, signal) => total + signal[field], 0);
    assert.equal(await page.locator('#rolloff-total').innerText(), compact(rank === 'capacity' ? candidates[0]?.capacity || 0 : sum('selected')));
    assert.equal(await page.locator('#ordinary-total').innerText(), compact(sum(rank === 'capacity' ? 'identified' : 'ordinary')));
    assert.equal(await page.locator('#referendum-total').innerText(), compact(sum('referendum')));
    assert.equal(await page.locator('#material-districts').innerText(), String(signals.filter(signal => rank === 'capacity' ? signal.item.opportunityEligible !== false && signal.capacity >= 5e6 : signal.selected >= 250000).length));
    assert.equal(await page.locator('#signal-count').innerText(), String(candidates.length));
    assert.equal(await page.locator('#opportunity-bars .opportunity-bar-row').count(), Math.min(10, candidates.length));
    assert.equal(await page.locator('#opportunity-body tr').count(), Math.max(1, candidates.length));
    if (candidates.length) {
      assert.equal(await page.locator('#opportunity-body tr').first().locator('td strong').first().innerText(), candidates[0].item.name);
      assert.equal(await page.locator('#opportunity-body tr').last().locator('td strong').first().innerText(), candidates.at(-1).item.name);
      const link = new URL(await page.locator('#opportunity-bars a').first().getAttribute('href'), page.url());
      assert.equal(link.pathname, mount + 'index.html');
      assert.equal(link.searchParams.get('district'), candidates[0].item.id);
      assert.equal(link.searchParams.get('year'), String(year));
    }
    assert.equal(new URL(page.url()).searchParams.get('year'), String(year));
    assert.equal(new URL(page.url()).searchParams.get('rank'), rank);
  }

  await ready('overview.html');
  assert.equal(await page.locator('#coverage-count').innerText(), `${data.districts.length} districts`);
  assert.equal(await page.locator('#overview-lane button:disabled').count(), 3);
  for (let year = 2027; year <= 2036; year++) {
    await page.click(`[data-year="${year}"]`);
    await page.click('[data-rank="capacity"]');
    await checkOverview(year, 'capacity', 'all');
    await page.click('[data-rank="rolloff"]');
    for (const lane of ['ordinary', 'referendum', 'all']) {
      await page.click(`[data-lane="${lane}"]`);
      await checkOverview(year, 'rolloff', lane);
    }
  }
  checks.push('All ten overview years and four ranking/lane modes match data totals, eligibility, and ordering');
  await ready('overview.html?year=2032&rank=rolloff&lane=referendum');
  await checkOverview(2032, 'rolloff', 'referendum');
  await page.locator('#opportunity-bars a').first().click();
  await page.waitForFunction(() => !document.querySelector('#loading-state'));
  await checkDistrict(byId(new URL(page.url()).searchParams.get('district')), 2032);
  await page.locator('.product-nav a[href="./overview.html"]').click();
  await page.waitForFunction(() => !document.querySelector('#loading-state'));
  await checkOverview(2027, 'capacity', 'all');
  await page.screenshot({ path: path.join(output, 'overview-desktop.png'), fullPage: true });
  await page.screenshot({ path: path.join(output, 'overview-desktop-viewport.png') });
  checks.push('Overview deep links, ranked district links, and navigation between both pages');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [file, name] of [['index.html', 'district'], ['overview.html', 'overview']]) {
      await ready(file);
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(geometry.content <= geometry.viewport + 1, `${name} at ${width}px overflows: ${JSON.stringify(geometry)}`);
      if (width === 390) {
        await page.screenshot({ path: path.join(output, `${name}-mobile.png`), fullPage: true });
        await page.screenshot({ path: path.join(output, `${name}-mobile-viewport.png`) });
      }
    }
  }
  checks.push('Both pages fit 390px and 320px mobile viewports without document overflow');
  assert.deepEqual(errors, [], 'No browser script or console errors');
  assert.deepEqual(failedRequests, [], 'No failed asset or data requests');
  assert.deepEqual(externalRequests, [], 'No requests to ChatGPT, authentication, CDNs, or external services');
  checks.push('No failed requests, JavaScript errors, external dependencies, or account requests');
  const report = { status: 'passed', checkedAt: new Date().toISOString(), basePath: mount, districtCount: data.districts.length, checks, errors, failedRequests, externalRequests };
  await writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'browser-report.json'), JSON.stringify({ status: 'failed', checkedAt: new Date().toISOString(), checks, error: error.stack, errors, failedRequests, externalRequests }, null, 2) + '\n');
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
