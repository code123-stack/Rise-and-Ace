// Rise and Ace server: student accounts, saved test history, and a safe AI connection.
// Needs Node.js 18 or newer. No extra packages to install.
//   Start:  node server/server.js      then open http://localhost:3000
//   AI:     set AI_API_URL, AI_API_KEY and AI_MODEL as environment variables before starting.
//           The key stays on the server and is never sent to students' browsers.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), DATA = process.env.DATA_DIR || path.join(__dirname, 'data'), PORT = process.env.PORT || 3000;
const AI = { url: process.env.AI_API_URL || '', key: process.env.AI_API_KEY || '', model: process.env.AI_MODEL || '' };
const aiOn = () => !!(AI.url && AI.key && AI.model);
fs.mkdirSync(DATA, { recursive: true });

const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return d; } };
const save = (f, o) => { const p = path.join(DATA, f); fs.writeFileSync(p + '.tmp', JSON.stringify(o)); fs.renameSync(p + '.tmp', p); };
const users = load('users.json', {}), sessions = load('sessions.json', {}), attempts = load('attempts.json', {});

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
// Hashing runs off the main thread so one sign-up or login does not make other students wait.
const hashPw = (pw, salt) => new Promise((ok, bad) => crypto.scrypt(pw, salt, 64, (e, k) => e ? bad(e) : ok(k.toString('hex'))));
const MONTH = 30 * 24 * 3600 * 1000;
const hits = {};
function limited(key, max, ms) {
  const now = Date.now(), a = (hits[key] || []).filter(t => now - t < ms);
  a.push(now); hits[key] = a; return a.length > max;
}
setInterval(() => { const now = Date.now(); for (const k in hits) if (!hits[k].some(t => now - t < 3600000)) delete hits[k]; }, 600000).unref();

