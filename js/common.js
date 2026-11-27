// Shared helpers: element builder, navigation, accounts and the AI call.
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  props = props || {};
  for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  kids.flat(Infinity).forEach(c => {
    if (c == null || c === false) return;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  });
  return e;
}

// Lets pages pass lists and empty values straight to append/replaceChildren:
// lists are flattened and empty values are skipped instead of being printed as text.
['append', 'replaceChildren'].forEach(function (m) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function () {
    return orig.apply(this, Array.prototype.slice.call(arguments).flat(Infinity).filter(c => c != null && c !== false));
  };
});

const RA = {
  cfg: window.RA_CONFIG || {},
  server: false,    // true when the site is running through server/server.js
  serverAI: false,  // true when the server has an AI key
  user: null,       // logged-in student, or null for a guest
  attempts: [],     // logged-in student's saved test history
  hasAI() { return this.serverAI || !!(this.cfg.AI_API_URL && this.cfg.AI_API_KEY && this.cfg.AI_MODEL); },
  async api(route, body) {
    if (this.device && route !== 'config') return RA.deviceApi(route, body);
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' } : { credentials: 'same-origin' };
    const r = await fetch('api/' + route, opt);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
    return d;
  },
  async askAI(messages) {
    if (this.serverAI) return (await this.api('ai', { messages })).reply;
    const r = await fetch(this.cfg.AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.cfg.AI_API_KEY },
      body: JSON.stringify({ model: this.cfg.AI_MODEL, messages })
    });
    if (!r.ok) throw new Error('The AI service returned an error (' + r.status + ').');
    const d = await r.json();
    return d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : '';
  },
  TUTOR_PROMPT: 'You are the Rise and Ace tutor for students in India preparing for competitive exams, university exams and interviews. Be warm and patient. When the student is right, appreciate it specifically. When the student is wrong, never scold: say what was good in their thinking, then correct it step by step in simple words. Keep answers short and clear.'
};

// Weak and strong topics. Strong: 75% or more correct. Weak: under 50% correct (unanswered counts as not correct).
RA.level = (correct, total) => { const p = total ? correct * 100 / total : 0; return p >= 75 && correct > 0 ? 'strong' : p < 50 ? 'weak' : 'mid'; };
RA.topicLists = function (rows, opts) {
  opts = opts || {};
  const item = r => h('li', {}, h('b', {}, r.name), ': ' + r.correct + ' of ' + r.total + ' correct' + (r.skipped ? ' (' + r.skipped + ' not attempted)' : ''));
  const by = lv => rows.filter(r => RA.level(r.correct, r.total) === lv).sort((x, y) => x.correct / x.total - y.correct / y.total);
  const weak = by('weak'), mid = by('mid'), strong = by('strong').reverse();
  return h('div', { class: 'grid' },
    h('div', { class: 'card', 'data-level': 'weak' }, h('h3', {}, opts.weakTitle || 'Weak topics to work on'),
      weak.length ? h('ul', {}, weak.map(item)) : h('p', { class: 'good' }, 'No weak topics here. Great job.'),
      weak.length ? h('p', { class: 'muted' }, 'Every mistake is a step up. Take these one at a time.') : null),
    h('div', { class: 'card', 'data-level': 'strong' }, h('h3', {}, opts.strongTitle || 'Your strong topics'),
      strong.length ? h('ul', {}, strong.map(item)) : h('p', { class: 'muted' }, 'No strong topics yet. They will appear here as you practise, so keep going.'),
      strong.length ? h('p', { class: 'good' }, 'Well done. Keep these sharp with a quick revision now and then.') : null),
    mid.length ? h('div', { class: 'card', 'data-level': 'mid' }, h('h3', {}, 'Needs a little more practice'), h('ul', {}, mid.map(item))) : null);
};
// Overall summary across all saved attempts. Returns null when there is nothing to show.
RA.overallTopics = function (attempts) {
  const m = {};
  (attempts || []).forEach(a => (Array.isArray(a.topics) ? a.topics : []).forEach(t => {
    if (!t || !t.name || !(t.total > 0)) return;
    const x = m[t.name] || (m[t.name] = { name: t.name, correct: 0, total: 0 });
    x.correct += Number(t.correct) || 0; x.total += Number(t.total) || 0;
  }));
  const rows = Object.values(m);
  if (!rows.length) return null;
  return h('div', { id: 'overall-topics' }, h('h2', {}, 'Your weak and strong topics so far'),
    h('p', { class: 'muted' }, 'Combined from all the tests you have taken.'), RA.topicLists(rows));
};

