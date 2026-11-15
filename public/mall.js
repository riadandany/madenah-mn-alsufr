// ================= المول: ضخم، 3 أدوار، درج، محلات وناس =================
// القشرة الخارجية (جدران/نوافذ/لوحات) تنبني مع المدينة، أما الداخل (آلاف القطع) فينبني فقط لما تقرب من الباب
// ويختفي لما تبعد — عشان الأداء. كل الإحداثيات محلية نسبةً لمركز الساحة.
import * as THREE from '/vendor/three.module.min.js';

const CX = -223, HW = 95, HD = 70, FH = 12, S = FH / 7, NS = Math.round(15 * S), LV = [.3, .3 + FH, .3 + 2 * FH], ROOF = .3 + 3 * FH, CELL = 5;   // FH = ارتفاع الدور (كان 7): سقف مرتفع، والدرج أطول بنفس الميل
const ATR = { x0: -20, x1: 20, z0: -15, z1: 15 };
const SHOP = { x: 62, z: 0, r: 3.8 };   // منصّة المتجر داخل المول (إحداثيات المول المحلية، الدور الأرضي)
// الدرج: dir=+1 يرتفع باتجاه +x، -1 باتجاه -x. from = الدور اللي يبدأ منه
const STAIRS = [
  { x0: -65, x1: -65 + NS, z0: -20, z1: -15, dir: 1, from: 0 }, { x0: 65 - NS, x1: 65, z0: 15, z1: 20, dir: -1, from: 0 },
  { x0: -65, x1: -65 + NS, z0: 15, z1: 20, dir: 1, from: 1 }, { x0: 65 - NS, x1: 65, z0: -20, z1: -15, dir: -1, from: 1 }];
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const covered = (lv, x, z) => { if (inR(ATR, x, z)) return false; for (const s of STAIRS) if (s.from + 1 === lv && inR(s, x, z)) return false; return true; };
// (اسم، نوع، لون الأرضية، لون مميّز)
const TH = [['سوبرماركت', 'shelf', '#e9f0e1', '#3aa06a'], ['مخبز', 'food', '#f4e3c2', '#c2853a'], ['كوفي', 'food', '#e8d8c8', '#7a4f2a'], ['برجر', 'food', '#fde7c8', '#e94f3b'], ['بيتزا', 'food', '#fbe2d2', '#d6382f'],
  ['آيس كريم', 'food', '#f9e1ec', '#ff7bac'], ['حلويات', 'food', '#fbe5ef', '#c04f8d'], ['عصائر', 'food', '#e5f6d8', '#6bbf3a'], ['ملابس رجالية', 'rack', '#e4e9f2', '#2d6fb8'], ['ملابس نسائية', 'rack', '#f6e4ee', '#c04f8d'],
  ['ملابس أطفال', 'rack', '#fff1c9', '#f2a900'], ['أحذية', 'rack', '#ece6dc', '#7a4f2a'], ['حقائب', 'rack', '#efe3d6', '#8a5a2b'], ['ساعات', 'tech', '#e3e6ea', '#2b2f36'], ['نظارات', 'rack', '#e3eef6', '#2d6fb8'],
  ['جوالات', 'tech', '#e1e8ef', '#3d4a58'], ['إلكترونيات', 'tech', '#dfe7ee', '#1d6fd1'], ['ألعاب فيديو', 'game', '#e5e0f5', '#6a43c8'], ['ألعاب أطفال', 'toy', '#ffe9d0', '#ff7414'], ['مكتبة', 'shelf', '#f1ead9', '#7a4f2a'],
  ['عطور', 'shelf', '#f3e6f2', '#8a52c4'], ['مجوهرات', 'shelf', '#f8f0d0', '#d6a400'], ['رياضة', 'rack', '#e0f0e4', '#2f9d57'], ['هدايا وورود', 'toy', '#fde6e9', '#e94f8b'], ['صيدلية', 'shelf', '#e4f4f1', '#19a89a'], ['أثاث', 'shelf', '#efe6da', '#a8794a']];
const PAL = ['#e94f3b', '#2d6fb8', '#f2c230', '#3aa06a', '#8a52c4', '#ff7414', '#ffffff', '#e94f8b'];

