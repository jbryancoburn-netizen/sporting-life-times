'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const renderer = fs.readFileSync(path.join(__dirname, '../cbb-front-news.js'), 'utf8');
const repository = 'https://raw.githubusercontent.com/jbryancoburn-netizen/sporting-life-times/main/data/cbb-national-news.json';

function edition(label, timestamp) {
  const publishedAt = new Date(timestamp).toISOString();
  return {
    updated_at: publishedAt,
    articles: ['men', 'women'].map(gender => ({
      gender, title: label + ' ' + gender + ' basketball headline',
      source: 'Test publisher', published_at: publishedAt, url: 'https://example.test/' + gender,
    })),
  };
}

async function checkEdition(gender) {
  let now = Date.parse('2026-11-10T12:00:00Z');
  let pages = edition('Pages', now);
  let collected = null;
  let repositoryRequests = 0;
  let refresh;
  const news = {innerHTML: '', querySelector: () => news.innerHTML.includes('cbb-news-grid')};
  const stamp = {};
  class Clock extends Date {
    static now() { return now; }
  }
  vm.runInNewContext(renderer, {
    Date: Clock, URL, URLSearchParams, AbortSignal,
    location: {search: '?gender=' + gender},
    document: {
      getElementById: id => id === 'cbb-front-news' ? news : stamp,
      addEventListener() {},
    },
    fetch: async url => {
      let data;
      if (url.startsWith('data/cbb-national-news.json?')) data = pages;
      if (url.startsWith(repository + '?')) {
        repositoryRequests++;
        data = collected;
      }
      return {ok: Boolean(data), json: async () => data};
    },
    setInterval: callback => { refresh = callback; },
  });
  const render = async () => { refresh(); await new Promise(setImmediate); };
  await new Promise(setImmediate);
  assert.match(news.innerHTML, new RegExp('Pages ' + gender + ' basketball headline'));
  assert.match(stamp.textContent, /National wire updated/);
  assert.equal(repositoryRequests, 0, 'fresh Pages should avoid the fallback');

  now += 36 * 60_000;
  collected = edition('Collector', now);
  await render();
  const fresh = news.innerHTML;
  assert.match(fresh, new RegExp('Collector ' + gender + ' basketball headline'));
  assert.doesNotMatch(fresh, new RegExp('Collector ' + (gender === 'men' ? 'women' : 'men')));
  assert.equal(repositoryRequests, 1, 'stale Pages should read directly from the collector');

  pages = null;
  collected = null;
  await render();
  assert.equal(repositoryRequests, 1, 'fallback requests are throttled');
  now += 5 * 60_000;
  await render();
  assert.equal(repositoryRequests, 2);
  assert.equal(news.innerHTML, fresh, 'source outage must preserve the last wire');

  now += 5 * 60_000;
  collected = edition('Incomplete', now);
  collected.articles.pop();
  await render();
  assert.equal(news.innerHTML, fresh, 'incomplete fallback must preserve both editions');

  now += 5 * 60_000;
  collected = edition('Older', now - 20 * 60_000);
  await render();
  assert.equal(news.innerHTML, fresh, 'an older fallback must never roll back the wire');

  pages = edition('Recovered Pages', now);
  await render();
  assert.match(news.innerHTML, new RegExp('Recovered Pages ' + gender + ' basketball headline'));
}

Promise.all(['men', 'women'].map(checkEdition)).then(() => {
  console.log('PASS CBB news: both editions bypass stale Pages, preserve the newest complete wire, and recover');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
