// ================= قسم الألعاب بالساحة =================
// 4 ألعاب فردية (ثعبان، ذاكرة، اضرب الخلد، 2048) + 3 ثنائية (إكس أو، أربعة تتصل، حجر ورقة مقص).
// الثنائية: مباراة سريعة مع لاعب حقيقي (السيرفر يتحقق من الحركات) أو ضد الكمبيوتر. كلها مكتوبة هنا بدون أي موقع/مكتبة خارجية (جمهور فيهم صغار: لا إعلانات ولا تتبّع).
import * as THREE from '/vendor/three.module.min.js';

// ---------- منطق الألعاب الثنائية (نسخة السيرفر بنفس الأسماء في server.js) ----------
const TL = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const tttWin = b => { for (const [a, c, d] of TL) if (b[a] !== null && b[a] === b[c] && b[a] === b[d]) return b[a]; return b.every(x => x !== null) ? 'd' : null; };
const c4Drop = (b, col, p) => { for (let r = 5; r >= 0; r--) if (b[r * 7 + col] === null) { b[r * 7 + col] = p; return r; } return -1; };
const c4Win = (b, r, c, p) => { for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { let n = 1; for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (rr >= 0 && rr < 6 && cc >= 0 && cc < 7 && b[rr * 7 + cc] === p) { n++; rr += dr * s; cc += dc * s; } } if (n >= 4) return true; } return false; };
const rpsWin = (a, b) => a === b ? -1 : (a - b + 3) % 3 === 1 ? 0 : 1;   // 0 حجر 1 ورقة 2 مقص؛ يرجع رقم الفائز أو -1

export const QK = ['👍', '😂', '🔥', '😅', 'حظ موفق 🍀', 'لعبة حلوة 👏', 'مرة ثانية؟', 'سريع!', 'أحسنت! 👏', 'ما شاء الله 🌟', 'حظ أوفر 😅', 'فزت عليك 😎', 'جولة ثانية؟', 'يلا نلعب 🎮', 'تمام 👍', 'هههه 😂', 'شكراً 🌹', 'تشرفنا 🤝', 'ثواني ⏳', 'مع السلامة 👋'];   // لازم عددها = GC_N بالسيرفر;   // رسائل الألعاب الجاهزة (لازم عددها = GC_N بالسيرفر)
export const STATIONS = [
  { id: 'snake', n: 'الثعبان', i: '🐍', k: 'فردي', x: 32, z: -82, c: '#3aa06a' }, { id: 'memory', n: 'الذاكرة', i: '🧠', k: 'فردي', x: 45, z: -82, c: '#8a52c4' },
  { id: 'whack', n: 'اضرب الخلد', i: '🐹', k: 'فردي', x: 58, z: -82, c: '#c2853a' }, { id: 'g2048', n: '2048', i: '🔢', k: 'فردي', x: 71, z: -82, c: '#f2a900' },
  { id: 'ttt', n: 'إكس أو', i: '❌', k: 'ثنائي', x: 38, z: -62, c: '#e94f3b' }, { id: 'c4', n: 'أربعة تتصل', i: '🔴', k: 'ثنائي', x: 52, z: -62, c: '#2d6fb8' },
  { id: 'rps', n: 'حجر ورقة مقص', i: '✂️', k: 'ثنائي', x: 66, z: -62, c: '#19a89a' },
  { id: 'ludo', n: 'لودو', i: '🎲', k: 'جماعي', x: 38, z: -42, c: '#e53935' }, { id: 'tap', n: 'سباق النقر', i: '⚡', k: 'جماعي', x: 52, z: -42, c: '#f2a900' },
  { id: 'guess', n: 'خمّن الرقم', i: '🎯', k: 'جماعي', x: 66, z: -42, c: '#8a52c4' }];

