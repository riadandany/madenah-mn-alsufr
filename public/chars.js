// شخصيات المشي — 10 شخصيات مبنية من أشكال بسيطة (بدون ملفات خارجية)
// كل شخصية: جسم ثابت + رجلين + يدين (تتحرك وقت المشي). الشخصية تطالع باتجاه +z وطولها تقريباً 2.2
import * as THREE from '/vendor/three.module.min.js';

export const CHARS = ['أبو شماغ', 'أبو غترة', 'أم عباية', 'الولد', 'البنت', 'الرياضي', 'الشيبة', 'الطبّاخ', 'رائد فضاء', 'الروبوت'];
export const CH_COUNT = CHARS.length;
export const CH_ALL = 29;      // 28 = بدلة «المدير العام» (زي الوظيفة فقط، ما ينشرى)      // 10 = لبس صاحب المدينة (حصري)، 11..15 = السكنات الأسطورية (لحسابات اللي كانوا موجودين اليوم وبكره فقط)
export const LEG_NAMES = ['التنين الذهبي', 'الفارس الأسطوري', 'الساحر الأعظم', 'صقر الصحراء', 'ملك الكريستال'];
// سكنات السوق (16..27) — تنشرى بالذهب 🪙 (الأسعار بالسيرفر)
export const SHOP_SKINS = ['الشرطي', 'الإطفائي', 'الدكتور', 'النينجا', 'القرصان', 'لاعب الكورة', 'الطيّار', 'الفضائي', 'البطل الخارق', 'الملك', 'الشيخ الذهبي', 'أسطورة الماس'];
export const SKIN_FIRST = 16;
export const chName = i => i < 10 ? CHARS[i] : i >= 11 && i <= 15 ? LEG_NAMES[i - 11] : i === 28 ? 'المدير العام' : i >= SKIN_FIRST ? SHOP_SKINS[i - SKIN_FIRST] : 'صاحب المدينة';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
  cyl: new THREE.CylinderGeometry(.5, .5, 1, 12).toNonIndexed(),
  robe: new THREE.CylinderGeometry(.38, .47, 1, 14).toNonIndexed(),
  skirt: new THREE.CylinderGeometry(.34, .52, 1, 14).toNonIndexed(),
  ball: new THREE.SphereGeometry(.5, 12, 8).toNonIndexed(),
  cone: new THREE.ConeGeometry(.5, 1, 12).toNonIndexed(),
};
const HIP = .95, SHOULDER = 1.62, ARM_X = .47, LEG_X = .16;
const DARK = '#1d1712';

