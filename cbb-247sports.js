(() => {
  'use strict';
  function start(teamDesk = null, teamName = '', teamGender = '') {
    const schools = document.getElementById('cbb-247-school');
    const link = (teamDesk || document).querySelector('#' + 'cbb-247-school-link');
    const status = (teamDesk || document).querySelector('#' + 'cbb-247-status');
    const headlines = (teamDesk || document).querySelector('#' + 'cbb-247-headlines');
    if (!teamDesk && (!schools || !headlines)) return;
    const gender = teamGender || (new URLSearchParams(location.search).get('gender') === 'women' ? 'women' : 'men');
    let teamSlug = '';
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
        const local = await read('data/cbb-247sports-headlines.json').catch(()=>null);
        // The separate news collector may commit before the full Pages deployment.
        // Prefer its authenticated repository snapshot only when it is newer.
        const upstream = await read('https://raw.githubusercontent.com/jbryancoburn-netizen/sporting-life-times/main/data/cbb-247sports-headlines.json?ts='+Date.now()).catch(()=>null);
        const next = Array.isArray(upstream?.articles) && Date.parse(upstream.updated_at)>Date.parse(local?.updated_at||0)
          ? upstream : local;
        if(!next)throw Error('School news source unavailable');
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
      const slug = teamDesk ? teamSlug : schools.value;
      if (teamDesk && !slug) return;
      const school = publishers.get(slug);
      link.hidden = !school;
      if (school) link.href = 'https://247sports.com/college/' + slug + '/news/?sport=basketball';
      else link.removeAttribute('href');
      headlines.replaceChildren();
      if (!wire) {
        status.textContent = '247Sports headlines are unavailable. The school links remain available.';
        return;
      }
      const seen = new Set();
      const stories = wire.articles.filter(article => {
        if (!article.verified_school_origin || !publishers.has(article.slug) || article.gender !== gender || (school && slug !== article.slug) ||
            !publisherURL(article) || !Number.isFinite(Date.parse(article.published_at)) ||
            Date.now() - Date.parse(article.published_at) > 5 * 86400000) return false;
        if (!school && seen.has(article.slug)) return false;
        seen.add(article.slug);
        return true;
      }).slice(0, school ? 8 : 10);
      const edition = gender === 'women' ? 'women’s' : 'men’s';
      const check = school ? wire.checked?.[slug] : null;
      const lastSuccess = check?.last_success_at || (check?.available ? check.at : null);
      const formatTime = value => value && Number.isFinite(Date.parse(value))
        ? clock.format(new Date(value)) + ' ET' : '';
      const lastUpdated = formatTime(lastSuccess);
      const lastAttempt = formatTime(check?.at);
      if (!school) {
        const collected = formatTime(wire.updated_at);
        status.textContent = Date.now() - Date.parse(wire.updated_at) > 60 * 60 * 1000 && collected
          ? 'Last collected ' + collected + '.'
          : stories.length ? '' : 'No recent ' + edition + ' basketball headlines from 247Sports.';
      } else if (stories.length) {
        status.textContent = !check?.available || Date.now() - Date.parse(lastSuccess) > 60 * 60 * 1000
          ? 'Showing saved headlines.' + (lastUpdated ? ' Last collected ' + lastUpdated + '.' : '')
          : '';
      } else if (check?.available) {
        status.textContent = 'No recent ' + edition + ' basketball headlines from 247Sports for ' + school + '.';
      } else {
        status.textContent = check
          ? 'Couldn’t refresh this school’s headlines.' + (lastAttempt ? ' Last attempt ' + lastAttempt + '.' : '')
          : 'This school is awaiting its first 247Sports check.';
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

    schools?.addEventListener('change', () => {
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
      const statusLine = document.getElementById('cbb-on3-status');
      const storyList = document.getElementById('cbb-on3-headlines');
      if (!statusLine || !storyList) return;
      let feeds = {};
      let pending = false;
      const category = gender === 'women' ? 'womens-basketball' : 'basketball';

      function renderAlternative() {
        const source = select.value;
        storyList.replaceChildren();
        sourceLink.hidden = !source;
        if (!source) {
          sourceLink.removeAttribute('href');
          statusLine.textContent = '';
          return;
        }
        const schoolSite = source.slice(0, -'/news/'.length);
        sourceLink.href = schoolSite + '/category/' + category + '/news/';
        const stories = (feeds[source]?.articles || []).filter(story =>
          story.url.startsWith(schoolSite + '/news/') &&
          Number.isFinite(Date.parse(story.published_at)) &&
          Date.now() - Date.parse(story.published_at) <= 14 * 86400000
        );
        statusLine.textContent = stories.length ? '' : 'No recent headlines available here. Open the publisher’s basketball desk for more.';
        for (const story of stories) {
          const card = document.createElement('article');
          card.className = 'cbb-news-story';
          const meta = document.createElement('p');
          meta.className = 'cbb-news-eyebrow';
          meta.textContent = clock.format(new Date(story.published_at)) + ' ET' + (story.premium ? ' · Subscriber' : '');
          const heading = document.createElement('h4');
          const original = document.createElement('a');
          original.href = story.url;
          original.target = '_blank';
          original.rel = 'noopener noreferrer';
          original.textContent = story.title;
          heading.append(original);
          card.append(meta, heading);
          storyList.append(card);
        }
      }

      async function refreshAlternative() {
        if (pending) return;
        pending = true;
        try {
          const wire = await read('data/cbb-on3-rivals-headlines.json');
          feeds = wire.feeds?.[gender] || {};
        } catch {
          // Keep the latest successful download and the direct publisher link.
        } finally {
          pending = false;
          renderAlternative();
        }
      }

      select.addEventListener('change', () => {
        renderAlternative();
        refreshAlternative();
      });
      window.setInterval(() => {
        if (!document.hidden && select.value) refreshAlternative();
      }, 5 * 60 * 1000);
      refreshAlternative();
    }

    if (!teamDesk) loadAlternativeSites();
    Promise.allSettled([
      read('data/cbb-247sports-team-sites.json'),
      refreshHeadlines()
    ]).then(([directory]) => {
      if (directory.status === 'fulfilled' && Array.isArray(directory.value)) {
        for (const [slug, name] of directory.value) {
          if (!/^[a-z0-9-]+$/.test(slug) || typeof name !== 'string') continue;
          publishers.set(slug, name);
          schools?.add(new Option(name, slug));
        }
        if (schools) schools.disabled = publishers.size === 0;
      }
      if (teamDesk) {
        const normalize = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const name = normalize(teamName);
        // A team headline carries its mascot (e.g. "Indiana Hoosiers"), while the
        // publisher directory normally contains only the university name.
        // Match the longest unique school stem without guessing between campuses.
        const matches=[...publishers].filter(([slug,school])=>{
          const stem=normalize(school),short=normalize(slug);
          return stem===name||short===name||name.startsWith(stem);
        }).sort((a,b)=>normalize(b[1]).length-normalize(a[1]).length);
        teamSlug=matches.length && (matches.length===1||normalize(matches[0][1]).length>normalize(matches[1][1]).length)
          ?matches[0][0]:'';
        if (!teamSlug || !teamDesk.isConnected) return;
        teamDesk.hidden = false;
      }
      render();
    });
  }

  window.SLTCBB247 = { mount: start };
  start();
})();
