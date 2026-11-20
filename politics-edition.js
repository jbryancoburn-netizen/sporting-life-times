(() => {
  const date = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', dateStyle: 'full'});
  const stamp = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short'});
  document.getElementById('edition-date').textContent = date.format(new Date());
  const front = document.getElementById('news-front');
  const wire = document.getElementById('news-wire');
  const publisher = document.getElementById('publisher');
  const status = document.getElementById('news-status');
  const more = document.getElementById('news-more');
  let articles = [];
  let featured = new Set();
  let limit = 18;

  function story(item) {
    const article = document.createElement('article');
    article.className = 'story';
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = item.url;
    link.textContent = item.title;
    heading.append(link);
    const meta = document.createElement('p');
    meta.className = 'story-meta';
    meta.textContent = item.source + ' · ' + stamp.format(Date.parse(item.published_at)) + ' ET';
    article.append(meta, heading);
    return article;
  }

  function renderWire() {
    const selection = articles.filter(item => publisher.value ? item.source === publisher.value : !featured.has(item.url));
    wire.replaceChildren(...selection.slice(0, limit).map(story));
    more.hidden = limit >= selection.length;
  }

  async function refresh() {
    try {
      const response = await fetch('politics-news.json', {cache: 'no-cache', signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Feed unavailable');
      const data = await response.json();
      const fresh = data.articles.filter(item => item.title && item.source &&
        /^https:\/\//i.test(item.url) && Number.isFinite(Date.parse(item.published_at)))
        .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
      const checked = Date.parse(data.updated_at);
      if (!fresh.length || !Number.isFinite(checked)) throw new Error('Invalid feed');
      articles = fresh;
      status.textContent = (Date.now() - checked > 3 * 3600000 ? 'Last available edition · ' : 'Feed updated ') + stamp.format(checked) + ' ET';
      const distinct = new Set();
      const lead = fresh.filter(item => {
        if (distinct.has(item.source)) return false;
        distinct.add(item.source);
        return true;
      }).slice(0, 6);
      featured = new Set(lead.map(item => item.url));
      const columns = [lead.slice(0, 2), lead.slice(2, 4), lead.slice(4)].filter(items => items.length);
      front.replaceChildren(...columns.map((items, index) => {
        const column = document.createElement('div');
        if (!index) column.className = 'lead-col';
        column.append(...items.map(story));
        return column;
      }));
      const previous = publisher.value;
      publisher.replaceChildren(new Option('All publishers', ''), ...[...distinct].sort().map(source => new Option(source, source)));
      if (distinct.has(previous)) publisher.value = previous;
      renderWire();
    } catch {
      status.textContent = articles.length ? 'Feed temporarily unavailable · Showing last loaded headlines' : 'Headlines temporarily unavailable';
    }
  }
  publisher.addEventListener('change', () => { limit = 18; renderWire(); });
  more.addEventListener('click', () => { limit += 18; renderWire(); });
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 120000);
})();
