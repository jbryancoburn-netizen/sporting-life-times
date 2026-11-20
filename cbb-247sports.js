(() => {
  'use strict';
  const schools = document.getElementById('cbb-247-school');
  const link = document.getElementById('cbb-247-school-link');
  const status = document.getElementById('cbb-247-status');
  const headlines = document.getElementById('cbb-247-headlines');
  if (!schools || !headlines) return;
  const gender = new URLSearchParams(location.search).get('gender') === 'women' ? 'women' : 'men';
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  const publishers = new Map();
  const read = async path => {
    const res = await fetch(path, {cache: 'no-cache', signal: AbortSignal.timeout(10000)});
    if (!res.ok) throw new Error('News source unavailable');
    return res.json();
  };
  let wire = null;
  let refreshing = false;

  async function refreshHeadlines() {
    if (refreshing) return;
    refreshing = true;
    try {
      const next = await read('data/cbb-247sports-headlines.json');
      if (Array.isArray(next?.articles) && next.updated_at !== wire?.updated_at) {
        wire = next;
        render();
      }
    } catch {
      if (!wire) render();
    } finally {
      refreshing = false;
    }
  }

  window.setInterval(() => {
    if (!document.hidden) refreshHeadlines();
  }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshHeadlines();
  });

  function publisherURL(article) {
    try {
      const url = new URL(article.url);
      return url.origin === 'https://247sports.com' &&
        url.pathname.startsWith('/college/' + article.slug + '/') ? url.href : '';
    } catch {
      return '';
    }
  }

  function render() {
    const school = publishers.get(schools.value);
    link.hidden = !school;
    if (school) link.href = 'https://247sports.com/college/' + schools.value + '/news/?sport=basketball';
    else link.removeAttribute('href');
    headlines.replaceChildren();
    if (!wire) {
      status.textContent = '247Sports headlines are unavailable. The school links remain available.';
      return;
    }
    const seen = new Set();
    const stories = wire.articles.filter(article => {
      if (!article.verified_school_origin || !publishers.has(article.slug) || article.gender !== gender || (school && schools.value !== article.slug) ||
          !publisherURL(article) || !Number.isFinite(Date.parse(article.published_at)) ||
          Date.now() - Date.parse(article.published_at) > 5 * 86400000) return false;
      if (!school && seen.has(article.slug)) return false;
      seen.add(article.slug);
      return true;
    }).slice(0, school ? 8 : 10);
    const edition = gender === 'women' ? 'women’s' : 'men’s';
    const check = school ? wire.checked?.[schools.value] : null;
    const lastSuccess = check?.last_success_at || (check?.available ? check.at : null);
    const timestamp = lastSuccess && Number.isFinite(Date.parse(lastSuccess))
      ? 'Last checked ' + clock.format(new Date(lastSuccess)) + ' ET.' : '';
    if (!school) {
      status.textContent = stories.length ? '' : 'No recent ' + edition + ' basketball headlines from 247Sports.';
    } else if (check?.available) {
      status.textContent = [stories.length ? '' : 'No recent ' + edition + ' basketball headlines from 247Sports for ' + school + '.', timestamp].filter(Boolean).join(' ');
    } else {
      status.textContent = [check ? '247Sports was unavailable on the latest check.' : 'This school is awaiting its first 247Sports check.', timestamp].filter(Boolean).join(' ');
    }
    for (const story of stories) {
      const article = document.createElement('article');
      article.className = 'cbb-news-story';
      const meta = document.createElement('p');
      meta.className = 'cbb-news-eyebrow';
      meta.textContent = story.school + ' · 247Sports · ' + clock.format(new Date(story.published_at)) +
        ' ET' + (story.vip ? ' · VIP' : '');
      const heading = document.createElement('h4');
      const original = document.createElement('a');
      original.href = publisherURL(story);
      original.target = '_blank';
      original.rel = 'noopener noreferrer';
      original.textContent = story.title;
      heading.append(original);
      article.append(meta, heading);
      headlines.append(article);
    }
  }

  schools.addEventListener('change', () => {
    render();
    refreshHeadlines();
  });
  async function loadAlternativeSites() {
    const desk = document.getElementById('cbb-on3-desk');
    const select = document.getElementById('cbb-on3-school');
    const sourceLink = document.getElementById('cbb-on3-link');
    if (!desk || !select || !sourceLink) return;
    let directory;
    try {
      directory = await read('data/cbb-on3-rivals-team-sites.json');
    } catch {
      return;
    }
    for (const [name, publisher, url] of directory[gender] || []) {
      if (!/^https:\/\/www\.on3\.com\/(?:teams|sites)\/[a-z0-9-]+\/news\/$/.test(url)) continue;
      select.add(new Option(name + ' · ' + publisher, url));
    }
    if (select.options.length <= 1) return;
    desk.hidden = false;
    select.addEventListener('change', () => {
      sourceLink.hidden = !select.value;
      if (select.value) {
        sourceLink.href = select.value;
      } else {
        sourceLink.removeAttribute('href');
      }
    });
  }

  loadAlternativeSites();
  Promise.allSettled([
    read('data/cbb-247sports-team-sites.json'),
    refreshHeadlines()
  ]).then(([directory]) => {
    if (directory.status === 'fulfilled' && Array.isArray(directory.value)) {
      for (const [slug, name] of directory.value) {
        if (!/^[a-z0-9-]+$/.test(slug) || typeof name !== 'string') continue;
        publishers.set(slug, name);
        schools.add(new Option(name, slug));
      }
      schools.disabled = publishers.size === 0;
    }
    render();
  });
})();