export function createMall(C, D) {
  const { GEO, toon, textTex, AU, LOW, MID, WK } = C;
  const M = { inside: 0, state: 0, imesh: [], walkers: [], ppl: [] };
  const lay = (key, geo, items, o) => { const ms = D.lay(key, geo, items, o); M.imesh.push(...ms); return ms; };
  const sol = D.sol, rng = D.rng, rr = (a, b) => a + rng() * (b - a), pick = a => a[(rng() * a.length) | 0];
  const X = mx => CX + mx;
  const BAS = () => new THREE.MeshBasicMaterial({ color: '#ffffff' });

  // ---------- أرضية المول (للمشي) ----------
  M.ground = (lx, lz, y) => {
    const x = lx - CX; if (x < -HW || x > HW || lz < -HD || lz > HD) return null;
    const lim = y + .75; let best = LV[0];
    for (let l = 1; l < 3; l++) if (LV[l] <= lim && LV[l] > best && covered(l, x, lz)) best = LV[l];
    for (const s of STAIRS) if (inR(s, x, lz)) { const t = s.dir > 0 ? (x - s.x0) / (s.x1 - s.x0) : (s.x1 - x) / (s.x1 - s.x0), h = LV[s.from] + (LV[s.from + 1] - LV[s.from]) * t; if (h <= lim && h > best) best = h; }
    return best;
  };
  M.door = () => ({ x: X(HW) + 10, z: 1.1 });
  M.reg = () => {};

  // ---------- القشرة الخارجية ----------
  M.buildShell = () => {
    const B = [], W = [], F = [], bol = [];
    const wall = (mx0, mx1, mz0, mz1) => { B.push([X((mx0 + mx1) / 2), .3, (mz0 + mz1) / 2, mx1 - mx0, ROOF - .3, mz1 - mz0, 0, '#e9dfcc']); sol(X(mx0), X(mx1), mz0, mz1, .3, ROOF); };
    const t = .6;
    wall(-HW - t, -9 - 0, -HD - t, -HD + t); wall(9, HW + t, -HD - t, -HD + t); wall(-HW - t, -9, HD - t, HD + t); wall(9, HW + t, HD - t, HD + t);
    wall(HW - t, HW + t, -HD, -9); wall(HW - t, HW + t, 9, HD); wall(-HW - t, -HW + t, -HD, HD);
    // أحزمة وأطر
    for (const l of [0, 1, 2, 3]) { const y = (LV[l] ?? ROOF) - .6; F.push([X(0), y, -HD - .7, 2 * HW + 2, .5, .4, 0, '#c2553a'], [X(0), y, HD + .7, 2 * HW + 2, .5, .4, 0, '#c2553a'], [X(HW + .7), y, 0, .4, .5, 2 * HD + 2, 0, '#c2553a'], [X(-HW - .7), y, 0, .4, .5, 2 * HD + 2, 0, '#c2553a']); }
    // نوافذ
    for (let l = 0; l < 3; l++) { const y = LV[l] + 1.6 * S;
      for (let z = -HD + 9; z <= HD - 8; z += 10) { if (l === 0 && Math.abs(z) < 13) continue; W.push([X(HW + .62), y, z, .2, 3.8 * S, 6.6, 0, '#2f5f83']); W.push([X(-HW - .62), y, z, .2, 3.8 * S, 6.6, 0, '#2f5f83']); }
      for (let x = -HW + 10; x <= HW - 9; x += 10) { if (l === 0 && Math.abs(x) < 13) continue; W.push([X(x), y, -HD - .62, 6.6, 3.8 * S, .2, 0, '#2f5f83']); W.push([X(x), y, HD + .62, 6.6, 3.8 * S, .2, 0, '#2f5f83']); } }
    // سطح: حواف + مساحات حول الفتحة الزجاجية
    const roof = [];
    roof.push([X((-HW + ATR.x0) / 2 - 0), ROOF - .1, 0, HW + ATR.x0 + 1.2, .6, 2 * HD + 1.2, 0, '#cfc7b8']); roof.push([X((HW + ATR.x1) / 2), ROOF - .1, 0, HW - ATR.x1 + 1.2, .6, 2 * HD + 1.2, 0, '#cfc7b8']);
    roof.push([X(0), ROOF - .1, (-HD + ATR.z0) / 2, 40, .6, HD + ATR.z0, 0, '#cfc7b8']); roof.push([X(0), ROOF - .1, (HD + ATR.z1) / 2, 40, .6, HD - ATR.z1, 0, '#cfc7b8']);
    for (const [x, z, w, d] of [[0, -HD, 2 * HW + 2, 1.4], [0, HD, 2 * HW + 2, 1.4], [-HW, 0, 1.4, 2 * HD], [HW, 0, 1.4, 2 * HD]]) B.push([X(x), ROOF + .5, z, w, 1.4, d, 0, '#c2553a']);
    for (let k = 0; k < 6; k++) B.push([X(rr(-80, 80)), ROOF + .5, rr(-55, -25) * (k % 2 ? -1 : 1), 6, 2.2, 4, 0, '#9aa3ab']);
    // مظلة المدخل الرئيسي (شرق، تواجه الساحة) + مدخلان (شمال/جنوب)
    B.push([X(HW + 5), FH - .9, 0, 10, .5, 34, 0, '#c2553a']); for (const s of [-1, 1]) { const it = [X(HW + 9), .3, s * 16.5, 1.2, FH - 1.2, 1.2, 0, '#e9dfcc']; B.push(it); sol(it[0] - .6, it[0] + .6, it[2] - .6, it[2] + .6, .3, FH - .9); }
    for (const s of [-1, 1]) { B.push([X(0), FH - .9, s * (HD + 4), 34, .5, 8, 0, '#c2553a']); }
    // أعمدة تمنع السيارات من دخول المول (فراغ ≈1.7م يمرّ منه الشخص بس)
    const post = (x, z) => { bol.push([x, .3, z, .5, 1.2, .5, 0, '#f2c230']); bol.push([x, 1.0, z, .52, .25, .52, 0, '#222']); sol(x - .25, x + .25, z - .25, z + .25, .3, 1.5); };
    for (let k = -3; k <= 3; k++) { post(X(HW + .1), k * 2.2); post(X(k * 2.2), -HD + .1); post(X(k * 2.2), HD - .1); }
    // نخل وكراسي أمام المدخل
    const Pl = [], Lf = []; for (const z of [-26, -40, 26, 40]) { Pl.push([X(HW + 13), .3, z, .5, 7, .5, 0, '#9a6e3f']); for (let l = 0; l < 6; l++) Lf.push([X(HW + 13) + Math.cos(l) * 1.5, 7.6, z + Math.sin(l) * 1.5, 3.4, .25, .95, -l, '#3f8f45']); }
    for (const z of [-20, 20]) B.push([X(HW + 12), .3, z, .9, .55, 3, 0, '#9a6e3f']);
    D.lay('m_shell', GEO.box, B, { shadow: true }); D.lay('m_roof', GEO.box, roof, { mat: BAS() }); D.lay('m_shellF', GEO.box, F); D.lay('m_win', GEO.flat, W); D.lay('m_bol', GEO.box, bol); D.lay('m_pl', GEO.box, Pl); D.autoSol(Pl); D.lay('m_lf', GEO.flat, Lf);
    // لوحات المول
    const tex = textTex('🏬 مول من الصفر', 1280, 224, '#c2261c', '#ffffff', 150), mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    for (const [x, z, ry, w] of [[X(HW + .8), 0, Math.PI / 2, 34], [X(0), -HD - .9, Math.PI, 34], [X(0), HD + .9, 0, 34]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * .175), mat); m.position.set(x, 16.5, z); m.rotation.y = ry; D.root.add(m); }
    const en = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: textTex('🚪 المدخل', 512, 96, '#1d2b36', '#ffd34d', 62), transparent: true })); en.position.set(X(HW + .9), 5.2, 0); en.rotation.y = Math.PI / 2; D.root.add(en);
    // لوحة طريق قبل المول من الساحة
    for (const [txt, x, z, col] of [['🏬 المول ←', -112, -2, '#c2261c']]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.4), new THREE.MeshBasicMaterial({ map: textTex(txt, 512, 112, col, '#fff', 70), transparent: true })); m.position.set(x, 8, z); m.rotation.y = Math.PI / 2; D.root.add(m); }
    // زجاج السقف فوق الصالة الوسطى
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ color: '#9fd6f0', transparent: true, opacity: .4, side: THREE.DoubleSide })); gl.rotation.x = -Math.PI / 2; gl.position.set(X(0), ROOF + .1, 0); D.root.add(gl);
  };

  // ---------- الداخل (ينبني عند الاقتراب) ----------
  const SIGNS = []; const NPEOPLE = [];
  function buildInterior() {
    const B = [], CY = [], BL = [], FL = [], LF = [], WN = [], SLAB = [], TILE = [], LAMP = [], RAIL = [];
    const sol0 = D.solids.length;
    const mkS = (mx0, mx1, mz0, mz1, y0, y1) => sol(X(mx0), X(mx1), mz0, mz1, y0, y1);
    const box = (arr, mx, y, mz, sx, sy, sz, col, ry = 0, solid = false) => { arr.push([X(mx), y, mz, sx, sy, sz, ry, col]); if (solid) mkS(mx - sx / 2, mx + sx / 2, mz - sz / 2, mz + sz / 2, y, y + sy); };
    // --- الأرضيات والأسقف ---
    for (let l = 0; l < 3; l++) {
      for (let iz = 0; iz < HD * 2 / CELL; iz++) { let run = null; const z = -HD + iz * CELL + CELL / 2;
        for (let ix = 0; ix <= HW * 2 / CELL; ix++) { const x = -HW + ix * CELL + CELL / 2, ok = ix < HW * 2 / CELL && covered(l, x, z);
          if (ok && !run) run = ix; if (!ok && run !== null) { if (l > 0) SLAB.push([X(-HW + (run + ix) * CELL / 2), LV[l] - .55, z, (ix - run) * CELL, .55, CELL, 0, '#ece4d2']); run = null; } }
        for (let ix = 0; ix < HW * 2 / CELL; ix++) { const x = -HW + ix * CELL + CELL / 2; if ((ix + iz) % 2 && covered(l, x, z)) TILE.push([X(x), LV[l] + .005, z, CELL, .03, CELL, 0, '#d8ccb0']); } }
      if (l < 2) for (let x = -75; x <= 75; x += 15) for (let z = -45; z <= 45; z += 15) { if (x > ATR.x0 - 3 && x < ATR.x1 + 3 && z > ATR.z0 - 3 && z < ATR.z1 + 3) continue; LAMP.push([X(x), LV[l] + FH - .8, z, 3.4, .12, 3.4, 0, '#fffbe8']); }
      else for (let x = -75; x <= 75; x += 15) for (let z = -45; z <= 45; z += 15) { if (x > ATR.x0 - 3 && x < ATR.x1 + 3 && z > ATR.z0 - 3 && z < ATR.z1 + 3) continue; LAMP.push([X(x), ROOF - .8, z, 3.4, .12, 3.4, 0, '#fffbe8']); }
      // أعمدة
      for (const x of [-60, -30, 30, 60]) for (const z of [-33, 33]) box(B, x, LV[l], z, 1.5, FH - .85, 1.5, '#dcd3bf', 0, true);
      // درابزين الفتحة الوسطى
      if (l > 0) { const y = LV[l], r = (mx0, mx1, mz0, mz1) => { RAIL.push([X((mx0 + mx1) / 2), y + .5, (mz0 + mz1) / 2, Math.max(.2, mx1 - mx0), .6, Math.max(.2, mz1 - mz0), 0, '#9fd6f0']); RAIL.push([X((mx0 + mx1) / 2), y + 1.1, (mz0 + mz1) / 2, Math.max(.3, mx1 - mx0), .12, Math.max(.3, mz1 - mz0), 0, '#2b2f36']); mkS(mx0 - .1, mx1 + .1, mz0 - .1, mz1 + .1, y, y + 1.2); };
        r(ATR.x0 - .2, ATR.x1 + .2, ATR.z0 - .2, ATR.z0); r(ATR.x0 - .2, ATR.x1 + .2, ATR.z1, ATR.z1 + .2); r(ATR.x0 - .2, ATR.x0, ATR.z0, ATR.z1); r(ATR.x1, ATR.x1 + .2, ATR.z0, ATR.z1); }
    }
    // --- الدرج ---
    for (const s of STAIRS) { const n = NS, base = LV[s.from], top = LV[s.from + 1], zc = (s.z0 + s.z1) / 2;
      for (let i = 0; i < n; i++) { const x = s.dir > 0 ? s.x0 + i + .5 : s.x1 - i - .5, h = (top - base) * (i + 1) / n; box(B, x, base, zc, 1, h, s.z1 - s.z0, i % 2 ? '#cfc4ad' : '#e0d7c2');
        for (const z of [s.z0 - .1, s.z1 + .1]) RAIL.push([X(x), base + h, z, 1, 1.0, .12, 0, '#9fd6f0']); }
      for (const z of [s.z0 - .1, s.z1 + .1]) mkS(Math.min(s.x0, s.x1), Math.max(s.x0, s.x1), z - .15, z + .15, base, top + 1.2);
      const hi = s.dir > 0 ? s.x1 - .5 : s.x0, lo = s.dir > 0 ? s.x0 : s.x1; mkS(hi, hi + .5, s.z0, s.z1, base, top - 1);     // يسد تحت الدرج من جهة الأعلى
      mkS(lo - (s.dir > 0 ? .15 : -.15) - .15, lo + .15, s.z0, s.z1, top, top + 1.2); RAIL.push([X(lo), top + .6, zc, .2, 1.1, s.z1 - s.z0, 0, '#9fd6f0']);   // حاجز الطرف المنخفض بفتحة الدور العلوي
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.3), new THREE.MeshBasicMaterial({ map: textTex(s.from === 0 ? '⬆️ للدور الأول' : '⬆️ للدور الثاني', 512, 112, '#1d2b36', '#ffd34d', 62), transparent: true })); lab.position.set(X(s.dir > 0 ? s.x0 - 1 : s.x1 + 1), base + FH * .8, zc); lab.rotation.y = s.dir > 0 ? -Math.PI / 2 : Math.PI / 2; D.root.add(lab); M.imesh.push(lab); }
    // --- المحلات ---
    let ti = 0; const keeperCh = () => (rng() * 10) | 0;
    const shop = (lv, mx, mz, fx, fz, w, d, first) => {
      const th = TH[ti++ % TH.length], y0 = LV[lv], rx = fz, rz = -fx, ox = mx - fx * d / 2, oz = mz - fz * d / 2;
      const P = (a, b) => [ox + rx * a + fx * b, oz + rz * a + fz * b], zAxis = Math.abs(fz) === 1;
      const put = (arr, a, b, y, wa, wb, h, col, solid) => { const [px, pz] = P(a, b), sx = zAxis ? wa : wb, sz = zAxis ? wb : wa; box(arr, px, y0 + y + (arr === BL ? h / 2 : 0), pz, sx, h, sz, col, 0, solid); };
      put(FL, 0, d / 2, .02, w - .4, d - .4, .04, th[2]);
      put(B, 0, .25, 0, w, .5, 6.2, th[3]);                                        // الجدار الخلفي
      put(B, w / 2, d / 2, 0, .4, d, 5.6, '#f2ede2', true); if (first) put(B, -w / 2, d / 2, 0, .4, d, 5.6, '#f2ede2', true);
      put(B, 0, d - .3, 5.0, w, .5, 1.5, th[3]);                                   // كورنيش المحل
      const [sxp, szp] = P(0, d - .1); SIGNS.push({ txt: th[0], bg: th[3], fg: '#fff', x: X(sxp), y: y0 + 5.75, z: szp, w: Math.min(w - 1.6, 11), h: 1.3, ry: Math.atan2(fx, fz) });
      const items = (a0, a1, b, y, n, h) => { for (let k = 0; k < n; k++) put(B, a0 + (a1 - a0) * (n === 1 ? .5 : k / (n - 1)), b, y, .9, h, .6, pick(PAL)); };
      switch (th[1]) {
        case 'shelf': put(B, 0, .9, 0, w - 1.5, .9, 3.8, '#c9b79a', true); for (const yy of [.5, 1.7, 2.9]) items(-w / 2 + 1.6, w / 2 - 1.6, 1.4, yy, 7, .8);
          for (const a of [-w * .22, w * .22]) { put(B, a, d * .5, 0, w * .3, .9, 1.5, '#d8c9a8', true); items(a - w * .1, a + w * .1, d * .5, 1.5, 3, .7); } break;
        case 'rack': for (const b of [d * .35, d * .6]) { put(B, 0, b, 0, w * .7, .2, 2.3, '#9aa3ab', true); for (let k = 0; k < 9; k++) put(B, -w * .32 + k * w * .08, b, .7, .35, .5, 1.3, pick(PAL)); }
          for (const a of [-w * .3, w * .3]) { put(CY, a, d * .78, 0, .6, .6, 1.4, '#e8e0d2'); put(BL, a, d * .78, 1.4, .55, .55, .55, '#f0d9bf'); } break;
        case 'food': put(B, 0, d * .42, 0, w * .85, 1.4, 1.15, th[3], true); put(B, 0, d * .42, 1.15, w * .8, 1.2, .5, '#bfe6f5'); put(WN, 0, 1.1, 2.6, w * .7, .1, 1.8, '#2b2f36'); for (let k = 0; k < 5; k++) put(WN, -w * .3 + k * w * .15, 1.0, 3.1 - (k % 2) * .5, w * .1, .06, .25, pick(PAL));
          for (const a of [-w * .26, w * .26]) { put(CY, a, d * .78, 0, 1.6, 1.6, .85, '#e8e0d2'); put(CY, a - 1.4, d * .78, 0, .6, .6, .55, th[3]); put(CY, a + 1.4, d * .78, 0, .6, .6, .55, th[3]); } break;
        case 'tech': for (const a of [-w * .25, w * .25]) { put(B, a, d * .55, 0, w * .35, 1.6, .9, '#2b2f36', true); for (let k = 0; k < 3; k++) put(WN, a - w * .1 + k * w * .1, d * .55, .9, .9, .08, .7, '#7ad0ff'); }
          for (let k = 0; k < 3; k++) put(WN, -w * .3 + k * w * .3, .55, 2.2, w * .22, .1, 1.8, '#4aa8ff'); break;
        case 'game': for (let r = 0; r < 2; r++) for (let k = 0; k < Math.floor(w / 2.6); k++) { const a = -w / 2 + 1.6 + k * 2.6, b = 2 + r * 4.2; put(B, a, b, 0, 1.3, 1, 2.2, pick(PAL), true); put(WN, a, b + .52, 1.3, 1, .06, .8, pick(['#7ad0ff', '#ffd34d', '#8aff9a'])); } break;
        case 'toy': for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) put(B, -w * .2 + (k - (3 - r) / 2) * 1.3, d * .5, r * 1.2, 1.2, 1.2, 1.2, pick(PAL)); put(BL, w * .28, d * .55, .1, 1.8, 1.8, 1.8, '#a8794a'); put(BL, w * .28, d * .55, 1.7, 1.1, 1.1, 1.1, '#b98a5a'); break;
      }
      if (th[1] !== 'game') put(B, w * .28, d - 4, 0, 3.6, 1.2, 1.1, '#c9b79a', true);   // طاولة المحاسب
      if (th[1] !== 'game' && rng() < .65) { const [kx, kz] = P(w * .28, d - 5.2); NPEOPLE.push({ x: X(kx), y: y0, z: kz, ry: Math.atan2(fx, fz), ch: keeperCh() }); }
    };
    for (let l = 0; l < 3; l++) {
      const nN = 12, wN = 2 * HW / nN;
      for (let i = 0; i < nN; i++) { const mx = -HW + (i + .5) * wN; if (l === 0 && Math.abs(mx) < 14) continue; shop(l, mx, -HD + 9, 0, 1, wN - .2, 18, i === 0); shop(l, mx, HD - 9, 0, -1, wN - .2, 18, i === 0); }
      const nW = 6, wW = 104 / nW; for (let i = 0; i < nW; i++) shop(l, -HW + 9, -52 + (i + .5) * wW, 1, 0, wW - .2, 18, i === 0);
      for (const z0 of [-52, 12]) for (let i = 0; i < 2; i++) shop(l, HW - 9, z0 + (i + .5) * 20, -1, 0, 19.8, 18, i === 0);
    }
    // --- أثاث الأدوار ---
    const palm = (mx, y, mz, h = 4) => { box(CY, mx, y, mz, 1.6, .9, 1.6, '#a8794a'); box(B, mx, y + .9, mz, .35, h, .35, '#9a6e3f'); for (let l = 0; l < 6; l++) LF.push([X(mx) + Math.cos(l) * 1.2, y + .9 + h, mz + Math.sin(l) * 1.2, 2.8, .22, .8, -l, '#3f8f45']); mkS(mx - .8, mx + .8, mz - .8, mz + .8, y, y + 1); };
    for (let l = 0; l < 3; l++) { const y = LV[l];
      for (const [x, z] of [[-35, -40], [35, 40], [-35, 40], [35, -40], [-75, -45], [75, 45]]) { if (Math.abs(z) > 38 && Math.abs(x) > 70 && l === 0 && x > 0 && Math.abs(z) < 14) continue; palm(x, y, z); }
      for (const [x, z, ry] of [[-26, 0, 0], [26, 0, 0], [0, -21, 1], [0, 21, 1]]) { const sx = ry ? 5.5 : 1, sz = ry ? 1 : 5.5; box(B, x, y, z, sx, .55, sz, '#a8794a', 0, true); box(B, x + (ry ? 0 : (x > 0 ? .5 : -.5)), y + .55, z + (ry ? (z > 0 ? .5 : -.5) : 0), ry ? 5.5 : .2, .6, ry ? .2 : 5.5, '#7a5533'); } }
    // الدور الأرضي: نافورة وسط + سيارة عرض + أكشاك
    box(CY, 0, LV[0], 0, 12, .7, 12, '#d3dade'); box(CY, 0, LV[0] + .7, 0, 10.8, .08, 10.8, '#5fb7e6'); box(CY, 0, LV[0] + .7, 0, 1.4, 5, 1.4, '#eef1f3'); box(CY, 0, LV[0] + 5.5, 0, 4.2, .4, 4.2, '#d3dade'); box(CY, 0, LV[0] + 5.9, 0, 3.6, .06, 3.6, '#5fb7e6'); mkS(-6, 6, -6, 6, LV[0], LV[0] + 1);
    // منصّة المتجر (الدور الأرضي، قرب المدخل): قف داخل الدائرة يفتح المتجر
    box(CY, SHOP.x, LV[0], SHOP.z, 8.4, .12, 8.4, '#ffffff'); box(CY, SHOP.x, LV[0] + .12, SHOP.z, 7.4, .06, 7.4, '#ff7414'); box(CY, SHOP.x, LV[0] + .18, SHOP.z, 5.6, .06, 5.6, '#ffd9b8'); box(CY, SHOP.x, LV[0] + .24, SHOP.z, 3.2, .06, 3.2, '#ff7414');
    for (const [dx, dz] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) { box(CY, SHOP.x + dx, LV[0], SHOP.z + dz, .7, 4.2, .7, '#2b2f36', 0, true); BL.push([X(SHOP.x + dx), LV[0] + 4.4, SHOP.z + dz, .9, .9, .9, 0, '#ff7414']); }
    SIGNS.push({ txt: 'المتجر', bg: '#ff7414', fg: '#fff', x: X(SHOP.x) + .06, y: LV[0] + 6.6, z: SHOP.z, w: 9, h: 2, ry: Math.PI / 2 }, { txt: 'المتجر', bg: '#ff7414', fg: '#fff', x: X(SHOP.x) - .06, y: LV[0] + 6.6, z: SHOP.z, w: 9, h: 2, ry: -Math.PI / 2 });
    box(B, 30, LV[0], -40, 11, .35, 7, '#2b2f36', 0, true);
    for (const [x, z, c] of [[-45, 34, '#e94f3b'], [45, -34, '#2d6fb8'], [-48, -34, '#f2c230'], [48, 34, '#3aa06a']]) { box(B, x, LV[0], z, 4, 1.2, 2, c, 0, true); box(CY, x, LV[0], z, .2, 3, .2, '#fff'); BL.push([X(x), LV[0] + 3, z, 5, 1, 5, 0, c]); }
    // الدور الأول: منطقة ألعاب الأطفال (مسبح كرات + مكعبات)
    box(B, 52, LV[1], 36, 16, .8, 14, '#2d6fb8', 0, true); for (let k = 0; k < 40; k++) BL.push([X(rr(45, 59)), LV[1] + .9, rr(30, 42), 1.2, 1.2, 1.2, 0, pick(PAL)]);
    for (let k = 0; k < 5; k++) box(B, 52 - 6 + k * 3, LV[1], 24, 2, 1 + k * .5, 2, pick(PAL), 0, true);
    // الدور الثاني: ساحة مطاعم (طاولات وكراسي)
    for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) { const x = -60 + k * 15, z = 27 + r * 8; if (x > ATR.x0 - 6 && x < ATR.x1 + 6 && z < ATR.z1 + 8) continue; box(CY, x, LV[2], z, 2.2, .1, 2.2, '#e8e0d2'); box(CY, x, LV[2] + .1, z, .3, .8, .3, '#5b6670'); for (const [dx, dz] of [[-1.7, 0], [1.7, 0], [0, -1.7], [0, 1.7]]) box(CY, x + dx, LV[2], z + dz, .8, .6, .8, pick(PAL)); mkS(x - 1, x + 1, z - 1, z + 1, LV[2], LV[2] + 1); if (rng() < .4) NPEOPLE.push({ x: X(x + 1.7), y: LV[2], z: z, ry: -Math.PI / 2, ch: keeperCh()}); }
    // لافتات معلّقة فوق الفتحة
    for (let l = 1; l < 3; l++) for (const [x, z, c] of [[-14, 0, '#e94f3b'], [14, 0, '#2d6fb8'], [0, 0, '#f2c230']]) FL.push([X(x), LV[l] + 3.2, z, .1, 2.6, 7, 0, c]);
    // --- رسم الطبقات ---
    const mat = BAS();
    lay('m_slab', GEO.box, SLAB, { mat }); lay('m_tile', GEO.box, TILE, { mat: BAS() }); lay('m_lamp', GEO.box, LAMP, { mat: BAS() }); lay('m_rail', GEO.box, RAIL, { mat: BAS() });
    lay('m_box', GEO.box, B); lay('m_cyl', GEO.cyl, CY); lay('m_ball', GEO.ball, BL); lay('m_flat', GEO.box, FL); lay('m_leaf', GEO.flat, LF); lay('m_wn', GEO.box, WN, { mat: BAS() });
    // أرضية الدور الأرضي مصقولة تحت البلاط
    // اللوحات: أطلس واحد لكل الأسماء (سحبة رسم واحدة)
    const keys = [...new Set(SIGNS.map(s => s.txt + '|' + s.bg))], CW = 256, CH = 64, cols = 4, rows = Math.ceil(keys.length / cols), cv = document.createElement('canvas'); cv.width = CW * cols; cv.height = CH * rows; const g = cv.getContext('2d');
    keys.forEach((k, i) => { const [t, bg] = k.split('|'), cx = (i % cols) * CW, cy = Math.floor(i / cols) * CH; g.fillStyle = bg; g.fillRect(cx, cy, CW, CH); g.fillStyle = '#fff'; g.font = '900 40px Cairo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(t, cx + CW / 2, cy + CH / 2 + 2, CW - 14); });
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const pos = [], uv = [], ix = [];
    SIGNS.forEach((s, i) => { const k = keys.indexOf(s.txt + '|' + s.bg), u0 = (k % cols) / cols, v1 = 1 - Math.floor(k / cols) / rows, u1 = u0 + 1 / cols, v0 = v1 - 1 / rows, c = Math.cos(s.ry), sn = Math.sin(s.ry), hw = s.w / 2, hh = s.h / 2, n = pos.length / 3;
      for (const [a, b] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) pos.push(s.x + a * c, s.y + b, s.z - a * sn);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1); ix.push(n, n + 1, n + 2, n, n + 2, n + 3); });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(ix);
    const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); D.root.add(sm); M.imesh.push(sm);
    // الناس: ثابتين (محلات ومطاعم) — instanced
    M.imesh.push(...C.peopleLayer('m_ppl', NPEOPLE.map(p => ({ ...p, x: p.x - 0 })), D.root));
    // زوّار يتمشون
    const NW = LOW ? 3 : MID ? 6 : 10;
    for (let i = 0; i < NW; i++) { const lv = i % 3, w = C.makeWalker((rng() * 10) | 0, C.CM, rng() < .4 ? 1 + ((rng() * 6) | 0) : 0, 0); w.root.visible = false; D.root.add(w.root); M.walkers.push({ w, lv, x: rr(-60, 60), z: rr(-40, 40), tx: 0, tz: 0, r: 0, ph: rr(0, 6), wait: rr(0, 3), amt: 0, t: 0 }); }
    // سجّل الصلبات الجديدة بعالم اللعبة
    const P = C.plaza(); for (let i = sol0; i < D.solids.length; i++) { const b = D.solids[i]; C.addSolid([b[0] + P.x, b[1] + P.x, b[2] + P.z, b[3] + P.z, b[4], b[5]]); }
  }
  const target = b => { for (let k = 0; k < 20; k++) { const x = rr(-72, 72), z = rr(-46, 46); if (x > ATR.x0 - 6 && x < ATR.x1 + 6 && z > ATR.z0 - 6 && z < ATR.z1 + 6) continue; if (STAIRS.some(s => x > s.x0 - 4 && x < s.x1 + 4 && z > s.z0 - 4 && z < s.z1 + 4)) continue; b.tx = x; b.tz = z; return; } b.tx = 0; b.tz = 30; };

  M.frame = (dt, t, lx, lz) => {
    const dxm = Math.max(Math.abs(lx - CX) - HW, 0), dzm = Math.max(Math.abs(lz) - HD, 0), dist = Math.hypot(dxm, dzm), in_ = dist === 0 ? 1 : 0;
    M.inside += (in_ - M.inside) * Math.min(1, dt * 2);
    if (!M.state && dist < 55 && WK.on) { M.state = 1; C.toast('🏬 يحمّل المول…'); setTimeout(() => { try { buildInterior(); M.state = 2; C.toast('🏬 أهلاً بك في المول! 3 أدوار وكل شي فيها'); AU.door(); } catch (e) { console.error(e); M.state = 3; } }, 40); }
    const vis = M.state === 2 && dist < 80; if (M.shown !== vis) { M.shown = vis; M.imesh.forEach(m => m.visible = vis); }
    if (!vis) return;
    const P = C.plaza(), f = WK.on ? WK.p : null;
    // منصّة المتجر: أول ما تدخل الدائرة يفتح المتجر (مرة وحدة لكل دخلة)
    if (f) { const ds = Math.hypot(lx - CX - SHOP.x, lz - SHOP.z); if (f.y < 6 && ds < SHOP.r) { if (!M.padOn) { M.padOn = 1; if (D.onShop) D.onShop(); } } else if (ds > SHOP.r + 1.5) M.padOn = 0; }
    for (const b of M.walkers) { const on = dist < 40; b.w.root.visible = on; if (!on) continue;
      let mv = false; if (b.wait > 0) b.wait -= dt; else { const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz); b.t += dt; if (d < 1.2 || b.t > 14 || !b.tx) { b.wait = rr(1, 5); b.t = 0; target(b); } else { b.x += dx / d * 2.2 * dt; b.z += dz / d * 2.2 * dt; b.r = Math.atan2(dx, dz); mv = true; const q = { x: X(b.x) + P.x, z: b.z + P.z }; C.collide(q, LV[b.lv], .7); b.x = q.x - P.x - CX; b.z = q.z - P.z; } }
      b.amt += ((mv ? .8 : 0) - b.amt) * Math.min(1, dt * 8); if (mv) b.ph += dt * 9; b.w.pose(b.ph, b.amt, t); b.w.root.position.set(X(b.x), LV[b.lv] + b.w.bob, b.z); b.w.root.rotation.y = b.r; }
  };
  return M;
}
