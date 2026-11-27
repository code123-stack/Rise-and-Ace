// Mock interviews: written, plus spoken (browser speech) when SPOKEN_INTERVIEWS is true in js/config.js, with feedback after every answer.
(function () {
  const app = document.getElementById('app');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function speak(t) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'en-IN'; u.rate = 0.95; speechSynthesis.speak(u); } catch (e) { } }
  function stopAll() { try { speechSynthesis.cancel(); } catch (e) { } try { if (rec) rec.stop(); } catch (e) { } rec = null; }

  function localFeedback(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const fillers = (text.match(/\b(um+|uh+|basically|actually|you know|i mean|kind of|sort of)\b/gi) || []).length;
    const example = /(for example|for instance|when i|once i|in my|during my|i led|i built|i worked)/i.test(text);
    const good = [], fix = [];
    if (words >= 40 && words <= 180) good.push('Your answer is a good length (' + words + ' words).');
    else if (words < 40) fix.push('Your answer is short (' + words + ' words). Add one more point or a short example; aim for 60 to 150 words.');
    else fix.push('Your answer is long (' + words + ' words). Lead with your main point and trim it to about 150 words.');
    if (example) good.push('You supported your point with a personal example, which makes it believable.');
    else fix.push('Add one real example from your own life or work to prove your point.');
    if (/\d/.test(text)) good.push('You used specific numbers or facts.'); else fix.push('Where you can, add a number or a concrete fact.');
    if (fillers > 2) fix.push('You used ' + fillers + ' filler words. A short pause sounds more confident than a filler.');
    if (!good.length) good.push('You attempted the question, and that is the first step.');
    return { good, fix, words };
  }

  function home() {
    stopAll();
    let type = RA_INTERVIEWS[0].id, mode = 'written';
    const typeSel = h('select', { onchange: e => type = e.target.value }, RA_INTERVIEWS.map(i => h('option', { value: i.id }, i.name)));
    const spokenOn = RA.cfg.SPOKEN_INTERVIEWS === true;  // switch on in js/config.js after testing the microphone
    const modeSel = h('select', { onchange: e => mode = e.target.value }, h('option', { value: 'written' }, 'Written interview (type your answers)'), h('option', { value: 'spoken' }, 'Spoken interview (the interviewer speaks, you answer aloud)'));
    app.replaceChildren(
      h('h1', {}, 'Mock interviews'),
      h('p', { class: 'muted' }, 'Practise with an interviewer that asks one question at a time and gives you feedback after each answer.'),
      h('div', { class: 'card' },
        h('label', {}, 'Interview type'), typeSel, h('div', { style: 'height:10px' }),
        spokenOn ? [h('label', {}, 'Mode'), modeSel] : null,
        h('button', { class: 'btn primary block', onclick: () => run(RA_INTERVIEWS.find(i => i.id === type), mode) }, 'Start interview')),
      !spokenOn && !RA.hasAI() ? null : h('div', { class: 'note' }, (!spokenOn ? '' : SR ? 'Spoken mode uses your browser\'s microphone. It needs the site to be opened from a web address (https), so it may not work when you open the files directly from your phone or computer.' : 'This browser does not support speech-to-text, so in spoken mode the interviewer will speak and you can type. Chrome supports it fully.') +
        (RA.hasAI() ? ' AI feedback is switched on.' : '')));
  }

  function run(iv, mode) {
    let i = 0; const results = [];
    function question() {
      stopAll();
      const q = iv.questions[i];
      const box = h('textarea', { placeholder: mode === 'spoken' ? 'Your spoken answer will appear here. You can also type or edit it.' : 'Type your answer here.' });
      const out = h('div', {});
      const micBtn = SR && mode === 'spoken' ? h('button', { class: 'btn', onclick: mic }, 'Start speaking') : null;
      const submit = h('button', { class: 'btn primary', onclick: done }, 'Submit answer');
      function mic() {
        if (rec) { stopAll(); micBtn.textContent = 'Start speaking'; return; }
        try {
          rec = new SR(); rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = false;
          rec.onresult = e => { for (let k = e.resultIndex; k < e.results.length; k++) box.value += (box.value ? ' ' : '') + e.results[k][0].transcript.trim(); };
          rec.onerror = () => { out.replaceChildren(h('div', { class: 'note' }, 'The microphone could not be used here. Please type your answer instead.')); rec = null; micBtn.textContent = 'Start speaking'; };
          rec.onend = () => { rec = null; micBtn.textContent = 'Start speaking'; };
          rec.start(); micBtn.textContent = 'Stop speaking';
        } catch (e) { rec = null; }
      }
      async function done() {
        const text = box.value.trim(); if (!text) { out.replaceChildren(h('div', { class: 'note' }, 'Please give an answer first. Even a short one is fine.')); return; }
        stopAll(); submit.disabled = true;
        const fb = localFeedback(text); let ai = '';
        if (RA.hasAI()) {
          out.replaceChildren(h('p', { class: 'muted' }, 'Reviewing your answer...'));
          try { ai = await RA.askAI([{ role: 'system', content: 'You are a kind, realistic interviewer for a ' + iv.name + ' in India. Give feedback on the candidate\'s answer: first what was good, then two or three specific improvements, then a score out of 10. Be encouraging and brief.' }, { role: 'user', content: 'Question: ' + q.q + '\nAnswer: ' + text }]); } catch (e) { ai = ''; }
        }
        results.push({ q: q.q, words: fb.words, fixes: fb.fix.length });
        out.replaceChildren(h('div', { class: 'card', style: 'margin-top:12px' },
          h('h3', {}, 'Feedback'),
          ai ? h('p', { style: 'white-space:pre-wrap' }, ai) : [
            h('p', { class: 'good' }, 'What went well'), h('ul', {}, fb.good.map(x => h('li', {}, x))),
            fb.fix.length ? [h('p', { style: 'font-weight:700;color:#d97706' }, 'What to improve'), h('ul', {}, fb.fix.map(x => h('li', {}, x)))] : null],
          h('p', {}, h('b', {}, 'A strong answer usually: '), q.tip),
          h('button', { class: 'btn primary', onclick: () => { i++; i < iv.questions.length ? question() : summary(); } }, i + 1 < iv.questions.length ? 'Next question' : 'Finish interview')));
      }
      app.replaceChildren(
        h('h1', {}, iv.name),
        h('p', { class: 'muted' }, 'Question ' + (i + 1) + ' of ' + iv.questions.length),
        h('div', { class: 'card' }, h('p', { class: 'qtext' }, q.q),
          mode === 'spoken' ? h('button', { class: 'btn', onclick: () => speak(q.q) }, 'Hear the question again') : null),
        h('div', { style: 'height:12px' }), box,
        h('div', { class: 'row' }, micBtn, submit, h('button', { class: 'btn', onclick: home }, 'End interview')), out);
      if (mode === 'spoken') speak(q.q);
      window.scrollTo(0, 0);
    }
    function summary() {
      stopAll();
      const avg = Math.round(results.reduce((a, r) => a + r.words, 0) / results.length);
      app.replaceChildren(
        h('h1', {}, 'Interview complete'),
        h('p', {}, 'Well done for completing all ' + results.length + ' questions. Each practice round makes the real one easier.'),
        h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('b', {}, results.length), 'Questions answered'), h('div', { class: 'stat' }, h('b', {}, avg), 'Average words per answer'), h('div', { class: 'stat' }, h('b', {}, results.filter(r => r.fixes === 0).length), 'Answers with nothing to fix')),
        h('div', { class: 'card' }, h('table', {}, h('tr', {}, h('th', {}, 'Question'), h('th', {}, 'Words'), h('th', {}, 'Points to improve')),
          results.map(r => h('tr', {}, h('td', {}, r.q), h('td', {}, r.words), h('td', {}, r.fixes))))),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: home }, 'Try another interview')));
      window.scrollTo(0, 0);
    }
    question();
  }
  RA.ready.then(home);
})();
