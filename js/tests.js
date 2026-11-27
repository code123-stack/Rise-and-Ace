// Mock test engine: timer, question palette, negative marking, and performance analysis.
(function () {
  const app = document.getElementById('app');
  let S = null, tick = null;
  const fmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
  // Logged-in students: history is saved to their account. Guests: saved on this device.
  function hist() { if (RA.user) return RA.attempts; try { return JSON.parse(localStorage.getItem('ra_history') || '[]'); } catch (e) { return []; } }
  function saveHist(r) {
    if (RA.user) { RA.attempts.unshift(r); RA.api('attempts', r).catch(() => { }); return; }
    try { const a = hist(); a.unshift(r); localStorage.setItem('ra_history', JSON.stringify(a.slice(0, 30))); } catch (e) { }
  }

  let curGroup = null;
  const groupOf = e => e.group || e.name;
  function pastBlock() {
    const past = hist();
    return past.length ? h('div', {}, h('h2', {}, 'Your past attempts'), h('p', { class: 'muted' }, RA.user ? (RA.device ? 'Saved to your account on this device.' : 'Saved to your account.') : 'Saved on this device only. ' + (RA.server ? 'Log in to keep your history on every device.' : RA.device ? 'Log in to keep it under your own account.' : '')),
      h('div', { class: 'card', style: 'overflow:auto' }, h('table', {}, h('tr', {}, h('th', {}, 'Test'), h('th', {}, 'Date'), h('th', {}, 'Score'), h('th', {}, 'Accuracy')),
        past.map(p => h('tr', {}, h('td', {}, p.exam), h('td', {}, p.date), h('td', {}, p.score + ' / ' + p.max), h('td', {}, p.accuracy + '%')))))) : null;
  }
  const NOTE = 'These are practice papers written in exam style, not actual previous-year papers.';

  // Home: one card per exam. Tapping a card lists that exam's papers.
  function home() {
    clearInterval(tick); S = null;
    if (curGroup) return papers(curGroup);
    const groups = [];
    RA_EXAMS.forEach(e => { const g = groupOf(e); let x = groups.find(y => y.name === g); if (!x) groups.push(x = { name: g, list: [] }); x.list.push(e); });
    app.replaceChildren(
      h('h1', {}, 'Mock tests'),
      h('p', { class: 'muted' }, 'Attempt a paper like the real exam: a running timer, a question palette, mark for review and negative marking. You get a full analysis at the end.'),
      h('div', { class: 'note' }, NOTE),
      h('input', { type: 'text', placeholder: 'Search an exam or subject, for example: banking, physics, university', style: 'margin-bottom:12px', oninput: ev => { const v = ev.target.value.toLowerCase(); document.querySelectorAll('[data-exam]').forEach(c => { c.style.display = c.getAttribute('data-exam').includes(v) ? '' : 'none'; }); } }),
      h('div', { class: 'grid' }, groups.map(g => {
        const subs = [...new Set(g.list.flatMap(e => e.questions.map(q => q.subject)))];
        const nq = g.list.reduce((a, e) => a + e.questions.length, 0);
        return h('div', { class: 'card', 'data-exam': (g.name + ' ' + subs.join(' ')).toLowerCase() },
          h('h3', {}, g.name),
          h('p', { class: 'muted' }, g.list.length + (g.list.length === 1 ? ' paper · ' : ' papers · ') + nq + ' questions'),
          h('div', {}, subs.map(s => h('span', { class: 'tag' }, s))),
          h('button', { class: 'btn primary block', onclick: () => { curGroup = g.name; papers(g.name); } }, 'View papers'));
      })),
      RA.overallTopics(hist()), pastBlock());
    window.scrollTo(0, 0);
  }

  function papers(group) {
    clearInterval(tick); S = null;
    const list = RA_EXAMS.filter(e => groupOf(e) === group);
    const done = {}; hist().forEach(p => { if (!(p.exam in done)) done[p.exam] = p; });
    app.replaceChildren(
      h('button', { class: 'btn', onclick: () => { curGroup = null; home(); } }, 'All exams'),
      h('h1', {}, group),
      h('div', { class: 'note' }, NOTE),
      h('div', { class: 'grid' }, list.map(e => h('div', { class: 'card', 'data-paper': e.id },
        h('h3', {}, e.name),
        h('p', { class: 'muted' }, e.questions.length + ' questions · ' + e.minutes + ' minutes · +' + e.plus + ' / −' + e.minus),
        done[e.name] ? h('p', { class: 'good' }, 'Last score: ' + done[e.name].score + ' / ' + done[e.name].max) : null,
        h('button', { class: 'btn primary block', onclick: () => start(e) }, done[e.name] ? 'Retake test' : 'Start test'),
        h('button', { class: 'btn block', 'data-key': e.id, onclick: () => answerKey(e) }, 'Answer key')))),
      pastBlock());
    window.scrollTo(0, 0);
  }

  // Answer key: can be opened without attempting the paper. Not offered while a test is running.
  function answerKey(e) {
    if (S) return;
    clearInterval(tick);
    app.replaceChildren(
      h('button', { class: 'btn', onclick: home }, 'Back'),
      h('h1', {}, 'Answer key'),
      h('p', { class: 'muted' }, e.name + ' · ' + e.questions.length + ' questions. Tap a row to see the explanation.'),
      h('div', { class: 'card', style: 'overflow:auto' }, h('table', { id: 'keytable' },
        h('tr', {}, h('th', {}, 'Q'), h('th', {}, 'Answer'), h('th', {}, 'Correct option')),
        e.questions.map((q, k) => {
          const exp = h('tr', { class: 'keyexp', style: 'display:none' }, h('td', { colspan: '3' }, h('p', { style: 'margin:0 0 6px' }, h('b', {}, 'Question: '), q.q), q.exp ? h('p', { style: 'margin:0' }, h('b', {}, 'Explanation: '), q.exp) : null));
          return [h('tr', { class: 'keyrow', style: 'cursor:pointer', onclick: () => { exp.style.display = exp.style.display === 'none' ? '' : 'none'; } },
            h('td', {}, k + 1), h('td', {}, h('b', {}, 'ABCD'[q.ans])), h('td', {}, q.options[q.ans])), exp];
        }))),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: home }, 'Back'), h('button', { class: 'btn primary', onclick: () => start(e) }, 'Start this test')));
    window.scrollTo(0, 0);
  }

  function start(exam) {
    const n = exam.questions.length;
    S = { exam, i: 0, ans: Array(n).fill(null), marked: Array(n).fill(false), shown: Array(n).fill(false), time: Array(n).fill(0), left: exam.minutes * 60 };
    clearInterval(tick);
    tick = setInterval(() => {
      S.left--; S.time[S.i]++;
      const t = document.getElementById('timer');
      if (t) { t.textContent = fmt(S.left); t.className = 'timer' + (S.left <= 60 ? ' low' : ''); }
      if (S.left <= 0) finish();
    }, 1000);
    render(); window.scrollTo(0, 0);
  }

  function go(k) { const n = S.exam.questions.length; S.i = Math.min(n - 1, Math.max(0, k)); render(); }

  function render() {
    const e = S.exam, n = e.questions.length, q = e.questions[S.i];
    app.replaceChildren(
      h('div', { class: 'testbar' }, h('strong', {}, e.name), h('span', { id: 'timer', class: 'timer' + (S.left <= 60 ? ' low' : '') }, fmt(S.left))),
      h('div', { class: 'testgrid' },
        h('div', { class: 'card' },
          h('div', { class: 'muted' }, 'Question ' + (S.i + 1) + ' of ' + n + ' · ' + q.subject),
          h('p', { class: 'qtext' }, q.q),
          h('div', { class: 'opts' }, q.options.map((o, k) => h('button', { class: 'opt' + (S.shown[S.i] ? (k === q.ans ? ' right' : S.ans[S.i] === k ? ' wrong' : '') : S.ans[S.i] === k ? ' sel' : ''), disabled: S.shown[S.i], onclick: () => { S.ans[S.i] = k; render(); } }, h('b', {}, 'ABCD'[k] + '.  '), o))),
          S.shown[S.i] ? h('div', { class: 'note', id: 'shown-answer' }, h('p', { style: 'margin:0 0 6px' }, h('b', {}, 'Correct answer: '), 'ABCD'[q.ans] + '. ' + q.options[q.ans]), q.exp ? h('p', { style: 'margin:0 0 6px' }, h('b', {}, 'Explanation: '), q.exp) : null,
            h('p', { class: 'muted', style: 'margin:0' }, S.ans[S.i] === null ? 'You saw the answer before answering, so this question is counted as not attempted.' : 'Your answer for this question is now locked.')) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn', disabled: S.i === 0, onclick: () => go(S.i - 1) }, 'Previous'),
            h('button', { class: 'btn', disabled: S.shown[S.i], onclick: () => { S.ans[S.i] = null; render(); } }, 'Clear answer'),
            h('button', { class: 'btn', disabled: S.shown[S.i], 'data-show': '1', onclick: () => { S.shown[S.i] = true; render(); } }, S.shown[S.i] ? 'Answer shown' : 'Show answer'),
            h('button', { class: 'btn', onclick: () => { S.marked[S.i] = !S.marked[S.i]; render(); } }, S.marked[S.i] ? 'Unmark review' : 'Mark for review'),
            h('button', { class: 'btn primary', disabled: S.i === n - 1, onclick: () => go(S.i + 1) }, 'Save and next'))),
        h('div', { class: 'card' },
          h('h3', {}, 'Question palette'),
          h('div', { class: 'palette' }, e.questions.map((_, k) => h('button', { class: 'pq ' + (k === S.i ? 'cur ' : '') + (S.marked[k] ? 'mark' : S.ans[k] !== null ? 'done' : ''), onclick: () => go(k) }, k + 1))),
          h('p', { class: 'muted' }, 'Green: answered · Orange: marked for review · White: not answered'),
          h('button', { class: 'btn accent block', onclick: () => {
            const left = S.ans.filter(a => a === null).length;
            if (confirm(left ? 'You have ' + left + ' unanswered question(s). Submit the test?' : 'Submit the test?')) finish();
          } }, 'Submit test'))));
  }

  function finish() {
    clearInterval(tick);
    const e = S.exam, qs = e.questions, n = qs.length;
    let correct = 0, wrong = 0, skipped = 0; const topics = {};
    qs.forEach((q, k) => {
      const key = q.subject + ' · ' + q.topic;
      const t = topics[key] || (topics[key] = { total: 0, correct: 0, wrong: 0, time: 0 });
      t.total++; t.time += S.time[k];
      if (S.ans[k] === null) skipped++;
      else if (S.ans[k] === q.ans) { correct++; t.correct++; }
      else { wrong++; t.wrong++; }
    });
    const score = Math.round((correct * e.plus - wrong * e.minus) * 100) / 100, max = n * e.plus;
    const attempted = correct + wrong, accuracy = pct(correct, attempted), used = S.time.reduce((a, b) => a + b, 0);
    saveHist({ exam: e.name, date: new Date().toLocaleDateString('en-IN'), score, max, accuracy,
      topics: Object.keys(topics).slice(0, 40).map(k => ({ name: k, correct: topics[k].correct, total: topics[k].total })) });
    const rows = Object.keys(topics).map(k => Object.assign({ name: k, acc: pct(topics[k].correct, topics[k].total) }, topics[k])).sort((a, b) => a.acc - b.acc);
    const slow = qs.map((q, k) => ({ k, t: S.time[k] })).sort((a, b) => b.t - a.t).slice(0, 3).filter(x => x.t > 0);
    const msg = accuracy >= 80 ? 'Excellent work. You are clearly prepared, so keep this rhythm going.'
      : accuracy >= 50 ? 'Good effort. You have a solid base, and the topics below are your quickest way to more marks.'
      : 'Well done for finishing the test. Every mistake here is a step up, so start with the weak topics below one at a time.';
    const ans = S.ans.slice();
    app.replaceChildren(
      h('h1', {}, 'Your result: ' + e.name),
      h('p', {}, msg),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, score + ' / ' + max), 'Score'),
        h('div', { class: 'stat' }, h('b', {}, accuracy + '%'), 'Accuracy'),
        h('div', { class: 'stat' }, h('b', {}, correct), 'Correct'),
        h('div', { class: 'stat' }, h('b', {}, wrong), 'Wrong'),
        h('div', { class: 'stat' }, h('b', {}, skipped), 'Not attempted'),
        h('div', { class: 'stat' }, h('b', {}, fmt(used)), 'Time used')),
      h('h2', {}, 'Your weak and strong topics in this test'),
      RA.topicLists(rows.map(r => ({ name: r.name, correct: r.correct, total: r.total, skipped: r.total - r.correct - r.wrong }))),
      h('h2', {}, 'Topic-wise performance'),
      h('div', { class: 'card', style: 'overflow:auto' }, h('table', {},
        h('tr', {}, h('th', {}, 'Topic'), h('th', {}, 'Correct'), h('th', {}, 'Accuracy'), h('th', {}, ''), h('th', {}, 'Avg time')),
        rows.map(r => h('tr', {}, h('td', {}, r.name), h('td', {}, r.correct + ' / ' + r.total), h('td', {}, r.acc + '%'),
          h('td', {}, h('div', { class: 'bar' }, h('i', { class: r.acc >= 75 ? '' : r.acc >= 50 ? 'mid' : 'low', style: 'width:' + r.acc + '%' }))),
          h('td', {}, fmt(r.time / r.total)))))),
      slow.length ? h('div', {}, h('h2', {}, 'Where you spent the most time'),
        h('div', { class: 'card' }, h('ul', {}, slow.map(x => h('li', {}, 'Question ' + (x.k + 1) + ' (' + qs[x.k].topic + '): ' + fmt(x.t) + (ans[x.k] === qs[x.k].ans ? ', answered correctly' : ans[x.k] === null ? ', not answered' : ', answered wrongly')))))) : null,
      h('h2', {}, 'Review every question'),
      qs.map((q, k) => h('div', { class: 'card', style: 'margin-bottom:10px' },
        h('div', { class: 'muted' }, 'Question ' + (k + 1) + ' · ' + q.subject + ' · ' + q.topic + ' · ',
          ans[k] === null ? h('span', {}, 'Not attempted') : ans[k] === q.ans ? h('span', { class: 'good' }, 'Correct') : h('span', { class: 'badc' }, 'Wrong')),
        h('p', { class: 'qtext' }, q.q),
        h('div', { class: 'opts' }, q.options.map((o, j) => h('div', { class: 'opt' + (j === q.ans ? ' right' : j === ans[k] ? ' wrong' : '') }, h('b', {}, 'ABCD'[j] + '.  '), o, j === q.ans ? '  (correct answer)' : j === ans[k] ? '  (your answer)' : ''))),
        h('p', {}, h('b', {}, 'Explanation: '), q.exp))),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: home }, 'Back to papers'), h('button', { class: 'btn', onclick: () => start(e) }, 'Retake this test'), h('button', { class: 'btn', onclick: () => answerKey(e) }, 'Answer key')));
    S = null; window.scrollTo(0, 0);
  }

  RA.ready.then(home);
})();
