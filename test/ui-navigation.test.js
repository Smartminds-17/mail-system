const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('SMS sidebar provides real destinations for every available page', () => {
  const html = fs.readFileSync('public/sms.html', 'utf8');

  assert.match(html, /href="\/dashboard"[^>]+data-page="dashboard"/);
  assert.match(html, /href="\/dashboard#analytics"[^>]+data-page="analytics"/);
  assert.match(html, /href="\/sms"[^>]+data-page="sms"/);
});

test('sidebar has only one JavaScript navigation handler', () => {
  const script = fs.readFileSync('public/script.js', 'utf8');
  const handlers = script.match(/document\.querySelectorAll\('\.nav-link'\)/g) || [];

  assert.equal(handlers.length, 1);
  assert.match(script, /link\.dataset\.page === 'settings'/);
});

test('authenticated sidebars expose a runtime version placeholder', () => {
  for (const page of ['dashboard.html', 'sms.html']) {
    const html = fs.readFileSync(`public/${page}`, 'utf8');
    assert.match(html, /data-app-version/);
    assert.doesNotMatch(html, /Campaign workspace|Securely connected/);
  }
});

test('authenticated workspaces include accessible persistent settings', () => {
  for (const page of ['dashboard.html', 'sms.html']) {
    const html = fs.readFileSync(`public/${page}`, 'utf8');
    assert.match(html, /id="settingsModal"[^>]+role="dialog"[^>]+aria-modal="true"/);
    assert.match(html, /name="accent" value="emerald"/);
    assert.match(html, /id="showSmsPreference"[^>]+role="switch"/);
  }

  const script = fs.readFileSync('public/script.js', 'utf8');
  assert.match(script, /PREFERENCES_KEY = 'sendchap_preferences'/);
  assert.match(script, /localStorage\.setItem\(PREFERENCES_KEY/);
  assert.match(script, /querySelectorAll\('\[data-page="sms"\]'\)/);
  assert.doesNotMatch(script, /Settings coming soon/);
});
