// Video search: shows results inside the page when a YouTube key is set in js/config.js,
// otherwise opens the same search on YouTube.
(function () {
  const app = document.getElementById('app');
  // YouTube sends titles with codes like &amp; and &#39; in them; turn those back into normal characters.
  const plain = t => { const a = document.createElement('textarea'); a.innerHTML = String(t || ''); return a.value; };
  const key = RA.cfg.YOUTUBE_API_KEY;
  const input = h('input', { type: 'text', placeholder: 'Search a topic, for example: projectile motion JEE', onkeydown: e => { if (e.key === 'Enter') search(); } });
  const out = h('div', { style: 'margin-top:16px' });
  const ideas = ['Projectile motion JEE', 'Human physiology NEET', 'Indian polity UPSC', 'Time and work SSC', 'Bank PO interview tips', 'Organic chemistry basics'];
  app.replaceChildren(
    h('h1', {}, 'Video search'),
    h('p', { class: 'muted' }, 'Find the most relevant lessons for any topic or exam.'),
    h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:220px' }, input), h('button', { class: 'btn primary', onclick: search }, 'Search')),
    h('div', { style: 'margin-top:10px' }, ideas.map(t => h('button', { class: 'tag', style: 'border:0;cursor:pointer', onclick: () => { input.value = t; search(); } }, t))),
    key ? null : h('div', { class: 'note' }, 'Results inside this page are not switched on yet. Add a YouTube key in js/config.js to enable them. Until then, searches open on YouTube.'),
    out);

  async function search() {
    const q = input.value.trim(); if (!q) return;
    const yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q + ' lecture');
    if (!key) {
      out.replaceChildren(h('div', { class: 'card' }, h('h3', {}, 'Lessons for "' + q + '"'), h('a', { class: 'btn primary', href: yt, target: '_blank', rel: 'noopener' }, 'Open results on YouTube')));
      return;
    }
    out.replaceChildren(h('p', { class: 'muted' }, 'Searching...'));
    try {
      const r = await fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12&relevanceLanguage=en&regionCode=IN&q=' + encodeURIComponent(q) + '&key=' + encodeURIComponent(key));
      if (!r.ok) throw new Error('status ' + r.status);
      const d = await r.json(), items = (d.items || []).filter(i => i.id && i.id.videoId);
      if (!items.length) { out.replaceChildren(h('p', {}, 'No videos found. Try different words.')); return; }
      out.replaceChildren(h('div', { class: 'grid' }, items.map(i => {
        const holder = h('div', {}), s = i.snippet || {};
        const thumb = s.thumbnails && (s.thumbnails.medium || s.thumbnails.default);
        holder.append(h('a', { class: 'vid', href: '#', onclick: e => { e.preventDefault(); holder.replaceChildren(h('div', { class: 'vid' }, h('iframe', { src: 'https://www.youtube.com/embed/' + encodeURIComponent(i.id.videoId) + '?autoplay=1', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: '' }))); } },
          thumb ? h('img', { src: thumb.url, alt: '' }) : null));
        return h('div', { class: 'card' }, holder, h('p', { style: 'font-weight:700;margin:8px 0 2px' }, plain(s.title) || 'Video'), h('p', { class: 'muted', style: 'margin:0' }, plain(s.channelTitle)));
      })));
    } catch (e) {
      out.replaceChildren(h('div', { class: 'note' }, 'Could not load results here (' + e.message + '). ', h('a', { href: yt, target: '_blank', rel: 'noopener' }, 'Open the search on YouTube instead.')));
    }
  }
})();
