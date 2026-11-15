// ================= حيّ الفعاليات: البحيرة + الحلبة + (المول في mall.js) =================
// كل الإحداثيات «محلية» نسبةً لمركز الساحة (PLAZA) — لو كبرت المدينة وتحرّكت الساحة تتحرك معها الأشياء كلها بدون إعادة بناء.
// الحلبة والبحيرة والمول تحيط بالساحة: المول غرب، البحيرة شرق، والحلبة تلفّ حولهم كلهم.
import * as THREE from '/vendor/three.module.min.js';
import { createMall } from '/mall.js?v=4';
import { createVip } from '/vipcity.js?v=2';

// ---- ثوابت (سباق: G و LAPS لازم تطابق server.js) ----
export const LAPS = 2, G = 16;
const HAS_LAKE = false;   // البحيرة انشالت: مكانها ساحة المواد وساحة البناء (worlds.js)
const LK = { x: 240, z: 0, rx: 96, rz: 84 }, WATER = -.35, BED = -3, Q0 = .72;     // البحيرة
const ISL = { x: 18, z: -14, r0: 8, r1: 12 };                                      // جزيرة بوسط البحيرة
const DOCK = { x0: 132, x1: 172, z0: -3, z1: 3, y: .55 };                          // رصيف
const PV = { x0: -335, x1: 140, z0: -112, z1: 112 };                               // أرضية الحيّ المرصوفة (بنفس ارتفاع الساحة .3)
const HX = 258, TCX = -127, HZ = 175, RR = 75, TW = 8;   // الحلبة صارت أقصر: تنتهي عند x=131 قبل حدّ عالم البناء (x=144)
export const WORLD_X0 = 144;   // بداية عالم المكعبات (محلياً شرق الساحة)                                          // الحلبة: نصف الأبعاد، نصف قطر الزاوية، نصف العرض
const S0 = 160;                                                                     // مكان خط البداية على المسار (x=-150 بالمستقيم الشمالي)
const START = { x0: -208, x1: -118, z0: -200, z1: -150 };                          // منطقة الانتظار قبل السباق (محلية)
const smooth = t => t * t * (3 - 2 * t);

