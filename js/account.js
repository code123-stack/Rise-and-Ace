// Student account page: sign up, log in, log out. Works when the site runs through server/server.js.
(function () {
  const app = document.getElementById('app');
  let tab = 'login';
  function draw(msg) {
    if (!RA.server && !RA.device) {
      app.replaceChildren(h('h1', {}, 'Student account'),
        h('div', { class: 'note' }, 'Accounts are not switched on here. They work when the site is started with the included server (see README.txt). Until then you can use everything as a guest, and your test history is saved on this device.'),
        h('a', { class: 'btn primary', href: 'tests.html' }, 'Continue as guest'));
      return;
    }
    if (RA.user) {
      app.replaceChildren(h('h1', {}, 'Hello, ' + RA.user.name),
        h('p', { class: 'muted' }, RA.user.email),
        h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('b', {}, RA.attempts.length), 'Tests taken'),
          h('div', { class: 'stat' }, h('b', {}, RA.attempts.length ? Math.round(RA.attempts.reduce((a, x) => a + x.accuracy, 0) / RA.attempts.length) + '%' : '-'), 'Average accuracy')),
        RA.overallTopics(RA.attempts),
        h('p', {}, RA.device ? 'This account and its test history are saved on this device only.' : 'Your test history is saved to your account, so you can see it on any device after logging in.'),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: 'tests.html' }, 'Go to mock tests'),
          h('button', { class: 'btn', onclick: async () => { try { await RA.api('logout', {}); } catch (e) { } location.reload(); } }, 'Log out')));
      return;
    }
    const name = h('input', { type: 'text', placeholder: 'Your name', autocomplete: 'name' });
    const email = h('input', { type: 'text', placeholder: 'Email address', autocomplete: 'email', inputmode: 'email' });
    const pw = h('input', { type: 'password', placeholder: tab === 'login' ? 'Password' : 'Password (at least 8 characters)', autocomplete: tab === 'login' ? 'current-password' : 'new-password', style: 'width:100%;padding:10px 12px;border:1px solid #e3e5f2;border-radius:10px;font:inherit' });
    const btn = h('button', { class: 'btn primary block', onclick: go }, tab === 'login' ? 'Log in' : 'Create account');
    async function go() {
      btn.disabled = true;
      try {
        await RA.api(tab, { name: name.value, email: email.value, password: pw.value });
        location.href = 'tests.html';
      } catch (e) { btn.disabled = false; draw(e.message); }
    }
    pw.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    app.replaceChildren(h('h1', {}, 'Student account'),
      h('div', { class: 'tabs' }, h('button', { class: tab === 'login' ? 'on' : '', onclick: () => { tab = 'login'; draw(); } }, 'Log in'),
        h('button', { class: tab === 'register' ? 'on' : '', onclick: () => { tab = 'register'; draw(); } }, 'Create account')),
      msg ? h('div', { class: 'note' }, msg) : null,
      RA.device ? h('p', { class: 'muted' }, 'Your account is saved on this device only.') : null,
      h('div', { class: 'card', style: 'max-width:440px;display:grid;gap:10px' }, tab === 'register' ? name : null, email, pw, btn));
  }
  RA.ready.then(() => draw());
})();