// يدمج قطع كثيرة في شكل واحد بألوان على الرؤوس (رسمة وحدة بدل عشرات)
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _v = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function merge(parts, off = [0, 0, 0]) {
  const pos = [], nor = [], col = [];
  for (const [g, x, y, z, sx, sy, sz, c, rx = 0, ry = 0, rz = 0] of parts) {
    _m.compose(_p.set(x + off[0], y + off[1], z + off[2]), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    _n.getNormalMatrix(_m); _c.set(c);
    const P = G[g].attributes.position, N = G[g].attributes.normal;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize(); nor.push(_v.x, _v.y, _v.z);
      col.push(_c.r, _c.g, _c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------- قطع مشتركة ----------
const face = (skin, eyes = DARK) => [
  ['box', 0, 1.95, 0, .5, .5, .48, skin],
  ['box', -.11, 1.98, .245, .08, .1, .03, eyes], ['box', .11, 1.98, .245, .08, .1, .03, eyes],
];
const headCloth = (c, egal = true) => [                       // شماغ / غترة + عقال
  ['box', 0, 2.24, -.01, .6, .14, .56, c],
  ['box', 0, 1.9, -.25, .6, .66, .1, c],
  ['box', -.29, 1.93, -.03, .05, .56, .42, c], ['box', .29, 1.93, -.03, .05, .56, .42, c],
  ...(egal ? [['cyl', 0, 2.33, -.01, .5, .07, .48, '#151515']] : []),
];
const shirtTorso = c => [['box', 0, 1.32, 0, .72, .74, .42, c]];
const robeBody = (c, bottom = .26) => { const h = 1.68 - bottom; return [['robe', 0, bottom + h / 2, 0, 1, h, .9, c]]; };
const legs = (pants, shoe, len = .85) => [                   // نسبة لمفصل الورك
  ['box', 0, -len / 2, 0, .26, len, .3, pants],
  ['box', 0, -HIP + .07, .06, .3, .14, .44, shoe],
];
const robeLegs = (c, shoe) => [['box', 0, -.75, 0, .2, .4, .22, c], ['box', 0, -HIP + .07, .06, .28, .14, .42, shoe]];
const arms = (sleeve, skin, w = .22) => [                     // نسبة لمفصل الكتف
  ['box', 0, -.3, 0, w, .62, w + .02, sleeve],
  ['ball', 0, -.66, 0, .2, .2, .2, skin],
];

const SKIN = ['#f1c7a0', '#d9a477', '#b07a52'];
function spec(ch) {
  switch (ch) {
    case 0: return { robe: true, body: [...robeBody('#f6f6f2'), ...face(SKIN[1]), ...headCloth('#d23b33'), ['box', 0, 1.66, .2, .34, .05, .12, '#f6f6f2']],
      leg: robeLegs('#f6f6f2', '#6b4423'), arm: arms('#f6f6f2', SKIN[1]) };
    case 1: return { robe: true, body: [...robeBody('#f6f6f2'), ...face(SKIN[0]), ...headCloth('#fbfbf8'), ['box', 0, 1.74, .25, .34, .12, .06, '#2b2018']],
      leg: robeLegs('#f6f6f2', '#2b2b2b'), arm: arms('#f6f6f2', SKIN[0]) };
    case 2: return { robe: true, body: [...robeBody('#1d1d24', .12),
        ['box', 0, 1.97, 0, .58, .6, .56, '#1d1d24'], ['box', 0, 1.95, .27, .38, .34, .04, SKIN[0]],
        ['box', -.09, 1.98, .29, .07, .08, .02, DARK], ['box', .09, 1.98, .29, .07, .08, .02, DARK],
        ['box', 0, 1.66, -.02, .7, .2, .5, '#1d1d24']],
      leg: robeLegs('#1d1d24', '#1d1d24'), arm: arms('#1d1d24', SKIN[0], .26) };
    case 3: return { body: [...shirtTorso('#ff8a2a'), ['box', 0, 1.02, 0, .72, .14, .42, '#3a5f9a'], ...face(SKIN[1]),
        ['box', 0, 2.06, -.2, .52, .3, .12, '#2b1d12'], ['box', 0, 2.25, 0, .55, .14, .52, '#2d6fb8'], ['box', 0, 2.2, .34, .42, .05, .28, '#2d6fb8']],
      leg: legs('#3a5f9a', '#f2f2f2'), arm: arms('#ff8a2a', SKIN[1]) };
    case 4: return { body: [...shirtTorso('#f06fa5'), ['skirt', 0, .9, 0, 1, .5, .9, '#f06fa5'], ...face(SKIN[0]),
        ['box', 0, 2.22, -.02, .56, .14, .54, '#5a3a22'], ['box', 0, 1.88, -.22, .56, .66, .14, '#5a3a22'],
        ['ball', 0, 2.05, -.4, .3, .3, .3, '#5a3a22'], ['box', 0, 2.3, -.32, .26, .12, .1, '#ff4f8a']],
      leg: legs(SKIN[0], '#e9434f', .85), arm: arms(SKIN[0], SKIN[0], .18) };
    case 5: return { body: [...shirtTorso('#2d5fd0'), ['box', 0, 1.36, .215, .1, .7, .02, '#ffffff'], ...face(SKIN[2]),
        ['box', 0, 2.21, -.02, .54, .1, .52, '#14100c'], ['box', 0, 2.14, 0, .54, .07, .52, '#ffffff']],
      leg: [...legs('#2d5fd0', '#e9434f'), ['box', .135, -.42, 0, .02, .8, .1, '#ffffff']], arm: arms('#2d5fd0', SKIN[2]) };
    case 6: return { robe: true, body: [...robeBody('#f6f6f2'), ['robe', 0, 1.05, -.01, 1.08, 1.27, .98, '#6b4a2a'],
        ['box', 0, 1.05, .42, .2, 1.25, .04, '#f6f6f2'], ['box', -.11, 1.05, .43, .03, 1.25, .03, '#d8a33a'], ['box', .11, 1.05, .43, .03, 1.25, .03, '#d8a33a'],
        ...face(SKIN[1]), ['box', 0, 1.78, .24, .44, .24, .08, '#f2f2f2'], ...headCloth('#fbfbf8')],
      leg: robeLegs('#f6f6f2', '#6b4423'), arm: arms('#6b4a2a', SKIN[1], .26) };
    case 7: return { body: [...shirtTorso('#f7f7f5'), ['box', -.1, 1.4, .215, .05, .05, .02, DARK], ['box', -.1, 1.2, .215, .05, .05, .02, DARK],
        ['box', 0, 1.68, .05, .5, .1, .4, '#e94f3b'], ...face(SKIN[0]),
        ['cyl', 0, 2.38, 0, .46, .36, .46, '#ffffff'], ['ball', 0, 2.62, 0, .62, .42, .62, '#ffffff']],
      leg: legs('#2b2b2b', '#14100c'), arm: arms('#f7f7f5', SKIN[0]) };
    case 8: return { body: [['box', 0, 1.32, 0, .78, .78, .48, '#eef0f2'], ['box', 0, 1.4, .245, .3, .2, .03, '#ff7414'],
        ['box', 0, 1.36, -.32, .58, .62, .24, '#cfd4d9'], ['ball', 0, 1.98, 0, .72, .7, .7, '#f7f8f9'], ['box', 0, 1.99, .27, .46, .3, .12, '#203a5a']],
      leg: legs('#eef0f2', '#7d8790', .85), arm: arms('#eef0f2', '#cfd4d9', .26) };
    // ===== سكنات أسطورية حصرية (11..15): كل واحد له شارة اسم خاصة (TAGS 8..12) =====
    case 11: return { body: [...shirtTorso('#d4a017'), ['box', 0, 1.02, 0, .72, .14, .42, '#7a5a10'], ['box', 0, 1.36, .215, .5, .5, .03, '#1e8a4c'], ['box', -.5, 1.62, 0, .32, .2, .42, '#1e8a4c'], ['box', .5, 1.62, 0, .32, .2, .42, '#1e8a4c'],
        ...face(SKIN[1]), ['box', 0, 2.27, 0, .58, .18, .56, '#d4a017'], ['cone', -.2, 2.5, 0, .14, .42, .14, '#fff3b0'], ['cone', .2, 2.5, 0, .14, .42, .14, '#fff3b0'], ['box', 0, 1.82, .245, .42, .16, .03, '#1e8a4c'],
        ['box', 0, .9, -.35, .2, .2, .6, '#1e8a4c'], ['box', 0, .82, -.78, .15, .15, .42, '#1e8a4c'], ['cone', 0, .8, -1.1, .2, .32, .2, '#ff5a2a', -1.57, 0, 0]],
      leg: legs('#1e8a4c', '#d4a017'), arm: arms('#d4a017', SKIN[1]) };
    case 12: return { body: [...shirtTorso('#c8cdd2'), ['box', 0, 1.02, 0, .72, .14, .42, '#8a929a'], ['box', 0, 1.36, .215, .22, .5, .03, '#c0392b'], ['ball', -.52, 1.62, 0, .36, .3, .36, '#aeb4ba'], ['ball', .52, 1.62, 0, .36, .3, .36, '#aeb4ba'],
        ['box', 0, 1.95, 0, .58, .58, .56, '#c8cdd2'], ['box', 0, 1.98, .285, .42, .08, .02, '#111111'], ['box', 0, 2.38, -.08, .1, .34, .5, '#c0392b'],
        ['box', 0, 1.1, -.32, .72, 1.2, .06, '#b71c1c'], ['box', .18, 1.4, -.5, .1, 1.4, .05, '#e8eef2', 0, 0, .35], ['box', .1, .78, -.5, .34, .08, .06, '#e7b53c', 0, 0, .35]],
      leg: legs('#aeb4ba', '#4a4f55'), arm: arms('#c8cdd2', '#8a929a', .24) };
    case 13: return { robe: true, body: [...robeBody('#4a2d82', .2), ['box', 0, 1.0, .46, .2, 1.3, .03, '#e7b53c'], ['box', 0, 1.66, -.02, .7, .2, .5, '#3a2270'],
        ...face(SKIN[0]), ['box', 0, 1.74, .26, .42, .3, .08, '#f2f2f2'], ['cyl', 0, 2.28, 0, .92, .06, .92, '#3a2270'], ['cone', 0, 2.75, 0, .66, .95, .66, '#4a2d82'], ['ball', 0, 3.2, 0, .14, .14, .14, '#ffd34d'],
        ['ball', .78, 1.9, .2, .3, .3, .3, '#56e0ff'], ['ball', -.78, 1.5, .1, .16, .16, .16, '#ffd34d']],
      leg: robeLegs('#3a2270', '#e7b53c'), arm: arms('#4a2d82', SKIN[0], .26) };
    case 14: return { body: [...shirtTorso('#6b4a2a'), ['box', 0, 1.02, 0, .72, .14, .42, '#3a2a18'], ['box', 0, 1.36, .215, .4, .6, .03, '#e7b53c'],
        ...face(SKIN[1]), ['box', 0, 2.2, 0, .58, .22, .56, '#6b4a2a'], ['box', 0, 1.99, .27, .5, .08, .04, '#f2c230'], ['cone', 0, 1.9, .4, .16, .34, .16, '#f2c230', 1.57, 0, 0],
        ['box', -.62, 1.55, -.36, 1.1, .5, .05, '#8b5a2b', 0, 0, .5], ['box', .62, 1.55, -.36, 1.1, .5, .05, '#8b5a2b', 0, 0, -.5], ['box', -.95, 1.9, -.36, .5, .3, .04, '#e7b53c', 0, 0, .5], ['box', .95, 1.9, -.36, .5, .3, .04, '#e7b53c', 0, 0, -.5]],
      leg: legs('#6b4a2a', '#3a2a18'), arm: arms('#6b4a2a', SKIN[1]) };
    case 15: return { body: [...shirtTorso('#7ee8fa'), ['box', 0, 1.02, 0, .72, .14, .42, '#ffffff'], ['box', 0, 1.36, .215, .3, .5, .03, '#ffffff'], ...face(SKIN[0]),
        ['cyl', 0, 2.3, 0, .62, .14, .62, '#ffffff'], ...[0, 1, 2, 3, 4].map(k => { const a = k / 5 * Math.PI * 2; return ['cone', Math.cos(a) * .24, 2.54, Math.sin(a) * .24, .14, .34, .14, k % 2 ? '#a5f3ff' : '#fdfdfd']; }),
        ['box', -.72, 1.7, 0, .2, .2, .2, '#a5f3ff', .8, .8, 0], ['box', .72, 1.5, .1, .16, .16, .16, '#ffffff', .8, .8, 0], ['box', 0, 1.1, -.3, .7, 1.2, .05, '#5ad0ea']],
      leg: legs('#7ee8fa', '#ffffff'), arm: arms('#7ee8fa', SKIN[0]) };
    // ===== سكنات السوق (16..27) =====
    case 16: return { body: [...shirtTorso('#1f3a6b'), ['box', 0, 1.02, 0, .72, .14, .42, '#14100c'], ['box', -.17, 1.46, .215, .12, .12, .02, '#f2c230'], ['box', .17, 1.36, .215, .2, .05, .02, '#c0392b'], ...face(SKIN[1]),
        ['box', 0, 2.24, 0, .56, .16, .54, '#1f3a6b'], ['box', 0, 2.18, .3, .48, .05, .22, '#14100c'], ['box', 0, 2.27, .275, .12, .1, .02, '#f2c230']],
      leg: legs('#14100c', '#14100c'), arm: arms('#1f3a6b', SKIN[1]) };
    case 17: return { body: [...shirtTorso('#c62828'), ['box', 0, 1.18, .215, .72, .06, .02, '#ffd34d'], ['box', 0, 1.5, .215, .72, .06, .02, '#ffd34d'], ['box', 0, 1.02, 0, .72, .14, .42, '#3a3a3a'], ...face(SKIN[0]),
        ['ball', 0, 2.24, 0, .66, .4, .66, '#ffc107'], ['box', 0, 2.12, -.32, .66, .1, .3, '#ffc107'], ['box', 0, 2.3, .3, .16, .14, .04, '#c62828']],
      leg: [...legs('#3a3a3a', '#14100c'), ['box', 0, -.5, .155, .27, .05, .02, '#ffd34d']], arm: arms('#c62828', '#3a3a3a') };
    case 18: return { body: [['box', 0, 1.18, 0, .76, 1.05, .44, '#fbfbfb'], ['box', 0, 1.4, .225, .2, .5, .02, '#4fb3a4'], ['cyl', -.15, 1.55, .23, .1, .02, .1, '#555555'], ['box', -.15, 1.35, .235, .03, .3, .02, '#555555'], ['box', .2, 1.3, .23, .14, .14, .02, '#2d6fb8'], ...face(SKIN[1]),
        ['box', 0, 2.17, -.02, .52, .14, .5, '#3a2a18']],
      leg: legs('#4fb3a4', '#f2f2f2'), arm: arms('#fbfbfb', SKIN[1]) };
    case 19: return { body: [...shirtTorso('#15151a'), ['box', 0, 1.06, 0, .74, .1, .44, '#c0392b'], ['box', .3, .98, .18, .1, .3, .05, '#c0392b'],
        ['box', 0, 1.95, 0, .52, .52, .5, '#15151a'], ['box', 0, 1.99, .25, .46, .12, .02, SKIN[1]], ['box', -.1, 1.99, .262, .08, .07, .02, DARK], ['box', .1, 1.99, .262, .08, .07, .02, DARK],
        ['box', 0, 2.1, -.3, .1, .1, .3, '#c0392b'], ['box', .2, 1.3, -.28, .06, 1.1, .06, '#9aa6b2', 0, 0, .6]],
      leg: legs('#15151a', '#15151a'), arm: arms('#15151a', '#15151a') };
    case 20: return { body: [...shirtTorso('#f4efe2'), ['box', 0, 1.32, .205, .52, .74, .03, '#3a2a18'], ['box', 0, 1.04, 0, .74, .14, .44, '#c0392b'], ...face(SKIN[1]),
        ['box', 0, 2.2, 0, .54, .14, .52, '#c0392b'], ['box', -.2, 2.1, -.3, .12, .3, .08, '#c0392b'], ['box', .11, 1.99, .255, .14, .12, .02, '#14100c'], ['box', 0, 2.05, .25, .5, .03, .02, '#14100c'], ['box', 0, 1.78, .24, .36, .12, .06, '#3a2a18']],
      leg: legs('#3a2a18', '#14100c'), arm: arms('#f4efe2', SKIN[1]) };
    case 21: return { body: [...shirtTorso('#1e8a4c'), ['box', 0, 1.34, .215, .22, .34, .02, '#ffffff'], ['box', -.36, 1.58, 0, .02, .2, .44, '#ffffff'], ['box', .36, 1.58, 0, .02, .2, .44, '#ffffff'], ['box', 0, 1.0, 0, .72, .18, .42, '#ffffff'], ...face(SKIN[2]),
        ['box', 0, 2.2, -.02, .52, .1, .5, '#14100c']],
      leg: [...legs(SKIN[2], '#14100c'), ['box', 0, -.62, 0, .28, .42, .32, '#1e8a4c']], arm: arms('#1e8a4c', SKIN[2]) };
    case 22: return { body: [...shirtTorso('#1d2b4a'), ['box', 0, 1.5, .215, .5, .05, .02, '#f2c230'], ['box', -.36, 1.62, 0, .04, .06, .44, '#f2c230'], ['box', .36, 1.62, 0, .04, .06, .44, '#f2c230'], ['box', -.18, 1.42, .218, .16, .05, .02, '#f2c230'], ['box', 0, 1.02, 0, .72, .14, .42, '#1d2b4a'], ...face(SKIN[0]),
        ['cyl', 0, 2.25, 0, .6, .12, .6, '#fbfbfb'], ['box', 0, 2.18, .3, .5, .05, .2, '#14100c'], ['box', 0, 2.26, .3, .14, .08, .02, '#f2c230'], ['box', 0, 1.99, .255, .44, .1, .03, '#14100c']],
      leg: legs('#1d2b4a', '#14100c'), arm: arms('#1d2b4a', SKIN[0]) };
    case 23: return { body: [['box', 0, 1.32, 0, .74, .76, .44, '#c7ced6'], ['box', 0, 1.36, .225, .3, .3, .02, '#7cfc5a'], ['ball', 0, 2.02, 0, .76, .7, .7, '#7cdb52'], ['ball', -.15, 2.06, .28, .2, .24, .08, '#14100c'], ['ball', .15, 2.06, .28, .2, .24, .08, '#14100c'],
        ['cyl', -.18, 2.42, 0, .04, .26, .04, '#7cdb52'], ['cyl', .18, 2.42, 0, .04, .26, .04, '#7cdb52'], ['ball', -.18, 2.57, 0, .1, .1, .1, '#ffeb3b'], ['ball', .18, 2.57, 0, .1, .1, .1, '#ffeb3b']],
      leg: legs('#c7ced6', '#7d8790'), arm: arms('#c7ced6', '#7cdb52') };
    case 24: return { body: [...shirtTorso('#1565c0'), ['box', 0, 1.36, .215, .34, .3, .02, '#ffd34d'], ['box', 0, 1.36, .222, .16, .14, .02, '#c62828'], ['box', 0, 1.02, 0, .72, .14, .42, '#c62828'], ...face(SKIN[1]),
        ['box', 0, 1.99, .25, .52, .14, .03, '#1565c0'], ['box', 0, 2.2, -.02, .52, .12, .5, '#14100c'], ['box', 0, 1.1, -.3, .8, 1.25, .05, '#c62828'], ['box', 0, 1.7, -.26, .8, .1, .14, '#c62828']],
      leg: legs('#1565c0', '#c62828'), arm: arms('#1565c0', '#c62828') };
    case 25: return { robe: true, body: [...robeBody('#b71c1c', .14), ['box', 0, 1.62, 0, .78, .16, .58, '#fbfbfb'], ['box', 0, .9, .44, .16, 1.4, .04, '#fbfbfb'], ['box', 0, .24, 0, 1.0, .1, .9, '#fbfbfb'], ...face(SKIN[0]),
        ['box', 0, 1.76, .25, .42, .26, .08, '#a1887f'], ['cyl', 0, 2.3, 0, .6, .2, .6, '#f2c230'], ...[0, 1, 2, 3, 4].map(k => { const a = k / 5 * Math.PI * 2; return ['cone', Math.cos(a) * .24, 2.5, Math.sin(a) * .24, .14, .24, .14, '#f2c230']; }), ['ball', 0, 2.32, .3, .1, .1, .06, '#2d6fb8']],
      leg: robeLegs('#b71c1c', '#f2c230'), arm: arms('#b71c1c', SKIN[0], .26) };
    case 26: return { robe: true, body: [...robeBody('#fbfbf8'), ['robe', 0, 1.05, -.01, 1.12, 1.28, 1.02, '#c99a2e'],
        ['box', 0, 1.05, .46, .26, 1.26, .04, '#fbfbf8'], ['box', -.14, 1.05, .47, .05, 1.26, .03, '#fff3b0'], ['box', .14, 1.05, .47, .05, 1.26, .03, '#fff3b0'],
        ...face(SKIN[1]), ['box', 0, 1.78, .24, .44, .24, .08, '#2b2018'], ...headCloth('#d23b33'), ['cyl', 0, 2.33, -.01, .52, .07, .5, '#f2c230']],
      leg: robeLegs('#fbfbf8', '#c99a2e'), arm: arms('#c99a2e', SKIN[1], .26) };
    case 27: return { body: [['box', 0, 1.32, 0, .76, .76, .46, '#b3f0ff'], ['box', 0, 1.36, .235, .3, .3, .02, '#ffffff', 0, 0, .785], ['box', 0, 1.02, 0, .74, .14, .44, '#5ad0ea'],
        ['box', 0, 1.97, 0, .54, .52, .52, '#e0fbff'], ['box', -.11, 2.0, .265, .09, .1, .02, '#0b7fa3'], ['box', .11, 2.0, .265, .09, .1, .02, '#0b7fa3'],
        ...[0, 1, 2, 3, 4, 5].map(k => { const a = k / 6 * Math.PI * 2; return ['box', Math.cos(a) * .26, 2.36, Math.sin(a) * .26, .12, .3, .12, k % 2 ? '#7ee8fa' : '#ffffff', .6, a, 0]; }),
        ['box', -.75, 1.75, .1, .2, .2, .2, '#ffffff', .8, .8, 0], ['box', .78, 1.55, -.05, .16, .16, .16, '#7ee8fa', .8, .8, 0], ['box', 0, 1.1, -.3, .76, 1.2, .05, '#7ee8fa']],
      leg: legs('#b3f0ff', '#ffffff'), arm: arms('#b3f0ff', '#e0fbff') };
    // ===== 28: بدلة المدير العام (جاكيت + قميص أبيض + كرفتة حمراء + منديل ذهبي بالجيب) =====
    case 28: return { body: [['box', 0, 1.32, 0, .72, .74, .42, '#2b3340'], ['box', 0, 1.5, .213, .22, .4, .02, '#ffffff'], ['box', 0, 1.4, .226, .085, .48, .02, '#c0392b'], ['box', 0, 1.66, .228, .12, .08, .025, '#962d22'],
        ['box', -.13, 1.5, .224, .07, .38, .015, '#1c222b', 0, 0, .35], ['box', .13, 1.5, .224, .07, .38, .015, '#1c222b', 0, 0, -.35], ['box', .22, 1.47, .223, .15, .02, .02, '#1c222b'], ['box', .22, 1.505, .224, .11, .06, .02, '#f2c230'],
        ['box', -.09, 1.12, .222, .05, .05, .02, '#e7b53c'], ['box', -.09, 1.26, .222, .05, .05, .02, '#e7b53c'], ['box', 0, 1.02, 0, .72, .14, .42, '#14100c'], ...face(SKIN[1]), ['box', 0, 2.2, -.02, .54, .14, .52, '#1d1712']],
      leg: legs('#2b3340', '#0d0d0d'), arm: arms('#2b3340', SKIN[1]) };
    case 10: return { robe: true, body: [...robeBody('#fbfbf8'), ['robe', 0, 1.05, -.01, 1.1, 1.28, 1.0, '#2a2118'],
        ['box', 0, 1.05, .45, .24, 1.26, .04, '#fbfbf8'], ['box', -.13, 1.05, .46, .04, 1.26, .03, '#e7b53c'], ['box', .13, 1.05, .46, .04, 1.26, .03, '#e7b53c'], ['box', 0, .45, .47, .5, .05, .03, '#e7b53c'],
        ...face(SKIN[0]), ['box', 0, 1.78, .24, .44, .24, .08, '#3a2a1c'], ...headCloth('#ffffff'), ['cyl', 0, 2.33, -.01, .52, .07, .5, '#e7b53c']],
      leg: robeLegs('#fbfbf8', '#e7b53c'), arm: arms('#2a2118', SKIN[0], .26) };
    case 9: return { body: [['box', 0, 1.32, 0, .8, .74, .48, '#9aa6b2'], ['box', 0, 1.36, .245, .36, .3, .02, '#3d8c7c'],
        ['box', 0, 1.97, 0, .56, .46, .5, '#b8c2cc'], ['box', -.12, 2, .255, .12, .08, .02, '#56e0ff'], ['box', .12, 2, .255, .12, .08, .02, '#56e0ff'],
        ['box', 0, 1.86, .255, .26, .04, .02, '#3a4750'], ['cyl', 0, 2.34, 0, .04, .3, .04, '#3a4750'], ['ball', 0, 2.5, 0, .12, .12, .12, '#ff3b3b']],
      leg: [['cyl', 0, -.42, 0, .22, .84, .22, '#7d8790'], ['box', 0, -HIP + .08, .05, .3, .16, .42, '#3a4750']], arm: [['cyl', 0, -.3, 0, .16, .6, .16, '#7d8790'], ['box', 0, -.66, 0, .2, .18, .2, '#3a4750']] };
  }
}

// ---------- المواد ----------
export function charMaterials(grad) {
  const body = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  // حد أسود بنفخ الرؤوس على اتجاه السطح (نفس ستايل المدينة)
  const line = new THREE.MeshBasicMaterial({ color: DARK, side: THREE.BackSide });
  line.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.035;'); };
  return { body, line };
}

// ---------- الإكسسوارات (قبعات + أشياء الظهر) — تنفتح بأيام الدخول ----------
export const HATS = ['بدون', 'طاقية', 'كاوبوي', 'تاج', 'خوذة', 'قبعة حفلة', 'قبعة ساحر', 'تاج صاحب المدينة', 'قبعة شمس', 'قبعة قرصان', 'هالة ذهبية', 'أذان أرنب', 'سماعات قيمنق', 'تاج الماس', 'قبعة تخرّج', 'خوذة فايكنج'];   // 7 = حصري لصاحب المدينة
export const BACKS = ['بدون', 'شنطة ظهر', 'عباءة سوبر', 'أجنحة', 'أجنحة ذهبية', 'عباءة ملكية', 'جيتار', 'سيف', 'صاروخ ظهر', 'درع', 'أجنحة تنين'];   // 5 = حصري لصاحب المدينة
export const TAGS = ['', '⭐', '🔥', '💎', '🚀', '👑', '🌹', '', '🐉', '⚔️', '🔮', '🦅', '💠'];   // 8..12 = شارات السكنات الأسطورية
const HEADTOP = [2.4, 2.32, 2.27, 2.33, 2.3, 2.27, 2.32, 2.8, 2.36, 2.3, 2.4, 2.7, 2.7, 3.4, 2.5, 2.9, 2.33, 2.44, 2.25, 2.22, 2.28, 2.26, 2.32, 2.4, 2.27, 2.62, 2.4, 2.55];   // ارتفاع راس كل شخصية
function accParts(ch, hat, back) {
  const y = HEADTOP[ch] ?? 2.3, P = [], GOLD = '#f2c230';
  switch (hat) {
    case 1: P.push(['box', 0, y + .09, 0, .58, .18, .56, '#2d6fb8'], ['box', 0, y + .02, .38, .5, .05, .3, '#2d6fb8']); break;
    case 2: P.push(['cyl', 0, y + .03, 0, 1.0, .06, 1.0, '#8a5a2b'], ['cyl', 0, y + .22, 0, .5, .34, .5, '#9a6a35'], ['cyl', 0, y + .1, 0, .52, .08, .52, '#3a2a18']); break;
    case 3: P.push(['cyl', 0, y + .09, 0, .6, .18, .6, GOLD]); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; P.push(['box', Math.cos(a) * .24, y + .27, Math.sin(a) * .24, .1, .2, .1, GOLD]); } break;
    case 4: P.push(['ball', 0, y + .05, 0, .72, .62, .72, '#c0392b'], ['box', 0, y + .33, 0, .08, .04, .6, '#ffffff']); break;
    case 5: P.push(['cone', 0, y + .3, 0, .4, .6, .4, '#e94f8b'], ['ball', 0, y + .64, 0, .14, .14, .14, '#ffd34d']); break;
    case 7: { P.push(['cyl', 0, y + .12, 0, .72, .24, .72, GOLD], ['cyl', 0, y + .02, 0, .76, .06, .76, '#fff3b0']);
      for (let k = 0; k < 7; k++) { const an = k / 7 * Math.PI * 2; P.push(['cone', Math.cos(an) * .3, y + .42, Math.sin(an) * .3, .2, .4, .2, GOLD], ['ball', Math.cos(an) * .3, y + .66, Math.sin(an) * .3, .09, .09, .09, '#e63946']); }
      P.push(['ball', 0, y + .3, .36, .16, .16, .16, '#2d6fb8'], ['ball', 0, y + .3, -.36, .16, .16, .16, '#2d6fb8']); break; }
    case 8: P.push(['cyl', 0, y + .02, 0, 1.15, .05, 1.15, '#e8c66a'], ['cyl', 0, y + .16, 0, .56, .26, .56, '#e8c66a'], ['cyl', 0, y + .1, 0, .58, .06, .58, '#c0392b']); break;
    case 9: P.push(['box', 0, y + .12, 0, .9, .26, .5, '#15151a'], ['box', 0, y + .3, 0, .5, .18, .44, '#15151a'], ['box', 0, y + .16, .26, .14, .12, .02, '#ffffff'], ['box', 0, y + .02, 0, .92, .04, .52, '#f2c230']); break;
    case 10: for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; P.push(['ball', Math.cos(a) * .34, y + .42, Math.sin(a) * .34, .12, .12, .12, '#ffd34d']); } break;
    case 11: P.push(['box', -.14, y + .36, 0, .14, .62, .1, '#fbfbfb', 0, 0, .12], ['box', .14, y + .36, 0, .14, .62, .1, '#fbfbfb', 0, 0, -.12], ['box', -.14, y + .36, .055, .07, .48, .02, '#f7a8c4', 0, 0, .12], ['box', .14, y + .36, .055, .07, .48, .02, '#f7a8c4', 0, 0, -.12]); break;
    case 12: P.push(['box', 0, y + .06, 0, .62, .08, .14, '#22262b'], ['cyl', -.3, y - .2, 0, .22, .1, .22, '#22262b', 0, 0, 1.57], ['cyl', .3, y - .2, 0, .22, .1, .22, '#22262b', 0, 0, 1.57], ['box', -.36, y - .2, 0, .02, .12, .12, '#39ff6a'], ['box', .36, y - .2, 0, .02, .12, .12, '#39ff6a'], ['box', -.27, y - .32, .2, .04, .04, .24, '#22262b']); break;
    case 13: P.push(['cyl', 0, y + .09, 0, .62, .18, .62, '#9be7ff']); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P.push(['cone', Math.cos(a) * .25, y + .3, Math.sin(a) * .25, .14, .26, .14, '#e0fbff'], ['ball', Math.cos(a) * .25, y + .46, Math.sin(a) * .25, .08, .08, .08, '#56e0ff']); } P.push(['ball', 0, y + .1, .31, .14, .14, .06, '#ff4fa3']); break;
    case 14: P.push(['box', 0, y + .08, 0, .52, .16, .5, '#15151a'], ['box', 0, y + .19, 0, .82, .04, .82, '#15151a', 0, .785, 0], ['ball', 0, y + .23, 0, .08, .05, .08, '#f2c230'], ['box', .3, y + .06, .3, .04, .3, .04, '#f2c230']); break;
    case 15: P.push(['ball', 0, y + .02, 0, .66, .52, .66, '#8a929a'], ['box', 0, y - .02, .3, .08, .3, .04, '#6b7680'], ['cone', -.36, y + .22, 0, .14, .42, .14, '#f4efe2', 0, 0, .9], ['cone', .36, y + .22, 0, .14, .42, .14, '#f4efe2', 0, 0, -.9]); break;
    case 6: P.push(['cyl', 0, y + .03, 0, .8, .05, .8, '#4a2d82'], ['cone', 0, y + .38, 0, .5, .7, .5, '#5b3ca8'], ['ball', 0, y + .76, 0, .12, .12, .12, '#ffd34d']); break;
  }
  switch (back) {
    case 1: P.push(['box', 0, 1.35, -.4, .5, .6, .22, '#c2553a'], ['box', 0, 1.15, -.5, .4, .25, .12, '#a8432c']); break;
    case 2: P.push(['box', 0, 1.1, -.5, .8, 1.2, .06, '#c0392b'], ['box', 0, 1.66, -.4, .8, .1, .2, '#c0392b']); break;
    case 3: P.push(['box', -.55, 1.55, -.45, .9, .5, .06, '#f4f4f6', 0, 0, .5], ['box', .55, 1.55, -.45, .9, .5, .06, '#f4f4f6', 0, 0, -.5]); break;
    case 5: P.push(['box', 0, .95, -.52, .95, 1.55, .06, '#6a1b9a'], ['box', 0, 1.74, -.42, 1.0, .16, .26, '#ffffff'], ['box', -.47, .95, -.55, .06, 1.55, .04, '#e7b53c'], ['box', .47, .95, -.55, .06, 1.55, .04, '#e7b53c'], ['box', 0, .18, -.55, .95, .06, .04, '#e7b53c']); break;
    case 6: P.push(['ball', 0, 1.0, -.42, .62, .7, .18, '#a0522d'], ['ball', 0, .98, -.52, .18, .18, .04, '#2b1d12'], ['box', 0, 1.62, -.42, .1, .8, .06, '#6b4423', 0, 0, .12], ['box', -.05, 2.04, -.42, .16, .16, .07, '#2b1d12', 0, 0, .12]); break;
    case 7: P.push(['box', .1, 1.35, -.38, .1, 1.3, .03, '#dfe6ec', 0, 0, .55], ['box', -.26, 1.95, -.38, .34, .07, .08, '#f2c230', 0, 0, .55], ['box', -.38, 2.12, -.38, .07, .26, .07, '#6b4423', 0, 0, .55]); break;
    case 8: P.push(['cyl', -.18, 1.3, -.42, .24, .8, .24, '#d0d5da'], ['cyl', .18, 1.3, -.42, .24, .8, .24, '#d0d5da'], ['cone', -.18, 1.84, -.42, .24, .28, .24, '#c62828'], ['cone', .18, 1.84, -.42, .24, .28, .24, '#c62828'], ['cone', -.18, .74, -.42, .18, .34, .18, '#ff9800', Math.PI, 0, 0], ['cone', .18, .74, -.42, .18, .34, .18, '#ff9800', Math.PI, 0, 0]); break;
    case 9: P.push(['cyl', 0, 1.32, -.36, .82, .07, .82, '#b71c1c', 1.57, 0, 0], ['cyl', 0, 1.32, -.4, .5, .05, .5, '#f2c230', 1.57, 0, 0], ['cyl', 0, 1.32, -.43, .18, .05, .18, '#b71c1c', 1.57, 0, 0]); break;
    case 10: P.push(['box', -.75, 1.6, -.45, 1.4, .7, .06, '#1e8a4c', 0, 0, .55], ['box', .75, 1.6, -.45, 1.4, .7, .06, '#1e8a4c', 0, 0, -.55], ['cone', -1.32, 2.0, -.45, .12, .34, .12, '#0f5c2e', 0, 0, .55], ['cone', 1.32, 2.0, -.45, .12, .34, .12, '#0f5c2e', 0, 0, -.55], ['cone', -.9, 1.28, -.45, .12, .3, .12, '#0f5c2e', 0, 0, 2.4], ['cone', .9, 1.28, -.45, .12, .3, .12, '#0f5c2e', 0, 0, -2.4]); break;
    case 4: P.push(['box', -.6, 1.55, -.45, 1.1, .6, .06, '#ffd34d', 0, 0, .45], ['box', .6, 1.55, -.45, 1.1, .6, .06, '#ffd34d', 0, 0, -.45], ['cyl', -.2, 1.2, -.45, .22, .7, .22, '#6b7680'], ['cyl', .2, 1.2, -.45, .22, .7, .22, '#6b7680']); break;
  }
  return P;
}

const limbCache = new Map(), styleCache = new Map();
const okI = (v, n) => Number.isInteger(v) && v >= 0 && v < n ? v : 0;
// geo.npc = شكل واحد مدمج (للواقفين عند بيوتهم)، geo.body/leg/arm = للشخصية اللي تتمشى
export function charGeo(ch, hat = 0, back = 0) {
  ch = okI(ch, CH_ALL); hat = okI(hat, HATS.length); back = okI(back, BACKS.length);
  const key = ch + ':' + hat + ':' + back;
  if (styleCache.has(key)) return styleCache.get(key);
  const s = spec(ch);
  if (!limbCache.has(ch)) limbCache.set(ch, { leg: merge(s.leg), arm: merge(s.arm) });
  const body = [...s.body, ...accParts(ch, hat, back)];
  const npc = merge([
    ...body,
    ...s.leg.map(p => { const q = [...p]; q[1] += -LEG_X; q[2] += HIP; return q; }),
    ...s.leg.map(p => { const q = [...p]; q[1] += LEG_X; q[2] += HIP; return q; }),
    ...s.arm.map(p => { const q = [...p]; q[1] += -ARM_X; q[2] += SHOULDER; return q; }),
    ...s.arm.map(p => { const q = [...p]; q[1] += ARM_X; q[2] += SHOULDER; return q; }),
  ]);
  const g = { npc, body: merge(body), ...limbCache.get(ch), robe: !!s.robe };
  styleCache.set(key, g);
  return g;
}

// شخصية قابلة للتحريك: group فيه الجسم والرجلين واليدين بمفاصلها
export function makeWalker(ch, mats, hat = 0, back = 0) {
  const root = new THREE.Group();
  const add = (parent, geo) => { const m = new THREE.Mesh(geo, mats.body); m.castShadow = true; const o = new THREE.Mesh(geo, mats.line); parent.add(m, o); return [m, o]; };
  const joint = (x, y) => { const j = new THREE.Group(); j.position.set(x, y, 0); root.add(j); return j; };
  const W = { root, legL: joint(-LEG_X, HIP), legR: joint(LEG_X, HIP), armL: joint(-ARM_X, SHOULDER), armR: joint(ARM_X, SHOULDER), meshes: [] };
  W.set = (c, h = 0, b = 0) => {
    W.ch = c; W.key = c + ':' + h + ':' + b; const g = charGeo(c, h, b); W.robe = g.robe;
    for (const m of W.meshes) m.parent.remove(m);
    W.meshes = [...add(root, g.body), ...add(W.legL, g.leg), ...add(W.legR, g.leg), ...add(W.armL, g.arm), ...add(W.armR, g.arm)];
  };
  W.set(ch, hat, back);
  // phase: مرحلة الخطوة، amt: 0 واقف ← 1 يمشي، run: يجري
  W.pose = (phase, amt, t) => {
    const k = W.robe ? .45 : .8, sw = Math.sin(phase) * k * amt;
    W.legL.rotation.x = sw; W.legR.rotation.x = -sw;
    const idle = Math.sin(t * 1.6) * .05 * (1 - amt);
    W.armL.rotation.x = -sw * .9 + idle; W.armR.rotation.x = sw * .9 - idle;
    W.armL.rotation.z = -.06; W.armR.rotation.z = .06;
    W.bob = Math.abs(Math.sin(phase)) * .07 * amt;           // يرفع الجسم كامل مع كل خطوة
  };
  W.bob = 0;
  return W;
}

// ---------- السيارات (واقفة بموقف الساحة — يركبها اللاعب ويسوقها) ----------
// السيارة تطالع باتجاه +z، طولها ~5.5 (الشخصية 2.2)
export const CARS = [
  { t: 'suv', c: '#f4f4f2', n: 'لاندكروزر' }, { t: 'pickup', c: '#d9dde0', n: 'هايلكس' }, { t: 'sedan', c: '#d63c33', n: 'سيدان' },
  { t: 'sport', c: '#ffc21a', n: 'رياضية' }, { t: 'taxi', c: '#f7f7f2', n: 'تاكسي' }, { t: 'suv', c: '#1e2a36', n: 'جيب أسود' },
  { t: 'sedan', c: '#2d6fb8', n: 'سيدان أزرق' }, { t: 'sport', c: '#3aa06a', n: 'رياضية خضراء' },
];
export const CAR_N = CARS.length;
const GL_COL = '#25313c';   // لون قطع الزجاج: تنفصل عن الهيكل وترسم شفافة (يبان اللي جواها)
function carSpec({ t, c }) {
  const GL = GL_COL, DK = '#1d1d1d', HUB = '#c9cdd1';
  const pil = (cx, cy, cz, sx, sy, sz) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ['box', cx + a * sx / 2, cy, cz + b * sz / 2, .16, sy, .16, c]);   // أعمدة الكابينة
  const wheel = (x, z, r) => [['cyl', x, r, z, 2 * r, .38, 2 * r, DK, 0, 0, Math.PI / 2], ['cyl', x + (x > 0 ? .2 : -.2), r, z, r * 1.1, .02, r * 1.1, HUB, 0, 0, Math.PI / 2]];
  const wheels = (hx, hz, r) => [...wheel(-hx, hz, r), ...wheel(hx, hz, r), ...wheel(-hx, -hz, r), ...wheel(hx, -hz, r)];
  const lights = (zf, y, hw) => [['box', -hw, y, zf, .42, .18, .04, '#fff6c8'], ['box', hw, y, zf, .42, .18, .04, '#fff6c8'], ['box', -hw, y, -zf, .42, .16, .04, '#e03a2f'], ['box', hw, y, -zf, .42, .16, .04, '#e03a2f']];
  const bump = (z, y, w) => [['box', 0, y, z, w, .26, .12, DK], ['box', 0, y, -z, w, .26, .12, DK]];
  switch (t) {
    case 'sedan': case 'taxi': return [
      ['box', 0, .8, 0, 2.4, .8, 5.4, c], ['box', 0, 1.55, -.2, 2.0, .7, 2.7, GL], ...pil(0, 1.55, -.2, 2.0, .7, 2.7), ['box', 0, 1.95, -.25, 2.1, .12, 2.4, c],
      ...bump(2.72, .52, 2.3), ...lights(2.71, .98, .8), ...wheels(1.15, 1.7, .45),
      ...(t === 'taxi' ? [['box', 0, 2.17, -.25, .9, .32, .4, '#ffd34d'], ['box', 0, .9, 0, 2.42, .14, 5.0, '#ffd34d']] : [])];
    case 'suv': return [
      ['box', 0, 1.0, 0, 2.5, 1.1, 5.6, c], ['box', 0, 1.92, -.3, 2.3, .75, 3.4, GL], ...pil(0, 1.92, -.3, 2.3, .75, 3.4), ['box', 0, 2.36, -.3, 2.4, .12, 3.3, c],
      ['box', -.8, 2.5, -.3, .1, .12, 3.0, '#5b6670'], ['box', .8, 2.5, -.3, .1, .12, 3.0, '#5b6670'],
      ...bump(2.82, .62, 2.4), ...lights(2.81, 1.25, .85), ...wheels(1.2, 1.8, .55)];
    case 'pickup': return [
      ['box', 0, .95, 0, 2.4, 1.0, 5.8, c], ['box', 0, 1.82, .9, 2.2, .75, 2.0, GL], ...pil(0, 1.82, .9, 2.2, .75, 2.0), ['box', 0, 2.25, .9, 2.3, .12, 1.9, c],
      ['box', 0, 1.47, -1.45, 2.1, .04, 2.6, '#3a3f44'],
      ['box', -1.14, 1.62, -1.45, .12, .35, 2.75, c], ['box', 1.14, 1.62, -1.45, .12, .35, 2.75, c], ['box', 0, 1.62, -2.84, 2.4, .35, .12, c], ['box', 0, 1.62, -.12, 2.4, .35, .12, c],
      ...bump(2.92, .6, 2.3), ...lights(2.91, 1.15, .85), ...wheels(1.2, 1.85, .52)];
    case 'sport': return [
      ['box', 0, .62, 0, 2.5, .55, 5.4, c], ['box', 0, 1.12, -.3, 1.9, .45, 2.2, GL], ...pil(0, 1.12, -.3, 1.9, .45, 2.2), ['box', 0, 1.38, -.3, 2.0, .08, 2.0, c],
      ['box', 0, .9, .4, .4, .02, 4.6, '#ffffff'], ['box', 0, 1.27, -2.5, 2.3, .08, .5, '#1d1d1d'], ['box', -.8, 1.05, -2.5, .1, .35, .1, DK], ['box', .8, 1.05, -2.5, .1, .35, .1, DK],
      ...bump(2.72, .42, 2.4), ...lights(2.71, .72, .85), ...wheels(1.22, 1.65, .42)];
  }
}
const carCache = new Map();
export function carGeo(i) {
  i = Number.isInteger(i) && i >= 0 && i < CAR_N ? i : 0;
  if (!carCache.has(i)) carCache.set(i, merge(carSpec(CARS[i]).filter(p => p[7] !== GL_COL)));
  return carCache.get(i);
}
const glassCache = new Map();
export function carGlassGeo(i) {
  i = Number.isInteger(i) && i >= 0 && i < CAR_N ? i : 0;
  if (!glassCache.has(i)) glassCache.set(i, merge(carSpec(CARS[i]).filter(p => p[7] === GL_COL)));
  return glassCache.get(i);
}