// ---- Device-only accounts (used when the site runs without server/server.js) ----
// Accounts and test history live in this browser's storage. Passwords are never stored:
// only a salted, repeated SHA-256 hash is kept.
RA.sha256 = function (str) {
  const K = [], H = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  for (let n = 2, i = 0; i < 64; n++) { let pr = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { pr = false; break; } if (pr) K[i++] = (Math.pow(n, 1 / 3) * 4294967296) | 0; }
  const bytes = Array.from(new TextEncoder().encode(str)), len = bytes.length * 8;
  bytes.push(128); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (len >>> (i * 8)) & 255);
  const rr = (x, n) => (x >>> n) | (x << (32 - n)), h = H.slice();
  for (let o = 0; o < bytes.length; o += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) | 0; }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, k].forEach((v, i) => { h[i] = (h[i] + v) | 0; });
  }
  return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
};
RA.deviceHash = function (pw, salt) { let x = salt + ':' + pw; for (let i = 0; i < 1500; i++) x = RA.sha256(salt + x); return x; };
RA.deviceStore = function () { try { const s = JSON.parse(localStorage.getItem('ra_device_accounts') || '{}'); return s && s.users ? s : { users: {} }; } catch (e) { return { users: {} }; } };
RA.deviceApi = async function (route, b) {
  const st = RA.deviceStore(), put = () => localStorage.setItem('ra_device_accounts', JSON.stringify(st));
  const has = em => Object.prototype.hasOwnProperty.call(st.users, em);
  const fail = m => { throw new Error(m); };
  if (route === 'register') {
    const name = String(b.name || '').trim().slice(0, 60), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (!name) fail('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) fail('Please enter a valid email address.');
    if (pw.length < 8 || pw.length > 200) fail('Please choose a password with at least 8 characters.');
    if (has(email)) fail('An account with this email already exists. Please log in.');
    const sb = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(sb) : sb.forEach((_, i) => { sb[i] = Math.floor(Math.random() * 256); });
    const salt = Array.from(sb).map(x => x.toString(16).padStart(2, '0')).join('');
    st.users[email] = { name, salt, hash: RA.deviceHash(pw, salt), attempts: [] }; put();
    localStorage.setItem('ra_device_session', email);
    return { user: { name, email } };
  }
  if (route === 'login') {
    const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    const u = has(email) ? st.users[email] : null;
    if (!u || RA.deviceHash(pw, u.salt) !== u.hash) fail('The email or password is not correct.');
    localStorage.setItem('ra_device_session', email);
    return { user: { name: u.name, email } };
  }
  if (route === 'logout') { localStorage.removeItem('ra_device_session'); return { ok: true }; }
  if (route === 'attempts') {
    const em = localStorage.getItem('ra_device_session');
    if (!em || !has(em)) fail('Please log in.');
    if (b) { st.users[em].attempts = [b].concat(st.users[em].attempts || []).slice(0, 200); put(); return { ok: true }; }
    return { attempts: st.users[em].attempts || [] };
  }
  fail('Not available.');
};

// Pages wait for this before drawing, so they know whether a student is logged in.
RA.ready = (async function () {
  if (location.protocol !== 'file:') {
    try {
      const c = await RA.api('config');
      if (c && c.accounts === true) {
        RA.server = true; RA.serverAI = !!c.ai; RA.user = c.user || null;
        if (RA.user) RA.attempts = (await RA.api('attempts')).attempts || [];
      }
    } catch (e) { /* no server: guest mode */ }
  }
  // No server (static hosting or opened as a file): accounts are kept in this browser only.
  if (!RA.server) {
    RA.device = true;
    try {
      const st = RA.deviceStore(), em = localStorage.getItem('ra_device_session');
      if (em && st.users[em]) { RA.user = { name: st.users[em].name, email: em }; RA.attempts = st.users[em].attempts || []; }
    } catch (e) { }
  }
  // Features that need a key stay out of sight until the key is added, then appear on their own.
  const video = !!RA.cfg.YOUTUBE_API_KEY, ai = RA.hasAI();
  document.querySelectorAll('[data-needs="video"]').forEach(e => { if (!video) e.remove(); });
  document.querySelectorAll('[data-ai-text]').forEach(e => { if (ai) e.textContent = e.getAttribute('data-ai-text'); });
  const pages = [['index.html', 'Home'], video ? ['videos.html', 'Videos'] : null, ['tests.html', 'Mock tests'], ['tutor.html', ai ? 'AI tutor' : 'Tutor'], ['interview.html', 'Interviews'], ['lab.html', '3D lab'], ['account.html', RA.user ? RA.user.name.split(' ')[0] : 'Log in']];
  const here = (location.pathname.split('/').pop() || 'index.html');
  const nav = document.getElementById('nav');
  if (nav) nav.replaceChildren(h('div', { class: 'navin' },
    h('a', { class: 'logo', href: 'index.html' }, 'Rise', h('span', {}, 'And'), 'Ace'),
    h('nav', { class: 'links' }, pages.filter(Boolean).map(p => h('a', { href: p[0], class: p[0] === here ? 'on' : '' }, p[1])))));
  const f = document.getElementById('foot');
  if (f) f.textContent = 'Rise and Ace · Every mistake is a step up.';
})();
