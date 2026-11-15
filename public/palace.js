// ================= داخل القصر: 3 أدوار + درجين + صالة كبرى + مسبح داخلي + غرف نوم + علامة مميزة =================
// يُبنى عند الدخول فقط بإحداثيات بعيدة، وينحذف بالخروج (نفس نظام داخل البيوت).
import * as THREE from '/vendor/three.module.min.js';

export const PAL = { HW: 50, HD: 36, LV: [.3, 11.3, 22.3], ROOF: 33.3 };
const { HW, HD, LV, ROOF } = PAL, CELL = 4;
const ATR = { x0: -18, x1: 18, z0: -14, z1: 14 };                                   // فتحة وسط الصالة (طول 3 أدوار)
const ST = [{ x0: -47, x1: -39, z0: -26, z1: 26, dir: -1, from: 0 }, { x0: 39, x1: 47, z0: -26, z1: 26, dir: 1, from: 1 }];   // درجين: dir=-1 يطلع باتجاه -z، +1 باتجاه +z
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const covered = (l, x, z) => { if (inR(ATR, x, z)) return false; for (const s of ST) if (s.from + 1 === l && inR(s, x, z)) return false; return true; };

export function createPalaceIn({ GEO, tm, textTex }) {
  return function build(h, ox, oz) {
    const g = new THREE.Group(); g.position.set(ox, 0, oz); const boxes = [];
    const add = (x, y, z, sx, sy, sz, c, solid, ry = 0) => { const m = new THREE.Mesh(GEO.box, tm(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (ry) m.rotation.y = ry; g.add(m); if (solid) boxes.push([ox + x - sx / 2, ox + x + sx / 2, oz + z - sz / 2, oz + z + sz / 2, y, y + sy]); return m; };
    const cyl = (x, y, z, r, hgt, c, solid) => { const m = new THREE.Mesh(GEO.cyl, tm(c)); m.position.set(x, y, z); m.scale.set(r * 2, hgt, r * 2); g.add(m); if (solid) boxes.push([ox + x - r, ox + x + r, oz + z - r, oz + z + r, y, y + hgt]); return m; };
    const ball = (x, y, z, r, c) => { const m = new THREE.Mesh(GEO.ball, tm(c)); m.position.set(x, y, z); m.scale.set(r * 2, r * 2, r * 2); g.add(m); return m; };
    const GOLD = '#d6b25e', CREAM = '#f1e8d4', MARBLE = '#e9e4d6';
    // ---- الأرضية والجدران والسقف ----
    add(0, 0, 0, 2 * HW + 1.2, .3, 2 * HD + 1.2, MARBLE);
    for (let x = -HW + 6; x < HW; x += 12) for (let z = -HD + 6; z < HD; z += 12) if (((x + HW) / 12 + (z + HD) / 12) % 2 === 0) add(x + 6 - 6, .3, z + 6 - 6, 11.6, .03, 11.6, '#c9bd9f');
    const WH = ROOF - .3;
    add(0, .3, -HD, 2 * HW, WH, .8, CREAM); add(-HW, .3, 0, .8, WH, 2 * HD, CREAM); add(HW, .3, 0, .8, WH, 2 * HD, CREAM);
    const gw = 9; for (const sg of [-1, 1]) add(sg * (HW / 2 + gw / 4), .3, HD, HW - gw / 2, WH, .8, CREAM); add(0, 10.3, HD, gw, WH - 10, .8, CREAM);
    add(0, .3, HD, gw, 10, .5, '#4a3320'); add(0, 10.3, HD - .1, gw + 1.4, 1, 1.2, GOLD); add(2, 5, HD - .4, .5, .5, .5, GOLD);
    add(0, ROOF, 0, 2 * HW + 1.4, .7, 2 * HD + 1.4, '#f6efe0');
    for (const [x, z, sx, sz] of [[0, -HD + .5, 2 * HW, .6], [-HW + .5, 0, .6, 2 * HD], [HW - .5, 0, .6, 2 * HD]]) add(x, .3, z, sx, 1, sz, GOLD);   // لوح سفلي ذهبي
    for (const lv of [LV[1], LV[2], ROOF]) for (const [x, z, sx, sz] of [[0, -HD + .4, 2 * HW, .8], [-HW + .4, 0, .8, 2 * HD], [HW - .4, 0, .8, 2 * HD]]) add(x, lv - 1.3, z, sx, 1.3, sz, GOLD);   // أحزمة ذهبية عند كل دور
    for (const sg of [-1, 1]) for (let z = -28; z <= 28; z += 14) { add(sg * (HW - .5), 14, z, .3, 5, 5, '#7fb4d6'); add(sg * (HW - .5), 25, z, .3, 5, 5, '#7fb4d6'); add(sg * (HW - .5), 3.5, z, .3, 5, 5, '#7fb4d6'); }
    for (let x = -36; x <= 36; x += 18) { add(x, 3.5, -HD + .5, 5, 5, .3, '#7fb4d6'); add(x, 14, -HD + .5, 5, 5, .3, '#7fb4d6'); add(x, 25, -HD + .5, 5, 5, .3, '#7fb4d6'); }
    // ---- بلاطات الدورين العلويين (تتجمّع صفوف) ----
    for (let l = 1; l < 3; l++) for (let iz = 0; iz < 2 * HD / CELL; iz++) { const z = -HD + iz * CELL + CELL / 2; let run = null;
      for (let ix = 0; ix <= 2 * HW / CELL; ix++) { const x = -HW + ix * CELL + CELL / 2, ok = ix < 2 * HW / CELL && covered(l, x, z); if (ok && run === null) run = ix; if (!ok && run !== null) { add(-HW + (run + ix) * CELL / 2, LV[l] - 1, z, (ix - run) * CELL, 1, CELL, l === 1 ? '#efe6d2' : '#e6dcc4'); run = null; } } }
    // أسوار الفتحة (درابزين) والدرج
    const rail = (x0, x1, z0, z1, y) => add((x0 + x1) / 2, y + .1, (z0 + z1) / 2, Math.max(.3, x1 - x0), 1.5, Math.max(.3, z1 - z0), GOLD);
    for (const l of [1, 2]) { const y = LV[l]; rail(ATR.x0, ATR.x1, ATR.z0 - .3, ATR.z0, y); rail(ATR.x0, ATR.x1, ATR.z1, ATR.z1 + .3, y); rail(ATR.x0 - .3, ATR.x0, ATR.z0, ATR.z1, y); rail(ATR.x1, ATR.x1 + .3, ATR.z0, ATR.z1, y); }
    for (const s of ST) { const n = 26, len = s.z1 - s.z0, base = LV[s.from], top = LV[s.from + 1];
      for (let i = 0; i < n; i++) { const z = s.dir < 0 ? s.z1 - (i + .5) * len / n : s.z0 + (i + .5) * len / n, hh = (top - base) * (i + 1) / n; add((s.x0 + s.x1) / 2, base, z, s.x1 - s.x0, hh, len / n + .05, i % 2 ? '#e8dcc2' : '#f4ecd8'); }
      for (const x of [s.x0, s.x1]) add(x, base + .2, (s.z0 + s.z1) / 2, .4, 1.5, len, GOLD, false); }
    // ---- أعمدة ذهبية ولمسات الصالة الكبرى ----
    for (const [x, z] of [[-26, -22], [26, -22], [-26, 22], [26, 22], [-8, 30], [8, 30]]) { cyl(x, .3, z, 1.5, 11, CREAM, true); cyl(x, .3, z, 1.9, 1, GOLD); cyl(x, 10.5, z, 1.9, 1, GOLD); }
    add(0, .31, 0, 32, .05, 26, '#9b2d30'); add(0, .35, 0, 29, .05, 23, '#d6b25e'); add(0, .39, 0, 26, .05, 20, '#9b2d30');
    // ثريّا ضخمة وسط الصالة تنزل من السقف
    cyl(0, 24, 0, .4, 9.3, GOLD); for (const [r, y, c] of [[7, 24, '#fff0b8'], [4.6, 27, '#fff7d6'], [2.4, 29.5, GOLD]]) cyl(0, y, 0, r, .8, c);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; ball(Math.cos(a) * 7, 24.6, Math.sin(a) * 7, .7, '#fff3c4'); }
    // ⭐ العلامة المميزة: نوتة تيك توك عملاقة (سماوي/أحمر/أبيض) معلّقة بالصالة
    for (const [dx, c] of [[-.7, '#25f4ee'], [.7, '#fe2c55'], [0, '#ffffff']]) { add(dx, 12.5, -5, 1.6, 9, 1.6, c); ball(dx - 3.4, 12.5, -5, 2.5, c); add(dx + 2.8, 19.6, -5, 5.4, 2.4, 1.6, c); }
    add(0, 11.4, -5, 8, .5, 8, GOLD, true);
    // ---- الدور الأرضي: مسبح داخلي (يسار الشرق) ----
    add(32, .31, -20, 34, .04, 28, '#cfeaf5'); add(32, .3, -20, 30, .9, 24, '#f4f1ea', true); add(32, .85, -20, 26.5, .3, 20.5, '#2fb5e6');
    for (let k = 0; k < 4; k++) { const x = 22 + k * 7; add(x, .3, -33.5, 4.6, .6, 2, '#ffffff'); add(x, .85, -34.3, 4.6, .9, .6, '#e94f3b'); }
    for (const x of [18, 46]) { cyl(x, .3, -6, .3, 5, '#7a5533'); const m = new THREE.Mesh(GEO.cone, tm(x < 30 ? '#ffd34d' : '#e94f3b')); m.position.set(x, 5.3, -6); m.scale.set(6, 1.8, 6); g.add(m); }
    for (const [x, z] of [[47, -30], [47, -8]]) { cyl(x, .3, z, .5, 8, '#9a6e3f'); for (let l = 0; l < 6; l++) { const leaf = new THREE.Mesh(GEO.flat, tm('#3f8f45')); leaf.position.set(x + Math.cos(l) * 2.2, 8.4, z + Math.sin(l) * 2.2); leaf.scale.set(5, .3, 1.6); leaf.rotation.y = -l; g.add(leaf); } }
    // صالة طعام (يسار الغرب خلف الدرج)
    add(-26, .3, -28, 26, 1.2, 5, '#6b4423', true); for (let k = 0; k < 6; k++) for (const sz of [-1, 1]) add(-37 + k * 4.4, .3, -28 + sz * 3.6, 1.8, 1.4, 1.8, '#a8794a');
    add(-26, .3, -34.6, 22, 2.6, 1.4, '#5a3a22', true);
    // صالة جلوس أمامية (شرق) + مكتب استقبال + تلفاز
    add(32, .3, 22, 16, 1.2, 4, '#4f6d8f', true); add(32, 1.5, 24.6, 16, 2.6, 1, '#44607f'); add(24, .3, 28, 4, 1.2, 12, '#4f6d8f', true); add(40, .3, 28, 4, 1.2, 12, '#4f6d8f', true); add(32, .3, 29, 8, .9, 4, '#7a5533', true);
    add(32, 3, HD - 1.2, 18, 8, .6, '#111418'); add(32, .3, HD - 1.4, 22, 2, 1, '#5a3a22');
    add(-20, .3, 26, 14, 1.4, 4, '#7a5533', true); cyl(-20, 1.7, 26, .5, 2.4, GOLD);
    // اسم القصر
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.2), new THREE.MeshBasicMaterial({ map: textTex((h.adm ? '👑 قصر ' : '🏰 قصر ') + h.name, 1024, 190, '#1d2b36', '#ffd34d', 100), transparent: true })); sp.position.set(0, 7.5, -HD + .6); g.add(sp);
    // ---- الدور الأول: غرف نوم ومكتبة ----
    const y1 = LV[1]; add(26, y1, -24, 14, 1.1, 9, '#7a5533', true); add(26, y1 + 1.1, -24, 13.4, .8, 8.4, '#f4f1ea'); add(26, y1 + 1.9, -27.4, 11, .5, 1.8, '#9ec5e8'); add(26, y1 + 1.9, -22, 13.4, .3, 5, '#c94f4f');
    const bed = { x: ox + 26, z: oz - 24, y: y1 + 2.3 };
    add(26, y1, 24, 14, 1.1, 9, '#7a5533', true); add(26, y1 + 1.1, 24, 13.4, .8, 8.4, '#f4f1ea'); add(26, y1 + 1.9, 27.4, 11, .5, 1.8, '#9ec5e8');
    for (const z of [-33, 33]) add(46, y1, z, 4, 8, 3, '#7a5533', true);
    add(-28, y1, -34, 24, 8, 1.6, '#7a5533', true); ['#c94f4f', '#3b7bc4', '#e7b53c', '#3aa06a', '#8e5bd0'].forEach((c, k) => { for (let q = 0; q < 8; q++) add(-38 + q * 2.4 + k * .3, y1 + 2.2 + (k % 2) * 3, -33.2, 1.2, 2.2, 1, c); });
    add(-26, y1, -22, 10, 1.1, 4, '#8b5a2b', true); add(-26, y1 + 1.1, -22, 2, 1.6, 2, '#a8794a');
    add(-30, y1, 12, 14, 1.2, 4, '#4f6d8f', true); add(-30, y1, 22, 14, 1.2, 4, '#4f6d8f', true);
    // ---- الدور الثاني: صالة ترفيه ومجلس ----
    const y2 = LV[2]; add(30, y2, 0, 16, 1.6, 9, '#2f7d3a', true); add(30, y2 + 1.6, 0, 15, .2, 8, '#3fae4f'); for (const [x, z] of [[23, -4], [23, 4], [37, -4], [37, 4]]) cyl(x, y2, z, .5, 1.6, '#3a2a1c');
    add(-30, y2, -26, 18, 1.2, 4, '#7a5533', true); for (let k = 0; k < 4; k++) add(-37 + k * 4.4, y2, -22.6, 2.2, 1.3, 2, '#c94f4f');
    for (const [x, z] of [[-30, 10], [-30, 24]]) add(x, y2, z, 16, 1.2, 4, '#8e5bd0', true);
    add(-36, y2, 30, 4, 7, 4, '#2b2f36', true); cyl(-36, y2 + 7, 30, .3, 4, '#9aa3ab'); add(30, y2, 26, 14, 1.6, 4, '#5a3a22', true);
    for (const [x, z] of [[-8, 28], [8, 28]]) add(x, y2, z, 3, 6, 3, CREAM, true);
    return { group: g, boxes, bed, hw: HW, hd: HD, H: ROOF - .4, gf: (x, z, y) => { const lx = x - ox, lz = z - oz, lim = y + .75; let best = LV[0];
      for (let l = 1; l < 3; l++) if (LV[l] <= lim && LV[l] > best && covered(l, lx, lz)) best = LV[l];
      for (const s of ST) if (inR(s, lx, lz)) { const len = s.z1 - s.z0, t = s.dir < 0 ? (s.z1 - lz) / len : (lz - s.z0) / len, hh = LV[s.from] + (LV[s.from + 1] - LV[s.from]) * t; if (hh <= lim && hh > best) best = hh; }
      return best; }, spawn: { x: ox, z: oz + HD - 6 } };
  };
}
