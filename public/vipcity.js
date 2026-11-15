// ================= مدينة مشتركي تيك توك: أسوار + بوابة + حوش + شارع رئيسي + 13 قصراً ضخماً =================
// خلف الساحة (عكس اتجاه البرج). كل الإحداثيات محلية نسبةً لمركز الساحة (نفس نظام المول والبحيرة).
// القشرة تنبني مرة وحدة لما تقرب (instanced)، وتختفي لما تبعد. ثوابت السيرفر (vipInside) لازم تطابقها: HW=200، Z0=300، العمق 390.
import * as THREE from '/vendor/three.module.min.js';

export const VIP = { HW: 200, Z0: 300, DV: 390, ZB: 690, GATE: 14 };
const { HW, Z0, ZB, GATE } = VIP;
// مواقع القصور: lot 0 = قصر المشرف الكبير (آخر الشارع)، 1..12 = على الجانبين (فرد = يسار، زوج = يمين)
export const lotInfo = lot => {
  if (lot === 0) return { type: 'G', cx: 0, zF: 604, k: 1.3 };
  const k = Math.floor((lot - 1) / 2), right = (lot - 1) % 2 === 1;
  return { type: right ? 'R' : 'L', cz: 353 + 46 * k, xF: right ? 26 : -26, k: 1 };
};
// باب القصر (نقطة وقوف قدّامه) بإحداثيات الساحة المحلية
export const lotDoor = lot => { const i = lotInfo(lot); return i.type === 'G' ? { x: 0, z: i.zF - 7 } : { x: i.xF + (i.type === 'L' ? 9 : -9), z: i.cz }; };
const PALETTES = [['#f4ecd8', '#d6b25e', '#d6b25e'], ['#fbf7f0', '#e8b4a0', '#e8b4a0'], ['#ecdcb8', '#35b7b0', '#35b7b0'], ['#f2f4f8', '#4a78c8', '#4a78c8'], ['#f6dcc0', '#d6b25e', '#c0504d'],
  ['#eef1ea', '#2fa36b', '#2fa36b'], ['#e4e6ea', '#d6b25e', '#8a52c4'], ['#efdcb4', '#8a52c4', '#d6b25e']];   // [جدار، زخرفة/قباب، لمسة]