export function createDistrict(C) {
  const { S, GEO, setLayer, toon, textTex, AU, LOW, MID, WK, CAR, PARKED } = C;
  const D = { meshes: [], solids: [], built: false };
  const PL = () => C.plaza();
  const root = new THREE.Group(); S.add(root);
  const tmp = new THREE.Object3D();
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); root.add(m); return m; };
  // طبقة instanced بإحداثيات محلية (تتبع الساحة)
  const lay = (key, geo, items, o = {}) => { const ms = setLayer(key, geo, items, { outline: false, shadow: false, ...o }) || [], P = PL(); ms.forEach(m => { m.position.set(P.x, 0, P.z); D.meshes.push(m); }); return ms; };
  const sol = (x0, x1, z0, z1, y0, y1) => D.solids.push([x0, x1, z0, z1, y0, y1]);
  const solBox = it => sol(it[0] - it[3] / 2, it[0] + it[3] / 2, it[2] - it[5] / 2, it[2] + it[5] / 2, it[1], it[1] + it[4]);
  const rng = (() => { let h = 12345; return () => { h = (h * 1103515245 + 12345) | 0; return ((h >>> 8) & 0xffff) / 65536; }; })();
  const rr = (a, b) => a + rng() * (b - a);
  // تصادم تلقائي لأي قطعة مرتفعة قائمة على الأرض (أعمدة/أبراج/جدران/أشجار) — ما فيه شي يتمشّى منه اللاعب
  D.autoSol = (items, minH = 2.2) => { for (const it of items) if (it[4] >= minH && it[1] < 1.5 && it[3] >= .4 && it[5] >= .4) solBox(it); };
  D.rng = rng; D.lay = lay; D.sol = sol; D.solBox = solBox; D.root = root;

  // ---------------- شبكة آمنة لرسم مضلعات بألوان ----------------
  function colored(pos, col, idx, mat, off = 0) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (idx) g.setIndex(idx); g.computeVertexNormals();
    if (off) { mat.polygonOffset = true; mat.polygonOffsetFactor = -off; mat.polygonOffsetUnits = -off; }
    const m = new THREE.Mesh(g, mat); root.add(m); return m;
  }
  const hex = c => new THREE.Color(c);

  // ================== البحيرة ==================
  // العمق: حافة (q=1) عند .3 ← تنزل بشاطئ لين لين لين لين لين لين لين لين لين لين لين إلى القاع -3 عند q=Q0
  const lakeQ = (lx, lz) => Math.hypot((lx - LK.x) / LK.rx, (lz - LK.z) / LK.rz);
  const bedAt = (lx, lz) => {
    if (!HAS_LAKE) return null;
    const q = lakeQ(lx, lz); if (q >= 1) return null;
    let h = q <= Q0 ? BED : .3 + (BED - .3) * smooth((1 - q) / (1 - Q0));
    const r = Math.hypot(lx - LK.x - ISL.x, lz - LK.z - ISL.z);
    if (r < ISL.r1) h = Math.max(h, r < ISL.r0 ? .3 : .3 + (BED - .3) * smooth((r - ISL.r0) / (ISL.r1 - ISL.r0)));
    return h;
  };
  // قريب من البحيرة؟ (لحجب الظلال/الأصوات)
  D.lakeInfo = (x, z) => { const P = PL(), b = bedAt(x - P.x, z - P.z); return b === null ? null : { bed: b, deep: b < -1.3, water: WATER }; };
  D.WATER = WATER;
  D.lakeDist = (x, z) => { if (!HAS_LAKE) return 1e6; const P = PL(); return (lakeQ(x - P.x, z - P.z) - 1) * Math.min(LK.rx, LK.rz); };
  // السيارات ما تدخل الماء
  D.carBlock = p => { if (!HAS_LAKE) { const P = PL(); if (p.x > P.x + WORLD_X0 && p.z > P.z - 200) { p.x = P.x + WORLD_X0; return true; } return false; } const P = PL(), dx = (p.x - P.x - LK.x) / LK.rx, dz = (p.z - P.z - LK.z) / LK.rz, q = Math.hypot(dx, dz); if (q >= 1.03 || q < 1e-6) return false; const s = 1.03 / q; p.x = P.x + LK.x + dx * s * LK.rx; p.z = P.z + LK.z + dz * s * LK.rz; return true; };

  const FISH = [], DUCKS = [], BUBB = [];
  let waterMat = null, fishB = null, fishT = null, duckB = null, duckH = null, bubM = null, jumper = null, turtle = null;
  function buildLake() {
    const ring = [1, .985, .965, .94, .91, .88, .85, .82, .79, .76, Q0], SEG = 72, pos = [], col = [], idx = [];
    const shade = t => { // t: 0 رمل ← 1 عميق
      const a = [[0, '#ecdcae'], [.1, '#cdb98a'], [.35, '#79bdb4'], [.7, '#3d93ad'], [1, '#2a6f93']];
      for (let i = 1; i < a.length; i++) if (t <= a[i][0]) { const k = (t - a[i - 1][0]) / (a[i][0] - a[i - 1][0]); return hex(a[i - 1][1]).lerp(hex(a[i][1]), k); } return hex(a[a.length - 1][1]);
    };
    ring.forEach((q, ri) => {
      for (let i = 0; i <= SEG; i++) {
        const a = i / SEG * Math.PI * 2, lx = LK.x + Math.cos(a) * LK.rx * q, lz = LK.z + Math.sin(a) * LK.rz * q, h = bedAt(lx, lz) ?? .3;
        pos.push(lx, h, lz); const c = shade(Math.min(1, (.3 - h) / 3.3)); col.push(c.r, c.g, c.b);
        if (ri > 0 && i < SEG) { const a0 = (ri - 1) * (SEG + 1) + i, a1 = a0 + 1, b0 = ri * (SEG + 1) + i, b1 = b0 + 1; idx.push(a0, b0, a1, a1, b0, b1); }
      }
    });
    // قاع مسطّح
    const cI = pos.length / 3; pos.push(LK.x, BED, LK.z); { const c = shade(1); col.push(c.r, c.g, c.b); }
    const last = (ring.length - 1) * (SEG + 1); for (let i = 0; i < SEG; i++) idx.push(cI, last + i, last + i + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    // الوجه لفوق (نعكس لو طلع لتحت)
    const bed = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); root.add(bed);
    // الجزيرة
    const isl = mk(new THREE.CylinderGeometry(ISL.r0, ISL.r1, .3 - BED, 28), toon('#e6d3a0'), LK.x + ISL.x, BED, LK.z + ISL.z); isl.geometry.translate(0, (.3 - BED) / 2, 0);
    isl.position.y = BED; isl.position.y = BED;
    // الماء
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#bfefff'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#ffffff'; x.lineWidth = 2.5; x.globalAlpha = .55; for (let i = 0; i < 26; i++) { const px = Math.random() * 128, py = Math.random() * 128, r = 6 + Math.random() * 12; x.beginPath(); x.arc(px, py, r, .2, 1.8); x.stroke(); x.beginPath(); x.arc(px - 128, py, r, .2, 1.8); x.stroke(); x.beginPath(); x.arc(px + 128, py, r, .2, 1.8); x.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 12); tex.colorSpace = THREE.SRGBColorSpace;
    waterMat = new THREE.MeshBasicMaterial({ map: tex, color: '#4fc3e6', transparent: true, opacity: .62, depthWrite: false });
    const wg = new THREE.CircleGeometry(1, 72); wg.rotateX(-Math.PI / 2);
    const water = mk(wg, waterMat, LK.x, WATER, LK.z); water.scale.set(LK.rx * 1.0, 1, LK.rz * 1.0); water.renderOrder = 3;
    // ===== زينة الشاطئ (طبقات instanced) =====
    const P = { box: [], cyl: [], cone: [], flat: [], leaf: [], ball: [] };
    const palm = (px, pz, h = 7) => { P.box.push([px, .3, pz, .5, h, .5, 0, '#9a6e3f']); for (let l = 0; l < 6; l++) P.leaf.push([px + Math.cos(l) * 1.5, .3 + h + .3, pz + Math.sin(l) * 1.5, 3.4, .25, .95, -l, '#3f8f45']); };
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + .15; if (Math.cos(a) < -.8) continue; palm(LK.x + Math.cos(a) * LK.rx * 1.1, LK.z + Math.sin(a) * LK.rz * 1.1, rr(6, 9)); }
    for (let k = 0; k < 7; k++) { const a = (k + .5) / 7 * Math.PI * 2 + 1.0; if (Math.cos(a) < -.6) continue; const ux = LK.x + Math.cos(a) * LK.rx * 1.06, uz = LK.z + Math.sin(a) * LK.rz * 1.06, c = ['#e94f3b', '#2d6fb8', '#f2c230', '#3aa06a', '#8a52c4'][k % 5]; // مظلة شاطئ + كرسيين
      P.cyl.push([ux, .3, uz, .25, 3.4, .25, 0, '#f2efe4']); P.cone.push([ux, 3.5, uz, 4.6, 1.1, 4.6, 0, c]); P.box.push([ux + 2.2, .3, uz, .9, .45, 2.4, 0, '#fff']); P.box.push([ux - 2.2, .3, uz, .9, .45, 2.4, 0, '#7ec4e8']); }
    for (let k = 0; k < 22; k++) { const a = rr(0, 6.28), rx = LK.x + Math.cos(a) * LK.rx * rr(1.0, 1.04), rz = LK.z + Math.sin(a) * LK.rz * rr(1.0, 1.04); P.ball.push([rx, .3, rz, rr(1.2, 2.6), rr(.9, 1.6), rr(1.2, 2.6), rng() * 3, '#8c9399']); }
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + .3, lx = LK.x + Math.cos(a) * LK.rx * 1.2, lz = LK.z + Math.sin(a) * LK.rz * 1.2; if (Math.cos(a) < -.5) continue; P.box.push([lx, .3, lz, .3, 6.5, .3, 0, '#3a4750']); P.box.push([lx, 6.8, lz, 1, .8, 1, 0, '#fff3c4']); }
    // طوافات حمراء وبيضاء تحدّد منطقة السباحة
    for (let k = 0; k < 26; k++) { const a = Math.PI * .5 + k / 25 * Math.PI * 1.1, q = .86; P.ball.push([LK.x + Math.cos(a) * LK.rx * q, WATER - .1, LK.z + Math.sin(a) * LK.rz * q, 1, 1, 1, 0, k % 2 ? '#ff3b30' : '#ffffff']); }
    // الجزيرة: نخلتين + صخرة + صندوق كنز
    palm(LK.x + ISL.x - 2, LK.z + ISL.z + 1, 8); palm(LK.x + ISL.x + 2.5, LK.z + ISL.z - 2, 6.5);
    P.ball.push([LK.x + ISL.x + 1, .3, LK.z + ISL.z + 3, 2.2, 1.4, 2.2, 0, '#8c9399']); P.box.push([LK.x + ISL.x - 3, .3, LK.z + ISL.z - 3, 1.6, 1, 1.1, .5, '#8a5a2b']); P.box.push([LK.x + ISL.x - 3, 1.3, LK.z + ISL.z - 3, 1.7, .15, 1.2, .5, '#e7b53c']);
    // أعشاب القاع وأحجار
    const SW = [];
    for (let k = 0; k < 70; k++) { const a = rr(0, 6.28), q = rr(.05, .72), lx = LK.x + Math.cos(a) * LK.rx * q, lz = LK.z + Math.sin(a) * LK.rz * q, b = bedAt(lx, lz); if (b === null || b > -2) continue; const h = rr(1.2, 2.6); SW.push([lx, b, lz, .22, h, .22, rng() * 3, ['#2f9d57', '#3fb86a', '#1f8a4c'][k % 3]]); }
    for (let k = 0; k < 24; k++) { const a = rr(0, 6.28), q = rr(.05, .7), lx = LK.x + Math.cos(a) * LK.rx * q, lz = LK.z + Math.sin(a) * LK.rz * q, b = bedAt(lx, lz); if (b === null || b > -2.2) continue; P.ball.push([lx, b, lz, rr(.8, 2), rr(.5, 1.1), rr(.8, 2), rng() * 3, ['#7d8a91', '#a39880'][k % 2]]); }
    // زنابق على السطح قرب الشاطئ
    for (let k = 0; k < 20; k++) { const a = rr(0, 6.28), q = rr(.88, .94), lx = LK.x + Math.cos(a) * LK.rx * q, lz = LK.z + Math.sin(a) * LK.rz * q; if (Math.cos(a) < -.7) continue; P.flat.push([lx, WATER + .02, lz, 1.5, .05, 1.5, rng(), '#3f9d52']); if (k % 3 === 0) P.ball.push([lx, WATER + .12, lz, .5, .3, .5, 0, '#ff8ac0']); }
    // رصيف خشبي + أعمدة + قارب
    for (let px = DOCK.x0; px < DOCK.x1; px += .75) P.box.push([px + .35, DOCK.y - .12, 0, .62, .12, DOCK.z1 * 2, 0, px % 1.5 < .75 ? '#a8794a' : '#946a3f']);
    for (let px = DOCK.x0 + 2; px <= DOCK.x1; px += 5) for (const s of [-1, 1]) { P.box.push([px, BED + .5, s * (DOCK.z1 + .1), .4, DOCK.y - BED + .9, .4, 0, '#6b4a26']); P.box.push([px, DOCK.y - .02, s * (DOCK.z1 + .1), 5, .08, .2, 0, '#8a5a2b']); }
    P.box.push([DOCK.x1 + 3.5, WATER - .2, 7, 3.6, .5, 1.5, .3, '#c2553a']); P.box.push([DOCK.x1 + 3.5, WATER + .25, 7, 3.0, .12, 1.0, .3, '#f4e9d0']);
    lay('d_lake', GEO.box, P.box); lay('d_lakeC', GEO.cyl, P.cyl); lay('d_lakeK', GEO.cone, P.cone); lay('d_lakeF', GEO.flat, P.flat); lay('d_lakeL', GEO.flat, P.leaf); lay('d_lakeB', GEO.ball, P.ball);
    lay('d_weed', GEO.box, SW);
    // لوحة
    const sg = mk(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ map: textTex('🏊 البحيرة', 768, 160, '#1d2b36', '#7fe0ff', 100), transparent: true }), LK.x - LK.rx * 1.22, 8, LK.z); sg.rotation.y = -Math.PI / 2; mk(new THREE.BoxGeometry(.5, 9, .5), toon('#3a4750'), LK.x - LK.rx * 1.22, 4.5, LK.z + 7.2); mk(new THREE.BoxGeometry(.5, 9, .5), toon('#3a4750'), LK.x - LK.rx * 1.22, 4.5, LK.z - 7.2);
    // ===== كائنات حيّة =====
    const NF = LOW ? 10 : MID ? 18 : 28, fgeo = new THREE.BoxGeometry(1.5, .5, .55), tgeo = new THREE.BoxGeometry(.5, .6, .12);
    fishB = new THREE.InstancedMesh(fgeo, toon('#ffffff'), NF); fishT = new THREE.InstancedMesh(tgeo, toon('#ffffff'), NF); fishB.frustumCulled = fishT.frustumCulled = false;
    const FC = ['#ff8a2b', '#ffd34d', '#ff5a5f', '#ffffff', '#4fa3ff', '#7be07b'];
    for (let i = 0; i < NF; i++) { const c = hex(FC[i % FC.length]); fishB.setColorAt(i, c); fishT.setColorAt(i, c); FISH.push({ a: rr(0, 6.28), q: rr(.15, .66), y: rr(-2.6, -1), sp: rr(.12, .3) * (rng() < .5 ? 1 : -1), ph: rr(0, 6), s: rr(.8, 1.5) }); }
    root.add(fishB, fishT);
    jumper = new THREE.Mesh(fgeo, toon('#ffb13b')); jumper.scale.set(1.3, 1.3, 1.3); jumper.visible = false; root.add(jumper); jumper.userData = { t: 0, dur: 1, x0: 0, z0: 0, dx: 0, dz: 0, next: 3 };
    const ND = 5; duckB = new THREE.InstancedMesh(GEO.ball, toon('#ffe066'), ND); duckH = new THREE.InstancedMesh(GEO.ball, toon('#ffd23a'), ND); duckB.frustumCulled = duckH.frustumCulled = false; root.add(duckB, duckH);
    for (let i = 0; i < ND; i++) DUCKS.push({ a: rr(0, 6.28), q: rr(.55, .85), sp: rr(.02, .05) * (i % 2 ? 1 : -1), ph: rr(0, 6) });
    const NB = 14; bubM = new THREE.InstancedMesh(GEO.ball, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .7 }), NB); bubM.frustumCulled = false; root.add(bubM);
    for (let i = 0; i < NB; i++) { const a = rr(0, 6.28), q = rr(.1, .65); BUBB.push({ x: LK.x + Math.cos(a) * LK.rx * q, z: LK.z + Math.sin(a) * LK.rz * q, p: rr(0, 1), sp: rr(.15, .3) }); }
    // سلحفاة
    turtle = new THREE.Group(); const gm = toon('#3f9d52'); const sh = new THREE.Mesh(GEO.ball, gm); sh.scale.set(2.2, 1, 2.8); turtle.add(sh); const hd = new THREE.Mesh(GEO.ball, toon('#7bc77b')); hd.scale.set(.8, .7, .9); hd.position.set(0, .1, 1.7); turtle.add(hd);
    for (const [fx, fz] of [[-1.2, .9], [1.2, .9], [-1.2, -1], [1.2, -1]]) { const f = new THREE.Mesh(GEO.ball, toon('#7bc77b')); f.scale.set(1, .25, .6); f.position.set(fx, -.1, fz); turtle.add(f); }
    root.add(turtle); turtle.userData = { a: 1 };
  }
  const lakePos = (a, q) => [LK.x + Math.cos(a) * LK.rx * q, LK.z + Math.sin(a) * LK.rz * q];
  function lakeFrame(dt, t, near) {
    if (waterMat) { waterMat.map.offset.x = (t * .012) % 1; waterMat.map.offset.y = (t * .007) % 1; }
    if (!near || !fishB) return;
    FISH.forEach((f, i) => { f.a += f.sp * dt; const [x, z] = lakePos(f.a, f.q), sg = Math.sign(f.sp), yaw = Math.atan2(-Math.cos(f.a) * LK.rz * sg, -Math.sin(f.a) * LK.rx * sg), wag = Math.sin(t * 8 + f.ph) * .45, b = bedAt(x, z), yy = Math.max(f.y, (b ?? -3) + .6) + Math.sin(t + f.ph) * .15;
      tmp.position.set(x, yy, z); tmp.rotation.set(0, yaw, 0); tmp.scale.setScalar(f.s); tmp.updateMatrix(); fishB.setMatrixAt(i, tmp.matrix);
      tmp.rotation.y = yaw + wag; tmp.translateX(-.95 * f.s); tmp.updateMatrix(); fishT.setMatrixAt(i, tmp.matrix); });
    fishB.instanceMatrix.needsUpdate = fishT.instanceMatrix.needsUpdate = true;
    DUCKS.forEach((d, i) => { d.a += d.sp * dt; const [x, z] = lakePos(d.a, d.q), y = WATER + .1 + Math.sin(t * 1.5 + d.ph) * .06, sg = Math.sign(d.sp), yaw = Math.atan2(-Math.sin(d.a) * LK.rx * sg, Math.cos(d.a) * LK.rz * sg);
      tmp.position.set(x, y, z); tmp.rotation.set(0, yaw, 0); tmp.scale.set(1.1, .8, 1.5); tmp.updateMatrix(); duckB.setMatrixAt(i, tmp.matrix);
      tmp.position.set(x, y + .6, z); tmp.translateZ(.8); tmp.scale.set(.6, .6, .6); tmp.updateMatrix(); duckH.setMatrixAt(i, tmp.matrix); });
    duckB.instanceMatrix.needsUpdate = duckH.instanceMatrix.needsUpdate = true;
    BUBB.forEach((b, i) => { b.p = (b.p + b.sp * dt) % 1; tmp.position.set(b.x + Math.sin(t * 2 + i) * .2, BED + b.p * (WATER - BED - .1) + .3, b.z); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(.25 + b.p * .15); tmp.updateMatrix(); bubM.setMatrixAt(i, tmp.matrix); });
    bubM.instanceMatrix.needsUpdate = true;
    const T = turtle.userData; T.a += dt * .05; const [tx, tz] = lakePos(T.a, .5); turtle.position.set(tx, -1.6 + Math.sin(t * .8) * .1, tz); turtle.rotation.y = Math.atan2(-Math.sin(T.a) * LK.rx, Math.cos(T.a) * LK.rz);
    // سمكة تقفز
    const J = jumper.userData; J.next -= dt;
    if (!jumper.visible && J.next <= 0) { const a = rr(0, 6.28), q = rr(.2, .62); [J.x0, J.z0] = lakePos(a, q); const b = rr(0, 6.28); J.dx = Math.cos(b) * 7; J.dz = Math.sin(b) * 7; J.t = 0; J.dur = .95; jumper.visible = true; J.next = rr(4, 9); J.splash = false; }
    if (jumper.visible) { J.t += dt; const k = J.t / J.dur; if (k >= 1) { jumper.visible = false; D.splashAt(J.x0 + J.dx, J.z0 + J.dz, .5); } else { jumper.position.set(J.x0 + J.dx * k, WATER + Math.sin(k * Math.PI) * 3, J.z0 + J.dz * k); jumper.rotation.set(0, Math.atan2(-J.dz, J.dx), Math.cos(k * Math.PI) * .9); if (k > .02 && !J.splash) { J.splash = true; D.splashAt(J.x0, J.z0, .5); } } }
  }
  // رذاذ + صوت (محلي)
  const drops = [];
  D.splashAt = (lx, lz, big = 1, world = false) => {
    const P = PL(), x = world ? lx - P.x : lx, z = world ? lz - P.z : lz, f = WK.on ? Math.hypot(P.x + x - WK.p.x, P.z + z - WK.p.z) : 999; if (f < 90) AU.splash(Math.max(.15, big * (1 - f / 90)));
    for (let i = 0; i < 10 * big; i++) { const m = new THREE.Mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: .9 })); m.scale.setScalar(.25); m.position.set(x + (Math.random() - .5), WATER, z + (Math.random() - .5)); root.add(m); drops.push({ m, v: new THREE.Vector3((Math.random() - .5) * 3, 3 + Math.random() * 3 * big, (Math.random() - .5) * 3), life: .8 }); }
  };
  function dropsFrame(dt) { for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.v.y -= 14 * dt; d.m.position.addScaledVector(d.v, dt); d.life -= dt; d.m.material.opacity = Math.max(0, d.life); if (d.life <= 0 || d.m.position.y < WATER - .1) { root.remove(d.m); d.m.material.dispose(); drops.splice(i, 1); } } }

  // ================== الحلبة ==================
  const SEG = [{ t: 's', x: -310, z: -175, dx: 1, dz: 0, len: 366 }, { t: 'a', cx: 56, cz: -100, a0: -Math.PI / 2 }, { t: 's', x: 131, z: -100, dx: 0, dz: 1, len: 200 }, { t: 'a', cx: 56, cz: 100, a0: 0 },
    { t: 's', x: 56, z: 175, dx: -1, dz: 0, len: 366 }, { t: 'a', cx: -310, cz: 100, a0: Math.PI / 2 }, { t: 's', x: -385, z: 100, dx: 0, dz: -1, len: 200 }, { t: 'a', cx: -310, cz: -100, a0: Math.PI }];
  const ARC = RR * Math.PI / 2; let TL = 0; const SEGS = SEG.map(s => { s.s0 = TL; s.L = s.t === 's' ? s.len : ARC; TL += s.L; return s; });
  D.TL = TL;
  // نقطة على المسار عند s (محلية) + الاتجاه
  function pointAt(s) {
    s = ((s % TL) + TL) % TL; const g = SEGS.find(q => s >= q.s0 && s < q.s0 + q.L) || SEGS[0], u = s - g.s0;
    if (g.t === 's') return { x: g.x + g.dx * u, z: g.z + g.dz * u, tx: g.dx, tz: g.dz };
    const a = g.a0 + u / RR; return { x: g.cx + Math.cos(a) * RR, z: g.cz + Math.sin(a) * RR, tx: -Math.sin(a), tz: Math.cos(a) };
  }
  // نقاط مسار كل 4 م (للمسقط التقريبي)
  const PTS = []; for (let s = 0; s < TL; s += 4) PTS.push(pointAt(s));
  const sOfSeg = (i, u) => SEGS[i].s0 + u;
  function proj(lx, lz) { // أقرب نقطة على المسار: s وبعد جانبي
    let bi = 0, bd = 1e12; for (let i = 0; i < PTS.length; i++) { const p = PTS[i], d = (p.x - lx) ** 2 + (p.z - lz) ** 2; if (d < bd) { bd = d; bi = i; } }
    const p = PTS[bi], u = (lx - p.x) * p.tx + (lz - p.z) * p.tz; return { s: (bi * 4 + u + TL) % TL, d: Math.sqrt(bd), side: (lx - p.x) * -p.tz + (lz - p.z) * p.tx };
  }
  const trackDist = (rx, rz) => { const qx = Math.abs(rx - TCX) - (HX - RR), qz = Math.abs(rz) - (HZ - RR); return Math.abs(Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - RR); };
  // سلالم القفز (على المستقيمات فقط)
  const RAMPS = [], PADS = [];
  const addRamp = (i, u) => { const s = sOfSeg(i, u), p = pointAt(s); RAMPS.push({ x: p.x, z: p.z, tx: p.tx, tz: p.tz, len: 13, w: 13, h: 3 }); };
  const addPad = (i, u) => { const p = pointAt(sOfSeg(i, u)); PADS.push({ x: p.x, z: p.z, tx: p.tx, tz: p.tz, len: 12, w: 9 }); };
  addRamp(0, 250); addRamp(2, 120); addRamp(4, 240); addRamp(6, 120);
  addPad(0, 130); addPad(2, 60); addPad(4, 100); addPad(6, 60); addPad(4, 330);
  const inRect = (o, lx, lz, len, w) => { const dx = lx - o.x, dz = lz - o.z, u = dx * o.tx + dz * o.tz, v = dx * -o.tz + dz * o.tx; return Math.abs(v) <= w / 2 && u >= 0 && u <= len ? u : -1; };
  const rampH = (lx, lz) => { for (const r of RAMPS) { const u = inRect(r, lx, lz, r.len, r.w); if (u >= 0) return .095 + r.h * u / r.len; } return 0; };
  const GATE_S = k => (S0 + k * TL / G) % TL;
  D.gates = G;
  function buildTrack() {
    const N = PTS.length, nrm = i => { const p = PTS[i]; return [-p.tz, p.tx]; };
    const strip = (o0, o1, y, colFn, mat, off) => {
      const pos = [], col = [], idx = []; let v = 0;
      for (let i = 0; i < N; i++) { const raw = colFn(i); if (raw === null) continue; const p = PTS[i], q = PTS[(i + 1) % N], [nx, nz] = nrm(i), [mx, mz] = nrm((i + 1) % N), c = hex(raw);
        pos.push(p.x + nx * o0, y, p.z + nz * o0, p.x + nx * o1, y, p.z + nz * o1, q.x + mx * o0, y, q.z + mz * o0, q.x + mx * o1, y, q.z + mz * o1);
        for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b); idx.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); v += 4; }
      const m = colored(pos, col, idx, mat, off); m.material.side = THREE.DoubleSide; return m;
    };
    const B = () => new THREE.MeshBasicMaterial({ vertexColors: true });
    strip(-17, 17, .075, () => '#d7c08a', B(), 1); strip(-TW, TW, .095, i => i % 2 ? '#3b3f46' : '#393d44', B(), 2);
    strip(TW, TW + 1.6, .1, i => (i >> 1) % 2 ? '#d6382f' : '#f4f1ea', B(), 3); strip(-TW - 1.6, -TW, .1, i => (i >> 1) % 2 ? '#d6382f' : '#f4f1ea', B(), 3);
    strip(-.18, .18, .105, i => i % 3 === 2 ? null : '#f2efe4', B(), 4);
    // خطوط الحواف
    strip(TW - 1, TW - .6, .105, () => '#f2efe4', B(), 4); strip(-TW + .6, -TW + 1, .105, () => '#f2efe4', B(), 4);
    // خط البداية (مربعات) + مواقف الانطلاق
    const sp = pointAt(S0), F = [], Bx = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) F.push([sp.x + r - .5 + 0, .11, sp.z - TW + c + .5 + 0, 1, .02, 1, 0, (r + c) % 2 ? '#111' : '#fff']);
    for (let i = 0; i < 8; i++) { const g = D.gridSlot(i, true); F.push([g.x, .108, g.z, 5.6, .012, 3.4, 0, '#4a4f57']); F.push([g.x - 2.9, .112, g.z, .3, .012, 3.6, 0, '#fff']); F.push([g.x, .112, g.z - 1.8, 5.8, .012, .25, 0, '#fff']); F.push([g.x, .112, g.z + 1.8, 5.8, .012, .25, 0, '#fff']); }
    // منطقة الانتظار: إطار أخضر
    const zx = (START.x0 + START.x1) / 2, zz = (START.z0 + START.z1) / 2, zw = START.x1 - START.x0, zd = START.z1 - START.z0;
    for (const [x, z, w, d] of [[zx, START.z0, zw, .6], [zx, START.z1, zw, .6], [START.x0, zz, .6, zd], [START.x1, zz, .6, zd]]) F.push([x, .1, z, w, .02, d, 0, '#2fe08a']);
    // مسرّعات: قاعدة برتقالية + أسهم
    for (const p of PADS) { const yaw = Math.atan2(p.tx, p.tz), cx = p.x + p.tx * p.len / 2, cz = p.z + p.tz * p.len / 2; F.push([cx, .112, cz, p.w, .012, p.len, yaw, '#ff7a1a']);
      for (let k = -1; k <= 1; k++) for (const sg of [-1, 1]) { const ax = cx + p.tx * k * 3.2 + (-p.tz) * sg * 1.6, az = cz + p.tz * k * 3.2 + p.tx * sg * 1.6; F.push([ax, .118, az, 4, .012, .8, yaw + sg * .8, '#fff2a8']); } }
    lay('d_trF', GEO.flat, F);
    // الحواجز: صفوف إطارات على خارج الزوايا + أعمدة إنارة وأعلام
    const T = [], Pl = [], Fl = [];
    PTS.forEach((p, i) => { const [nx, nz] = nrm(i); const onArc = (p.x < -310 || p.x > 56) && Math.abs(p.z) > 100; if (onArc && i % 2 === 0) { const sgn = (p.x * nx + p.z * nz) > 0 ? 1 : -1; T.push([p.x + nx * sgn * 12, .08, p.z + nz * sgn * 12, 1.6, .9, 1.6, 0, i % 4 ? '#222' : '#d6382f']); T.push([p.x + nx * sgn * 12, .98, p.z + nz * sgn * 12, 1.6, .9, 1.6, 0, '#f4f1ea']); }
      if (i % 14 === 0) { const sgn = (i / 14) % 2 ? 1 : -1; Pl.push([p.x + nx * sgn * 14, .08, p.z + nz * sgn * 14, .3, 7, .3, 0, '#3a4750']); Pl.push([p.x + nx * sgn * 14, 7, p.z + nz * sgn * 14, 1.2, .5, 1.2, 0, '#fff3c4']); Fl.push([p.x + nx * sgn * 14, 8.2, p.z + nz * sgn * 14, 2.4, 1.1, .08, 0, ['#e94f3b', '#2d6fb8', '#f2c230', '#3aa06a'][(i / 14 | 0) % 4]]); } });
    lay('d_trT', GEO.box, T); lay('d_trP', GEO.box, Pl); lay('d_trFl', GEO.flat, Fl);
    // أقواس نقاط التفتيش (غير البداية)
    const Ar = []; for (let k = 1; k < G; k++) { const p = pointAt(GATE_S(k)), [nx, nz] = [-p.tz, p.tx]; for (const sg of [-1, 1]) Ar.push([p.x + nx * sg * 12, .08, p.z + nz * sg * 12, .5, 6.5, .5, 0, '#19c6d9']); const yaw = Math.atan2(p.tx, p.tz); Ar.push([p.x, 6.2, p.z, .45, .45, 24, yaw + Math.PI / 2, '#19c6d9']); }
    lay('d_trA', GEO.box, Ar); D.autoSol(Ar);
    // عقبات: مخاريط متعرجة + حواجز خرسانية + براميل (على المستقيمات فقط ← صناديق محاذية للمحاور فتصير صلبة)
    const O = [], Cn = [];
    const slalom = (i, u0, n) => { for (let k = 0; k < n; k++) { const p = pointAt(sOfSeg(i, u0 + k * 13)), lat = (k % 2 ? 1 : -1) * 3.4; Cn.push([p.x - p.tz * lat, .1, p.z + p.tx * lat, 1, 1.5, 1, 0, '#ff7a1a']); Cn.push([p.x - p.tz * lat, .9, p.z + p.tx * lat, .75, .35, .75, 0, '#ffffff']); } };
    slalom(0, 540, 5); slalom(2, 90, 3); slalom(4, 220, 5); slalom(6, 160, 3);
    const block = (i, u, lat) => { const p = pointAt(sOfSeg(i, u)), ax = Math.abs(p.tx) > .5; const x = p.x - p.tz * lat, z = p.z + p.tx * lat; O.push([x, .1, z, ax ? 7 : 3.2, 1.3, ax ? 3.2 : 7, 0, '#b8bcc2']); O.push([x, 1.4, z, ax ? 7 : 3.2, .3, ax ? 3.2 : 7, 0, '#d6382f']); };
    block(4, 330, -4.2); block(4, 355, 4.2); block(4, 380, -4.2); block(0, 100, 5); block(0, 125, -5); block(6, 40, 4.5); block(2, 150, -4.5);
    for (const [i, u] of [[2, 20], [6, 90]]) for (let k = 0; k < 4; k++) { const p = pointAt(sOfSeg(i, u + k * 1.6)); Cn.push([p.x - p.tz * (k % 2 ? 5.5 : -5.5), .1, p.z + p.tx * (k % 2 ? 5.5 : -5.5), 1.4, 1.6, 1.4, 0, '#3f6fc2']); }
    lay('d_trO', GEO.box, O); O.forEach(solBox); lay('d_trC', GEO.box, Cn); Cn.forEach(it => { if (it[4] >= 1.4) solBox(it); });
    // سلالم القفز: مجسّم إسفين لكل واحد
    const mat = toon('#f2c230');
    for (const r of RAMPS) { const w = r.w / 2, L = r.len, h = r.h, y0 = .095;
      const v = [-w, y0, 0, w, y0, 0, -w, y0 + h, L, w, y0 + h, L, -w, y0, L, w, y0, L], c = hex('#f2c230'), cs = hex('#2a2a2a');
      const ix = [0, 1, 3, 0, 3, 2, 0, 2, 4, 1, 5, 3, 2, 3, 5, 2, 5, 4]; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(ix); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.position.set(r.x, 0, r.z); m.rotation.y = Math.atan2(r.tx, r.tz); root.add(m);
      // خطوط سوداء على السطح
      for (let k = 1; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(r.w - .6, .06, .8), toon('#2a2a2a')); const u = L * (k / 4); f.position.set(0, y0 + h * k / 4 + .12, u); f.rotation.x = -Math.atan2(h, L); m.add(f); } }
    // بوابة البداية
    const sg = pointAt(S0), yaw = Math.atan2(sg.tx, sg.tz), lat = TW + 3.4;
    const Gt = []; for (const s of [-1, 1]) Gt.push([sg.x, .08, sg.z + s * lat, 1.7, 10, 1.7, 0, '#2b2f36']); Gt.push([sg.x, 9.5, sg.z, 1.2, 1.4, lat * 2 + 1.7, 0, '#2b2f36']);
    for (let c = 0; c < 22; c++) Gt.push([sg.x - .62, 9.5, sg.z - lat + c * (lat * 2 / 21), .06, 1.4, lat * 2 / 22, 0, c % 2 ? '#fff' : '#111']);
    lay('d_trG', GEO.box, Gt); solBox(Gt[0]); solBox(Gt[1]);
    const ban = mk(new THREE.PlaneGeometry(22, 3.4), new THREE.MeshBasicMaterial({ map: textTex('🏁 خط البداية والنهاية', 1024, 160, '#c2261c', '#ffffff', 96), side: THREE.DoubleSide }), sg.x - .7, 12.3, sg.z); ban.rotation.y = -Math.PI / 2;
    // مدرّج المشاهدين (جنوب خط البداية)
    const St = [], gx = sg.x, gz0 = sg.z + TW + 17, W = 56;
    for (let k = 0; k < 6; k++) { const it = [gx, .08, gz0 + k * 2.6 + 1.3, W, .9 * (k + 1), 2.6, 0, k % 2 ? '#c9ced4' : '#aeb5bd']; St.push(it); solBox(it); St.push([gx, .9 * (k + 1) + .08, gz0 + k * 2.6 + 1.3, W - .4, .1, 2.2, 0, ['#e94f3b', '#2d6fb8', '#f2c230'][k % 3]]); }
    for (const s of [-1, 1]) St.push([gx + s * (W / 2 - .4), .08, gz0 + 17, .6, 9.5, .6, 0, '#5b6670']);
    St.push([gx, 9.4, gz0 + 8.5, W + 1.6, .5, 19, 0, '#d6382f']); St.push([gx, 9.9, gz0 + 8.5, W + 1.6, .12, 19.2, 0, '#fff']);
    lay('d_trS', GEO.box, St); D.autoSol(St.filter(it => it[1] < 1));
    // لوحات إعلانية على الجانب الخارجي من المستقيمات
    // لوحة إرشادية «🏁 الحلبة» عند أطراف المنطقة
    D.signs = { start: mk(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0) };
    // مشجعين على المدرّج
    const ppl = []; for (let k = 0; k < (LOW ? 10 : 24); k++) { const row = rng() * 6 | 0; ppl.push({ x: gx + rr(-W / 2 + 2, W / 2 - 2), y: .9 * (row + 1) + .08 + .1, z: gz0 + row * 2.6 + 1.3, ry: Math.PI, ch: (rng() * 10) | 0 }); }
    C.peopleLayer('d_fans', ppl, root);
  }
  // مكان السيارة بالانطلاق (محلي)
  D.gridSlot = (i, local = false) => { const k = i >> 1, lane = i & 1 ? 3.6 : -3.6, p = pointAt(S0), x = p.x - 8 - k * 9, z = p.z + lane; const P = PL(); return { x: local ? x : P.x + x, z: local ? z : P.z + z, yaw: Math.PI / 2 }; };

  // ================== الأرضية والثقوب (الأرض والإسفلت لازم يكون فيها فتحة للبحيرة) ==================
  let gKey = '', pavingMesh = null, asphOut = null, groundB = null, asphB = null;
  function holeGeo(x0, x1, z0, z1, hx, hz, rx, rz, y, seg = 72) { // مستطيل بعالم (x,z) وفيه فتحة إهليلجية
    const sh = new THREE.Shape(); sh.moveTo(x0, -z0); sh.lineTo(x1, -z0); sh.lineTo(x1, -z1); sh.lineTo(x0, -z1); sh.closePath();
    if (rx > 0) { const h = new THREE.Path(); for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2, px = hx + Math.cos(a) * rx, pz = hz + Math.sin(a) * rz; i ? h.lineTo(px, -pz) : h.moveTo(px, -pz); } sh.holes.push(h); }
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
  }
  // يتبع الساحة: يحدّث الأرض/الإسفلت ومكان كل المجسمات
  D.place = (ground, extO) => {
    const P = PL(), key = P.x + ',' + P.z + ',' + extO; root.position.set(P.x, 0, P.z); D.meshes.forEach(m => m.position.set(P.x, 0, P.z));
    if (key === gKey) return; gKey = key;
    const hx = P.x + LK.x, hz = P.z + LK.z, rx = HAS_LAKE ? LK.rx * 1.04 : 0, rz = HAS_LAKE ? LK.rz * 1.04 : 0;
    ground.geometry.dispose(); ground.geometry = holeGeo(-4000, P.x + WORLD_X0, -4000, 4000, hx, hz, rx, rz, 0); ground.rotation.set(0, 0, 0); ground.position.y = -.06;   // الأرض تنتهي عند حدّ عالم البناء
    if (!groundB) { groundB = new THREE.Mesh(new THREE.BufferGeometry(), ground.material); groundB.receiveShadow = true; S.add(groundB); }
    groundB.geometry.dispose(); groundB.geometry = holeGeo(P.x + WORLD_X0, 4000, -4000, P.z - 200, hx, hz, 0, 0, 0); groundB.rotation.set(0, 0, 0); groundB.position.y = -.06;   // أرض المدينة شمال عالم البناء
    if (!asphOut) { asphOut = new THREE.Mesh(new THREE.BufferGeometry(), toon('#4a4f55')); asphOut.receiveShadow = true; S.add(asphOut); }
    asphOut.geometry.dispose(); asphOut.geometry = holeGeo(-extO / 2, Math.min(extO / 2, P.x + WORLD_X0), -extO / 2, extO / 2, hx, hz, rx, rz, .04);   // الإسفلت ما يغطي عالم البناء
    if (!asphB) { asphB = new THREE.Mesh(new THREE.BufferGeometry(), asphOut.material); asphB.receiveShadow = true; S.add(asphB); }
    asphB.geometry.dispose(); asphB.geometry = extO / 2 > P.x + WORLD_X0 ? holeGeo(P.x + WORLD_X0, extO / 2, -extO / 2, P.z - 200, hx, hz, 0, 0, .04) : new THREE.BufferGeometry();
    if (!pavingMesh) { pavingMesh = new THREE.Mesh(new THREE.BufferGeometry(), toon('#eadfc6')); pavingMesh.receiveShadow = true; D.meshes.push(pavingMesh); S.add(pavingMesh); }
    pavingMesh.geometry.dispose(); pavingMesh.geometry = holeGeo(PV.x0, PV.x1, PV.z0, PV.z1, LK.x, LK.z, HAS_LAKE ? LK.rx : 0, LK.rz, .3, 72); pavingMesh.position.set(P.x, 0, P.z);
  };
  // الحيّ ما فيه ضواحي: الكتل اللي تتقاطع معه
  D.inBlock = (bx, bz) => { const P = PL(); const st = C.STEP || 44, dz = bz * st - P.z, dx = bx * st - P.x; return (Math.abs(dx) <= 400 && dz >= -200 && dz <= 760) || (dx >= WORLD_X0 - st / 2 && dz >= -200 - st / 2); };   // + كل منطقة عالم البناء   // 760 = تشمل مدينة مشتركي تيك توك خلف الساحة
  D.extent = () => { const P = PL(); return P.z + 215; };

  // ================== ارتفاع الأرض بالحيّ (null = مو بالحيّ) ==================
  D.ground = (x, z, y = 0) => {
    if (!D.built) return null; const P = PL(), lx = x - P.x, lz = z - P.z; if (lx < -435 || lx > 435 || lz < -215 || lz > 215) return null;
    const mg = D.mall.ground(lx, lz, y); if (mg !== null) return mg;
    const vg = D.vip.ground(lx, lz, y); if (vg !== null) return vg;
    const b = bedAt(lx, lz);
    if (b !== null) { if (lx >= DOCK.x0 && lx <= DOCK.x1 && lz >= DOCK.z0 && lz <= DOCK.z1 && y > -.4) return DOCK.y; return b; }
    if (lx >= PV.x0 && lx <= PV.x1 && lz >= PV.z0 && lz <= PV.z1) return .3;
    const d = trackDist(lx, lz); if (d > 17) return null;
    return d <= TW + 1.6 ? .095 + rampH(lx, lz) : .075;
  };
  // سطح تحت السيارة: مسرّع / رمل (بطيء)
  D.carSurf = (x, z) => { const P = PL(), lx = x - P.x, lz = z - P.z; if (lx < -400 || lx > 400 || lz < -190 || lz > 190) return 0;
    for (const p of PADS) if (inRect(p, lx, lz, p.len, p.w) >= 0) return 2;
    const d = trackDist(lx, lz); return d > TW + 1.6 && d <= 17 ? 1 : 0; };

  // ================== السباق (واجهة + منطق العميل) ==================
  const RC = { st: 'idle', n: 0, left: 0, in: false, inT: 0, hb: 0, racing: false, lock: false, cnt: 0, next: 1, prev: -1, rank: 0, of: 0, t0: 0, slot: -1, big: '', bigT: 0, msg: '', msgT: 0, joined: false };
  D.race = RC;
  D.raceLock = () => RC.lock; D.racing = () => RC.racing;
  const el = (id, css) => { const e = document.createElement('div'); e.id = id; e.style.cssText = css; document.body.appendChild(e); return e; };
  const hud = el('raceHud', 'position:fixed;top:calc(var(--t) + 52px);left:50%;transform:translateX(-50%);color:#fff;font-weight:900;text-align:center;pointer-events:none;display:none;text-shadow:0 2px 8px rgba(0,0,0,.6);z-index:4;font-size:18px;background:rgba(12,22,34,.55);padding:6px 16px;border-radius:16px;white-space:nowrap');
  const big = el('raceBig', 'position:fixed;top:30%;left:0;right:0;text-align:center;color:#fff;font-weight:900;font-size:min(34vw,170px);pointer-events:none;display:none;text-shadow:0 6px 24px rgba(0,0,0,.65);z-index:4');
  const swimHud = el('swimHud', 'position:fixed;top:calc(var(--t) + 84px);left:50%;transform:translateX(-50%);color:#fff;font-weight:900;font-size:20px;padding:8px 22px;border-radius:18px;background:rgba(12,60,100,.72);display:none;pointer-events:none;z-index:4;text-align:center');
  const zoneHud = el('zoneHud', 'position:fixed;bottom:150px;left:50%;transform:translateX(-50%);color:#fff;font-weight:800;font-size:16px;padding:6px 16px;border-radius:16px;background:rgba(12,22,34,.7);display:none;pointer-events:none;z-index:4;text-align:center;max-width:90vw');
  D.swimHud = sec => { if (sec === null) { swimHud.style.display = 'none'; swimHud._s = null; return; } swimHud.style.display = 'block'; if (swimHud._s === Math.ceil(sec)) return; swimHud._s = Math.ceil(sec); swimHud.style.background = sec <= 10 ? 'rgba(180,30,30,.8)' : 'rgba(12,60,100,.72)'; swimHud.textContent = `🏊 تسبح • 🫧 باقي لك ${Math.ceil(sec)} ثانية ${sec <= 10 ? '— اطلع من الماء!' : ''}`; };
  D.zoneHud = t => { zoneHud.style.display = t ? 'block' : 'none'; if (t) zoneHud.textContent = t; };
  const fmt = ms => { const s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s % 60).toFixed(1).padStart(4, '0'); };
  const flash = (t, ms = 1200, sm) => { big.style.fontSize = sm ? 'min(13vw,60px)' : 'min(34vw,170px)'; big.style.top = sm ? '18%' : '30%'; big.textContent = t; big.style.display = 'block'; RC.bigT = performance.now() + ms; };
  const note = (t, ms = 4000) => { RC.msg = t; RC.msgT = performance.now() + ms; };
  // يوديك مكان الانطلاق
  D.startSpot = () => { const P = PL(); return { x: P.x + (START.x0 + START.x1) / 2, z: P.z + START.z0 + 18 }; };
  D.lakeSpot = () => { const P = PL(); return { x: P.x + LK.x - LK.rx * 1.08, z: P.z + 14 }; };
  D.mallDoor = () => { const P = PL(), q = D.mall.door(); return { x: P.x + q.x, z: P.z + q.z }; };
  function seat(slot) { // يركّبك بالسيارة بمكانك بالانطلاق (مقفولة لين يخلص العدّ)
    const g = D.gridSlot(slot); let c = CAR.on ? CAR.car : PARKED[slot % PARKED.length]; if (!c) return;
    C.stopSwim && C.stopSwim();
    c.x = g.x; c.z = g.z; c.yaw = g.yaw; c.y = .1; c.vy = 0; c.g.position.set(c.x, c.y, c.z); c.g.rotation.set(0, c.yaw, 0);
    if (!CAR.on) C.enterCar(c); else { WK.p.set(c.x, 0, c.z); WK.yaw = c.yaw; WK.camYaw = c.yaw + Math.PI; }
    CAR.speed = 0; RC.slot = slot;
  }
  D.raceReset = () => { RC.st = 'idle'; RC.racing = false; RC.lock = false; RC.joined = false; RC.slot = -1; RC.n = 0; RC.inT = 0; };   // بعد إعادة اتصال: نمسح أي حالة سباق قديمة (كانت تعلّق السيارة)
  D.raceLeave = () => { C.netSend({ t: 'rl' }); const was = RC.racing; D.raceReset(); return was; };
  D.raceNet = m => {
    const me = C.myId();
    if (m.t === 'race') {
      const was = RC.st; RC.st = m.s === 'go' ? 'run' : m.s; RC.n = m.n || 0; RC.left = m.left || 0;
      if (m.s === 'cd') {
        const mine = (m.slots || []).find(([id]) => id === me);
        if (mine && was !== 'cd') { RC.racing = true; RC.lock = true; RC.cnt = 0; RC.next = 1; RC.prev = -1; RC.rank = 1; RC.of = m.slots.length; seat(mine[1]); }
        if (RC.racing) { flash(String(m.n), 900); AU.beep(m.n); }
      } else if (m.s === 'go') {
        if (RC.racing) { RC.lock = false; RC.t0 = performance.now(); RC.prev = -1; flash('انطلق! 🏁', 1100); AU.beep(0); }
      } else if (m.s === 'idle') {
        if (RC.racing) { RC.racing = false; RC.lock = false; if (m.res && m.res.length) note('🏁 انتهى السباق: ' + m.res.slice(0, 3).map(([n, t], i) => ['🥇', '🥈', '🥉'][i] + ' ' + n + (t ? ' ' + fmt(t) : '')).join('  '), 9000); }
        RC.slot = -1;
      }
    } else if (m.t === 'rk') { RC.rank = m.p; RC.of = m.of; }
    else if (m.t === 'rfin') { if (m.id === me) { RC.racing = false; AU.fanfare(); flash(['🥇', '🥈', '🥉'][m.pos - 1] || '🏁', 1500, 1); note(`🏆 المركز ${m.pos} • ${fmt(m.time)}`, 5000); C.toast(`🏆 خلّصت السباق بالمركز ${m.pos}! ⏱ ${fmt(m.time)}`); } else note(`🏁 ${m.name} وصل المركز ${m.pos}`, 4000); }
    else if (m.t === 'rlap') { if (m.id === me) { AU.lap(); flash(`لفة ${m.lap}/${LAPS}`, 900); } }
  };
  // كل إطار: دخول منطقة الانتظار + قطع نقاط التفتيش + الواجهة
  function raceFrame(dt, t) {
    const P = PL(), now = performance.now(); if (!WK.on || WK.intro) { hud.style.display = 'none'; zoneHud.style.display = 'none'; return; }
    const lx = WK.p.x - P.x, lz = WK.p.z - P.z, inZ = lx > START.x0 && lx < START.x1 && lz > START.z0 && lz < START.z1;
    if (big.style.display === 'block' && now > RC.bigT) big.style.display = 'none';
    if (inZ && (RC.st === 'idle' || RC.st === 'lobby') && !RC.racing) { RC.inT += dt; if (RC.inT > 1.1 && now - RC.hb > 3000) { RC.hb = now; C.netSend({ t: 'rj' }); RC.joined = true; } }
    else { if (RC.joined && !RC.racing && RC.st !== 'cd' && RC.st !== 'run') { C.netSend({ t: 'rl' }); RC.joined = false; } if (!inZ) RC.inT = 0; }
    if (RC.st === 'idle' || !RC.racing) RC.lock = RC.lock && RC.racing;
    if (RC.lock) { RC.lockT = (RC.lockT || 0) + dt; if (RC.lockT > 8) { RC.lock = false; RC.racing = false; RC.lockT = 0; } } else RC.lockT = 0;   // أمان: القفل ما يطوّل أكثر من 8 ثواني (العدّ 3 ثواني)
    // عدّاد/قطع النقاط
    if (RC.racing && !RC.lock && CAR.on) {
      const pr = proj(lx, lz), s = pr.s, sk = GATE_S(RC.next % G), df = (((s - sk + TL / 2) % TL) + TL) % TL - TL / 2;
      if (Math.abs(df) >= 60) RC.prev = NaN;
      else { if (RC.prev < 0 && df >= 0 && pr.d < TW + 9) { const k = RC.next % G; C.netSend({ t: 'rg', g: k }); RC.cnt++; RC.next = k + 1; if (k) AU.gate(); }
        RC.prev = df; }
    }
    // واجهة
    let h = '';
    if (RC.racing && RC.st === 'run') { const lap = Math.min(LAPS, Math.floor(RC.cnt / G) + 1); h = `🏁 لفة ${lap}/${LAPS} • المركز ${RC.rank}/${RC.of} • ⏱ ${fmt(now - RC.t0)}`; }
    else if (RC.st === 'cd' && RC.racing) h = '🏁 استعد…';
    else if (now < RC.msgT) h = RC.msg;
    if (hud._t !== h) { hud._t = h; hud.textContent = h; hud.style.display = h ? 'block' : 'none'; }
    let z = '';
    if (inZ && !RC.racing && RC.st === 'run') z = '🏁 فيه سباق جارٍ الحين — يخلص خلال لحظات وتقدر تنضم للي بعده';
    if (inZ && !RC.racing && (RC.st === 'idle' || RC.st === 'lobby')) z = RC.st === 'lobby' && RC.n >= 2 ? `🏁 ${RC.n} لاعبين جاهزين — السباق يبدأ بعد ${Math.ceil(RC.left)} ثانية` : RC.st === 'lobby' ? `🏁 سباق ضد الوقت يبدأ بعد ${Math.ceil(RC.left)} ثانية — لو جا لاعب ثاني تتسابقون` : '🏁 وقفت بمنطقة البداية — استنّى شوي ويبدأ السباق (لحالك ضد الوقت أو مع أصحابك)';
    if (zoneHud._t !== z) { zoneHud._t = z; zoneHud.textContent = z; zoneHud.style.display = z ? 'block' : 'none'; }
  }

  // ================== الصوت المحيط + إطار التحديث ==================
  let chT = 0, lastNear = false;
  D.frame = (dt, t) => {
    if (!D.built) return; const P = PL(), f = WK.on ? WK.p : C.focus(), lx = f.x - P.x, lz = f.z - P.z;
    const lakeNear = HAS_LAKE && Math.hypot(lx - LK.x, lz - LK.z) < 260;
    if (HAS_LAKE) lakeFrame(dt, t, lakeNear); dropsFrame(dt);
    D.mall.frame(dt, t, lx, lz); D.vip.frame(dt, t, lx, lz);
    raceFrame(dt, t);
    // أصوات المكان
    const fd = Math.hypot(f.x - P.x, f.z - P.z), fountain = Math.max(0, 1 - fd / 70), lk = Math.max(0, 1 - Math.max(0, D.lakeDist(f.x, f.z)) / 55);
    const out = WK.on ? Math.max(0, 1 - D.mall.inside * 1.6) : 1;   // داخل المول: ما فيه نافورة/بحيرة/رياح — موسيقى المول بس
    AU.ambient({ fountain: WK.on ? fountain * out : 0, lake: WK.on ? lk * out : 0, wind: WK.on ? .5 * out : .2, mall: WK.on ? D.mall.inside : 0 });
    chT -= dt; if (chT <= 0) { chT = 3 + Math.random() * 6; if (WK.on && D.mall.inside < .3 && fd < 400) AU.birdy(); }
  };
  D.reg = () => { const P = PL(); for (const b of D.solids) C.addSolid([b[0] + P.x, b[1] + P.x, b[2] + P.z, b[3] + P.z, b[4], b[5]]); D.mall.reg(P); D.vip.reg(P); };
  D.build = () => { if (D.built) return; D.built = true; D.mall = createMall(C, D); D.vip = createVip(C, D); if (HAS_LAKE) buildLake(); buildTrack(); D.mall.buildShell(); };
  return D;
}
