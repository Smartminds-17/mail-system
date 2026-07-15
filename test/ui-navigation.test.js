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