export function createVip(C, D) {
  const { GEO, WK, textTex } = C;
  const V = { state: 0, pass: false, mine: null, houses: [], imesh: [], open: false, leaf: 0, plates: [], spin: [], gateSol: [] };
  const sol = D.sol, rng = D.rng, root = D.root;
  const L = { box: [], cyl: [], cone: [], ball: [], pyr: [], win: [], leaf: [], glow: [] };
  const add = (k, x, y, z, sx, sy, sz, c, ry = 0) => L[k].push([x, y, z, sx, sy, sz, ry, c]);
  const BAS = () => new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const S3 = (x0, x1, z0, z1, y1, y0 = .3) => sol(x0, x1, z0, z1, y0, y1);

  // ---------- الأرضية (للمشي) ----------
  V.ground = (lx, lz, y) => (Math.abs(lx) <= HW + 6 && lz >= Z0 - 100 && lz <= ZB + 6 ? .3 : null);
  V.center = () => ({ x: 0, z: (Z0 + ZB) / 2 });
  V.gate = () => ({ x: 0, z: Z0 - 22 });                // وقوفك قدّام البوابة (بالحوش)
  V.inCourt = (lx, lz) => Math.abs(lx) < 70 && lz > Z0 - 95 && lz < Z0 + 2;

  // ---------- مخطّط القصر: (u عرض الواجهة، v العمق للداخل) → عالم ----------
  function mapper(i) {
    if (i.type === 'G') return { p: (u, v) => [i.cx + u * i.k, i.zF + v * i.k], d: (su, sv) => [su * i.k, sv * i.k], ry: Math.PI };
    const s = i.type === 'L' ? -1 : 1;
    return { p: (u, v) => [i.xF + s * v, i.cz + u], d: (su, sv) => [sv, su], ry: i.type === 'L' ? Math.PI / 2 : -Math.PI / 2 };
  }
  function palace(lot) {
    const i = lotInfo(lot), M = mapper(i), K = i.k, pal = PALETTES[lot % PALETTES.length], WALL = pal[0], GOLD = pal[1], ACC = pal[2];
    const pb = (kind, u, y, v, su, sy, sv, c) => { const [x, z] = M.p(u, v), [dx, dz] = M.d(su, sv); add(kind, x, y, z, dx, sy * K, dz, c); };     // صندوق مركزه (u,v) وقاعدته y
    const cy = (kind, u, y, v, r, h, c) => { const [x, z] = M.p(u, v); add(kind, x, y, z, r * 2 * K, h * K, r * 2 * K, c); };
    const Y = h => .3 + h * K;
    // قاعدة + درج
    pb('box', 0, .3, 36, 56, 1.4, 80, '#d9cfb8'); pb('box', 0, .3, 36, 58, .5, 82, GOLD);
    for (let st = 0; st < 3; st++) pb('box', 0, .3, -2.5 - 1.1 * st, 22, .45 * (3 - st), 1.4, '#e8dfca');
    // الكتلة الرئيسية + الدور الأعلى + التاج
    pb('box', 0, Y(1.4), 26, 44, 24, 52, WALL);
    pb('box', 0, Y(25.4), 28, 46, 1.4, 56, GOLD); pb('box', 0, Y(26.8), 28, 36, 12, 38, WALL); pb('box', 0, Y(38.8), 28, 38, 1.2, 40, GOLD);
    pb('box', 0, Y(40), 26, 24, 8, 22, WALL); pb('box', 0, Y(48), 26, 26, 1, 24, GOLD);
    cy('ball', 0, Y(48), 26, 13, 15, GOLD); cy('cyl', 0, Y(62), 26, 1.6, 4, GOLD); cy('cone', 0, Y(66), 26, 1.4, 9, GOLD);
    for (let a = 0; a < 8; a++) { const th = a / 8 * Math.PI * 2; cy('cyl', Math.cos(th) * 11.5, Y(48), 26 + Math.sin(th) * 11.5, .7, 7, WALL); }
    // أبراج الزوايا بقباب
    for (const [u, v] of [[-22, 0], [22, 0], [-22, 52], [22, 52]]) { cy('cyl', u, Y(1.4), v, 5.2, 40, WALL); cy('cyl', u, Y(25), v, 5.8, 1.2, GOLD); cy('cyl', u, Y(41), v, 6, 1.2, GOLD); cy('cone', u, Y(42), v, 6.6, 15, ACC); cy('ball', u, Y(57), v, 1.8, 1.8, GOLD); }
    // رواق أمامي بأعمدة وجملون
    for (let k = -2; k <= 2; k++) cy('cyl', k * 5.4, Y(1.4), -4.2, 1.15, 19, '#fbf7f0');
    pb('box', 0, Y(20.4), -2.6, 32, 2, 8, GOLD); pb('pyr', 0, Y(22.4), -2.6, 32, 7.5, 8.6, WALL);
    pb('box', 0, Y(1.4), .2, 9, 13, 2, '#3a2a1c'); pb('box', 0, Y(14.4), .4, 10.6, 1.2, 2.4, GOLD); pb('box', -5.6, Y(1.4), .4, .8, 13.6, 2.2, GOLD); pb('box', 5.6, Y(1.4), .4, .8, 13.6, 2.2, GOLD);
    pb('box', -1.1, Y(6), -.9, .5, 2.2, .5, GOLD); pb('box', 1.1, Y(6), -.9, .5, 2.2, .5, GOLD);
    // نوافذ: 3 أدوار بالواجهة + الجوانب
    for (let f = 0; f < 3; f++) for (let u = -18; u <= 18; u += 6) { if (f === 0 && Math.abs(u) < 8) continue; pb('win', u, Y(4 + 8 * f), -.15, 3.2, 5, .3, '#24456a'); pb('box', u, Y(3.5 + 8 * f), -.5, 3.8, .45, .5, GOLD); }
    for (let f = 0; f < 3; f++) for (let v = 8; v <= 46; v += 8) for (const su of [-22.2, 22.2]) pb('win', su, Y(4 + 8 * f), v, .3, 5, 3.2, '#24456a');
    for (let u = -9; u <= 9; u += 9) pb('win', u, Y(28.5), 8.3, 3, 5, .3, '#24456a');
    // شرفة
    pb('box', 0, Y(9.4), -2.2, 14, .7, 4.4, GOLD); for (let u = -6; u <= 6; u += 2) pb('box', u, Y(10.1), -4.1, .35, 1.7, .35, GOLD); pb('box', 0, Y(11.8), -4.1, 13.4, .3, .4, GOLD);
    // ⭐ العلامة المميزة: نوتة تيك توك ثلاثية الأبعاد (سماوي + أحمر + أبيض) فوق القبة
    const note = (du, c) => { cy('cyl', du, Y(70), 26, .55, 11, c); cy('ball', du - 2.7, Y(70), 26, 1.7, 1.7, c); pb('box', du + 1.9, Y(78), 26, 4.2, 2.2, .9, c); };
    note(-.45, '#25f4ee'); note(.45, '#fe2c55'); note(0, '#ffffff'); cy('cyl', 0, Y(69), 26, 5.5, .8, GOLD);
    if (i.type !== 'G') {
    // الحديقة الخلفية + المسبح
    const GV = 96; pb('box', 0, .3, GV, 40, .8, 28, '#f3f1ea'); pb('box', 0, .9, GV, 35, .35, 23, '#2fb5e6');
    for (let k = 0; k < 4; k++) { const u = -12 + k * 8; pb('box', u, .3, GV - 17, 3, .5, 6, '#ffffff'); pb('box', u, .8, GV - 15.6, 3, .9, 1.3, '#e94f3b'); }
    for (const u of [-14, 14]) { cy('cyl', u, .3, GV + 18, .25, 4.4, '#7a5533'); cy('cone', u, .3 + 4.4 * K, GV + 18, 3.4, 1.6, u < 0 ? '#e94f3b' : '#ffd34d'); }
    const palm = (u, v, h = 11) => { cy('cyl', u, .3, v, .45, h, '#9a6e3f'); const [x, z] = M.p(u, v); for (let l = 0; l < 6; l++) add('leaf', x + Math.cos(l) * 2.2, .3 + h * K + .2, z + Math.sin(l) * 2.2, 5, .3, 1.6, '#3f8f45', -l); };
    for (const [u, v] of [[-18, 66], [18, 66], [-20, 120], [20, 120], [-8, 138], [8, 138], [-19, 90], [19, 90]]) palm(u, v, 9 + ((u + v) % 3));
    for (let v = 62; v <= 140; v += 6) { pb('box', -22.5, .3, v, 1.6, 2.2, 3.4, '#2f7d3a'); pb('box', 22.5, .3, v, 1.6, 2.2, 3.4, '#2f7d3a'); }
    pb('box', 0, .3, 66, 56, 1.6, .8, '#efe6d4'); pb('box', 0, .3, 162, 56, 1.6, .8, '#efe6d4');                  // حواجز الحديقة
    for (const u of [-23.5, 23.5]) pb('box', u, .3, 82, .9, 1.4, 164, '#efe6d4');                              // جدران فاصلة بين القصور
    for (const [u, v] of [[-16, 8], [16, 8], [-16, 46], [16, 46], [0, 62]]) { cy('cyl', u, .3, v, .22, 4.2, '#3a4750'); cy('ball', u, .3 + 4.2 * K, v, .9, .9, '#fff3c4'); }
    } else {   // قصر المشرف الكبير: حدائق أمامية على الجانبين
      for (const sx of [-1, 1]) { pb('box', sx * 36, .3, 20, 12, .35, 34, '#4f9a45'); for (let k = 0; k < 3; k++) { cy('cyl', sx * 36, .3, 6 + k * 14, .5, 10, '#9a6e3f'); const [x, z] = M.p(sx * 36, 6 + k * 14); for (let l = 0; l < 6; l++) add('leaf', x + Math.cos(l) * 2.2, .3 + 10 * K + .2, z + Math.sin(l) * 2.2, 5, .3, 1.6, '#3f8f45', -l); } }
      for (const u of [-14, 14]) { pb('box', u, .3, -6, 3, 4, 3, '#efe6d4'); cy('ball', u, .3 + 4 * K, -6, 1.6, 1.6, '#f2c230'); }
    }
    // مجسمات صلبة (ما يدخلها اللاعب): القصر كله + المسبح + أبراجه
    const [ax, az] = M.p(-30, -4), [bx, bz] = M.p(30, i.type === 'G' ? 53 : 72); S3(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), 80);
    if (i.type !== 'G') { const [px0, pz0] = M.p(-21, 96 - 14), [px1, pz1] = M.p(21, 96 + 14); S3(Math.min(px0, px1), Math.max(px0, px1), Math.min(pz0, pz1), Math.max(pz0, pz1), 1.6); }
    // لوحة الاسم (تتحدّث بالقائمة)
    const [nx, nz] = M.p(0, -6.2); const plate = new THREE.Mesh(new THREE.PlaneGeometry(20 * K, 3.6 * K), new THREE.MeshBasicMaterial({ map: textTex('🔒 قصر شاغر', 1024, 190, '#1d2b36', '#c9ced4', 100), transparent: true }));
    plate.position.set(nx, Y(23.4), nz); plate.rotation.y = i.type === 'G' ? Math.PI : i.type === 'L' ? Math.PI / 2 : -Math.PI / 2; root.add(plate); V.imesh.push(plate); V.plates[lot] = plate;
  }

  // ---------- البوابة والأسوار والحوش والشارع الرئيسي ----------
  V.build = () => {
    const sol0 = D.solids.length;
    // أرضية المدينة والحوش
    add('box', 0, .05, (Z0 + ZB) / 2 + 10, 2 * HW + 8, .25, ZB - Z0 + 30, '#e2d6bb');
    add('box', 0, .05, Z0 - 50, 250, .25, 105, '#d9cbb0');
    for (let x = -120; x < 120; x += 12) for (let z = Z0 - 100; z < Z0; z += 12) if (((x + 120) / 12 + (z - Z0 + 100) / 12) % 2 === 0) add('box', x + 6, .3, z + 6, 11.4, .03, 11.4, '#c9b98e');
    add('box', 0, .3, (Z0 + ZB) / 2, 44, .04, ZB - Z0, '#3b4148'); add('box', 0, .34, (Z0 + ZB) / 2, 1, .03, ZB - Z0, '#e7b53c');           // الشارع الرئيسي + خط ذهبي
    for (const sx of [-1, 1]) { add('box', sx * 23.5, .3, (Z0 + ZB) / 2, 3, .05, ZB - Z0, '#efe6d4'); add('box', sx * 21.8, .34, (Z0 + ZB) / 2, .4, .03, ZB - Z0, '#d6b25e'); }
    // حدائق خضراء خلف القصور
    for (const sx of [-1, 1]) add('box', sx * 150, .3, (Z0 + ZB) / 2 + 30, 96, .04, ZB - Z0 - 70, '#4f9a45');
    // الأسوار (ارتفاع 18) + شرفات + أبراج
    const WT = 4, WH = 18, merlon = (x, z, ox, oz) => add('box', x, .3 + WH, z, ox, 2.4, oz, '#efe6d4');
    const wallBox = (x0, x1, z0, z1) => { add('box', (x0 + x1) / 2, .3, (z0 + z1) / 2, x1 - x0, WH, z1 - z0, '#e8dcc0'); add('box', (x0 + x1) / 2, .3 + WH - 1.5, (z0 + z1) / 2, x1 - x0 + .6, 1.6, z1 - z0 + .6, '#d6b25e'); S3(x0, x1, z0, z1, WH + 1); };
    wallBox(-HW, -GATE, Z0 - WT / 2, Z0 + WT / 2); wallBox(GATE, HW, Z0 - WT / 2, Z0 + WT / 2);
    wallBox(-HW - WT / 2, -HW + WT / 2, Z0, ZB); wallBox(HW - WT / 2, HW + WT / 2, Z0, ZB); wallBox(-HW, HW, ZB - WT / 2, ZB + WT / 2);
    for (let x = -HW + 3; x < HW; x += 7) { if (Math.abs(x) > GATE + 1) { merlon(x, Z0, 3.4, 2.4); merlon(x, ZB, 3.4, 2.4); } }
    for (let z = Z0 + 4; z < ZB; z += 7) { merlon(-HW, z, 2.4, 3.4); merlon(HW, z, 2.4, 3.4); }
    const tower = (x, z, r, h, c = '#e8dcc0') => { add('cyl', x, .3, z, r * 2, h, r * 2, c); add('cyl', x, .3 + h * .6, z, r * 2 + 1.4, 1.4, r * 2 + 1.4, '#d6b25e'); add('cyl', x, .3 + h, z, r * 2 + 2.4, 1.6, r * 2 + 2.4, '#d6b25e'); add('cone', x, .3 + h + 1.6, z, r * 2 + 1, h * .34, r * 2 + 1, '#c0504d'); add('ball', x, .3 + h + 1.6 + h * .34, z, 2.2, 2.2, 2.2, '#f2c230'); S3(x - r, x + r, z - r, z + r, h + 2); };
    for (const [x, z] of [[-HW, Z0], [HW, Z0], [-HW, ZB], [HW, ZB]]) tower(x, z, 9, 46);
    for (let z = Z0 + 78; z < ZB - 20; z += 78) { tower(-HW, z, 5.5, 32); tower(HW, z, 5.5, 32); }
    for (const x of [-100, 100, 0]) if (x !== 0) tower(x, ZB, 5.5, 32);
    for (const sx of [-1, 1]) tower(sx * 30, Z0 - 1, 8, 40);
    // قوس البوابة الضخم
    for (const sx of [-1, 1]) { add('box', sx * 19, .3, Z0, 10, 44, 8, '#e8dcc0'); add('box', sx * 19, .3 + 30, Z0, 11, 1.6, 9, '#d6b25e'); add('box', sx * 19, .3 + 44, Z0, 11.6, 2, 9.6, '#d6b25e'); add('cone', sx * 19, .3 + 46, Z0, 8, 14, 8, '#c0504d'); S3(sx * 19 - 5, sx * 19 + 5, Z0 - 4, Z0 + 4, 46); }
    add('box', 0, .3 + 30, Z0, 2 * (GATE + 5) + 14, 12, 8, '#e8dcc0'); add('box', 0, .3 + 28.6, Z0, 2 * GATE + 6, 1.6, 8.6, '#d6b25e'); add('box', 0, .3 + 42, Z0, 2 * (GATE + 5) + 15, 1.8, 9, '#d6b25e'); S3(-GATE - 14, GATE + 14, Z0 - 4, Z0 + 4, 44, .3 + 28);
    // شاشة اسم عملاقة على القوس (الوجهين) + مصباح
    const BANNER = (txt, w, h, c1, c2) => { const cv = document.createElement('canvas'); cv.width = 2048; cv.height = Math.round(2048 * h / w); const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, cv.width, 0); gr.addColorStop(0, c1); gr.addColorStop(.5, '#101018'); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, cv.width, cv.height, cv.height * .18); g.fill();
      let fs = cv.height * .5; g.font = `900 ${fs}px Cairo, sans-serif`; { const mw = g.measureText(txt).width, lim = cv.width * .92; if (mw > lim) { fs = Math.floor(fs * lim / mw); g.font = `900 ${fs}px Cairo, sans-serif`; } } g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.lineWidth = cv.height * .09; g.strokeStyle = '#25f4ee'; g.strokeText(txt, cv.width / 2 + 5, cv.height / 2 + 5); g.strokeStyle = '#fe2c55'; g.strokeText(txt, cv.width / 2 - 5, cv.height / 2 - 3); g.fillStyle = '#fff'; g.fillText(txt, cv.width / 2, cv.height / 2);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }); };
    const bm = BANNER('🎵 مدينة مشتركي تيك توك 🎵', 60, 9, '#0b2a33', '#3a0b18'), planes = [];
    const plane = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bm); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); V.imesh.push(m); planes.push(m); };
    plane(58, 8.7, 0, .3 + 35.5, Z0 - 4.2, Math.PI); plane(58, 8.7, 0, .3 + 35.5, Z0 + 4.2, 0);
    for (const sx of [-1, 1]) { plane(70, 10.5, sx * 105, .3 + 10, Z0 - 2.2, Math.PI); plane(70, 10.5, sx * 105, .3 + 10, Z0 + 2.2, 0); }
    for (let z = Z0 + 80; z < ZB - 40; z += 100) for (const sx of [-1, 1]) { plane(70, 10.5, sx * (HW + 2.3), .3 + 10, z, sx * Math.PI / 2); plane(70, 10.5, sx * (HW - 2.3), .3 + 10, z, -sx * Math.PI / 2); }
    for (const x of [-100, 100]) { plane(70, 10.5, x, .3 + 10, ZB + 2.3, 0); plane(70, 10.5, x, .3 + 10, ZB - 2.3, Math.PI); }
    // علامة تيك توك ضخمة فوق القوس (تدور)
    V.finial = new THREE.Group(); const fm = (c, dx) => { const m = new THREE.MeshBasicMaterial({ color: c }); const stem = new THREE.Mesh(GEO.box, m), head = new THREE.Mesh(GEO.ball, m), flag = new THREE.Mesh(GEO.box, m); stem.scale.set(1.8, 16, 1.8); stem.position.set(dx, 0, 0); head.scale.set(7.5, 6, 3); head.position.set(dx - 4, -.1, 0); flag.scale.set(6.5, 3.2, 1.8); flag.position.set(dx + 3.4, 12.6, 0); V.finial.add(stem, head, flag); };
    fm('#25f4ee', -.9); fm('#fe2c55', .9); fm('#ffffff', 0); V.finial.position.set(0, .3 + 50, Z0); root.add(V.finial); V.imesh.push(V.finial); V.spin.push(V.finial);
    // الأبواب: ورقتين بمفصلات (تنفتح للخارج لما يجي التصريح)
    const leafMat = new THREE.MeshLambertMaterial({ color: '#6b4a24' }), studMat = new THREE.MeshBasicMaterial({ color: '#f2c230' });
    V.leaves = [-1, 1].map(sx => { const g = new THREE.Group(); g.position.set(sx * GATE, .3, Z0); const lf = new THREE.Mesh(GEO.box, leafMat); lf.scale.set(GATE - .2, 25, 1.6); lf.position.set(-sx * (GATE / 2), 0, 0); lf.position.x = -sx * (GATE - .2) / 2; g.add(lf);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const st = new THREE.Mesh(GEO.ball, studMat); st.scale.set(1.1, 1.1, 1.1); st.position.set(-sx * (2.2 + c * 3.6), 3 + r * 5.6, sx * 0 + .95); g.add(st); const st2 = st.clone(); st2.position.z = -.95; g.add(st2); }
      const ring = new THREE.Mesh(GEO.ball, studMat); ring.scale.set(2.4, 2.4, .6); ring.position.set(-sx * 2.6, 10, 1.1); g.add(ring); root.add(g); V.imesh.push(g); return g; });
    V.gateSol = [[-GATE, -.2, Z0 - 1, Z0 + 1, .3, 26], [.2, GATE, Z0 - 1, Z0 + 1, .3, 26]];
    // الحوش (قدّام البوابة): نافورة كبيرة + أعمدة إنارة + مقاعد + أحواض ورد + لوحة إرشاد
    const fx = 0, fz = Z0 - 52; add('cyl', fx, .3, fz, 30, 1.6, 30, '#efe6d4'); add('cyl', fx, .3, fz, 27.5, 1.9, 27.5, '#5fb7e6'); add('cyl', fx, .3, fz, 5, 9, 5, '#efe6d4'); add('cyl', fx, .3 + 9, fz, 11, 1.2, 11, '#efe6d4'); add('cyl', fx, .3 + 10.2, fz, 9, 1, 9, '#7cc8f0'); add('cyl', fx, .3 + 11, fz, 1.8, 7, 1.8, '#efe6d4'); add('ball', fx, .3 + 18, fz, 3, 3, 3, '#f2c230');
    S3(fx - 15, fx + 15, fz - 15, fz + 15, 3);
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const lx = sx * (45 + k * 18), lz = Z0 - 14; add('cyl', lx, .3, lz, .7, 8, .7, '#3a4750'); add('ball', lx, .3 + 8, lz, 2.4, 2.4, 2.4, '#fff3c4'); add('box', lx, .3, lz - 12, 7, 1.4, 2.4, '#8b5a2b'); add('box', sx * (47 + k * 18), .3, Z0 - 80, 9, 1.6, 4, '#4fae55'); for (let f = 0; f < 5; f++) add('box', sx * (43 + k * 18) + f * 2, .3 + 1.6, Z0 - 80, 1.4, 1.6, 1.4, ['#ff6b81', '#ffd34d', '#ffffff', '#ff9f43', '#c56cf0'][f]); }
    // لافتة إرشاد قدّام البوابة
    const guide = new THREE.Mesh(new THREE.PlaneGeometry(30, 7), new THREE.MeshBasicMaterial({ map: textTex('🔑 ادخل برمز بيتك • ✊ أو اطرق الباب', 1280, 300, '#1d2b36', '#ffd34d', 96), transparent: true, side: THREE.DoubleSide })); guide.position.set(0, 12, Z0 - 17); guide.rotation.y = Math.PI; root.add(guide); V.imesh.push(guide);
    for (const px of [-15.5, 15.5]) { add('cyl', px, .3, Z0 - 17, .8, 15, .8, '#3a4750'); S3(px - .5, px + .5, Z0 - 17.5, Z0 - 16.5, 15); }
    // الشارع الرئيسي: نخيل + إنارة + دوّار بمجسّم تيك توك
    for (let z = Z0 + 14; z < ZB - 90; z += 24) for (const sx of [-1, 1]) { const x = sx * 24.8; add('cyl', x, .3, z, .5, 9.5, .5, '#9a6e3f'); for (let l = 0; l < 6; l++) add('leaf', x + Math.cos(l) * 2.2, .3 + 9.7, z + Math.sin(l) * 2.2, 5, .3, 1.6, '#3f8f45', -l); add('cyl', sx * 22.6, .3, z + 12, .25, 6, .25, '#3a4750'); add('ball', sx * 22.6, .3 + 6, z + 12, 1.1, 1.1, 1.1, '#fff3c4'); }
    const rz = 470; add('cyl', 0, .3, rz, 46, 1.2, 46, '#e2d6bb'); add('cyl', 0, .3, rz, 21, 2, 21, '#efe6d4'); add('cyl', 0, .3, rz, 19, 2.3, 19, '#5fb7e6'); add('cyl', 0, .3, rz, 7, 6, 7, '#d6b25e'); S3(-11, 11, rz - 11, rz + 11, 8);
    V.mono = new THREE.Group(); const mm = (c, dx) => { const m = new THREE.MeshBasicMaterial({ color: c }); const stem = new THREE.Mesh(GEO.box, m), head = new THREE.Mesh(GEO.ball, m), flag = new THREE.Mesh(GEO.box, m); stem.scale.set(1.5, 15, 1.5); stem.position.set(dx, 0, 0); head.scale.set(7, 5.6, 2.6); head.position.set(dx - 3.8, -.1, 0); flag.scale.set(6, 3, 1.5); flag.position.set(dx + 3.2, 11.6, 0); V.mono.add(stem, head, flag); };
    mm('#25f4ee', -.8); mm('#fe2c55', .8); mm('#ffffff', 0); V.mono.position.set(0, .3 + 15, rz); root.add(V.mono); V.imesh.push(V.mono); V.spin.push(V.mono);
    // القصور
    for (let lot = 0; lot < 13; lot++) palace(lot);
    // حدود القاعة الخلفية لقصر المشرف: عمودين ذهبيين على الشارع
    // رسم كل الطبقات
    const lay = (key, geo, items, o) => { if (!items.length) return; const ms = D.lay(key, geo, items, o); V.imesh.push(...ms); };
    D.autoSol(L.box); D.autoSol(L.cyl); D.autoSol(L.cone);
    lay('vp_box', GEO.box, L.box); lay('vp_cyl', GEO.cyl, L.cyl); lay('vp_cone', GEO.cone, L.cone); lay('vp_ball', GEO.ball, L.ball); lay('vp_pyr', GEO.pyr, L.pyr);
    lay('vp_win', GEO.box, L.win, { mat: BAS() }); lay('vp_glow', GEO.box, L.glow, { mat: BAS() }); lay('vp_leaf', GEO.flat, L.leaf, { shadow: false });
    V.setHouses(V.houses);
    const P = C.plaza(); for (let i = sol0; i < D.solids.length; i++) { const b = D.solids[i]; C.addSolid([b[0] + P.x, b[1] + P.x, b[2] + P.z, b[3] + P.z, b[4], b[5]]); }
  };
  // أسماء القصور على اللوحات
  V.setHouses = list => {
    V.houses = list || []; if (V.state !== 2) return;
    for (let lot = 0; lot < 13; lot++) { const pl = V.plates[lot]; if (!pl) continue; const h = V.houses.find(x => x.lot === lot), txt = h ? (h.adm ? '👑 قصر ' + h.name : '🏰 قصر ' + h.name) : '🔒 قصر شاغر';
      if (pl.userData.txt === txt) continue; pl.userData.txt = txt; pl.material.map.dispose(); pl.material.map = textTex(txt, 1024, 190, h ? '#1d2b36' : '#3a4048', h ? '#ffd34d' : '#c9ced4', 100); pl.material.needsUpdate = true; }
  };
  V.palaces = () => V.houses.map(h => ({ ...h, door: lotDoor(h.lot) }));
  V.setPass = on => { if (V.pass === on) return; V.pass = on; V.open = on; C.resolids && C.resolids(); };
  V.reg = P => { if (V.open) return; for (const b of V.gateSol) C.addSolid([b[0] + P.x, b[1] + P.x, b[2] + P.z, b[3] + P.z, b[4], b[5]]); };

  // ---------- كل إطار: بناء عند الاقتراب، إخفاء عند البعد، وحركة الأبواب والعلامات ----------
  V.frame = (dt, t, lx, lz) => {
    const dx = Math.max(Math.abs(lx) - HW, 0), dz = Math.max(Z0 - 100 - lz, 0, lz - ZB), dist = Math.hypot(dx, dz);
    if (!V.state && dist < 720 && WK.on) { V.state = 1; setTimeout(() => { try { V.state = 2; V.build(); V.shown = true; } catch (e) { console.error(e); V.state = 3; } }, 30); }
    if (V.state !== 2) return;
    const vis = dist < 1100; if (V.shown !== vis) { V.shown = vis; V.imesh.forEach(m => m.visible = vis); }
    if (!vis) return;
    V.leaf += ((V.open ? 1 : 0) - V.leaf) * Math.min(1, dt * 2.4);
    if (V.leaves) V.leaves.forEach((g, i) => { g.rotation.y = (i === 0 ? 1 : -1) * V.leaf * 1.45; });
    for (const g of V.spin) g.rotation.y += dt * .8;
  };
  return V;
}
