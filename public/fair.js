// ================= مدينة الألعاب بالساحة =================
// 4 ألعاب: عجلة دوّارة، دوّامة خيل، كراسي طايرة، برج سقوط. الكل يتحرك بحسب ساعة السيرفر (فكل اللاعبين يشوفونها بنفس اللحظة)،
// واللاعب لما يركب تنتقل الكاميرا لعيونه (رؤية الشخص الأول) ويقدر يلف حوله بسحب الشاشة. مجاناً، مكتوبة هنا بدون أي مكتبة خارجية.
import * as THREE from '/vendor/three.module.min.js';

// إحداثيات محلية نسبةً لمركز الساحة. (x,z) مركز اللعبة، (bx,bz) نقطة الركوب، br نصف قطر ظهور زر «اركب»، dur مدة الجولة بالثواني
export const RIDES = [
  { id: 'wheel', n: 'العجلة الدوّارة', i: '🎡', x: -66, z: -30, bx: -55.5, bz: -30, br: 9, dur: 60, ns: 12, exit: 12, tip: 'اركب واستمتع بمنظر الساحة من فوق' },
  { id: 'carousel', n: 'الدوّامة', i: '🎠', x: -58, z: 24, bx: -58, bz: 24, br: 15.5, dur: 40, ns: 8, exit: 12.5, tip: 'اختر حصانك وادور' },
  { id: 'chairs', n: 'الكراسي الطايرة', i: '🌀', x: 58, z: 22, bx: 58, bz: 22, br: 17.5, dur: 40, ns: 10, exit: 13, tip: 'تطير وتدور فوق الساحة' },
  { id: 'tower', n: 'برج السقوط', i: '🗼', x: 66, z: -8, bx: 66, bz: -8, br: 11, dur: 30, ns: 4, exit: 7.5, tip: 'يطلع لفوق ويسقط بسرعة!' },
];
const WHEEL = { R: 15, hub: 18.5, N: 12, w: 2 * Math.PI / 70 }, CAR = { R: 6, N: 8, w: 2 * Math.PI / 16 }, CH = { N: 10, L: 6.2, top: 14.6, r0: 4.2, w: 2 * Math.PI / 9 }, TW = { top: 27, cyc: 20, off: 2.4 };
const SIGN = { wheel: [-52.5, -24], carousel: [-45.6, 18.9], chairs: [43.5, 16.5], tower: [58.1, -7] };   // أعمدة اللوحات الإرشادية (برّا مساحة اللعبة)
const HEX = ['#e94f8b', '#f2a900', '#2d6fb8', '#3aa06a', '#8a52c4', '#e94f3b', '#19a89a', '#ff7414'];

