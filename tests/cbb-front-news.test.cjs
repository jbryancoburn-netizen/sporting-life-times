'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'cbb-front-news.js'), 'utf8');
const wire = JSON.parse(fs.readFileSync(path.join(root, 'data/cbb-national-news.json'), 'utf8'));

async function checkEdition(gender) {
  let available = true;
  let refresh;
  const news = {
    innerHTML: '',
    querySelector: () => news.innerHTML.includes('cbb-news-grid'),
  };
  const stamp = {};
  vm.runInNewContext(renderer, {
    Date, URL, URLSearchParams, AbortSignal,
    location: {search: '?gender=' + gender},
    document: {
      getElementById: id => id === 'cbb-front-news' ? news : stamp,
      addEventListener() {},
    },
    fetch: async url => ({
      ok: available && url.startsWith('data/cbb-national-news.json?'),
      json: async () => wire,
    }),
    setInterval: callback => { refresh = callback; },
  });
  await new Promise(setImmediate);
  const initial = news.innerHTML;
  assert.match(initial, /<h3><a href="https?:\/\//);
  assert.match(stamp.textContent, /National wire updated/);

  available = false;
  refresh();
  await new Promise(setImmediate);
  assert.equal(news.innerHTML, initial, 'failed polls preserve the last visible headlines');
  assert.match(stamp.textContent, /Showing last loaded headlines/);
  return initial;
}

(async () => {
  const men = await checkEdition('men');
  const women = await checkEdition('women');
  assert.notEqual(men, women, 'editions must render different national stories');
  console.log('PASS CBB front page: both editions render the national wire and preserve stories on polling failures');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