export function createGames(C) {
  const { AU, toast, netSend, WK, CAR, S, textTex, toon, plaza } = C;
  const sfx = k => { try { AU[k] && AU[k](); } catch {} };   // الصوت ما يوقف اللعبة أبداً (حتى لو نسخة الصوت قديمة بالكاش)
  const G = { open: null, near: null, stations: STATIONS };
  const best = (k, v, low = false) => { let b = null; try { b = parseInt(localStorage.getItem('mnalsifr_g_' + k)); } catch {} if (v === undefined) return isNaN(b) ? null : b; try { C.zev && C.zev(k, v); } catch {} if (isNaN(b) || b === null || (low ? v < b : v > b)) { try { localStorage.setItem('mnalsifr_g_' + k, String(v)); window.dispatchEvent(new Event('mnalsifr-score')); } catch {} return v; } return b; };

  // ---------- المجسمات بالساحة (إحداثيات مطلقة بحسب الساحة الحالية) ----------
  // تُضاف لقوائم الساحة: P (box/cyl/win...) و F (الأرضيات)
  G.parts = (P, F) => {
    const { x: ox, z: oz } = plaza(), cx = ox + 52, cz = oz - 59, y = .3;
    F.push([cx, y, cz, 58, .2, 64, 0, '#27344d']); F.push([cx, y + .2, cz, 54, .02, 60, 0, '#33466b']);
    for (const [dx, dz] of [[-28, -31], [28, -31], [-28, 31], [28, 31]]) P.box.push([cx + dx, y, cz + dz, 1.5, 9, 1.5, 0, '#e7b53c']);
    P.box.push([cx, y + 9, cz, 60, .9, 66, 0, '#d6382f']);
    for (let k = -4; k <= 4; k++) P.box.push([cx + k * 6.6, y + 9.9, cz, 3.3, .08, 66.2, 0, '#ffffff']);
    for (const s of STATIONS) {
      const x = ox + s.x, z = oz + s.z;
      P.box.push([x, y + .2, z, 5.4, 1.1, 3.6, 0, '#2b2f36']);
      P.box.push([x, y + 1.3, z - .2, 4.6, 3.2, .8, 0, '#1d2433']);
      P.win.push([x, y + 1.6, z + .25, 4.1, 2.6, .12, 0, s.c]);
      P.box.push([x, y + 4.6, z - .2, 5, .3, .9, 0, s.c]);
    }
    // أعمدة لوحة القسم الكبيرة
    for (const sx of [-27, 27]) P.box.push([cx + sx, y, cz - 33, 1.4, 24, 1.4, 0, '#3a4750']);
  };
  let signs = null;
  G.signs = () => {   // لوحة كبيرة فوق القسم + أسماء المحطات (تتبع الساحة)
    const { x: ox, z: oz } = plaza(), cx = ox + 52, cz = oz - 59;
    if (!signs) {
      signs = { big: [0, 1].map(() => new THREE.Mesh(new THREE.PlaneGeometry(52, 8), new THREE.MeshBasicMaterial({ map: textTex('🎮 قسم الألعاب', 2048, 320, '#1d2b36', '#ffd34d', 200), transparent: true }))), st: [] };
      signs.big.forEach(m => S.add(m));
      const glow = new THREE.Mesh(new THREE.BoxGeometry(53, .5, .5), new THREE.MeshBasicMaterial({ color: '#ff3b8a' })); S.add(glow); signs.glow = glow;
      for (const s of STATIONS) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(s.i + ' ' + s.n, 640, 140, '#1d2b36', '#fff', 84), transparent: true, depthWrite: false })); sp.scale.set(7.2, 1.6, 1); sp.renderOrder = 6; S.add(sp);
        const tg = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(s.k === 'جماعي' ? '🎉 جماعي' : s.k === 'ثنائي' ? '👥 ثنائي' : '👤 فردي', 320, 90, s.k === 'جماعي' ? '#b45309' : s.k === 'ثنائي' ? '#c2261c' : '#1d6f3d', '#fff', 54), transparent: true, depthWrite: false })); tg.scale.set(3.4, .95, 1); tg.renderOrder = 6; S.add(tg); signs.st.push([sp, tg]); }
    }
    signs.big[0].position.set(cx, .3 + 19.5, cz - 33 + .8); signs.big[1].position.set(cx, .3 + 19.5, cz - 33 - .8); signs.big[1].rotation.y = Math.PI; signs.glow.position.set(cx, .3 + 15.2, cz - 33);
    STATIONS.forEach((s, i) => { signs.st[i][0].position.set(ox + s.x, .3 + 6.3, oz + s.z); signs.st[i][1].position.set(ox + s.x, .3 + 5.2, oz + s.z); });
  };
  G.spot = () => { const { x, z } = plaza(); return { x: x + 52, z: z - 38 }; };

  // ---------- زر «العب» عند الاقتراب ----------
  const btn = document.createElement('button'); btn.id = 'gameBtn';
  btn.style.cssText = 'position:fixed;right:16px;bottom:max(160px,env(safe-area-inset-bottom));display:none;background:#8a52c4;color:#fff;font-size:18px;padding:14px 22px;border-radius:30px;box-shadow:0 4px 16px rgba(0,0,0,.3);z-index:3';
  document.body.appendChild(btn); btn.onclick = () => G.near && G.openGame(G.near.id);
  addEventListener('keydown', e => { if (e.code === 'KeyG' && G.near && !G.open && WK.on && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) G.openGame(G.near.id); });
  G.frame = () => {
    let best_ = null, bd = 6; if (WK.on && !WK.intro && !CAR.on && !G.open) { const { x, z } = plaza(); for (const s of STATIONS) { const d = Math.hypot(x + s.x - WK.p.x, z + s.z + 2.2 - WK.p.z); if (d < bd) { bd = d; best_ = s; } } }
    if (best_ !== G.near) { G.near = best_; btn.style.display = best_ ? 'block' : 'none'; if (best_) btn.textContent = `🎮 العب ${best_.n}`; }
  };

  // ---------- الواجهة العامة (شاشة كاملة) ----------
  const ov = document.createElement('div'); ov.id = 'gameOv';
  ov.style.cssText = 'position:fixed;inset:0;display:none;background:rgba(10,18,32,.96);z-index:30;color:#fff;font-family:inherit;flex-direction:column;align-items:center;touch-action:manipulation';
  ov.innerHTML = '<div style="display:flex;width:100%;max-width:520px;align-items:center;justify-content:space-between;padding:12px 14px;box-sizing:border-box"><b id="gTitle" style="font-size:20px"></b><span id="gInfo" style="font-size:15px;opacity:.9"></span><button id="gClose" style="padding:6px 14px">✕ خروج</button></div><div id="gBody" style="flex:1;width:100%;max-width:520px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;padding:0 12px 18px;box-sizing:border-box;overflow:auto"></div>';
  document.body.appendChild(ov);
  const $b = () => ov.querySelector('#gBody'), $t = t => ov.querySelector('#gTitle').textContent = t, $i = t => ov.querySelector('#gInfo').textContent = t;
  const mkBtn = (txt, fn, css = '') => { const b = document.createElement('button'); b.textContent = txt; b.onclick = fn; b.style.cssText = 'padding:12px 22px;font-size:18px;' + css; return b; };
  const msgEl = txt => { const d = document.createElement('div'); d.style.cssText = 'font-size:18px;text-align:center;min-height:26px;line-height:1.6'; d.textContent = txt || ''; return d; };
  let cleanup = [], MODE = null, LOC = null;
  const onKey = fn => { addEventListener('keydown', fn); cleanup.push(() => removeEventListener('keydown', fn)); };
  const timer = (fn, ms) => { const id = setInterval(fn, ms); cleanup.push(() => clearInterval(id)); return id; };
  G.openGame = id => {
    const s = STATIONS.find(x => x.id === id); if (!s) return; sfx('unlock'); G.close(true);
    G.open = id; window.__gameOpen = true; $b().className = ''; ov.style.display = 'flex'; btn.style.display = 'none'; $t(s.i + ' ' + s.n); $i(''); $b().innerHTML = '';
    C.clearKeys && C.clearKeys(); C.sit && C.sit(true);
    ({ snake, memory, whack, g2048, ttt: duo, c4: duo, rps: duo, ludo: mg, tap: mg, guess: mg })[id](id);
  };
  G.close = silent => {
    if (MODE === 'net') netSend({ t: 'gl' }); if (MODE === 'mg') netSend({ t: 'ml' }); MODE = null; LOC = null; cleanup.forEach(f => f()); cleanup = [];
    G.net = null;   // ما تجي رسائل لعبة مسكّرة
    if (G.open) { G.open = null; ov.style.display = 'none'; G.near = null; C.sit && C.sit(false); }
    window.__gameOpen = false; try { document.activeElement && document.activeElement !== document.body && document.activeElement.blur(); } catch {} C.clearKeys && C.clearKeys();   // خروج وسط الجولة: فك أي قفل على المشي
    if (!silent) sfx('click');
  };
  ov.querySelector('#gClose').onclick = () => G.close();

  // ===== 🐍 الثعبان =====
  function snake() {
    const N = 15, Z = Math.min(20, Math.floor((Math.min(innerWidth, 480, innerHeight * .7) - 24) / N)), cv = document.createElement('canvas'); cv.width = cv.height = N * Z; cv.style.cssText = 'background:#0f1b2d;border-radius:12px;max-width:100%;touch-action:none';
    const info = msgEl('اسحب بإصبعك أو استخدم الأسهم'), pad = document.createElement('div'); pad.style.cssText = 'direction:ltr;display:grid;grid-template-columns:repeat(3,64px);gap:6px;margin-top:6px';
    $b().append(cv, info, pad); const ctx = cv.getContext('2d');
    let sn, dir, nd, q, food, score, alive, tick;   // q = طابور الاتجاهات: لو ضغطت اتجاهين بسرعة ما يضيع الثاني
    const reset = () => { sn = [[7, 7], [6, 7], [5, 7]]; dir = nd = [1, 0]; q = []; score = 0; alive = true; place(); $i('النقاط: 0 • الأفضل: ' + (best('snake') ?? 0)); info.textContent = ''; };
    const place = () => { do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (sn.some(p => p[0] === food[0] && p[1] === food[1])); };
    const turn = d => { const l = q.length ? q[q.length - 1] : dir; if ((d[0] + l[0] === 0 && d[1] + l[1] === 0) || (d[0] === l[0] && d[1] === l[1])) return; if (q.length < 3) q.push(d); };
    [['⬆️', [0, -1], 2], ['⬅️', [-1, 0], 4], ['⬇️', [0, 1], 5], ['➡️', [1, 0], 6]].forEach(([t, d]) => { const b = mkBtn(t, () => turn(d), 'padding:10px;font-size:22px'); pad.append(b); });
    pad.children[0].style.gridColumn = '2'; pad.children[1].style.gridColumn = '1'; pad.children[1].style.gridRow = '2'; pad.children[2].style.gridColumn = '2'; pad.children[2].style.gridRow = '2'; pad.children[3].style.gridColumn = '3'; pad.children[3].style.gridRow = '2';
    onKey(e => { const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code]; if (m) { turn(m); e.preventDefault(); } });
    swipeOn(d => turn({ l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }[d]), true);
    window.__snk = { get sn() { return sn; }, get food() { return food; }, set food(v) { food = v; }, get dir() { return dir; }, get score() { return score; }, get alive() { return alive; } }; cleanup.push(() => { window.__snk = null; });
    const draw = () => { ctx.fillStyle = '#0f1b2d'; ctx.fillRect(0, 0, cv.width, cv.height); { const fx = food[0] * Z + Z / 2, fy = food[1] * Z + Z / 2; ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(fx, fy + 1, Z * .38, 0, 7); ctx.fill(); ctx.fillStyle = '#ffb3ad'; ctx.beginPath(); ctx.arc(fx - Z * .13, fy - Z * .06, Z * .1, 0, 7); ctx.fill(); ctx.fillStyle = '#3aa06a'; ctx.fillRect(fx - 1, fy - Z * .5, 3, Z * .2); } sn.forEach((p, i) => { ctx.fillStyle = i ? '#3aa06a' : '#7be07b'; ctx.beginPath(); ctx.roundRect(p[0] * Z + 1, p[1] * Z + 1, Z - 2, Z - 2, 5); ctx.fill(); }); };
    const step = () => { if (!alive) return; if (q.length) dir = q.shift(); const h = [sn[0][0] + dir[0], sn[0][1] + dir[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || sn.some(p => p[0] === h[0] && p[1] === h[1])) { alive = false; sfx('lose'); const b = best('snake', score); info.textContent = `انتهت! نقاطك ${score} • الأفضل ${b}`; $b().append(mkBtn('🔁 العب مرة ثانية', () => { again.remove(); reset(); }, 'background:#ff7414;color:#fff')); const again = $b().lastChild; return; }
      sn.unshift(h); if (h[0] === food[0] && h[1] === food[1]) { score++; sfx('place'); place(); $i('النقاط: ' + score + ' • الأفضل: ' + (best('snake') ?? 0)); } else sn.pop(); draw(); };
    reset(); draw(); tick = timer(step, 190);
  }

  // ===== 🧠 الذاكرة =====
  function memory() {
    const E = ['🐶', '🐱', '🦁', '🐵', '🐸', '🦄', '🐼', '🐯'], grid = document.createElement('div'); grid.style.cssText = 'direction:ltr;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:min(92vw,400px)';
    const info = msgEl('اقلب بطاقتين متشابهتين'); $b().append(info, grid);
    let cards, open, lock, moves, found, t0;
    const build = () => { cards = [...E, ...E].sort(() => Math.random() - .5); open = []; lock = false; moves = 0; found = 0; t0 = 0; grid.innerHTML = ''; info.textContent = 'اقلب بطاقتين متشابهتين'; $i('الحركات: 0 • أفضل: ' + (best('memory') ?? '—'));
      cards.forEach((e, i) => { const b = mkBtn('❓', () => flip(i), 'font-size:34px;padding:0;aspect-ratio:1;height:auto;background:#2d3a57;color:#fff'); b.dataset.i = i; grid.append(b); }); };
    const flip = i => { if (lock) return; const b = grid.children[i]; if (b.dataset.done || open.includes(i)) return; if (!t0) t0 = Date.now(); sfx('tick'); b.textContent = cards[i]; b.style.background = '#fff'; open.push(i);
      if (open.length === 2) { moves++; $i('الحركات: ' + moves + ' • أفضل: ' + (best('memory') ?? '—')); const [a, c] = open;
        if (cards[a] === cards[c]) { grid.children[a].dataset.done = grid.children[c].dataset.done = 1; grid.children[a].style.background = grid.children[c].style.background = '#7be07b'; open = []; found++; sfx('place');
          if (found === 8) { const b2 = best('memory', moves, true); info.textContent = `🎉 خلّصت بـ ${moves} حركة (${Math.round((Date.now() - t0) / 1000)} ثانية) • أفضل ${b2}`; sfx('win'); $b().append(mkBtn('🔁 العب مرة ثانية', () => { ag.remove(); build(); }, 'background:#ff7414;color:#fff')); const ag = $b().lastChild; } }
        else { lock = true; setTimeout(() => { for (const k of [a, c]) { grid.children[k].textContent = '❓'; grid.children[k].style.background = '#2d3a57'; } open = []; lock = false; }, 800); } } };
    build();
  }

  // ===== 🐹 اضرب الخلد =====
  function whack() {
    const grid = document.createElement('div'); grid.style.cssText = 'direction:ltr;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:min(90vw,360px,76vh);margin-top:6px'; const info = msgEl('اضغط على الخلد اللي يطلع! ⏱ 30 ثانية'); $b().append(info, grid);
    let score, left, up, running;
    for (let i = 0; i < 9; i++) { const h = mkBtn('🕳️', () => hit(i), 'font-size:44px;padding:0;aspect-ratio:1;height:auto;background:#3b2f24;color:#fff'); grid.append(h); }
    const start = () => { score = 0; left = 30; up = -1; running = true; $i('النقاط: 0 • الأفضل: ' + (best('whack') ?? 0)); info.textContent = '⏱ 30'; if (btn2) btn2.remove(); };
    const show = i => { if (up >= 0) grid.children[up].textContent = '🕳️'; up = i; if (i >= 0) grid.children[i].textContent = '🐹'; };
    const hit = i => { if (!running || i !== up) return; score++; sfx('place'); show(-1); $i('النقاط: ' + score + ' • الأفضل: ' + (best('whack') ?? 0)); };
    let btn2 = null; timer(() => { if (!running) return; show(Math.floor(Math.random() * 9)); }, 700); timer(() => { if (!running) return; left--; info.textContent = '⏱ ' + left; if (left <= 0) { running = false; show(-1); const b = best('whack', score); info.textContent = `انتهى الوقت! نقاطك ${score} • الأفضل ${b}`; sfx('win'); btn2 = mkBtn('🔁 العب مرة ثانية', start, 'background:#ff7414;color:#fff'); $b().append(btn2); } }, 1000);
    start();
  }

  // سحب/لمس: نسمعه على الشاشة كلها (مو بس اللوحة) ونتتبّع بداية كل لمسة، عشان ما تنحسب حركة غلط من إحداثيات قديمة
  function swipeOn(cb, live = false) {
    let st = null; const down = e => { st = { x: e.clientX, y: e.clientY, id: e.pointerId }; }, cancel = () => { st = null; };
    const up = e => { if (!st || e.pointerId !== st.id) return; const dx = e.clientX - st.x, dy = e.clientY - st.y; st = null; if (Math.hypot(dx, dy) < 24) return; cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); };
    const move = e => { if (!live || !st || e.pointerId !== st.id) return; const dx = e.clientX - st.x, dy = e.clientY - st.y; if (Math.hypot(dx, dy) < 20) return; st = { x: e.clientX, y: e.clientY, id: e.pointerId }; cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); };
    ov.addEventListener('pointerdown', down); ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', cancel); ov.addEventListener('pointermove', move); ov.style.touchAction = 'none';
    cleanup.push(() => { ov.removeEventListener('pointerdown', down); ov.removeEventListener('pointerup', up); ov.removeEventListener('pointercancel', cancel); ov.removeEventListener('pointermove', move); ov.style.touchAction = 'manipulation'; });
  }

  // ===== 🔢 2048 (بطاقات تنزلق بسلاسة وثابتة بأماكنها) =====
  function g2048() {
    const GAP = 8, board = document.createElement('div');
    board.style.cssText = `direction:ltr;position:relative;width:min(88vw,360px,76vh);aspect-ratio:1;background:#3a4560;border-radius:12px;box-sizing:border-box;touch-action:none`;
    const bg = document.createElement('div'); bg.style.cssText = `position:absolute;inset:${GAP}px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:${GAP}px`;
    for (let i = 0; i < 16; i++) { const d = document.createElement('div'); d.style.cssText = 'background:#51607f;border-radius:8px'; bg.append(d); }
    const layer = document.createElement('div'); layer.style.cssText = `position:absolute;inset:${GAP}px`; board.append(bg, layer);
    const info = msgEl('اسحب أو استخدم الأسهم — اجمع الأرقام المتشابهة'); $b().append(info, board);
    const COL = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
    let tiles, score, over, busy;
    const place = t => { t.el.style.transform = `translate(calc(${t.c} * (100% + ${GAP}px)), calc(${t.r} * (100% + ${GAP}px)))`; t.el.dataset.r = t.r; t.el.dataset.c = t.c; };
    const paint = t => { t.el.textContent = t.v; t.el.style.background = COL[t.v] || '#3c3a32'; t.el.style.color = t.v > 4 ? '#fff' : '#776e65'; t.el.style.fontSize = t.v > 999 ? '22px' : t.v > 99 ? '26px' : '30px'; };
    const pop = el => { try { el.animate([{ scale: .4 }, { scale: 1 }], { duration: 160 }); } catch {} };
    const mk = (v, r, c) => { const el = document.createElement('div'); el.dataset.tile = 1; el.style.cssText = `position:absolute;left:0;top:0;width:calc((100% - ${3 * GAP}px)/4);height:calc((100% - ${3 * GAP}px)/4);display:flex;align-items:center;justify-content:center;border-radius:8px;font-weight:900;transition:transform .12s ease-out`; const t = { v, r, c, el }; paint(t); place(t); layer.append(el); pop(el); tiles.push(t); return t; };
    const addRandom = () => { const used = new Set(tiles.map(t => t.r * 4 + t.c)), e = []; for (let i = 0; i < 16; i++) if (!used.has(i)) e.push(i); if (!e.length) return; const i = e[Math.floor(Math.random() * e.length)]; mk(Math.random() < .9 ? 2 : 4, Math.floor(i / 4), i % 4); };
    const stat = () => $i('النقاط: ' + score + ' • الأفضل: ' + (best('g2048') ?? 0));
    const canMove = () => { if (tiles.length < 16) return true; const g = {}; tiles.forEach(t => g[t.r * 4 + t.c] = t.v); return tiles.some(t => (t.c < 3 && g[t.r * 4 + t.c + 1] === t.v) || (t.r < 3 && g[(t.r + 1) * 4 + t.c] === t.v)); };
    const move = d => {
      if (over || busy) return;
      const grid = Array.from({ length: 4 }, () => Array(4).fill(null)); tiles.forEach(t => grid[t.r][t.c] = t);
      let moved = false, gain = 0; const gone = [], merged = [];
      for (let k = 0; k < 4; k++) {
        const cells = [0, 1, 2, 3].map(j => d === 'l' ? [k, j] : d === 'r' ? [k, 3 - j] : d === 'u' ? [j, k] : [3 - j, k]);   // من جهة الحائط اللي نتجه له
        let slot = 0, last = null;
        for (const [r, c] of cells) { const t = grid[r][c]; if (!t) continue;
          let tr, tc;
          if (last && last.v === t.v && !last.merging) { [tr, tc] = [last.r, last.c]; last.merging = true; gain += t.v * 2; merged.push(last); gone.push(t); }
          else { [tr, tc] = cells[slot++]; last = t; }
          if (t.r !== tr || t.c !== tc) moved = true; t.r = tr; t.c = tc; }
      }
      if (!moved) { tiles.forEach(t => { t.merging = false; }); return; }
      busy = true; score += gain; sfx('tick'); tiles.forEach(place);
      setTimeout(() => {
        gone.forEach(t => t.el.remove()); tiles = tiles.filter(t => !gone.includes(t));
        merged.forEach(t => { t.v *= 2; t.merging = false; paint(t); pop(t.el); }); addRandom(); stat(); busy = false;
        if (!canMove()) { over = true; const bs = best('g2048', score); info.textContent = `انتهت! نقاطك ${score} • الأفضل ${bs}`; sfx('lose'); const ag = mkBtn('🔁 العب مرة ثانية', () => { ag.remove(); start(); }, 'background:#ff7414;color:#fff'); $b().append(ag); }
      }, 130);
    };
    const start = () => { layer.innerHTML = ''; tiles = []; score = 0; over = false; busy = false; addRandom(); addRandom(); info.textContent = 'اسحب أو استخدم الأسهم — اجمع الأرقام المتشابهة'; stat(); };
    onKey(e => { if (e.repeat) return; const m = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', KeyA: 'l', KeyD: 'r', KeyW: 'u', KeyS: 'd' }[e.code]; if (m) { move(m); e.preventDefault(); } });
    swipeOn(move);
    start();
  }


  // ===== 🎉 الألعاب الجماعية: لودو + سباق النقر + خمّن الرقم (2–6 لاعبين، والناقص بوتات) =====
  const LPATH = [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6]];
  const LCOL = ['#e53935', '#43a047', '#fdd835', '#1e88e5'], LPALE = ['#ffcdd2', '#c8e6c9', '#fff59d', '#bbdefb'], LBASE = [[0, 0], [9, 0], [9, 9], [0, 9]], LSAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const lhome = (seat, k) => seat === 0 ? [1 + k, 7] : seat === 1 ? [7, 1 + k] : seat === 2 ? [13 - k, 7] : [7, 13 - k];
  function ludoXY(seat, pos, ti) {
    if (pos === -1) { const [bx, by] = LBASE[seat]; return [bx + (ti % 2 ? 4 : 2), by + (ti > 1 ? 4 : 2)]; }
    if (pos <= 50) { const c = LPATH[(seat * 13 + pos) % 52]; return [c[0] + .5, c[1] + .5]; }
    if (pos < 57) { const c = lhome(seat, pos - 51); return [c[0] + .5, c[1] + .5]; }
    return [7.5 + (ti % 2 ? .35 : -.35), 7.5 + (ti > 1 ? .35 : -.35)];
  }
  const el = (tag, css, txt) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt !== undefined) e.textContent = txt; return e; };
  function mg(game) {
    const body = $b(); body.innerHTML = '';
    const info = msgEl('اختر طريقة اللعب'), sub = msgEl(''); sub.style.fontSize = '14px'; sub.style.opacity = '.85';
    const menu = el('div', 'display:flex;flex-direction:column;gap:10px;margin-top:10px;width:min(90vw,340px)'), area = el('div', 'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;margin-top:6px'), foot = el('div', 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px');
    body.classList.add('mg'); area.classList.add('mgArea'); body.append(info, sub, menu, area, foot); MODE = 'mg';
    const me = { i: -1, names: [], seats: [], over: false }; let render = null;
    const two = game !== 'tap';   // لودو وخمّن الرقم: لاعبين أو أربعة
    const join = (bots, n) => { menu.style.display = 'none'; info.textContent = '⏳ ندخلك اللوبي…'; chat.style.display = 'block'; netSend({ t: 'mq', g: game }); if (bots) setTimeout(() => netSend({ t: 'mb', n }), 250); };
    const botBtns = () => two ? [mkBtn('🤖 ابدأ ضد بوت (لاعبين)', () => netSend({ t: 'mb', n: 2 })), mkBtn('🤖 ابدأ مع 3 بوتات (4 لاعبين)', () => netSend({ t: 'mb', n: 4 }))] : [mkBtn('🤖 ابدأ الآن مع بوتات', () => netSend({ t: 'mb' }), 'background:#ff7414;color:#fff')];
    // ===== دردشة بين لاعبي المباراة =====
    const chat = el('div', 'display:none;width:min(92vw,330px);margin-top:4px;background:rgba(255,255,255,.1);border-radius:12px;padding:4px 6px;box-sizing:border-box;direction:rtl');
    const clog = el('div', 'max-height:54px;min-height:22px;overflow-y:auto;font-size:12.5px;line-height:1.45;text-align:right'), cquick = el('div', 'display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;justify-content:center;max-height:62px;overflow-y:auto');
    QK.forEach((t, k) => { const b = el('button', 'padding:2px 8px;font-size:12px;border-radius:12px', t); b.onclick = () => netSend({ t: 'gc', k }); cquick.append(b); }); chat.append(clog, cquick);
    if (C.canType && C.canType()) {
      const row = el('div', 'display:flex;gap:4px;margin-top:3px'), inp = el('input', 'flex:1;min-width:0;padding:4px 8px;font-size:13px;border-radius:10px;border:0'); inp.maxLength = 80; inp.placeholder = 'اكتب رسالة…';
      const sendT = () => { const x = inp.value.trim(); if (!x) return; netSend({ t: 'gc', x }); inp.value = ''; }; inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') sendT(); }); inp.addEventListener('keyup', e => e.stopPropagation());
      const sb = el('button', 'padding:4px 10px;font-size:13px;border-radius:10px', 'إرسال'); sb.onclick = sendT; row.append(inp, sb); chat.append(row);
    } else chat.append(el('div', 'font-size:11px;opacity:.7;margin-top:2px;text-align:center', 'الكتابة الحرة لأصحاب البيوت 🏠 — استخدم الأزرار'));
    const addChat = (who, txt, mine) => { const d = el('div'); d.append(el('b', `color:${mine ? '#9fd8ff' : '#ffd34d'}`, who), ': ' + txt); clog.append(d); while (clog.children.length > 30) clog.firstChild.remove(); clog.scrollTop = clog.scrollHeight; };
    menu.append(mkBtn('👥 العب مع لاعبين (يبدأ لما ينضم أحد)', () => join(false), 'background:#ff7414;color:#fff'), ...(two ? [mkBtn('🤖 ضد بوت (لاعبين)', () => join(true, 2)), mkBtn('🤖 مع 3 بوتات (4 لاعبين)', () => join(true, 4))] : [mkBtn('🤖 ابدأ الآن مع بوتات', () => join(true, 0))]));
    body.append(chat);
    const exit = () => G.close();
    const endFoot = () => { foot.innerHTML = ''; foot.append(mkBtn('🔁 مباراة ثانية', () => netSend({ t: 'mr' }), 'background:#ff7414;color:#fff'), mkBtn('🚪 خروج', exit)); };
    G.net = m => { if (m.g && m.g !== game) return; UI(m); };
    G.netFor = game;
    const UI = m => {
      if (m.s === 'chat') { addChat(m.me ? 'أنت' : (m.n || ''), m.x !== undefined ? m.x : (QK[m.k] || ''), !!m.me); if (!m.me) sfx('pop'); return; }
      if (m.me !== undefined) me.i = m.me;
      if (m.s === 'lobby') { body.querySelectorAll('.mgx').forEach(e => e.remove()); menu.style.display = 'none'; me.over = false; area.innerHTML = ''; foot.innerHTML = ''; info.textContent = `⏳ بالانتظار ${m.names.length}/${m.max}` + (m.left ? ` — يبدأ بعد ${m.left} ث` : ''); sub.textContent = m.names.join(' • ');
        foot.append(...botBtns(), mkBtn('🚪 خروج', exit)); chat.style.display = 'block'; return; }
      if (m.s === 'mstart') { body.querySelectorAll('.mgx').forEach(e => e.remove()); me.names = m.names; me.seats = m.seats; me.over = false; menu.style.display = 'none'; chat.style.display = 'block'; foot.innerHTML = ''; area.innerHTML = ''; sfx('pop'); render = ({ ludo: buildLudo, tap: buildTap, guess: buildGuess })[game](); return; }
      if (m.s === 'mnames') { me.names = m.names; return; }
      if (m.s === 'mend') { me.over = true; info.textContent = m.res === 'win' ? '🏆 فزت!' : '😔 فاز ' + m.win; sub.textContent = ''; sfx(m.res === 'win' ? 'win' : 'lose'); endFoot(); return; }
      if (render) render(m);
    };
    // ---------- 🎲 لودو ----------
    function buildLudo() {
      const land = innerWidth > innerHeight && innerHeight < 560, Zc = Math.floor(Math.min(land ? innerWidth * .46 : innerWidth - 16, 440, innerHeight * (land ? .82 : .58)) / 15), W = Zc * 15, dpr = Math.min(2, devicePixelRatio || 1);
      const cv = el('canvas', `width:${W}px;height:${W}px;border-radius:12px;background:#fff;touch-action:manipulation`); cv.width = cv.height = W * dpr; const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      const chips = el('div', 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:14px;direction:rtl'), diceRow = el('div', 'display:flex;align-items:center;gap:10px;min-height:92px');
      // ===== نرد حقيقي ثلاثي الأبعاد: يتدحرج ويقفز ويقف على الرقم =====
      const FACE_ROT = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] }, PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }, FACE_T = { 1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 2: 'rotateY(90deg)', 5: 'rotateY(-90deg)', 3: 'rotateX(90deg)', 4: 'rotateX(-90deg)' };
      const DS = 64, dieWrap = el('div', `width:${DS}px;height:${DS}px;perspective:520px;margin:14px 16px`), cube = el('div', `width:${DS}px;height:${DS}px;position:relative;transform-style:preserve-3d;transform:rotateX(-22deg) rotateY(26deg)`);
      for (let v = 1; v <= 6; v++) { const f = el('div', `position:absolute;inset:0;background:linear-gradient(145deg,#ffffff,#e6ebf1);border-radius:12px;border:2px solid #c3cbd5;box-shadow:inset 0 0 10px rgba(0,0,0,.18);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:9px;box-sizing:border-box;transform:${FACE_T[v]} translateZ(${DS / 2}px)`);
        for (let k = 0; k < 9; k++) { const c = el('i', 'display:flex;align-items:center;justify-content:center;max-height:62px;overflow-y:auto'); if (PIPS[v].includes(k)) c.append(el('b', `width:11px;height:11px;border-radius:50%;background:${v === 1 ? '#d32f2f' : '#222'};box-shadow:inset 0 -2px 2px rgba(255,255,255,.35)`)); f.append(c); } cube.append(f); }
      dieWrap.append(cube);
      const rollDie = v => { const [rx, ry] = FACE_ROT[v]; cube.style.transition = 'none'; cube.style.transform = `rotateX(${Math.floor(Math.random() * 360)}deg) rotateY(${Math.floor(Math.random() * 360)}deg) rotateZ(${Math.floor(Math.random() * 360)}deg)`; void cube.offsetWidth;
        cube.style.transition = 'transform 1.15s cubic-bezier(.12,.7,.2,1)'; cube.style.transform = `rotateX(${rx + 1080}deg) rotateY(${ry + 1080}deg) rotateZ(0deg)`;
        try { dieWrap.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-58px) scale(1.25)', offset: .3 }, { transform: 'translateY(0) scale(1)', offset: .55 }, { transform: 'translateY(-16px) scale(1.05)', offset: .75 }, { transform: 'translateY(0)' }], { duration: 1150, easing: 'ease-out' }); } catch {}
        let k = 0; const iv = setInterval(() => { sfx('tick'); if (++k > 7) clearInterval(iv); }, 140); cleanup.push(() => clearInterval(iv)); };
      const rollBtn = mkBtn('🎲 ارمِ النرد', () => { if (rollBtn.disabled) return; netSend({ t: 'mm', a: 'roll' }); sfx('click'); }, 'background:#ff7414;color:#fff;font-size:20px;padding:12px 24px');
      rollBtn.disabled = true; diceRow.append(dieWrap, rollBtn); chips.classList.add('mgx'); diceRow.classList.add('mgx'); area.append(cv); body.insertBefore(chips, area); body.insertBefore(diceRow, foot);   // بالعرض: الشرائح والنرد بالعمود الجانبي
      // ===== القطع تقفز من مربع لمربع =====
      let st = null, prevRn = -1; const seatOf = pi => me.seats[pi] ?? pi, tk = [], xy = a => ({ x: a[0], y: a[1] });
      const steps = (seat, from, to, ti) => to === -1 ? [{ ...xy(ludoXY(seat, -1, ti)), fly: 1 }] : from === -1 ? [xy(ludoXY(seat, 0, ti))] : Array.from({ length: to - from }, (_, q) => xy(ludoXY(seat, from + 1 + q, ti)));
      const syncTk = m => m.toks.forEach((row, pi) => { tk[pi] = tk[pi] || []; row.forEach((pos, ti) => { const r = tk[pi][ti], seat = seatOf(pi); if (!r) { const [x, y] = ludoXY(seat, pos, ti); tk[pi][ti] = { x, y, pos, q: [], a: null, t: 0, h: 0, sx: x, sy: y }; return; } if (r.pos !== pos) { r.q.push(...steps(seat, r.pos, pos, ti)); r.pos = pos; } }); });
      window.__ludo = { get st() { return st; }, me, Zc, cv, get tk() { return tk; } }; cleanup.push(() => { window.__ludo = null; });
      const drawBoard = () => {
        ctx.clearRect(0, 0, W, W); const z = Zc;
        for (let sd = 0; sd < 4; sd++) { const used = me.seats.includes(sd), [bx, by] = LBASE[sd]; ctx.globalAlpha = used ? 1 : .35; ctx.fillStyle = LCOL[sd]; ctx.fillRect(bx * z, by * z, 6 * z, 6 * z); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect((bx + 1) * z, (by + 1) * z, 4 * z, 4 * z, z * .5); ctx.fill(); ctx.globalAlpha = 1; }
        LPATH.forEach(([c, r], i) => { ctx.fillStyle = i % 13 === 0 ? LCOL[i / 13] : '#fff'; ctx.fillRect(c * z, r * z, z, z); ctx.strokeStyle = '#b0b7c0'; ctx.lineWidth = 1; ctx.strokeRect(c * z + .5, r * z + .5, z - 1, z - 1); if (LSAFE.has(i) && i % 13 !== 0) { ctx.fillStyle = '#9aa3ad'; ctx.font = z * .7 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', (c + .5) * z, (r + .55) * z); } });
        for (let sd = 0; sd < 4; sd++) for (let k = 0; k < 6; k++) { const [c, r] = lhome(sd, k); ctx.fillStyle = LPALE[sd]; ctx.fillRect(c * z, r * z, z, z); ctx.strokeStyle = LCOL[sd]; ctx.lineWidth = 1; ctx.strokeRect(c * z + .5, r * z + .5, z - 1, z - 1); }
        const c0 = 6 * z, c1 = 9 * z, mx = 7.5 * z; [[c0, c0, c1, c0, 0], [c1, c0, c1, c1, 1], [c1, c1, c0, c1, 2], [c0, c1, c0, c0, 3]].forEach(([a1, b1, c2, d2, sd]) => { ctx.fillStyle = LCOL[sd]; ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(c2, d2); ctx.lineTo(mx, mx); ctx.closePath(); ctx.fill(); });
        if (!st) return; const pulse = 1 + .12 * Math.sin(performance.now() / 160), mv = st.cur === me.i && st.ph === 'move' ? st.mv : [];
        const items = []; tk.forEach((row, pi) => row.forEach((r, ti) => items.push([pi, ti, r]))); items.sort((p, q) => (p[2].y - p[2].h) - (q[2].y - q[2].h));
        items.forEach(([pi, ti, r]) => { const seat = seatOf(pi), px = r.x * z, py = r.y * z, lift = r.h * z; const isMv = pi === me.i && mv.includes(ti) && !r.a && !r.q.length;
          ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(px, py + z * .26, z * .3, z * .1, 0, 0, 7); ctx.fill();
          if (isMv) { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, z * .46 * pulse, 0, 7); ctx.stroke(); }
          const sc = 1 + r.h * .5; ctx.fillStyle = LCOL[seat]; ctx.beginPath(); ctx.arc(px, py - lift, z * .34 * sc, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py - lift, z * .34 * sc + 1, 0, 7); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(px - z * .1, py - lift - z * .1, z * .1 * sc, 0, 7); ctx.fill(); });
      };
      let lt = performance.now();
      timer(() => { const now = performance.now(), dt = Math.min(.1, (now - lt) / 1000); lt = now;
        for (const row of tk) for (const r of row || []) { if (!r.a && r.q.length) { r.a = r.q.shift(); r.sx = r.x; r.sy = r.y; r.t = 0; }
          if (r.a) { r.t += dt / (r.a.fly ? .32 : .17); const u = Math.min(1, r.t); r.x = r.sx + (r.a.x - r.sx) * u; r.y = r.sy + (r.a.y - r.sy) * u; r.h = r.a.fly ? 0 : Math.sin(u * Math.PI) * .42; if (u >= 1) { r.x = r.a.x; r.y = r.a.y; r.h = 0; if (!r.a.fly) sfx('place'); r.a = null; } } }
        drawBoard(); }, 30);
      cv.addEventListener('pointerdown', e => { if (!st || st.cur !== me.i || st.ph !== 'move') return; const r = cv.getBoundingClientRect(), gx = (e.clientX - r.left) / r.width * 15, gy = (e.clientY - r.top) / r.height * 15; let best = -1, bd = .75; for (const ti of st.mv) { const [x, y] = ludoXY(seatOf(me.i), st.toks[me.i][ti], ti), d = Math.hypot(x - gx, y - gy); if (d < bd) { bd = d; best = ti; } } if (best >= 0) { netSend({ t: 'mm', a: 'mv', i: best }); sfx('place'); } });
      return m => {
        if (m.s !== 'lst') return; st = m; syncTk(m); const mine = m.cur === me.i;
        chips.innerHTML = ''; me.names.forEach((n, pi) => { const c = el('span', `padding:3px 10px;border-radius:14px;background:rgba(255,255,255,.12);border:2px solid ${pi === m.cur ? '#ffd34d' : 'transparent'}`); c.append(el('b', `color:${LCOL[seatOf(pi)]}`, '● '), pi === me.i ? 'أنت' : n); chips.append(c); });
        info.textContent = m.over ? '' : mine ? (m.ph === 'roll' ? '🎲 دورك — ارمِ النرد' : m.ph === 'move' ? '👆 اختر قطعة تحرّكها (الدائرة الصفراء)' : '⏳') : '⏳ دور ' + me.names[m.cur]; sub.textContent = (m.last || '') + (m.left && !m.over ? ` • ${m.left} ث` : '');
        rollBtn.disabled = !(mine && m.ph === 'roll' && !m.over); rollBtn.style.opacity = rollBtn.disabled ? .4 : 1;
        if (m.rn !== prevRn) { const first = prevRn === -1; prevRn = m.rn; if (m.roll && !first) rollDie(m.roll); else if (m.roll) { const [rx, ry] = FACE_ROT[m.roll]; cube.style.transition = 'none'; cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; } }
      };
    }
    // ---------- ⚡ سباق النقر ----------
    function buildTap() {
      const bars = el('div', 'width:min(92vw,360px);display:flex;flex-direction:column;gap:8px'), rows = [], big = el('div', 'font-size:64px;font-weight:900;min-height:76px;line-height:76px', '');
      me.names.forEach((n, i) => { const r = el('div', 'display:flex;align-items:center;gap:8px;direction:rtl'), nm = el('span', 'min-width:84px;font-size:14px;text-align:right', i === me.i ? 'أنت' : n), tr = el('div', 'flex:1;height:18px;background:rgba(255,255,255,.15);border-radius:9px;overflow:hidden'), fill = el('div', `height:100%;width:0;background:${LCOL[i % 4]};transition:width .15s`); tr.append(fill); r.append(nm, tr); bars.append(r); rows.push(fill); });
      let mine = 0, go = false; const tapBtn = el('button', 'width:min(80vw,300px);height:150px;border-radius:28px;border:0;font-size:30px;font-weight:900;color:#fff;background:linear-gradient(180deg,#ffb300,#f57c00);box-shadow:0 8px 0 #b45309;touch-action:manipulation;user-select:none;-webkit-user-select:none', '⚡ اضغط بسرعة!');
      const hit = e => { e.preventDefault(); if (!go) return; mine++; netSend({ t: 'mm', a: 'tap' }); tapBtn.style.transform = 'translateY(5px)'; tapBtn.style.boxShadow = '0 3px 0 #b45309'; setTimeout(() => { tapBtn.style.transform = ''; tapBtn.style.boxShadow = '0 8px 0 #b45309'; }, 60); };
      tapBtn.addEventListener('pointerdown', hit); onKey(e => { if (e.code === 'Space' || e.code === 'Enter') { if (!e.repeat) hit(e); } });
      area.append(big, bars, tapBtn); info.textContent = 'استعد…'; sub.textContent = 'أول واحد يوصل 60 ضغطة يفوز — اضغط الزر (أو Space)';
      return m => {
        if (m.s !== 'tst') return; go = m.ph === 'run' && !m.over;
        big.textContent = m.ph === 'cd' ? (m.cd > 0 ? m.cd : 'انطلق!') : ''; if (m.ph === 'cd' && m.cd > 0) sfx('tick');
        m.taps.forEach((v, i) => { const sv = i === me.i ? Math.max(v, Math.min(mine, v + 3)) : v; rows[i].style.width = Math.min(100, sv / m.goal * 100) + '%'; });
        info.textContent = m.over ? '' : m.ph === 'run' ? '⚡ اضغط اضغط اضغط!' : 'استعد…';
      };
    }
    // ---------- 🎯 خمّن الرقم (بالدور: كل لاعب مرة، ثم اللي بعده) ----------
    function buildGuess() {
      const range = el('div', 'font-size:20px;font-weight:900;background:rgba(255,255,255,.12);border-radius:14px;padding:8px 18px', 'من 1 إلى 100'), logEl = el('div', 'width:min(92vw,360px);max-height:140px;overflow-y:auto;font-size:15px;line-height:1.8;text-align:right;direction:rtl;background:rgba(255,255,255,.08);border-radius:12px;padding:6px 10px;min-height:40px'), val = el('div', 'font-size:56px;font-weight:900;color:#ffd34d;min-width:120px;text-align:center', '50');
      const chips = el('div', 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:14px;direction:rtl');
      const sl = el('input'); sl.type = 'range'; sl.min = 1; sl.max = 100; sl.value = 50; sl.style.cssText = 'width:min(88vw,340px);height:36px'; sl.oninput = () => { val.textContent = sl.value; };
      const adj = d => { sl.value = Math.max(1, Math.min(100, +sl.value + d)); val.textContent = sl.value; }, row = el('div', 'display:flex;gap:8px;align-items:center'); [['−10', -10], ['−1', -1]].forEach(([t, d]) => row.append(mkBtn(t, () => adj(d), 'padding:8px 14px;font-size:18px'))); row.append(val); [['+1', 1], ['+10', 10]].forEach(([t, d]) => row.append(mkBtn(t, () => adj(d), 'padding:8px 14px;font-size:18px')));
      const go = mkBtn('🎯 خمّن', () => { if (go.disabled || me.over) return; netSend({ t: 'mm', a: 'g', n: +sl.value }); sfx('click'); go.disabled = true; go.style.opacity = .4; }, 'background:#ff7414;color:#fff;font-size:22px;padding:12px 34px');
      go.disabled = true; go.style.opacity = .4; area.append(chips, range, row, sl, go, logEl); info.textContent = 'خمّن الرقم السري'; sub.textContent = 'بالدور: كل لاعب يخمّن مرة ثم اللي بعده — أول واحد يصيب يفوز (تلميح: أعلى/أقل)';
      let prevCur = -1;
      return m => {
        if (m.s !== 'gst') return; const mine = m.cur === me.i && !m.over; range.textContent = `الرقم بين ${m.lo} و ${m.hi}`; logEl.innerHTML = '';
        chips.innerHTML = ''; me.names.forEach((n, pi) => { const c = el('span', `padding:3px 10px;border-radius:14px;background:rgba(255,255,255,.12);border:2px solid ${pi === m.cur && !m.over ? '#ffd34d' : 'transparent'}`, pi === me.i ? 'أنت' : n); chips.append(c); });
        m.log.forEach(l => { const d = el('div'); d.append(el('b', `color:${l.h === 'hit' ? '#6bff95' : '#ffd34d'}`, l.who), ` خمّن ${l.n} → ${l.h === 'hit' ? '✅ صح!' : l.h === 'low' ? '⬆️ أعلى' : '⬇️ أقل'}`); logEl.append(d); }); logEl.scrollTop = logEl.scrollHeight;
        if (m.lo <= m.hi && (+sl.value < m.lo || +sl.value > m.hi)) { sl.value = Math.floor((m.lo + m.hi) / 2); val.textContent = sl.value; }
        go.disabled = !mine; go.style.opacity = mine ? 1 : .4; info.textContent = m.over ? '' : mine ? '🎯 دورك — خمّن الرقم' : '⏳ دور ' + me.names[m.cur]; sub.textContent = m.over ? '' : `بالدور • ${m.left} ث`;
        if (mine && prevCur !== m.cur) sfx('pop'); prevCur = m.cur;
      };
    }
  }

  // ===== الألعاب الثنائية: إكس أو / أربعة تتصل / حجر ورقة مقص =====
  // مباراة حقيقية عبر السيرفر، أو ضد الكمبيوتر (محاكاة محلية بنفس شكل رسائل السيرفر)
  const send = o => { if (MODE === 'net') netSend(o); else if (LOC) LOC(o); };
  function duo(game) {
    const body = $b(); body.innerHTML = '';
    const info = msgEl('اختر طريقة اللعب'), hint = msgEl(''); hint.style.fontSize = '14px'; hint.style.opacity = '.8';
    const menu = document.createElement('div'); menu.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:10px;width:min(90vw,340px)';
    menu.append(mkBtn('👥 العب مع لاعب حقيقي', () => { MODE = 'net'; menu.style.display = 'none'; info.textContent = '⏳ ننتظر لاعب ثاني… (ادعُ أصحابك للساحة!)'; hint.textContent = 'يبدأ اللعب أول ما يضغط لاعب ثاني نفس اللعبة'; netSend({ t: 'gq', g: game }); }, 'background:#ff7414;color:#fff'), mkBtn('🤖 العب ضد الكمبيوتر', () => { MODE = 'ai'; LOC = localEngine(game); menu.style.display = 'none'; LOC({ t: 'gq' }); }, 'background:#2d6fb8;color:#fff'));
    const area = document.createElement('div'); area.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%'; const foot = document.createElement('div'); foot.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    body.classList.add('mg'); area.classList.add('mgArea'); body.append(info, hint, menu, area, foot);
    const me = { you: 0, opp: '', over: false };
    // ===== دردشة بين اللاعبين داخل المباراة (للمباراة الحقيقية فقط) =====
    const chat = document.createElement('div'); chat.style.cssText = 'display:none;width:min(92vw,330px);margin-top:4px;background:rgba(255,255,255,.1);border-radius:12px;padding:4px 6px;box-sizing:border-box;direction:rtl';
    const clog = document.createElement('div'); clog.style.cssText = 'max-height:54px;min-height:22px;overflow-y:auto;font-size:12.5px;line-height:1.45;text-align:right';
    const cquick = document.createElement('div'); cquick.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;justify-content:center';
    QK.forEach((t, k) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'padding:2px 8px;font-size:12px;border-radius:12px'; b.onclick = () => netSend({ t: 'gc', k }); cquick.append(b); });
    chat.append(clog, cquick);
    if (C.canType && C.canType()) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:4px;margin-top:3px'; const inp = document.createElement('input'); inp.maxLength = 80; inp.placeholder = 'اكتب رسالة…'; inp.style.cssText = 'flex:1;min-width:0;padding:4px 8px;font-size:13px;border-radius:10px;border:0';
      const go = () => { const x = inp.value.trim(); if (!x) return; netSend({ t: 'gc', x }); inp.value = ''; }; inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); }); inp.addEventListener('keyup', e => e.stopPropagation());
      const sb = document.createElement('button'); sb.textContent = 'إرسال'; sb.style.cssText = 'padding:4px 10px;font-size:13px;border-radius:10px'; sb.onclick = go; row.append(inp, sb); chat.append(row);
    } else { const n = document.createElement('div'); n.style.cssText = 'font-size:11px;opacity:.7;margin-top:2px;text-align:center'; n.textContent = 'الكتابة الحرة لأصحاب البيوت 🏠 — استخدم الأزرار'; chat.append(n); }
    body.append(chat);
    const addChat = (who, txt, mine) => { const d = document.createElement('div'); const b = document.createElement('b'); b.style.color = mine ? '#9fd8ff' : '#ffd34d'; b.textContent = who; d.append(b, ': ' + txt); clog.append(d); while (clog.children.length > 30) clog.firstChild.remove(); clog.scrollTop = clog.scrollHeight; };
    G.net = m => { if (m.g && m.g !== game && m.s !== 'wait') return; UI(m); };
    G.netFor = game;
    const nm = i => i === me.you ? 'أنت' : me.opp;
    const UI = m => {
      if (m.s === 'chat') { addChat(m.me ? 'أنت' : (m.n || me.opp), m.x !== undefined ? m.x : (QK[m.k] || ''), !!m.me); if (!m.me) sfx('pop'); return; }
      if (m.s === 'wait') { chat.style.display = 'none'; info.textContent = '⏳ ننتظر لاعب ثاني… (ادعُ أصحابك للساحة!)'; return; }
      if (m.s === 'start') { if (MODE === 'net') { chat.style.display = 'block'; clog.innerHTML = ''; } me.you = m.you; me.opp = m.opp; me.over = false; hint.textContent = '🆚 ' + m.opp; foot.innerHTML = ''; area.innerHTML = ''; sfx('pop'); ({ ttt: buildTtt, c4: buildC4, rps: buildRps })[game](m); return; }
      if (m.s === 'rq') { hint.textContent = '🔁 ' + me.opp + ' يبي مباراة ثانية'; return; }
      render[game](m);
    };
    const end = m => { me.over = true; const t = { win: '🏆 فزت!', lose: '😔 خسرت', draw: '🤝 تعادل', left: '🏆 فزت — الخصم طلع' }[m.res]; info.textContent = t; if (m.res === 'win' || m.res === 'left') sfx('win'); else if (m.res === 'lose') sfx('lose');
      foot.innerHTML = ''; if (m.res !== 'left') foot.append(mkBtn('🔁 مباراة ثانية', () => { send({ t: 'gr' }); info.textContent = '⏳ ننتظر موافقة الخصم…'; }, 'background:#ff7414;color:#fff')); foot.append(mkBtn('🚪 خروج', () => G.close())); };
    const turnTxt = t => info.textContent = t === me.you ? '🟢 دورك' : '⏳ دور ' + me.opp;
    const render = {};
    // --- إكس أو
    let cells = [];
    function buildTtt(m) { area.style.cssText += ';'; const g = document.createElement('div'); g.style.cssText = 'direction:ltr;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(86vw,330px,76vh)'; cells = [];
      for (let i = 0; i < 9; i++) { const b = mkBtn('', () => { if (!me.over) send({ t: 'gm', m: i }); }, 'aspect-ratio:1;height:auto;font-size:46px;padding:0;background:#2d3a57;color:#fff'); cells.push(b); g.append(b); } area.append(g);
      hint.textContent = '🆚 ' + me.opp + ' • أنت ' + (me.you === 0 ? '❌' : '⭕'); turnTxt(m.turn); }
    render.ttt = m => { if (m.b) m.b.forEach((v, i) => { cells[i].textContent = v === null ? '' : v === 0 ? '❌' : '⭕'; cells[i].style.color = v === 0 ? '#ff6b5e' : '#6bc7ff'; }); sfx('tick'); if (m.s === 'end') end(m); else turnTxt(m.turn); };
    // --- أربعة تتصل
    let c4cells = [];
    function buildC4(m) { const wrap = document.createElement('div'); wrap.style.cssText = 'direction:ltr;display:grid;grid-template-columns:repeat(7,1fr);gap:5px;width:min(94vw,400px,90vh);background:#1f4b99;padding:8px;border-radius:12px'; c4cells = [];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { const d = document.createElement('button'); d.style.cssText = 'aspect-ratio:1;border-radius:50%;border:0;background:#0f1b2d;padding:0;cursor:pointer'; d.onclick = () => { if (!me.over) send({ t: 'gm', m: c }); }; c4cells.push(d); wrap.append(d); } area.append(wrap);
      hint.textContent = '🆚 ' + me.opp + ' • أنت ' + (me.you === 0 ? '🔴' : '🟡') + ' — اضغط على العمود'; turnTxt(m.turn); }
    render.c4 = m => { if (m.b) m.b.forEach((v, i) => c4cells[i].style.background = v === null ? '#0f1b2d' : v === 0 ? '#ff3b30' : '#ffd34d'); sfx('place'); if (m.s === 'end') end(m); else turnTxt(m.turn); };
    // --- حجر ورقة مقص
    let rpsInfo, rpsBtns = [];
    function buildRps() { rpsInfo = msgEl('اختر! الأفضل من 3 جولات'); const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:12px'; rpsBtns = ['✊', '✋', '✌️'].map((e, i) => { const b = mkBtn(e, () => { if (me.over || b.dataset.lock) return; rpsBtns.forEach(x => x.dataset.lock = 1); b.style.background = '#ffd34d'; rpsInfo.textContent = '⏳ ننتظر اختيار ' + me.opp + '…'; send({ t: 'gm', m: i }); }, 'font-size:54px;padding:10px 18px;border-radius:22px'); row.append(b); return b; }); area.append(rpsInfo, row); info.textContent = '✊ ✋ ✌️'; }
    render.rps = m => { if (m.s === 'rps' || m.s === 'end') { if (m.r) { const E = ['✊', '✋', '✌️']; rpsInfo.textContent = `أنت ${E[m.r[me.you]]}  ضد  ${E[m.r[1 - me.you]]} ${me.opp} — ` + (m.w === -1 ? 'تعادل' : m.w === me.you ? 'فزت بالجولة! 🎉' : 'خسرت الجولة') + `   (${m.sc[me.you]} - ${m.sc[1 - me.you]})`; sfx('tick'); }
        rpsBtns.forEach(x => { delete x.dataset.lock; x.style.background = ''; }); if (m.s === 'end') end(m); else info.textContent = 'جولة ' + m.round + ' — اختر'; } };
    cleanup.push(() => { G.net = null; });
  }
  // ---------- محاكاة السيرفر محلياً (ضد الكمبيوتر) ----------
  function localEngine(game) {
    const st = { b: game === 'ttt' ? Array(9).fill(null) : Array(42).fill(null), turn: 0, over: false, sc: [0, 0], round: 1 }, to = f => setTimeout(f, 450), emit = o => G.net && G.net({ t: 'g', g: game, ...o });
    const aiTtt = () => { const b = st.b, tryWin = p => { for (let i = 0; i < 9; i++) if (b[i] === null) { b[i] = p; const w = tttWin(b); b[i] = null; if (w === p) return i; } return -1; };
      let m = tryWin(1); if (m < 0) m = tryWin(0); if (m < 0 && b[4] === null) m = 4; if (m < 0) { const f = [0, 2, 6, 8, 1, 3, 5, 7].filter(i => b[i] === null); m = f[Math.floor(Math.random() * Math.min(f.length, 3))]; } return m; };
    const aiC4 = () => { const b = st.b, ok = []; for (let c = 0; c < 7; c++) if (b[c] === null) ok.push(c); const probe = (c, p) => { const bb = [...b], r = c4Drop(bb, c, p); return r >= 0 && c4Win(bb, r, c, p); };
      for (const c of ok) if (probe(c, 1)) return c; for (const c of ok) if (probe(c, 0)) return c; const pref = ok.sort((a, c) => Math.abs(a - 3) - Math.abs(c - 3) + (Math.random() - .5)); return pref[0]; };
    const finish = res => { st.over = true; emit({ s: 'end', res, b: st.b, turn: st.turn }); };
    const afterMove = (p, r, c) => { const w = game === 'ttt' ? tttWin(st.b) : (c4Win(st.b, r, c, p) ? p : (st.b.every(x => x !== null) ? 'd' : null));
      if (w === null) { st.turn = 1 - st.turn; emit({ s: 'st', b: st.b, turn: st.turn }); if (st.turn === 1) to(() => { if (st.over) return; if (game === 'ttt') { const m = aiTtt(); st.b[m] = 1; afterMove(1); } else { const col = aiC4(), rr = c4Drop(st.b, col, 1); afterMove(1, rr, col); } }); }
      else { emit({ s: 'st', b: st.b, turn: st.turn }); finish(w === 'd' ? 'draw' : w === 0 ? 'win' : 'lose'); } };
    return o => { if (o.t === 'gq') { G.net && G.net({ t: 'g', s: 'start', g: game, you: 0, opp: '🤖 الكمبيوتر', turn: 0 }); return; }
      if (o.t === 'gr') { st.b = game === 'ttt' ? Array(9).fill(null) : Array(42).fill(null); st.turn = 0; st.over = false; st.sc = [0, 0]; st.round = 1; G.net && G.net({ t: 'g', s: 'start', g: game, you: 0, opp: '🤖 الكمبيوتر', turn: 0 }); return; }
      if (o.t !== 'gm' || st.over) return;
      if (game === 'rps') { const a = o.m, bb = Math.floor(Math.random() * 3), w = rpsWin(a, bb); if (w === 0) st.sc[0]++; else if (w === 1) st.sc[1]++; const done = st.sc[0] >= 2 || st.sc[1] >= 2; to(() => { emit({ s: done ? 'end' : 'rps', r: [a, bb], w, sc: [...st.sc], round: ++st.round, ...(done ? { res: st.sc[0] > st.sc[1] ? 'win' : 'lose' } : {}) }); if (done) st.over = true; }); return; }
      if (st.turn !== 0) return;
      if (game === 'ttt') { if (!Number.isInteger(o.m) || o.m < 0 || o.m > 8 || st.b[o.m] !== null) return; st.b[o.m] = 0; afterMove(0); }
      else { if (!Number.isInteger(o.m) || o.m < 0 || o.m > 6) return; const r = c4Drop(st.b, o.m, 0); if (r < 0) return; afterMove(0, r, o.m); } };
  }
  return G;
}
