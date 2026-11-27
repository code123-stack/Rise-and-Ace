// Interactive animations drawn with plain canvas (no extra libraries, works offline).
(function () {
  const app = document.getElementById('app');
  let raf = null, current = 'molecule';
  const W = 720, H = 420;
  const slider = (label, min, max, step, val, unit, on) => {
    const out = h('b', {}, val + unit);
    const inp = h('input', { type: 'range', min, max, step, value: val, oninput: e => { out.textContent = e.target.value + unit; on(+e.target.value); } });
    return h('div', {}, h('label', {}, label + ': ', out), inp);
  };

  function shell() {
    cancelAnimationFrame(raf);
    const canvas = h('canvas', { width: W, height: H }), ctrl = h('div', { class: 'ctrl' }), info = h('div', { class: 'card', style: 'margin-top:12px' });
    const tabs = [['molecule', '3D molecules'], ['projectile', 'Projectile motion'], ['pendulum', 'Simple pendulum']];
    app.replaceChildren(
      h('h1', {}, '3D lab'),
      h('p', { class: 'muted' }, 'Move the sliders and watch the concept change. Seeing it move makes the formula easier to remember.'),
      h('div', { class: 'tabs' }, tabs.map(t => h('button', { class: current === t[0] ? 'on' : '', onclick: () => { current = t[0]; shell(); } }, t[1]))),
      canvas, ctrl, info);
    ({ molecule, projectile, pendulum })[current](canvas, canvas.getContext('2d'), ctrl, info);
  }

  // ---------- 3D molecule viewer ----------
  const MOL = {
    'Methane (CH₄)': { note: 'Tetrahedral shape, bond angle 109.5°, carbon is sp³ hybridised.', atoms: [['C', 0, 0, 0], ['H', 1, 1, 1], ['H', 1, -1, -1], ['H', -1, 1, -1], ['H', -1, -1, 1]], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] },
    'Water (H₂O)': { note: 'Bent shape, bond angle about 104.5°, because of two lone pairs on oxygen.', atoms: [['O', 0, 0.3, 0], ['H', 1.25, -0.67, 0], ['H', -1.25, -0.67, 0]], bonds: [[0, 1], [0, 2]] },
    'Carbon dioxide (CO₂)': { note: 'Linear shape, bond angle 180°, carbon is sp hybridised with two double bonds.', atoms: [['C', 0, 0, 0], ['O', 1.9, 0, 0], ['O', -1.9, 0, 0]], bonds: [[0, 1], [0, 2]] },
    'Ammonia (NH₃)': { note: 'Trigonal pyramidal shape, bond angle about 107°, one lone pair on nitrogen.', atoms: [['N', 0, 0.45, 0], ['H', 1.5, -0.5, 0], ['H', -0.75, -0.5, 1.3], ['H', -0.75, -0.5, -1.3]], bonds: [[0, 1], [0, 2], [0, 3]] }
  };
  const COL = { C: '#8b93a7', H: '#f4f6ff', O: '#ff5a5a', N: '#5b8cff' }, RAD = { C: 30, H: 19, O: 28, N: 28 };
  function molecule(canvas, c, ctrl, info) {
    let name = Object.keys(MOL)[0], rx = 0.4, ry = 0.6, drag = null, auto = true;
    const sel = h('select', { onchange: e => { name = e.target.value; note(); } }, Object.keys(MOL).map(n => h('option', { value: n }, n)));
    const btn = h('button', { class: 'btn', onclick: () => { auto = !auto; btn.textContent = auto ? 'Pause rotation' : 'Resume rotation'; } }, 'Pause rotation');
    ctrl.append(h('div', {}, h('label', {}, 'Molecule'), sel), h('div', {}, h('label', {}, 'Rotation'), h('div', {}, btn)));
    function note() { info.replaceChildren(h('h3', {}, name), h('p', {}, MOL[name].note), h('p', { class: 'muted' }, 'Drag the molecule with your finger or mouse to turn it.')); }
    note();
    canvas.onpointerdown = e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointermove = e => { if (!drag) return; ry += (e.clientX - drag[0]) * 0.01; rx += (e.clientY - drag[1]) * 0.01; drag = [e.clientX, e.clientY]; };
    canvas.onpointerup = canvas.onpointercancel = () => drag = null;
    (function frame() {
      if (auto && !drag) ry += 0.012;
      const m = MOL[name], cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
      const pts = m.atoms.map(a => {
        const x = a[1] * cy + a[3] * sy, z0 = -a[1] * sy + a[3] * cy, y = a[2] * cx - z0 * sx, z = a[2] * sx + z0 * cx, p = 6 / (6 - z);
        return { el: a[0], x: W / 2 + x * 85 * p, y: H / 2 - y * 85 * p, z, p };
      });
      c.clearRect(0, 0, W, H);
      c.lineCap = 'round';
      m.bonds.forEach(b => { c.strokeStyle = '#c9cde6'; c.lineWidth = 9; c.beginPath(); c.moveTo(pts[b[0]].x, pts[b[0]].y); c.lineTo(pts[b[1]].x, pts[b[1]].y); c.stroke(); });
      pts.slice().sort((a, b) => a.z - b.z).forEach(p => {
        const r = RAD[p.el] * p.p, g = c.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
        g.addColorStop(0, '#fff'); g.addColorStop(0.35, COL[p.el]); g.addColorStop(1, '#1a1d3a');
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
        c.fillStyle = p.el === 'H' ? '#1b1f3b' : '#fff'; c.font = 'bold ' + Math.round(r * 0.75) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.el, p.x, p.y);
      });
      raf = requestAnimationFrame(frame);
    })();
  }

  // ---------- Projectile motion ----------
  function projectile(canvas, c, ctrl, info) {
    canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = null;
    let ang = 45, u = 20, g = 9.8, t = 0;
    const reset = () => { t = 0; stats(); };
    ctrl.append(slider('Launch angle', 5, 85, 1, ang, '°', v => { ang = v; reset(); }), slider('Speed', 5, 40, 1, u, ' m/s', v => { u = v; reset(); }), slider('Gravity', 1.6, 20, 0.1, g, ' m/s²', v => { g = v; reset(); }));
    function calc() { const a = ang * Math.PI / 180; return { a, T: 2 * u * Math.sin(a) / g, R: u * u * Math.sin(2 * a) / g, Hm: Math.pow(u * Math.sin(a), 2) / (2 * g) }; }
    function stats() {
      const k = calc();
      info.replaceChildren(h('h3', {}, 'Projectile motion'), h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, k.R.toFixed(1) + ' m'), 'Range = u² sin2θ / g'),
        h('div', { class: 'stat' }, h('b', {}, k.Hm.toFixed(1) + ' m'), 'Max height = u² sin²θ / 2g'),
        h('div', { class: 'stat' }, h('b', {}, k.T.toFixed(2) + ' s'), 'Time of flight = 2u sinθ / g')),
        h('p', { class: 'muted' }, 'Try 45° to see the longest range. Notice that 30° and 60° land at the same spot.'));
    }
    stats();
    (function frame() {
      const k = calc(), pad = 40, sc = Math.min((W - 2 * pad) / Math.max(k.R, 1), (H - 2 * pad) / Math.max(k.Hm, 1));
      t += k.T / 150; if (t > k.T * 1.25) t = 0;
      const tt = Math.min(t, k.T), X = s => pad + u * Math.cos(k.a) * s * sc, Y = s => H - pad - (u * Math.sin(k.a) * s - 0.5 * g * s * s) * sc;
      c.clearRect(0, 0, W, H);
      c.strokeStyle = '#4b5190'; c.lineWidth = 2; c.beginPath(); c.moveTo(pad, H - pad); c.lineTo(W - 10, H - pad); c.stroke();
      c.setLineDash([5, 6]); c.strokeStyle = '#6b72c9'; c.beginPath();
      for (let s = 0; s <= k.T + 1e-9; s += k.T / 60) s === 0 ? c.moveTo(X(s), Y(s)) : c.lineTo(X(s), Y(s));
      c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#ff7a1a'; c.lineWidth = 3; c.beginPath();
      for (let s = 0; s <= tt; s += k.T / 60) s === 0 ? c.moveTo(X(s), Y(s)) : c.lineTo(X(s), Y(s));
      c.lineTo(X(tt), Y(tt)); c.stroke();
      c.fillStyle = '#ffd166'; c.beginPath(); c.arc(X(tt), Y(tt), 9, 0, 7); c.fill();
      c.fillStyle = '#dfe2ff'; c.font = '14px system-ui'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText('t = ' + tt.toFixed(2) + ' s', pad, 24);
      raf = requestAnimationFrame(frame);
    })();
  }

  // ---------- Simple pendulum ----------
  function pendulum(canvas, c, ctrl, info) {
    canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = null;
    let L = 1.5, g = 9.8, amp = 25, th = amp * Math.PI / 180, om = 0, last = null;
    const reset = () => { th = amp * Math.PI / 180; om = 0; stats(); };
    ctrl.append(slider('Length', 0.3, 3, 0.1, L, ' m', v => { L = v; reset(); }), slider('Gravity', 1.6, 20, 0.1, g, ' m/s²', v => { g = v; reset(); }), slider('Starting angle', 5, 60, 1, amp, '°', v => { amp = v; reset(); }));
    function stats() {
      info.replaceChildren(h('h3', {}, 'Simple pendulum'), h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, (2 * Math.PI * Math.sqrt(L / g)).toFixed(2) + ' s'), 'Time period = 2π√(L/g)')),
        h('p', { class: 'muted' }, 'Change the length and gravity and watch the period change. The formula holds for small angles and does not depend on the mass of the bob.'));
    }
    stats();
    (function frame(now) {
      const dt = last && now ? Math.min(0.03, (now - last) / 1000) : 0.016; last = now;
      for (let k = 0; k < 4; k++) { om += -(g / L) * Math.sin(th) * dt / 4; th += om * dt / 4; }
      const px = W / 2, py = 40, len = L * 105, bx = px + len * Math.sin(th), by = py + len * Math.cos(th);
      c.clearRect(0, 0, W, H);
      c.fillStyle = '#4b5190'; c.fillRect(px - 90, py - 8, 180, 8);
      c.setLineDash([4, 6]); c.strokeStyle = '#4b5190'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + len + 20); c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#dfe2ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by); c.stroke();
      const gr = c.createRadialGradient(bx - 6, by - 6, 2, bx, by, 20); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, '#ff7a1a'); gr.addColorStop(1, '#7a2f00');
      c.fillStyle = gr; c.beginPath(); c.arc(bx, by, 20, 0, 7); c.fill();
      raf = requestAnimationFrame(frame);
    })();
  }

  shell();
})();
