import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(resolve(root, file), 'utf8');
const release = JSON.parse(await read('release.json'));
for (const [file, expected] of Object.entries(release.preservedFiles)) {
  const hash = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
  assert.equal(hash, expected, `${file} differs from the recorded Indiana release. Review intentional changes before updating release.json.`);
}
const data = JSON.parse(await read('site-data.json'));
assert.equal(data.metadata.scope, 'Indiana public school corporations');
assert.equal(data.districts.length, release.districtCount);
assert.equal(data.metadata.districtCount, release.districtCount);
assert.equal(new Set(data.districts.map(d => d.id)).size, release.districtCount);
assert.equal(data.metadata.asOf, release.modelAsOf);
assert.equal(data.metadata.debtSnapshot, release.debtSnapshot);
assert.equal(data.districts.reduce((sum, d) => sum + d.issues.length, 0), release.capturedIssueCount);

const required = ['index.html', 'overview.html', 'app.js', 'overview.js', 'styles.css', 'site-data.json',
  'assets/core-logo-registered.png', 'assets/core-symbol.png', '.nojekyll'];
for (const file of required) assert.ok((await stat(resolve(root, file))).isFile(), `Missing site file: ${file}`);
for (const file of ['index.html', 'overview.html', 'app.js', 'overview.js', 'styles.css']) {
  const content = await read(file);
  assert.doesNotMatch(content, /chatgpt\.site|chatgpt\.com|openai\.com|multistate\.(html|js|css)|sacramento\.(html|js|css)|\/Users\/|file:\/\//i, `${file} contains a nonportable dependency`);
  if (!file.endsWith('.html')) continue;
  for (const [, target] of content.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|#)/.test(target)) continue;
    assert.ok(target.startsWith('./'), `${file} must use a relative path: ${target}`);
    const path = decodeURIComponent(target.split(/[?#]/)[0]);
    assert.ok((await stat(resolve(root, path))).isFile(), `${file} has a broken local link: ${target}`);
  }
}
console.log(`Checks passed: ${data.districts.length} Indiana districts; preserved data and forecast code; all site files and relative links present.`);