export function createFair(C) {
  const { AU, toast, WK, S, textTex, toon, plaza, PEERS, placeAt, canBoard } = C;
  const sfx = k => { try { AU[k] && AU[k](); } catch {} };
  const F = { on: false, ride: null, seat: 0, off: 0, near: null, c0: Math.PI, p0: .6, endAt: 0, rides: RIDES };
  const T = () => (Date.now() + F.off) / 1000;   // ساعة السيرفر (تتزبط من رسالة الاتصال)
  F.setClock = ms => { if (Number.isFinite(ms)) F.off = ms - Date.now(); };

  // ---------- المجسمات المتحركة (كلها داخل مجموعة بمركز الساحة) ----------
  const root = new THREE.Group(); S.add(root);
  const mats = {}, M = c => mats[c] || (mats[c] = toon(c)), geos = {};
  const gb = (w, h, d) => { const k = 'b' + w + ',' + h + ',' + d; return geos[k] || (geos[k] = new THREE.BoxGeometry(w, h, d)); };
  const gc = (r1, r2, h, s = 14) => { const k = 'c' + r1 + ',' + r2 + ',' + h + ',' + s; return geos[k] || (geos[k] = new THREE.CylinderGeometry(r1, r2, h, s)); };
  const add = (g, geo, col, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(col)); m.position.set(x, y, z); g.add(m); return m; };
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const rod = (g, ax, ay, az, bx, by, bz, w, col) => { const L = Math.hypot(bx - ax, by - ay, bz - az), m = new THREE.Mesh(gb(w, w, L), M(col)); m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.quaternion.setFromUnitVectors(ZV, new THREE.Vector3(bx - ax, by - ay, bz - az).normalize()); g.add(m); return m; };
  const ZV = new THREE.Vector3(0, 0, 1), R0 = RIDES[0], R1 = RIDES[1], R2 = RIDES[2], R3 = RIDES[3];

  // --- العجلة الدوّارة ---
  const wheel = { g: grp(root, R0.x, WHEEL.hub, R0.z), gond: [] };
  {
    const rim = add(wheel.g, new THREE.TorusGeometry(WHEEL.R, .38, 6, 40), '#f5f0e6'); rim.rotation.y = Math.PI / 2;
    const inner = add(wheel.g, new THREE.TorusGeometry(WHEEL.R * .5, .22, 6, 28), '#e94f8b'); inner.rotation.y = Math.PI / 2;
    for (let k = 0; k < 6; k++) { const s = add(wheel.g, gb(.22, WHEEL.R * 2, .22), k % 2 ? '#e94f8b' : '#2d6fb8'); s.rotation.x = k * Math.PI / 6; }
    const hub = add(wheel.g, gc(1.7, 1.7, 1.8), '#2d3a4a'); hub.rotation.z = Math.PI / 2;
    // الأرجل (ثابتة)
    const legs = grp(root, R0.x, WHEEL.hub, R0.z);
    for (const sx of [-3.4, 3.4]) for (const sz of [-10, 10]) rod(legs, sx, 0, 0, sx, -WHEEL.hub, sz, .6, '#3a4a5a');
    add(legs, gb(7.6, .55, .55), '#3a4a5a');
    for (let i = 0; i < WHEEL.N; i++) {
      const g = grp(root, 0, 0, 0), col = HEX[i % HEX.length];
      add(g, gb(2.2, .2, 1.7), '#fff3c4', 0, -.1, 0); add(g, gb(2.2, .8, .1), col, 0, .3, .85); add(g, gb(2.2, .8, .1), col, 0, .3, -.85); add(g, gb(.1, .9, 1.7), col, -1.05, .35, 0); add(g, gb(.1, .1, 1.7), '#ffffff', 1.05, .42, 0);
      add(g, gb(2.4, .16, 1.9), col, 0, 2.05, 0); for (const px of [-1.05, 1.05]) for (const pz of [-.8, .8]) add(g, gb(.08, 1.9, .08), '#5a6572', px, 1.0, pz);
      add(g, gb(.5, .3, 1.4), '#7a5533', -.55, .25, 0); add(g, gb(.12, .3, .12), '#5a6572', 0, 2.25, 0);
      wheel.gond.push(g);
    }
  }
  // --- الدوّامة ---
  const car = { g: grp(root, R1.x, 1.1, R1.z), horses: [] };
  {
    add(car.g, gc(8.2, 8.2, .3, 28), '#f4d9a8', 0, .15, 0); add(car.g, gc(9.6, 8.6, 2.6, 28), '#e94f8b', 0, 8.4, 0); add(car.g, gc(.5, .5, 1.8), '#f2c230', 0, 10.1, 0);
    for (let k = 0; k < 12; k++) add(car.g, gb(.5, .8, .1), k % 2 ? '#ffffff' : '#f2c230', Math.cos(k / 12 * 6.283) * 9.1, 7.4, Math.sin(k / 12 * 6.283) * 9.1).rotation.y = -k / 12 * 6.283;
    for (let i = 0; i < CAR.N; i++) {
      const a0 = i / CAR.N * Math.PI * 2, px = Math.cos(a0) * CAR.R, pz = Math.sin(a0) * CAR.R, col = HEX[i % HEX.length];
      add(car.g, gc(.08, .08, 7.2, 6), '#f2c230', px, 3.8, pz);
      const h = grp(car.g, px, 2, pz); h.rotation.y = -a0;
      add(h, gb(.6, .7, 1.5), '#f5f0e6', 0, -.5, 0); add(h, gb(.34, .8, .36), '#f5f0e6', 0, -.05, .78); add(h, gb(.36, .36, .62), '#f5f0e6', 0, .35, 1.08); add(h, gb(.62, .1, .62), col, 0, -.12, 0); add(h, gb(.12, .5, .12), '#7a5533', 0, -.35, -.85);
      for (const lx of [-.18, .18]) for (const lz of [-.55, .55]) add(h, gb(.14, .55, .14), '#f5f0e6', lx, -.98, lz);
      car.horses.push(h);
    }
  }
  // --- الكراسي الطايرة ---
  const ch = { g: grp(root, R2.x, CH.top, R2.z), seats: [], chains: [] };
  {
    add(ch.g, gc(6.2, 6.2, .5, 24), '#2d6fb8', 0, 0, 0); add(ch.g, gc(.1, 6.6, 2.2, 24), '#f2c230', 0, 1.35, 0); add(ch.g, gc(.35, .35, 1.3), '#e94f3b', 0, 3, 0);
    for (let i = 0; i < CH.N; i++) {
      const g = grp(root, 0, 0, 0), col = HEX[i % HEX.length];
      add(g, gb(1, .16, .85), col, 0, -.08, 0); add(g, gb(1, .75, .12), col, 0, .35, -.38); add(g, gb(.1, .4, .6), '#5a6572', -.5, .22, 0); add(g, gb(.1, .4, .6), '#5a6572', .5, .22, 0); add(g, gb(.7, .08, .08), '#d0d6dc', 0, .5, .35);
      ch.seats.push(g);
      const cg = grp(root, 0, 0, 0); const m = new THREE.Mesh(gb(.07, .07, 1), M('#9aa3ab')); cg.add(m); ch.chains.push({ g: cg, m });
    }
  }
  // --- برج السقوط ---
  const tw = { g: grp(root, R3.x, 0, R3.z) };
  {
    for (const y of [5, 11, 17, 23]) add(tw.g, gb(3.5, .7, 3.5), y % 2 ? '#8a52c4' : '#f2c230', 0, y, 0);
    add(tw.g, gb(4.4, 1.4, 4.4), '#e94f3b', 0, 30.4, 0); add(tw.g, new THREE.ConeGeometry(2.4, 3, 4), M('#f2c230'), 0, 32.6, 0);
    tw.car = grp(tw.g, 0, 0, 0); add(tw.car, gb(3.9, .5, 3.9), '#2d3a4a', 0, 0, 0);
    tw.seats = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz], i) => {
      const g = grp(tw.car, dx * TW.off, .9, dz * TW.off), yaw = Math.atan2(dx, dz); g.rotation.y = yaw;
      add(g, gb(1.4, .2, 1.1), HEX[i], 0, -.1, 0); add(g, gb(1.4, .9, .14), HEX[i], 0, .35, -.5); add(g, gb(1.4, .1, .1), '#d0d6dc', 0, .5, .5); add(g, gb(.2, .5, .2), '#2d3a4a', 0, -.45, -.9);
      tw.seats.push({ g, yaw });
    });
  }

  // ---------- المجسمات الثابتة بالساحة (تُضاف لقوائم الساحة P/F بإحداثيات مطلقة؛ الصلب منها يصير تصادم تلقائياً) ----------
  F.parts = (P, Fl) => {
    const { x: ox, z: oz } = plaza(), y = .3;
    // أرضيات ملوّنة تحت الألعاب
    Fl.push([ox + R0.x + 4, y, oz + R0.z, 26, .07, 44, 0, '#f2d3dc']); Fl.push([ox + R0.bx, y, oz + R0.bz, 8, .35, 10, 0, '#c9a86a']);   // منصة الركوب
    P.cyl.push([ox + R1.x, y, oz + R1.z, 27, .08, 27, 0, '#cfe3ef']); P.cyl.push([ox + R2.x, y, oz + R2.z, 29, .08, 29, 0, '#d8e8c8']); Fl.push([ox + R3.x, y, oz + R3.z, 15, .07, 15, 0, '#e3d3f2']);
    // العجلة: قواعد الأرجل
    for (const sx of [-3.4, 3.4]) for (const sz of [-10, 10]) P.box.push([ox + R0.x + sx, y, oz + R0.z + sz, 2.6, 1.2, 2.6, 0, '#5a6572']);
    // درابزين منصة العجلة
    for (const sz of [-4.5, 4.5]) P.box.push([ox + R0.bx, y + .35, oz + R0.bz + sz, 8, .9, .15, 0, '#e94f8b']);
    // الدوّامة: قاعدة ودعامة وسط
    P.cyl.push([ox + R1.x, y, oz + R1.z, 17.2, .8, 17.2, 0, '#c97a3a']); P.cyl.push([ox + R1.x, y + .8, oz + R1.z, 3.4, 9, 3.4, 0, '#f2c230']);
    // الكراسي الطايرة
    P.cyl.push([ox + R2.x, y, oz + R2.z, 15, .9, 15, 0, '#2d6fb8']); P.cyl.push([ox + R2.x, y + .9, oz + R2.z, 2.6, 13.8, 2.6, 0, '#e8edf1']);
    // برج السقوط
    P.box.push([ox + R3.x, y, oz + R3.z, 3, 30, 3, 0, '#e8edf1']); P.box.push([ox + R3.x, y, oz + R3.z, 6.4, .9, 6.4, 0, '#2d3a4a']);
    // سياج وأعلام حول كل لعبة
    for (const r of [R1, R2]) for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2, rr = r === R1 ? 12.8 : 14.2; if (Math.abs(Math.cos(a - Math.atan2(-r.z, -r.x))) > .93) continue; P.box.push([ox + r.x + Math.cos(a) * rr, y, oz + r.z + Math.sin(a) * rr, .5, 1.2, .5, 0, HEX[k % HEX.length]]); }
    for (const [fx, fz] of [[-80, -52], [-52, -52], [-80, 4], [-50, 4], [38, -2], [78, -2], [38, 44], [78, 44], [-80, 44], [-40, 44]]) { P.box.push([ox + fx, y, oz + fz, .28, 7, .28, 0, '#8a8f96']); P.flat.push([ox + fx + 1.3, y + 6.3, oz + fz, 2.6, 1.2, .1, 0, HEX[Math.abs(fx + fz) % HEX.length]]); }
    // لوحات إرشاد عند كل لعبة (أعمدة)
    for (const r of RIDES) P.box.push([ox + SIGN[r.id][0], y, oz + SIGN[r.id][1], .35, 3.2, .35, 0, '#3a4750']);
  };
  let sg = null;
  F.signs = () => {
    if (!sg) {
      sg = { name: [], tip: [] };
      for (const r of RIDES) {
        const a = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(r.i + ' ' + r.n, 768, 150, '#1d2b36', '#ffd34d', 100), transparent: true, depthWrite: false })); a.scale.set(13, 2.5, 1); a.renderOrder = 6; root.add(a); sg.name.push(a);
        const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('🎟️ مجاناً — اقترب واضغط «اركب»', 768, 130, '#e94f8b', '#fff', 70), transparent: true, depthWrite: false })); b.scale.set(5.6, .95, 1); b.renderOrder = 6; root.add(b); sg.tip.push(b);
      }
      const big = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('🎪 مدينة الألعاب 🎡', 1024, 200, '#1d2b36', '#ff7bd0', 120), transparent: true, depthWrite: false })); big.scale.set(26, 5, 1); big.renderOrder = 6; root.add(big); sg.big = big;
      const big2 = big.clone(); root.add(big2); sg.big2 = big2;
    }
    const nm = [[R0.x, 40, R0.z], [R1.x, 13, R1.z], [R2.x, 18.5, R2.z], [R3.x, 35.5, R3.z]];
    RIDES.forEach((r, i) => { sg.name[i].position.set(...nm[i]); sg.tip[i].position.set(SIGN[r.id][0], 4.3, SIGN[r.id][1]); });
    sg.big.position.set(R0.x, 46, R0.z); sg.big2.position.set(R3.x - 4, 41, R3.z + 12);
    root.position.set(plaza().x, .3, plaza().z);
  };

  // ---------- أماكن المقاعد (لحظة t) — نفس الدوال تحرّك المجسمات وتحدد مكان الراكب ----------
  const horseY = (i, t) => 1.1 + 1.25 + .85 * (.5 + .5 * Math.sin(2 * Math.PI * t / 3 + i * Math.PI)), chairBeta = t => .12 + .5 * (.5 + .5 * Math.sin(2 * Math.PI * t / 30 - Math.PI / 2));
  const towerY = t => {   // دورة 20 ثانية: انتظار ← طلوع ← وقوف فوق ← سقوط ← ارتداد ← انتظار
    const u = ((t % TW.cyc) + TW.cyc) % TW.cyc, lo = .5, hi = TW.top;
    if (u < 3) return lo; if (u < 10) { const k = (u - 3) / 7; return lo + (hi - lo) * (k * k * (3 - 2 * k)); } if (u < 13) return hi;
    if (u < 14.4) { const k = (u - 13) / 1.4; return hi - (hi - lo) * k * k; } if (u < 15.6) { const k = (u - 14.4) / 1.2; return lo + 2.2 * Math.sin(k * Math.PI) * (1 - k); } return lo;
  };
  const seatAt = (id, i, t) => {   // إحداثيات محلية (نسبةً للساحة) + اتجاه النظر
    if (id === 'wheel') { const a = i / WHEEL.N * Math.PI * 2 + WHEEL.w * t; return { x: R0.x, y: WHEEL.hub + WHEEL.R * Math.cos(a) - 2.3 + .3, z: R0.z + WHEEL.R * Math.sin(a), yaw: Math.PI / 2 }; }
    if (id === 'carousel') { const A = i / CAR.N * Math.PI * 2 + CAR.w * t; return { x: R1.x + CAR.R * Math.cos(A), y: horseY(i, t) - .1, z: R1.z + CAR.R * Math.sin(A), yaw: -A }; }
    if (id === 'chairs') { const A = i / CH.N * Math.PI * 2 + CH.w * t, b = chairBeta(t), rr = CH.r0 + CH.L * Math.sin(b); return { x: R2.x + rr * Math.cos(A), y: CH.top - CH.L * Math.cos(b) + .05, z: R2.z + rr * Math.sin(A), yaw: -A }; }
    const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][i]; return { x: R3.x + d[0] * TW.off, y: towerY(t) + .9, z: R3.z + d[1] * TW.off, yaw: Math.atan2(d[0], d[1]) };
  };
  const nearRoot = () => { const p = plaza(); return Math.hypot(WK.p.x - p.x, WK.p.z - p.z) < 330; };
  const animate = t => {
    wheel.g.rotation.x = WHEEL.w * t;
    wheel.gond.forEach((g, i) => { const s = seatAt('wheel', i, t); g.position.set(s.x, s.y, s.z); });
    car.g.rotation.y = -CAR.w * t; car.horses.forEach((h, i) => { h.position.y = horseY(i, t) - 1.1; });
    const b = chairBeta(t); ch.g.rotation.y = -CH.w * t;
    ch.seats.forEach((g, i) => { const s = seatAt('chairs', i, t), A = -s.yaw; g.position.set(s.x, s.y, s.z); g.rotation.y = s.yaw; const c = ch.chains[i], ax = R2.x + CH.r0 * Math.cos(A), az = R2.z + CH.r0 * Math.sin(A); const L = Math.hypot(s.x - ax, CH.top - (s.y + .9), s.z - az); c.g.position.set((ax + s.x) / 2, (CH.top + s.y + .9) / 2, (az + s.z) / 2); c.g.quaternion.setFromUnitVectors(ZV, new THREE.Vector3(s.x - ax, s.y + .9 - CH.top, s.z - az).normalize()); c.m.scale.z = L; });
    tw.car.position.y = towerY(t);
  };

  // ---------- زر «اركب» + لوحة الجولة ----------
  const btn = document.createElement('button'); btn.id = 'fairBtn';
  btn.style.cssText = 'position:fixed;right:16px;bottom:max(160px,env(safe-area-inset-bottom));display:none;background:#e94f8b;color:#fff;font-size:18px;padding:14px 22px;border-radius:30px;box-shadow:0 4px 16px rgba(0,0,0,.3);z-index:3';
  document.body.appendChild(btn);
  const box = document.createElement('div'); box.id = 'fairBox';
  box.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:max(120px,env(safe-area-inset-top));display:none;background:rgba(20,30,45,.88);color:#fff;border-radius:20px;padding:10px 16px;z-index:9;text-align:center;min-width:240px;max-width:92vw;box-shadow:0 4px 18px rgba(0,0,0,.4)';
  box.innerHTML = '<div id="fairT" style="font-weight:900;font-size:17px"></div><div id="fairH" style="font-size:13px;opacity:.92;margin:3px 0 8px"></div><button id="fairX" style="padding:8px 22px;font-size:16px;border-radius:14px;border:0;background:#ffd34d;color:#1d2b36;font-weight:900">⬇️ انزل</button>';
  document.body.appendChild(box);
  const $ = id => box.querySelector(id);
  const freeSeat = (r, t) => {   // أقرب مقعد فاضي (ما فيه لاعب ثاني عليه)
    const p = plaza(), me = WK.p; let best = -1, bd = 1e9;
    for (let i = 0; i < r.ns; i++) {
      const s = seatAt(r.id, i, t), X = p.x + s.x, Z = p.z + s.z; let taken = false;
      for (const q of PEERS.values()) if (Math.hypot(q.x - X, q.z - Z) < 1.5 && Math.abs((q.y || 0) - s.y) < 2) { taken = true; break; }
      if (taken) continue; const d = Math.hypot(X - me.x, Z - me.z); if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  F.board = id => {
    const r = RIDES.find(x => x.id === (id || (F.near && F.near.id))); if (!r || F.on) return; if (canBoard && !canBoard()) return;
    const i = freeSeat(r, T()); if (i < 0) { toast('🎢 ' + r.n + ' ممتلئة حالياً — جرّب بعد شوي'); return; }
    F.on = true; F.ride = r; F.seat = i; F.endAt = performance.now() + r.dur * 1000; F.c0 = WK.camYaw = Math.PI; F.p0 = WK.pitch = .635; F.fov = null; WK.emote = 0; WK.jy = 0; WK.vy = 0;
    WK.walker.root.visible = false; btn.style.display = 'none'; F.near = null;
    $('#fairT').textContent = r.i + ' ' + r.n; $('#fairH').textContent = '👀 اسحب الشاشة تتفرّج حولك • اضغط «انزل» وقت ما تبي'; box.style.display = 'block';
    const joy = document.getElementById('joy'); if (joy) { F.joy = joy.style.display; joy.style.display = 'none'; }
    sfx('door'); let first = true; try { first = !localStorage.getItem('mnalsifr_fair_tip'); localStorage.setItem('mnalsifr_fair_tip', '1'); } catch {}
    if (first) toast('👀 أنت الحين تشوف بعيونك! اسحب الشاشة (أو الماوس) تلف حولك، و«انزل» لما تبي');
  };
  F.leave = (msg, silent) => {
    if (!F.on) return; const r = F.ride, s = seatAt(r.id, F.seat, T()); F.on = false; F.ride = null; box.style.display = 'none';
    const joy = document.getElementById('joy'); if (joy && F.joy !== undefined) joy.style.display = F.joy; WK.walker.root.visible = true; WK.mv = 0; WK.camYaw = WK.yaw + Math.PI; WK.pitch = .35;
    if (F.fov) { C.cam.fov = F.fov; C.cam.updateProjectionMatrix(); F.fov = null; }
    if (silent) return;
    const p = plaza(), dx = -r.x, dz = -r.z, l = Math.hypot(dx, dz) || 1, ex = p.x + r.x + dx / l * r.exit, ez = p.z + r.z + dz / l * r.exit;
    placeAt(ex, ez, Math.atan2(dx, dz)); toast(msg || '🎉 انتهت الجولة — تبي تكرر؟');
  };
  btn.onclick = () => F.board();
  box.querySelector('#fairX').onclick = () => F.leave('⬇️ نزلت — منورنا 🎉');
  addEventListener('keydown', e => { if (e.code === 'KeyE' && F.near && !F.on && WK.on && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) F.board(); });

  // مكان الراكب هذي اللحظة (مطلق) + اتجاه نظره
  F.seatPose = () => { if (!F.on) return null; const p = plaza(), s = seatAt(F.ride.id, F.seat, T()); return { x: p.x + s.x, y: s.y + .3, z: p.z + s.z, yaw: s.yaw }; };
  // كاميرا الشخص الأول: نظر الراكب = اتجاه المقعد + لفّة المستخدم بالسحب
  F.camera = cam => {
    const s = F.seatPose(); if (!s) return;
    if (!F.fov) { F.fov = cam.fov; cam.fov = 74; cam.updateProjectionMatrix(); }
    const yaw = s.yaw + (WK.camYaw - F.c0), pit = Math.max(-1.15, Math.min(1.1, (WK.pitch - F.p0) * 1.7)), cp = Math.cos(pit);
    cam.position.set(s.x, s.y + .85, s.z); cam.lookAt(s.x + Math.sin(yaw) * cp, s.y + .85 - Math.sin(pit), s.z + Math.cos(yaw) * cp);
  };
  F.frame = (dt, t) => {
    const T0 = T(), pz = plaza(); root.position.set(pz.x, .3, pz.z); const near = nearRoot(); root.visible = near; if (near) animate(T0);
    if (F.on) {
      const left = Math.max(0, Math.ceil((F.endAt - performance.now()) / 1000)); if (left !== F.left) { F.left = left; $('#fairT').textContent = F.ride.i + ' ' + F.ride.n + ' • باقي ' + left + ' ث'; }
      if (left <= 0) F.leave(); return;
    }
    let best = null, bd = 1e9;
    if (WK.on && !WK.intro && (!canBoard || canBoard())) { const p = plaza(); for (const r of RIDES) { const d = Math.hypot(p.x + r.bx - WK.p.x, p.z + r.bz - WK.p.z); if (d < r.br && d < bd) { bd = d; best = r; } } }
    if (best !== F.near) { F.near = best; btn.style.display = best ? 'block' : 'none'; if (best) btn.textContent = `${best.i} اركب ${best.n}`; }
  };
  F.spot = () => { const p = plaza(); return { x: p.x + R0.x + 16, z: p.z + R0.z }; };   // وجهة «مدينة الألعاب» (قدّام العجلة)
  return F;
}