// صور مصغّرة للشخصيات (لواجهة الاختيار) — ترسم مرة وحدة بمحرك صغير مؤقت
let thumbs = null;
export function charThumbs(grad) {
  if (thumbs) return thumbs;
  const w = 120, h = 150;
  let r; try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { try { r = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true }); } catch { thumbs = []; thumbs.hat = []; thumbs.back = []; return thumbs; } }   // جهاز ضعيف: بدون صور مصغّرة بدل ما تنهار اللوحة
  r.setPixelRatio(1); r.setSize(w, h); r.outputColorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight('#ffffff', '#cdb88e', 1.4));
  const d = new THREE.DirectionalLight('#fff4e0', 2); d.position.set(2, 4, 5); s.add(d);
  const cam = new THREE.PerspectiveCamera(30, w / h, .1, 50); cam.position.set(1.6, 1.9, 4.6); cam.lookAt(0, 1.2, 0);
  const mats = charMaterials(grad);
  thumbs = [];
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, ...Array.from({ length: CH_ALL - SKIN_FIRST }, (_, k) => SKIN_FIRST + k)]) {
    const g = charGeo(i).npc, m = new THREE.Mesh(g, mats.body), o = new THREE.Mesh(g, mats.line);
    s.add(m, o); r.render(s, cam); thumbs[i] = r.domElement.toDataURL('image/png'); s.remove(m, o);
  }
  // القبعات (من قدّام) وأشياء الظهر (من ورا)
  thumbs.hat = []; thumbs.back = [];
  for (let v = 1; v < HATS.length; v++) { const g = charGeo(3, v, 0).npc, m = new THREE.Mesh(g, mats.body), o = new THREE.Mesh(g, mats.line); s.add(m, o); cam.position.set(1.1, 2.6, 3.2); cam.lookAt(0, 2.05, 0); r.render(s, cam); thumbs.hat[v] = r.domElement.toDataURL('image/png'); s.remove(m, o); }
  for (let v = 1; v < BACKS.length; v++) { const g = charGeo(3, 0, v).npc, m = new THREE.Mesh(g, mats.body), o = new THREE.Mesh(g, mats.line); s.add(m, o); cam.position.set(-2.4, 2.2, -4.2); cam.lookAt(0, 1.3, 0); r.render(s, cam); thumbs.back[v] = r.domElement.toDataURL('image/png'); s.remove(m, o); }
  r.dispose(); r.forceContextLoss();
  return thumbs;
}