function send(res, code, obj, headers) { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {})); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((ok, bad) => {
    let s = '', n = 0;
    req.on('data', c => { n += c.length; if (n > 100000) { bad(new Error('too large')); req.destroy(); } else s += c; });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { bad(new Error('bad json')); } });
    req.on('error', bad);
  });
}
function currentUser(req) {
  const m = /(?:^|;\s*)ra_session=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const s = sessions[sha(m[1])];
  if (!s || s.exp < Date.now() || !users[s.email]) return null;
  return { email: s.email, name: users[s.email].name, tokenHash: sha(m[1]) };
}
function startSession(req, email) {
  const token = crypto.randomBytes(32).toString('hex');
  for (const k in sessions) if (sessions[k].exp < Date.now()) delete sessions[k];
  sessions[sha(token)] = { email, exp: Date.now() + MONTH }; save('sessions.json', sessions);
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return { 'Set-Cookie': 'ra_session=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + MONTH / 1000 + secure };
}

async function api(req, res, route) {
  // Behind a hosting proxy every visitor shares the proxy's address, so prefer the forwarded visitor address.
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  const me = currentUser(req);
  if (req.method === 'GET' && route === 'config') return send(res, 200, { accounts: true, ai: aiOn(), user: me ? { name: me.name, email: me.email } : null });
  if (req.method === 'GET' && route === 'attempts') { if (!me) return send(res, 401, { error: 'Please log in.' }); return send(res, 200, { attempts: attempts[me.email] || [] }); }
  if (req.method !== 'POST') return send(res, 404, { error: 'Not found.' });
  if (!/^application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Unsupported request.' });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: 'The request could not be read.' }); }

  if (route === 'register') {
    if (limited('reg:' + ip, 60, 3600000)) return send(res, 429, { error: 'Too many sign-ups from this network. Please try again later.' });
    const name = String(b.name || '').trim().slice(0, 60), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (!name) return send(res, 400, { error: 'Please enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return send(res, 400, { error: 'Please enter a valid email address.' });
    if (pw.length < 8 || pw.length > 200) return send(res, 400, { error: 'Please choose a password with at least 8 characters.' });
    if (Object.prototype.hasOwnProperty.call(users, email)) return send(res, 409, { error: 'An account with this email already exists. Please log in.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await hashPw(pw, salt);
    if (Object.prototype.hasOwnProperty.call(users, email)) return send(res, 409, { error: 'An account with this email already exists. Please log in.' });
    users[email] = { name, salt, hash, created: new Date().toISOString() }; save('users.json', users);
    return send(res, 200, { user: { name, email } }, startSession(req, email));
  }
  if (route === 'login') {
    const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (limited('login:' + ip + ':' + email, 10, 900000)) return send(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
    const u = Object.prototype.hasOwnProperty.call(users, email) ? users[email] : null;
    const good = u && crypto.timingSafeEqual(Buffer.from(await hashPw(pw.slice(0, 200), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!good) return send(res, 401, { error: 'The email or password is not correct.' });
    return send(res, 200, { user: { name: u.name, email } }, startSession(req, email));
  }
  if (route === 'logout') {
    if (me) { delete sessions[me.tokenHash]; save('sessions.json', sessions); }
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'ra_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0' });
  }
  if (route === 'attempts') {
    if (!me) return send(res, 401, { error: 'Please log in.' });
    const a = { exam: String(b.exam || '').slice(0, 120), date: String(b.date || '').slice(0, 20), score: Number(b.score) || 0, max: Number(b.max) || 0, accuracy: Number(b.accuracy) || 0 };
    if (Array.isArray(b.topics)) a.topics = b.topics.slice(0, 40).filter(t => t && typeof t.name === 'string' && t.name.trim()).map(t => {
      const total = Math.min(1000, Math.max(0, Math.floor(Number(t.total) || 0)));
      return { name: t.name.trim().slice(0, 100), correct: Math.min(total, Math.max(0, Math.floor(Number(t.correct) || 0))), total };
    }).filter(t => t.total > 0);
    const list = attempts[me.email] || (attempts[me.email] = []);
    list.unshift(a); list.length = Math.min(list.length, 200); save('attempts.json', attempts);
    return send(res, 200, { ok: true });
  }
  if (route === 'ai') {
    if (!aiOn()) return send(res, 503, { error: 'The AI tutor is not switched on yet.' });
    if (limited('ai:' + (me ? me.email : ip), 30, 60000)) return send(res, 429, { error: 'You are asking very fast. Please wait a minute.' });
    const msgs = Array.isArray(b.messages) ? b.messages.slice(-30) : [];
    const clean = msgs.filter(m => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!clean.length) return send(res, 400, { error: 'Please type a question.' });
    try {
      const r = await fetch(AI.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI.key }, body: JSON.stringify({ model: AI.model, messages: clean }) });
      if (!r.ok) return send(res, 502, { error: 'The AI service returned an error (' + r.status + ').' });
      const d = await r.json();
      return send(res, 200, { reply: (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '' });
    } catch (e) { return send(res, 502, { error: 'The AI service could not be reached.' }); }
  }
  return send(res, 404, { error: 'Not found.' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
const fileCache = {};
function serveFile(req, res, urlPath) {
  let rel; try { rel = decodeURIComponent(urlPath); } catch (e) { rel = '/'; }
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.normalize(path.join(ROOT, rel));
  const inside = path.relative(ROOT, full);
  // Never serve the server folder (it holds student data), hidden files, or anything outside the site.
  if (inside.startsWith('..') || path.isAbsolute(inside) || /^server(\/|\\|$)/i.test(inside) || /^(package\.json|render\.yaml|DEPLOY\.txt|README\.txt)$/i.test(inside) || inside.split(/[\\/]/).some(p => p.startsWith('.'))) { res.writeHead(404); return res.end('Not found'); }
  // Pages are kept in memory (refreshed every 30 seconds) and sent compressed, so they stay fast
  // even while many students are signing up or logging in.
  let c = fileCache[full];
  if (!c || Date.now() - c.at > 30000) {
    try { const buf = fs.readFileSync(full); c = fileCache[full] = { at: Date.now(), buf, gz: zlib.gzipSync(buf) }; }
    catch (e) { delete fileCache[full]; res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const head = { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Accept-Encoding' };
  if (gz) head['Content-Encoding'] = 'gzip';
  res.writeHead(200, head);
  res.end(req.method === 'HEAD' ? undefined : (gz ? c.gz : c.buf));
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) return api(req, res, u.pathname.slice(5)).catch(() => send(res, 500, { error: 'Something went wrong.' }));
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveFile(req, res, u.pathname);
}).listen(PORT, () => console.log('Rise and Ace is running at http://localhost:' + PORT + (aiOn() ? ' (AI tutor on)' : ' (AI tutor off: no AI key set)')));
