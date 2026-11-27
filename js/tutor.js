// AI tutor: guided practice works offline; free-form doubts need an AI key in js/config.js.
(function () {
  const app = document.getElementById('app');
  const pool = RA_EXAMS.flatMap(e => e.questions);
  const subjects = [...new Set(pool.map(q => q.subject))];
  const PRAISE = ['Exactly right! Well done.', 'Correct, and nicely reasoned.', 'Yes! You have understood this well.', 'Spot on. Keep going like this.'];
  const GENTLE = ['Not quite, and that is completely fine. Have one more look at the remaining options.', 'Good try. That option is a common trap, so try once more.', 'Close, but not this one. Take your time and try again.'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let mode = 'practice', chat, history = [];

  function say(text, who) { const m = h('div', { class: 'msg ' + (who || 'ai') }, text); chat.append(m); chat.scrollTop = chat.scrollHeight; return m; }

  function shell() {
    chat = h('div', { class: 'chat card' });
    const body = h('div', {});
    app.replaceChildren(
      h('h1', {}, RA.hasAI() ? 'AI tutor' : 'Tutor'),
      h('p', { class: 'muted' }, 'A patient tutor that appreciates right answers and gently corrects wrong ones.'),
      // "Ask a doubt" needs live AI, so its tab appears only when an AI key is set.
      !RA.hasAI() ? null : h('div', { class: 'tabs' },
        h('button', { class: mode === 'practice' ? 'on' : '', onclick: () => { mode = 'practice'; shell(); } }, 'Practice with the tutor'),
        h('button', { class: mode === 'doubt' ? 'on' : '', onclick: () => { mode = 'doubt'; shell(); } }, 'Ask a doubt')),
      body);
    mode === 'practice' || !RA.hasAI() ? practice(body) : doubt(body);
  }

  function practice(body) {
    const sel = h('select', {}, subjects.map(s => h('option', { value: s }, s)));
    const area = h('div', { style: 'margin-top:12px' });
    body.append(h('div', { class: 'card' }, h('label', {}, 'Choose a subject'), sel, h('button', { class: 'btn primary block', onclick: begin }, 'Start practice')), h('div', { style: 'height:12px' }), chat, area);
    say('Hello! Choose a subject and I will ask you questions one by one. Do not worry about mistakes, that is how we learn.');
    let list = [], idx = 0, right = 0;
    function begin() {
      list = pool.filter(q => q.subject === sel.value).sort(() => Math.random() - 0.5).slice(0, 10); idx = 0; right = 0;
      chat.replaceChildren(); ask();
    }
    function ask() {
      if (idx >= list.length) {
        say('That is the end of this set. You got ' + right + ' of ' + list.length + ' right on the first try. ' + (right === list.length ? 'Brilliant work!' : 'Every mistake is a step up, so try the set again and watch your score rise.'));
        area.replaceChildren(h('button', { class: 'btn primary', onclick: begin }, 'Practise again')); return;
      }
      const q = list[idx]; let tries = 0;
      say('Question ' + (idx + 1) + ' (' + q.topic + '): ' + q.q);
      const btns = q.options.map((o, k) => h('button', { class: 'opt', onclick: () => answer(k) }, h('b', {}, 'ABCD'[k] + '.  '), o));
      area.replaceChildren(h('div', { class: 'opts' }, btns));
      function answer(k) {
        say('ABCD'[k] + '. ' + q.options[k], 'me'); tries++;
        if (k === q.ans) {
          if (tries === 1) right++;
          say((tries === 1 ? pick(PRAISE) : 'Yes, that is it! Well done for not giving up.') + '\n\nWhy: ' + q.exp); next();
        } else if (tries === 1) {
          btns[k].disabled = true; btns[k].classList.add('wrong'); say(pick(GENTLE));
        } else {
          say('No problem at all. The correct answer is ' + 'ABCD'[q.ans] + '. ' + q.options[q.ans] + '.\n\nHere is why: ' + q.exp + '\n\nNow you know it for next time.'); next();
        }
      }
      function next() { idx++; area.replaceChildren(h('button', { class: 'btn primary', onclick: ask }, idx >= list.length ? 'See my result' : 'Next question')); }
    }
  }

  function doubt(body) {
    const input = h('textarea', { placeholder: 'Type your doubt here, for example: Why is the range maximum at 45 degrees?' });
    const send = h('button', { class: 'btn primary', onclick: go }, 'Ask');
    body.append(RA.hasAI() ? null : h('div', { class: 'note' }, 'Live AI answers are not switched on yet. Add your AI key in js/config.js to enable this. "Practice with the tutor" works without it.'),
      chat, h('div', { style: 'height:12px' }), input, h('div', { class: 'row' }, send));
    history = [{ role: 'system', content: RA.TUTOR_PROMPT }];
    say('Ask me any doubt from your syllabus. Tell me what you think the answer is too, and I will check your reasoning.');
    async function go() {
      const t = input.value.trim(); if (!t) return;
      say(t, 'me'); input.value = '';
      if (!RA.hasAI()) { say('I cannot answer live yet because no AI key is set in js/config.js. Once it is added, your doubts will be answered here.'); return; }
      history.push({ role: 'user', content: t }); send.disabled = true;
      const m = say('Thinking...');
      try { const a = await RA.askAI(history); history.push({ role: 'assistant', content: a }); m.textContent = a || 'I did not get an answer. Please try again.'; }
      catch (e) { history.pop(); m.textContent = 'Sorry, I could not reach the AI service. ' + e.message; }
      send.disabled = false; chat.scrollTop = chat.scrollHeight;
    }
  }

  RA.ready.then(shell);
})();
