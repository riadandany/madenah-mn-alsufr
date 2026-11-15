// ================= 💼 الوظائف + 🚔 الشرطة والسجن + 🏥 المستشفى + 🦹 الحرامي الهارب =================
// السيرفر يقرر كل شي (التوظيف، السجن، العلاج، الهدايا، الحرامي)؛ هنا المباني والعرض والأزرار والحبس داخل الزنزانة.
// لازم تطابق server.js: رموز الوظائف (p/d/m)، JAIL_REASONS (6)، PS/HS، THIEF_PATH وسرعته.
import * as THREE from '/vendor/three.module.min.js';

export const JOBS = {
  police: { c: 'p', n: 'شرطي', i: '👮', sup: 'مشرف الشرطة', col: '#1f5fd1', perks: ['🚔 تسجن المخالفين 3 دقايق (بسبب واضح — وفيه اعتراض)', '🚨 صفارة وأضواء على سيارتك', '🛑 توقّف السيارات المسرعة', '👮 زي الشرطة وعلامة فوق راسك', '🦹 تمسك الحرامي وتاخذ 120 🪙 بدل 60'] },
  doctor: { c: 'd', n: 'طبيب', i: '🩺', sup: 'مشرف المستشفى', col: '#0f9d58', perks: ['🩺 تعالج المصابين 🤕 (+5 🪙 لكل علاج)', '🏥 زي الدكتور وعلامة فوق راسك'] },
  gm: { c: 'g', n: 'المدير العام', i: '👔', sup: 'المدير العام', col: '#9a7b18', perks: ['👔 فوق كل مشرفي الوظائف — يقبل الطلبات ويوظّف ويفصل أي موظف أو مشرف', '⭐ يعيّن مشرف الشرطة والمستشفى والمول', '🚔 صلاحيات مشرف الشرطة (يسجن ويطلق ويشوف سجل السجن)', '🤵 بدلة رسمية بكرفتة وعلامة «👔 المدير العام» فوق راسه'] },
  mall: { c: 'm', n: 'موظف المول', i: '🛍️', sup: 'مشرف المول', col: '#e67e22', perks: ['🛒 تبيع أغراض السوق للزوار بخصم 10% وتاخذ عمولة 5% من كل بيعة', '🎁 توزّع هدايا ذهب لزوار المول (+3 🪙 لكل هدية)', '🛍️ علامة موظف المول فوق راسك'] },
};
const BYC = { p: 'police', d: 'doctor', m: 'mall', g: 'gm' };
// قوانين كل وظيفة (تظهر باللوحة وعلى لافتة داخل المبنى) + العقوبة: الفصل = منع من كل الوظائف 3 أيام (السيرفر يطبّقها)
export const RULES = {
  police: { t: '🚔 قوانين الشرطة', col: '#1d3a6b', place: 'مركز الشرطة',
    job: ['تحافظ على النظام وتنظّم المرور 🚦', 'نبّه المخالف بالكلام أول، وبعدين اسجنه بالسبب الصحيح', 'السجن 3 دقايق بس (مشرف الشرطة 5 أو 15) — وأطلقه لو غلطت'],
    no: ['السجن بدون سبب أو للمزح', 'سجن نفس الشخص مرتين باليوم (النظام يمنعها)، أو 3 اعتراضات مقبولة ضدك = توقف صلاحيتك يوم', 'مضايقة الناس أو ملاحقتهم'],
    all: 'للجميع: الإزعاج والتخريب والقيادة المتهورة والكلام السيء = سجن 3 دقايق 🔒 (ولك حق الاعتراض)' },
  doctor: { t: '🏥 قوانين المستشفى', col: '#b3261e', place: 'المستشفى',
    job: ['عالج كل مصاب 🤕 بسرعة وبدون تفرقة', 'ساعد المرضى يوصلون للأسرّة', 'العلاج مجاني دائماً'],
    no: ['طلب ذهب أو أي شي مقابل العلاج', 'تجاهل المرضى أو الاستهزاء فيهم', 'اتفاق مع أحد يتصاوب عشان المكافأة'],
    all: 'للمريض: قف جنب أي سرير 20 ثانية وتتعالج مجاناً 🛏️' },
  mall: { t: '🛍️ قوانين موظفي المول', col: '#c25e00', place: 'المول',
    job: ['ساعد الزوار ورحّب فيهم 😊', 'اعرض أغراض السوق بخصم 10% — والقرار للزائر', 'وزّع هدية المول مرة باليوم لكل زائر 🎁'],
    no: ['الإلحاح والإزعاج بالعروض', 'طلب ذهب أو أغراض من الزوار', 'البيع لنفسك أو التحايل على الهدايا'],
    all: 'للزوار: الشراء اختياري — اضغط «لا شكراً» وقت ما تبي 🙂' },
};
RULES.gm = { t: '👔 قوانين المدير العام', col: '#9a7b18', place: 'المدينة', job: ['يتابع كل الوظائف ويدعم المشرفين', 'يوظّف الشاطرين ويفصل المخالفين بعدل', 'يحل مشاكل الناس مع الموظفين'],
  no: ['الفصل أو السجن بدون سبب', 'المحاباة أو أخذ ذهب مقابل وظيفة', 'استغلال الصلاحيات ضد أحد'], all: 'صاحب المدينة 👑 يراجع كل قراراته' };
export const PENALTY = '⚠️ المخالف: فصل فوري + منع من كل الوظائف 3 أيام';
export const JAIL_REASONS = ['🚗 قيادة متهورة', '📢 إزعاج الناس', '🤬 كلام سيء', '⛏️ تخريب', '😠 مضايقة/ملاحقة', '🚨 مخالفة أوامر الشرطة'];
export const PS = { x0: -112, x1: -28, z0: -158, z1: -116 }, HS = { x0: 18, x1: 60, z0: -158, z1: -116 };
const CELL_W = 9, CELL_X0 = -111.7, CELL_Z0 = -157.7, CELL_Z1 = -148;
export const cellRect = i => { const x0 = CELL_X0 + CELL_W * (i % 6); return { x0, x1: x0 + CELL_W, z0: CELL_Z0, z1: CELL_Z1 }; };
const BEDZ = { x0: 19, x1: 59, z0: -157.5, z1: -148 };
export const THIEF_PATH = [[0, -40], [4, -78], [3, -104], [-10, -124], [-12, -140], [6, -147], [12, -128], [9, -104], [15, -78], [28, -29], [39, -9], [40, 10], [31, 26], [15, 37], [0, 41], [-15, 37], [-28, 28], [-38, 12], [-40, -8], [-31, -26], [-16, -37]];
const TH_LEN = THIEF_PATH.reduce((s, a, i) => { const b = THIEF_PATH[(i + 1) % THIEF_PATH.length]; return s + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0);
export function thiefLocal(d) {   // [x, z, اتجاه]
  d = ((d % TH_LEN) + TH_LEN) % TH_LEN;
  for (let i = 0; i < THIEF_PATH.length; i++) { const a = THIEF_PATH[i], b = THIEF_PATH[(i + 1) % THIEF_PATH.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= l) { const u = l ? d / l : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[0] - a[0], b[1] - a[1])]; } d -= l; }
  return [THIEF_PATH[0][0], THIEF_PATH[0][1], 0];
}
const inR = (r, x, z, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function createJobs(C) {
  const { S, toast, WK, CAR, PEERS, META, plaza, placeAt, netSend, show, textTex, AU, esc } = C;
  const sure = (a, n, x, ok) => window.sure ? window.sure(a, n, x, ok) : Promise.resolve(confirm(a.split('{n}').join(n || '') + '؟'));   // نافذة التأكيد من app.js
  const rowN = t => { const sp = t.closest('.jrow') && t.closest('.jrow').querySelector('span'); return sp ? sp.textContent.replace(/^[🟢⚪]\s*/u, '').split(' • ')[0] : ''; };
  const pN = id => { const p = PEERS.get(id); return p ? p.n : ''; };
  const sfx = (k, ...a) => { try { AU[k] && AU[k](...a); } catch {} };
  const J = { info: null, my: null, jail: null, inj: null, th: null, stopUntil: 0, siren: false, mg: null, tab: 'jobs', appeals: [] };
  const now = () => performance.now();
  const P0 = () => plaza();

  // ================= المباني (ثابتة: تنضاف لقوائم الساحة؛ اللي ارتفاعه ≥ .6 يصير صلب تلقائياً) =================
  J.parts = (P, F) => {
    const { x: ox, z: oz } = P0();
    const b = (x, y, z, w, h, d, col, g = 'box') => P[g].push([ox + x, y, oz + z, w, h, d, 0, col]);
    const wallX = (x0, x1, z, h, col, t = .6) => b((x0 + x1) / 2, .04, z, x1 - x0, h, t, col);
    const wallZ = (z0, z1, x, h, col, t = .6) => b(x, .04, (z0 + z1) / 2, t, h, z1 - z0, col);
    const car = (x, z, body, stripe, light) => {   // سيارة ديكور (شرطة/إسعاف) باتجاه z
      b(x, .25, z, 2.2, 1.05, 4.8, body); b(x, 1.3, z + .4, 1.9, .75, 2.5, '#1d2b36'); b(x, 1.3, z + .4, 2, .08, 2.6, body);
      b(x + 1.11, .65, z, .04, .32, 4.6, stripe, 'flat'); b(x - 1.11, .65, z, .04, .32, 4.6, stripe, 'flat');
      b(x - .4, 2.1, z + .4, .7, .2, .45, light[0]); b(x + .4, 2.1, z + .4, .7, .2, .45, light[1]);
      for (const sx of [-1.05, 1.05]) for (const sz of [-1.6, 1.6]) b(x + sx, .04, z + sz, .3, .55, .8, '#1a1a1a');
    };
    // ----- 🚔 مركز الشرطة -----
    F.push([ox - 70, .04, oz - 137, 84, .07, 42, 0, '#cfd6de']);
    F.push([ox - 70, .04, oz - 113, 10, .06, 6, 0, '#9aa7b5']);   // ممر الباب
    const BL = '#2c4f8a', WH = '#eef1f5';
    wallX(PS.x0, PS.x1, PS.z0, 5, BL); wallZ(PS.z0, PS.z1, PS.x0, 5, BL); wallZ(PS.z0, PS.z1, PS.x1, 5, BL);
    wallX(PS.x0, -74, PS.z1, 5, BL); wallX(-66, PS.x1, PS.z1, 5, BL);
    b(-70, 4.1, PS.z1, 8, .9, .6, BL);   // فوق الباب
    b(-93, 3.3, PS.z1 + .33, 38, .5, .05, WH, 'flat'); b(-47, 3.3, PS.z1 + .33, 38, .5, .05, WH, 'flat');   // خط أبيض
    b(-70, 5.04, PS.z1, 20, 2.6, .5, '#1d3a6b');   // لوحة الواجهة
    // الزنزانات: 6 بجدار خلفي + قضبان
    for (let i = 1; i <= 6; i++) wallZ(CELL_Z0 - .3, CELL_Z1, CELL_X0 + CELL_W * i, 4.2, '#8a96a3', .5);
    for (let i = 0; i < 6; i++) {
      const r = cellRect(i), cx = (r.x0 + r.x1) / 2;
      for (let x = r.x0 + .55; x <= r.x1 - .35; x += .5) b(x, .04, CELL_Z1, .22, 3.3, .22, '#4f5a66');   // 3.3م: ما تقفز فوقها، والكاميرا تشوف من فوقها
      b(cx, 3.3, CELL_Z1, CELL_W, .3, .3, '#4f5a66'); b(cx, .04, CELL_Z1, CELL_W, .18, .3, '#4f5a66');
      b(r.x0 + 1.4, .04, -155.4, 1.7, .5, 3.4, '#9aa5b1'); b(r.x0 + 1.4, .54, -155.4, 1.5, .14, 3.1, '#e8ecef');   // سرير
      b(r.x1 - 1.1, .04, -156.7, .75, .7, .75, '#f4f6f8');   // حمّام صغير
      b(cx, 4.35, CELL_Z1 + .2, 1.6, .7, .05, '#ffd34d', 'flat');
      F.push([ox + cx, .05, oz + (r.z0 + r.z1) / 2, CELL_W - .6, .07, r.z1 - r.z0 - .4, 0, '#b4bcc6']);
    }
    // مكتب + استقبال + كراسي انتظار
    b(-43, .04, -153, 6, 1.1, 1.6, '#7a5533'); b(-43, 1.14, -153, 1.2, .7, .1, '#1d2b36'); b(-43, .04, -155, .9, .9, .9, '#2d3a4a');
    for (let k = 0; k < 4; k++) b(-36 + k * 1.6, .04, -157.2, 1.3, 2.2, .8, '#6f7f91');   // خزائن
    b(-92, .04, -131, 14, 1.15, 1.6, '#e8edf1'); b(-92, 1.19, -131, 14.4, .14, 2, BL);
    for (let k = 0; k < 4; k++) b(-34, .04, -122 - k * 3.4, 1.6, .5, 2.6, '#3d5a80');
    for (let k = 0; k < 3; k++) b(-106, .04, -123 - k * 3.4, 1.6, .5, 2.6, '#3d5a80');
    for (const fx of [-80, -60]) { b(fx, .04, -113, .25, 7, .25, '#8a8f96'); b(fx + 1.1, 5.9, -113, 2.2, 1.2, .08, BL, 'flat'); }
    car(-22, -124, '#f4f6f8', '#1f5fd1', ['#e02424', '#1f5fd1']); car(-22, -137, '#f4f6f8', '#1f5fd1', ['#e02424', '#1f5fd1']);
    // ----- 🏥 المستشفى -----
    F.push([ox + 39, .04, oz - 137, 42, .07, 42, 0, '#eef3f6']); F.push([ox + 39, .04, oz - 113, 10, .06, 6, 0, '#c7d3dc']);
    const HW = '#f6f8fa', RD = '#d6382f';
    wallX(HS.x0, HS.x1, HS.z0, 5, HW); wallZ(HS.z0, HS.z1, HS.x0, 5, HW); wallZ(HS.z0, HS.z1, HS.x1, 5, HW);
    wallX(HS.x0, 35, HS.z1, 5, HW); wallX(43, HS.x1, HS.z1, 5, HW);
    b(39, 4.1, HS.z1, 8, .9, .6, HW); b(39, 5, HS.z1, 13, 3.4, .6, HW);
    b(26.5, 3.3, HS.z1 + .33, 17, .55, .05, RD, 'flat'); b(51.5, 3.3, HS.z1 + .33, 17, .55, .05, RD, 'flat');
    b(39, 6.1, HS.z1 + .34, 3.4, 1.1, .05, RD, 'flat'); b(39, 5.3, HS.z1 + .35, 1.1, 2.7, .05, RD, 'flat');   // الصليب الأحمر
    for (let i = 0; i < 6; i++) {
      const x = 22.5 + i * 6.6;
      b(x, .04, -154, 2, .6, 3.6, '#dfe6ec'); b(x, .64, -153.8, 1.85, .18, 3.1, '#ffffff'); b(x, .82, -155.4, 1.2, .18, .55, '#cfe6ff'); b(x, .83, -153.1, 1.9, .05, 1.8, '#7fb8e8', 'flat');
      b(x + 1.35, .04, -155.4, .07, 2.2, .07, '#9aa5b1'); b(x + 1.35, 2, -155.4, .3, .4, .1, '#bfe3f2', 'flat');
      if (i < 5) b(x + 3.3, .04, -154, .06, 2.4, 4, '#a8d8d0');
    }
    b(30, .04, -128, 10, 1.15, 1.6, '#ffffff'); b(30, 1.19, -128, 10.4, .14, 2, RD);
    for (let k = 0; k < 5; k++) b(47 + (k % 3) * 3.6, .04, -124 - Math.floor(k / 3) * 3.6, 1.4, .5, 1.4, '#7fb8e8');
    car(66, -130, '#ffffff', RD, ['#e02424', '#ffffff']);
  };
  let sg = null;
  function board(R, x, y, z, ry, w) {   // لافتة كبيرة: عنوان + المهام + الممنوع + العقوبة بالأحمر
    const W = 1024, H = 680, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 30); g.fill(); g.lineWidth = 8; g.strokeStyle = R.col; g.stroke();
    g.fillStyle = R.col; g.beginPath(); g.roundRect(4, 4, W - 8, 96, 30); g.fill(); g.fillRect(4, 60, W - 8, 44);
    const fit = (t, sz, mw, wt = 900) => { g.font = wt + ' ' + sz + 'px Cairo, sans-serif'; const m = g.measureText(t).width; if (m > mw) g.font = wt + ' ' + Math.floor(sz * mw / m) + 'px Cairo, sans-serif'; };
    g.textAlign = 'center'; g.fillStyle = '#fff'; fit(R.t, 58, W - 60); g.fillText(R.t, W / 2, 54); g.textAlign = 'right';
    let yy = 136; const R0 = W - 40, line = (t, col, sz = 33, wt = 800) => { g.fillStyle = col; fit(t, sz, W - 80, wt); g.fillText(t, R0, yy); yy += sz * 1.45; };
    line('✅ شغلك:', R.col, 36, 900); for (const t of R.job) line('• ' + t, '#1d2b36');
    yy += 6; line('🚫 ممنوع:', '#b3261e', 36, 900); for (const t of R.no) line('• ' + t, '#1d2b36');
    yy += 8; g.fillStyle = '#d6382f'; g.beginPath(); g.roundRect(28, yy - 34, W - 56, 68, 18); g.fill(); g.textAlign = 'center'; g.fillStyle = '#fff'; fit(PENALTY, 38, W - 100); g.fillText(PENALTY, W / 2, yy + 1); yy += 66;
    g.fillStyle = '#55606c'; fit(R.all, 28, W - 80, 700); g.fillText(R.all, W / 2, Math.min(H - 30, yy + 10));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * H / W), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(x, y, z); m.rotation.y = ry; m.renderOrder = 3; sg.add(m);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(w + .3, w * H / W + .3), new THREE.MeshBasicMaterial({ color: R.col })); fr.position.set(x - Math.sin(ry) * .02, y, z - Math.cos(ry) * .02); fr.rotation.y = ry; sg.add(fr);
  }
  J.signs = () => {
    if (!sg) {
      sg = new THREE.Group(); S.add(sg);
      const sp = (t, bg, fg, w, h, x, y, z) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(t, 1024, 200, bg, fg, 120), transparent: true, depthWrite: false })); s.scale.set(w, h, 1); s.position.set(x, y, z); s.renderOrder = 6; sg.add(s); return s; };
      sp('🚔 مركز الشرطة', '#1d3a6b', '#ffffff', 20, 3.9, -70, 9.5, -116);
      sp('🏥 المستشفى', '#d6382f', '#ffffff', 16, 3.1, 39, 10.6, -116);
      sp('🔒 الزنزانات', '#4f5a66', '#ffd34d', 9, 1.75, -84, 6, -148);
      sp('🛏️ قف جنب السرير 20 ثانية وتتعالج', '#0f9d58', '#ffffff', 12, 2.3, 39, 4.2, -148);
      // لافتات القوانين داخل المباني (x, y, z, اتجاه الوجه، عرض)
      board(RULES.police, -111.5, 2.75, -130, Math.PI / 2, 7.6); board(RULES.doctor, 59.5, 2.75, -134, -Math.PI / 2, 7.6); board(RULES.mall, -129.05, 7.7, -19, -Math.PI / 2, 9.6);
    }
    const p = P0(); sg.position.set(p.x, 0, p.z);
  };

  // ================= الواجهة: ستايل + لوحة 💼 + أشرطة الحالة =================
  const css = document.createElement('style');
  css.textContent = `.jbdg{position:absolute;top:-7px;left:-7px;min-width:17px;height:17px;border-radius:9px;background:#e02424;color:#fff;font:900 11px/17px Cairo,sans-serif;text-align:center;padding:0 3px;font-style:normal;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.jbdg.or{background:#ff8a00}.mkt.jobs{position:relative;border-color:#2c6fd1;background:linear-gradient(180deg,#eaf2ff,#cfe0ff);box-shadow:0 2px 6px rgba(44,111,209,.25)}
#p40 .jtabs{display:flex;gap:6px;margin:0 0 8px}#p40 .jtabs button{flex:1;padding:8px 6px;font-size:14px;border-radius:12px;background:#eef2f7}#p40 .jtabs button.on{background:#2c6fd1;color:#fff}
.jcard{border:2px solid #dbe3ee;border-radius:16px;padding:10px 12px;margin:0 0 8px;background:#fbfcfe}.jcard .jh{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:17px}
.jcard .jh span{font-size:13px;font-weight:800;background:#eef2f7;border-radius:10px;padding:2px 8px}.jcard ul{margin:6px 0;padding:0 18px 0 0;font-size:13px;line-height:1.6}.jcard .jm{font-size:12px;color:#55606c;margin:4px 0 8px}
.jcard button{width:100%}.jrow{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px 2px;border-bottom:1px solid #eef1f5;font-size:14px}.jrow button{padding:6px 10px;font-size:13px;flex:none}
.jsec{font-weight:900;margin:10px 0 4px;color:#1d2b36}#jobHud{position:fixed;left:50%;transform:translateX(-50%);top:calc(var(--t,48px) + 96px);z-index:7;display:none;flex-direction:column;gap:6px;align-items:center;max-width:94vw;pointer-events:none}
#jobHud>div{pointer-events:auto;background:rgba(20,30,45,.9);color:#fff;border-radius:16px;padding:8px 14px;text-align:center;font-weight:800;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.35)}
#jobHud button{margin:6px 4px 0;padding:6px 12px;font-size:13px;border-radius:12px;border:0;font-weight:900}#jobHud .jail{background:rgba(60,64,72,.95);border:2px solid #ffd34d}#jobHud .thf{background:rgba(160,20,30,.92)}
#jobHud .arr{display:inline-block;font-size:20px;transition:transform .2s}#job7{flex-wrap:wrap}#job7 button{flex:1 1 45%}#job7 .jr{font-size:12px;color:#55606c;width:100%;margin:2px 0}
#sirenBtn{position:fixed;left:16px;bottom:calc(max(16px,env(safe-area-inset-bottom)) + 150px);z-index:3;display:none;border:0;border-radius:50%;width:58px;height:58px;font-size:28px;background:#1f5fd1;box-shadow:0 4px 14px rgba(0,0,0,.35)}#sirenBtn.on{background:#e02424}
#p41 .jmk{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:52vh;overflow:auto}#p41 .jmk button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;font-size:12px;border-radius:12px;background:#f6f8fb}#p41 .jmk img{width:46px;height:46px;object-fit:contain}#p41 .jmk s{color:#999;font-size:11px}#p41 .jmk b{color:#0f9d58}
#joBox{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(16px,env(safe-area-inset-bottom)) + 120px);z-index:8;display:none;background:#fff;border-radius:18px;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.35);max-width:92vw;width:340px;text-align:center;font-weight:800}#joBox button{margin:8px 4px 0;padding:8px 16px}
#jpBox{position:fixed;right:12px;top:calc(var(--t,48px) + 46px);z-index:8;display:none;background:#fff;border-radius:16px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);max-width:290px;font-size:14px}`;
  document.head.appendChild(css);
  const pnl = document.createElement('div'); pnl.className = 'panel'; pnl.id = 'p40'; pnl.style.cssText = 'max-height:88vh;overflow:auto';
  pnl.innerHTML = '<h3>💼 الوظائف</h3><div class="jtabs" id="jTabs"></div><div id="jBody"></div><div class="row"><button id="cancel40">إغلاق</button></div>';
  document.body.appendChild(pnl);
  const hud = document.createElement('div'); hud.id = 'jobHud'; document.body.appendChild(hud);
  const sirenBtn = document.createElement('button'); sirenBtn.id = 'sirenBtn'; sirenBtn.textContent = '🚨'; document.body.appendChild(sirenBtn);
  const jpBox = document.createElement('div'); jpBox.id = 'jpBox'; document.body.appendChild(jpBox);
  const sell = document.createElement('div'); sell.className = 'panel'; sell.id = 'p41'; sell.style.cssText = 'max-height:88vh;overflow:auto';
  sell.innerHTML = '<h3 id="slT">🛒 اعرض غرض</h3><div class="info" style="margin:0 0 6px">يوصله العرض بخصم 10%، ولو اشترى تاخذ عمولة 5% 💰</div><div class="jtabs" id="slTabs" style="display:flex;gap:4px;flex-wrap:wrap;margin:0 0 6px"></div><div class="jmk" id="slGrid"></div><div class="row"><button id="cancel41">إغلاق</button></div>';
  document.body.appendChild(sell);
  const joBox = document.createElement('div'); joBox.id = 'joBox'; document.body.appendChild(joBox);
  const $ = id => document.getElementById(id);
  // أزرار الوظيفة داخل بطاقة الشخص (p7)
  const j7 = document.createElement('div'); j7.className = 'row'; j7.id = 'job7'; j7.style.display = 'none';
  { const top = $('p7top'); if (top) top.insertAdjacentElement('afterend', j7); }

  const jobOf = code => code ? BYC[code.toLowerCase()] || null : null;
  const isSup = code => !!code && code !== code.toLowerCase();
  const gmMe = () => !!J.my && J.my.j === 'gm';
  const pol = () => !!J.my && (J.my.j === 'police' || J.my.j === 'gm');
  const totalOpen = () => J.info ? J.info.jobs.reduce((s, x) => s + Math.max(0, x.slots - x.used), 0) : 0;
  J.badge = () => { if (!J.info) return null; if (J.info.rv > 0) return { n: J.info.rv, or: 1 }; if (!J.my && !J.info.app) { const n = totalOpen(); return n > 0 ? { n } : null; } return null; };
  J.chip = () => { const b = J.badge(); return `<span class="mkt jobs" data-jobs="1" title="الوظائف">💼${b ? `<i class="jbdg${b.or ? ' or' : ''}">${b.n > 99 ? '99+' : b.n}</i>` : ''}</span>`; };
  const canManage = () => !!J.info && (J.info.adm || (J.my && (J.my.sup || J.my.j === 'gm')));
  J.open = tab => { ['card', 'p7', 'p18', 'p30', 'p9'].forEach(x => { try { show(x, 0); } catch {} }); J.tab = tab || (J.info && J.info.rv > 0 ? 'mg' : J.my ? 'my' : 'jobs'); show('p40', 1); netSend({ t: 'jb' }); if (J.tab === 'mg') netSend({ t: 'jm' }); render(); };
  $('cancel40').onclick = () => show('p40', 0);
  const isOpen = () => pnl.style.display === 'block';
  function render() {
    if (!isOpen()) return; const I = J.info, mg = canManage();
    $('jTabs').innerHTML = [['jobs', '📋 الوظائف'], ['my', '🪪 وظيفتي'], ...(mg ? [['mg', `🛠️ الإدارة${I.rv ? ' (' + I.rv + ')' : ''}`]] : [])].map(([k, n]) => `<button data-jt="${k}" class="${J.tab === k ? 'on' : ''}">${n}</button>`).join('');
    if (!I) { $('jBody').innerHTML = '<div class="info">جاري التحميل…</div>'; return; }
    let h = '';
    if (J.tab === 'jobs') {
      h += '<div class="info" style="margin:0 0 8px">الوظائف قليلة ومحدودة 🔥 — تقدّم، والمشرف يقبلك. الراتب ينزل كل 10 دقايق وأنت متواجد وتتحرك.</div>';
      for (const x of I.jobs) {
        const D = JOBS[x.id], full = x.used >= x.slots; let btn;
        if (J.my && J.my.j === x.id) btn = `<button disabled>✅ هذي وظيفتك${J.my.sup ? ' (مشرف)' : ''}</button>`;
        else if (I.app === x.id) btn = `<button data-jw="1">⏳ طلبك قيد المراجعة — اضغط تسحبه</button>`;
        else if (J.my) btn = '<button disabled>عندك وظيفة ثانية</button>';
        else if (I.nb > 0) btn = `<button disabled>⛔ ممنوع من الوظائف باقي ${Math.ceil(I.nb / 3600e3)} ساعة (فصل بسبب مخالفة)</button>`;
        else if (!I.home) btn = '<button disabled>🏠 ابنِ بيتك أول عشان تقدّم</button>';
        else if (I.lv < x.lv) btn = `<button disabled>⭐ تحتاج المستوى ${x.lv} (مستواك ${I.lv})</button>`;
        else if (full) btn = '<button disabled>🚫 ممتلئة الحين</button>';
        else btn = `<button class="main" data-ja="${x.id}">📝 قدّم على وظيفة ${D.n}</button>`;
        h += `<div class="jcard"><div class="jh">${D.i} ${D.n}<span>${full ? 'ممتلئة' : 'فاضي ' + (x.slots - x.used)} • ${x.used}/${x.slots}</span></div><ul>${D.perks.map(p => `<li>${p}</li>`).join('')}</ul>
<div class="jm" style="color:#b3261e">🚫 ممنوع: ${RULES[x.id].no.join(' • ')}<br><b>${PENALTY}</b></div><div class="jm">💰 ${x.pay} 🪙 كل 10 دقايق (حد ${x.cap} باليوم) • ⭐ مستوى ${x.lv}+ • ${!x.auto ? '👑 يقبله صاحب المدينة بس' : x.sup ? '⭐ المشرف: ' + esc(x.sup) : 'بدون مشرف: الطلب ينقبل تلقائياً خلال ' + x.auto + ' دقيقة'}</div>${btn}</div>`;
      }
    } else if (J.tab === 'my') {
      if (!J.my) h += '<div class="info">ما عندك وظيفة الحين — قدّم من تبويب «📋 الوظائف» 👆</div>';
      else {
        const D = JOBS[J.my.j];
        h += `<div class="jcard"><div class="jh">${D.i} ${J.my.sup ? D.sup : D.n}<span>اليوم: ${J.my.earn} 🪙</span></div><ul>${D.perks.map(p => `<li>${p}</li>`).join('')}${J.my.sup ? '<li>⭐ تقبل الطلبات وتوظّف وتفصل من تبويب الإدارة</li>' : ''}</ul>
<div class="jm" style="color:#b3261e">✅ ${RULES[J.my.j].job.join(' • ')}<br>🚫 ممنوع: ${RULES[J.my.j].no.join(' • ')}<br><b>${PENALTY}</b>${J.my.j !== 'gm' ? ' — القوانين كاملة على لافتة داخل ' + RULES[J.my.j].place : ''}</div><div class="jm">👆 اضغط على أي شخص (أو اسمه) وتطلع لك أزرار وظيفتك. الراتب ينزل كل 10 دقايق تواجد.</div>
${D.c !== 'm' ? `<button data-jun="${J.my.uni ? 0 : 1}" style="margin-bottom:6px">${J.my.uni ? '👕 شيل زي الوظيفة' : '👮 البس زي الوظيفة'}</button>` : ''}<button class="danger" data-jres="1">🏳️ استقيل من الوظيفة</button></div>`;
      }
    } else if (J.tab === 'mg') {
      const M = J.mg; if (!M) { $('jBody').innerHTML = '<div class="info">جاري التحميل…</div>'; return; }
      const nm = j => (JOBS[j] ? JOBS[j].i + ' ' + JOBS[j].n : j), ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' د' : Math.round(m / 60) + ' س'; };
      h += `<div class="jsec">📥 الطلبات (${M.apps.length})</div>` + (M.apps.length ? M.apps.map(([k, n, j, lv, t]) => `<div class="jrow"><span>${esc(n)} • ${nm(j)} • ⭐${lv} • قبل ${ago(t)}</span><span><button class="main" data-jd="${esc(k)}" data-ok="1">✅</button> <button class="danger" data-jd="${esc(k)}" data-ok="0">❌</button></span></div>`).join('') : '<div class="info">ما فيه طلبات</div>');
      h += `<div class="jsec">👥 الموظفين (${M.emps.length})</div>` + (M.emps.length ? M.emps.map(([k, n, j, sup, on]) => `<div class="jrow"><span>${on ? '🟢' : '⚪'} ${esc(n)} • ${sup ? '⭐ ' + JOBS[j].sup : nm(j)}</span>${(I.adm || (j !== 'gm' && (!sup || gmMe()))) ? `<button class="danger" data-jf="${esc(k)}">❌ افصله</button>` : ''}</div>`).join('') : '<div class="info">ما فيه موظفين</div>');
      if (M.jail.length || M.log.length) {
        h += `<div class="jsec">🔒 المسجونين الحين (${M.jail.length})</div>` + (M.jail.length ? M.jail.map(([k, n, left, r, bn, ap]) => `<div class="jrow"><span>${esc(n)} • ${JAIL_REASONS[r] || ''} • باقي ${mmss(left)} • سجنه ${esc(bn)}${ap ? ' • 📢 اعترض' : ''}</span><button data-jr="${esc(k)}">🔓 أطلقه</button></div>`).join('') : '<div class="info">ما فيه أحد</div>');
        h += '<div class="jsec">📜 سجل السجن (آخر 40)</div>' + (M.log.length ? M.log.map(([t, bn, tn, r, m, rel]) => `<div class="jrow" style="font-size:12px"><span>${esc(bn)} ← سجن ${esc(tn)} ${m}د • ${JAIL_REASONS[r] || ''}${rel ? ' • 🔓 ' + esc(rel) : ''}</span><span>${ago(t)}</span></div>`).join('') : '<div class="info">فاضي</div>');
      }
      if (I.adm) h += '<div class="jsec">💼 عدد المقاعد بكل قسم</div>' + I.jobs.filter(x => x.id !== 'gm').map(x => `<div class="jrow"><span>${JOBS[x.id].i} ${JOBS[x.id].n} • ${x.used} موظف</span><span><button data-jsl="${x.id}" data-d="-1">➖</button> <b style="display:inline-block;min-width:28px;text-align:center">${x.slots}</b> <button data-jsl="${x.id}" data-d="1">➕</button></span></div>`).join('');
      if (M.th) h += `<div class="jsec">🦹 فعالية الحرامي</div><div class="jrow"><span>${M.th.on ? '🚨 شغّالة الحين' : 'الجاية بعد ' + Math.ceil(M.th.next / 60000) + ' دقيقة'}</span>${M.th.on ? '' : '<button class="main" data-thn="1">🦹 ابدأها الحين</button>'}</div>`;
      h += '<div class="info" style="margin-top:8px">💡 للتوظيف المباشر أو تعيين مشرف: اضغط على الشخص نفسه باللعبة.</div>';
    }
    $('jBody').innerHTML = h;
  }
  pnl.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t || t.disabled) return; const d = t.dataset;
    if (d.jt) { J.tab = d.jt; if (d.jt === 'mg') netSend({ t: 'jm' }); render(); return; }
    if (d.ja) { netSend({ t: 'ja', j: d.ja }); return; }
    if (d.jw) { netSend({ t: 'jw' }); return; }
    if (d.jres) { sure('الاستقالة من وظيفتك', '', 'بترجع شخص عادي وتفقد امتيازات الوظيفة', 'نعم، أستقيل').then(y => { if (y) netSend({ t: 'jw', q: 'res' }); }); return; }
    if (d.jun !== undefined) { netSend({ t: 'jun', on: d.jun === '1' }); return; }
    if (d.jd) { netSend({ t: 'jd', k: d.jd, ok: d.ok === '1' }); return; }
    if (d.jf) { sure('فصل {n} من وظيفته', rowN(t), 'بسبب مخالفة — بينمنع من كل الوظائف 3 أيام', 'نعم، افصله').then(y => { if (y) netSend({ t: 'jf', k: d.jf }); }); return; }
    if (d.jr) { netSend({ t: 'jr', k: d.jr }); return; }
    if (d.jsl) { const x = J.info.jobs.find(q => q.id === d.jsl); if (x) netSend({ t: 'jsl', j: d.jsl, n: Math.max(0, x.slots + (+d.d)) }); return; }
    if (d.thn) { netSend({ t: 'thn' }); setTimeout(() => netSend({ t: 'jm' }), 600); return; }
  });

  // ================= بطاقة الشخص: أزرار حسب وظيفتي ووظيفته =================
  let cardId = null, cardMode = '';
  J.card = id => { cardId = id || null; cardMode = ''; paintCard(); };
  function paintCard() {
    const p = cardId && PEERS.get(cardId), me = cardId && META.get(cardId);
    if (!p || !me || !J.info) { j7.style.display = 'none'; j7.innerHTML = ''; return; }
    const adm = !!J.info.adm, tj = jobOf(me.j), tsup = isSup(me.j), f = me.f | 0, B = [];
    if (cardMode === 'jail') {
      const long = adm || gmMe() || (J.my && J.my.sup && J.my.j === 'police');
      j7.innerHTML = `<div class="jr">🚔 اختر سبب السجن (${J.info.jm || 5} دقايق${long ? '، أو 15 دقيقة للمخالفة الكبيرة' : ''}):</div>` + JAIL_REASONS.map((r, i) => `<button data-jj="${i}" data-m="5">${r}</button>`).join('') + (long ? JAIL_REASONS.map((r, i) => `<button data-jj="${i}" data-m="15" class="danger">${r} • 15د</button>`).join('') : '') + '<button data-jx="1">رجوع</button>';
      j7.style.display = 'flex'; return;
    }
    if (cardMode === 'hire' || cardMode === 'sup') {
      j7.innerHTML = `<div class="jr">${cardMode === 'hire' ? '✅ وظّفه كـ:' : '⭐ عيّنه مشرف على:'}</div>` + Object.entries(JOBS).filter(([k]) => k !== 'gm' || (cardMode === 'hire' && adm)).map(([k, D]) => `<button data-${cardMode === 'hire' ? 'jh' : 'js'}="${k}">${D.i} ${cardMode === 'hire' ? D.n : D.sup}</button>`).join('') + '<button data-jx="1">رجوع</button>';
      j7.style.display = 'flex'; return;
    }
    if (f & 4) { if (adm || pol()) B.push(['jr', '🔓 أطلقه من السجن']); }
    else if (adm || pol()) B.push(['jj', '🚔 اسجنه']);
    if ((adm || pol()) && p.v >= 0 && !p.seat) B.push(['jst', '🛑 أوقف سيارته']);
    if ((adm || (J.my && J.my.j === 'doctor')) && (f & 1)) B.push(['jhl', '🩺 عالجه']);
    if (J.my && J.my.j === 'mall') { if (me.h) B.push(['jsell', '🛒 اعرض عليه غرض']); B.push(['jg', '🎁 أعطه هدية المول']); }
    if (me.h) {
      if (!tj) { if (adm || gmMe()) B.push(['jhire', '✅ وظّفه…']); else if (J.my && J.my.sup) B.push(['jh1', `✅ وظّفه ${JOBS[J.my.j].n}`]); }
      else if (adm || (tj !== 'gm' && ((gmMe()) || (!tsup && J.my && J.my.sup && J.my.j === tj)))) B.push(['jf', `❌ افصله من ${tsup ? JOBS[tj].sup : 'وظيفة ' + JOBS[tj].n}`]);
      if ((adm || gmMe()) && tj !== 'gm') B.push(tsup ? ['jsx', `⭐ شيل رتبة ${JOBS[tj].sup}`] : ['jsup', '⭐ عيّنه مشرف وظيفة…']);
      if (adm) B.push(tj === 'gm' ? ['jsx', '👔 شيل رتبة المدير العام'] : ['jgm', '👔 عيّنه المدير العام']);
    }
    const info = tj ? `<div class="jr">${f & 4 ? '🔒 مسجون الحين • ' : ''}${JOBS[tj].i} ${tsup ? JOBS[tj].sup : JOBS[tj].n}${f & 1 ? ' • 🤕 مصاب' : ''}</div>` : (f & 5 ? `<div class="jr">${f & 4 ? '🔒 مسجون الحين' : ''}${f & 1 ? ' 🤕 مصاب' : ''}</div>` : '');
    j7.innerHTML = info + B.map(([k, t]) => `<button data-jc="${k}" class="${k === 'jj' || k === 'jf' || k === 'jsx' ? 'danger' : ''}">${t}</button>`).join('');
    j7.style.display = B.length || info ? 'flex' : 'none';
  }
  j7.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t || !cardId) return; const d = t.dataset, id = cardId;
    if (d.jx) { cardMode = ''; return paintCard(); }
    if (d.jj !== undefined) { sure('سجن {n} ' + d.m + ' دقايق', pN(id), 'السبب: ' + (JAIL_REASONS[+d.jj] || ''), 'نعم، اسجنه').then(y => { if (!y) return; netSend({ t: 'jj', f: id, r: +d.jj, m: +d.m }); show('p7', 0); }); return; }
    if (d.jh) { netSend({ t: 'jh', f: id, j: d.jh }); show('p7', 0); return; }
    if (d.js) { netSend({ t: 'js', f: id, j: d.js }); show('p7', 0); return; }
    switch (d.jc) {
      case 'jj': cardMode = 'jail'; return paintCard();
      case 'jhire': cardMode = 'hire'; return paintCard();
      case 'jsup': cardMode = 'sup'; return paintCard();
      case 'jh1': netSend({ t: 'jh', f: id, j: J.my.j }); break;
      case 'jsx': sure('شيل رتبة {n}', pN(id), 'يرجع موظف عادي').then(y => { if (y) netSend({ t: 'js', f: id, j: null }); }); return;
      case 'jgm': sure('تعيين {n} المدير العام', pN(id), 'لو فيه مدير عام ثاني تنشال منه الرتبة').then(y => { if (y) netSend({ t: 'js', f: id, j: 'gm' }); }); return;
      case 'jr': netSend({ t: 'jr', f: id }); break;
      case 'jst': sure('إيقاف {n} (فرامل 4 ثواني)', pN(id), '').then(y => { if (y) { netSend({ t: 'jst', f: id }); sfx('whistle'); } }); return;
      case 'jhl': netSend({ t: 'jhl', f: id }); break;
      case 'jg': netSend({ t: 'jg', f: id }); break;
      case 'jsell': { const pp = PEERS.get(id); show('p7', 0); openSell(id, pp ? pp.n : ''); return; }
      case 'jf': sure('فصل {n} من وظيفته', pN(id), 'بسبب مخالفة — بينمنع من كل الوظائف 3 أيام', 'نعم، افصله').then(y => { if (y) netSend({ t: 'jf', f: id }); }); return;
      default: return;
    }
    show('p7', 0);
  });
  // ===== 🛒 بيع موظف المول: اختيار غرض من السوق وعرضه =====
  const SCATS = [['skin', '🧍 سكنات'], ['hat', '🎩 قبعات'], ['back', '🎒 الظهر'], ['tag', '🏷️ شارات'], ['house', '🏠 البيت'], ['yard', '🌴 الحوش'], ['service', '⏩ خدمات']];
  let sellTo = null, sellCat = 'hat';
  function openSell(id, n) { sellTo = id; $('slT').textContent = '🛒 اعرض غرض على ' + (n || ''); show('p41', 1); if (!(C.mkList && C.mkList())) { netSend({ t: 'mkl' }); setTimeout(paintSell, 700); setTimeout(paintSell, 1800); } paintSell(); }
  function paintSell() {
    if (sell.style.display !== 'block') return; const L = (C.mkList && C.mkList()) || null;
    $('slTabs').innerHTML = SCATS.map(([k, t]) => `<button data-sc="${k}" class="${sellCat === k ? 'on' : ''}" style="flex:1 1 30%">${t}</button>`).join('');
    if (!L) { $('slGrid').innerHTML = '<div class="info">جاري فتح السوق…</div>'; return; }
    const list = L.filter(it => it.cat === sellCat && it.i !== 'rename').sort((a, b) => a.p - b.p);
    $('slGrid').innerHTML = list.map(it => `<button data-si="${esc(it.i)}">${C.mkThumb ? C.mkThumb(it) : ''}<span>${esc(it.n)}</span><s>🪙 ${it.p.toLocaleString('en')}</s><b>🪙 ${Math.ceil(it.p * .9).toLocaleString('en')}</b></button>`).join('') || '<div class="info">فاضي</div>';
  }
  sell.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return; if (t.id === 'cancel41') { show('p41', 0); return; } if (t.dataset.sc) { sellCat = t.dataset.sc; paintSell(); return; } if (t.dataset.si && sellTo) { netSend({ t: 'jo', f: sellTo, i: t.dataset.si }); show('p41', 0); } });
  let offer = null, offerT = null;
  function showOffer(m) {
    offer = m; clearTimeout(offerT); offerT = setTimeout(() => { offer = null; joBox.style.display = 'none'; }, 55000);
    joBox.innerHTML = `🛍️ ${esc(m.n)} (موظف المول) يعرض عليك<div style="font-size:17px;margin:4px 0">«${esc(m.nm)}»</div><div>بـ 🪙 ${m.p.toLocaleString('en')} <s style="color:#999">${m.op.toLocaleString('en')}</s> • خصم 10%</div><button class="main" data-jy="1">✅ اشترِ</button><button data-jy="0">❌ لا شكراً</button>`;
    joBox.style.display = 'block'; sfx('door');
  }
  joBox.addEventListener('click', e => { const t = e.target.closest('[data-jy]'); if (!t || !offer) return; netSend({ t: 'jy', ok: t.dataset.jy === '1' }); offer = null; clearTimeout(offerT); joBox.style.display = 'none'; });
  // اسم الشخص فوق راسه: سطر الوظيفة/الحالة
  J.label = me => { if (!me) return null; const f = me.f | 0; if (f & 4) return ['🔒 مسجون', '#4f5a66']; const j = jobOf(me.j); if (!j) return null; const D = JOBS[j]; return [j === 'gm' ? '👔 المدير العام' : isSup(me.j) ? '⭐ ' + D.sup : D.i + ' ' + D.n, D.col]; };
  const UNI = { police: 16, doctor: 18, gm: 28 };
  J.myCh = ch => (J.my && J.my.uni && UNI[J.my.j] !== undefined ? UNI[J.my.j] : ch);   // زي الوظيفة على شخصيتي أنا
  J.namePrefix = me => (me && (me.f & 1) ? '🤕 ' : '');

  // ================= الحبس + الإصابة + الأوامر =================
  J.jailed = () => !!J.jail;
  J.cellPos = () => { const p = P0(), r = cellRect(J.jail ? J.jail.cell : 0); return { x: p.x + (r.x0 + r.x1) / 2 + 1.5, z: p.z + r.z1 - 2.2 }; };   // قدّام القضبان (يطالع برّا)
  J.clamp = pp => {   // المسجون ما يطلع من زنزانته
    if (!J.jail) return; const p = P0(), r = cellRect(J.jail.cell), lx = pp.x - p.x, lz = pp.z - p.z;
    if (!inR(r, lx, lz, 6)) { const c = J.cellPos(); pp.x = c.x; pp.z = c.z; return; }
    pp.x = p.x + Math.max(r.x0 + .85, Math.min(r.x1 - .85, lx)); pp.z = p.z + Math.max(r.z0 + .7, Math.min(r.z1 - .75, lz));
  };
  J.inj = () => !!J.injury && J.injury.until > now();
  J.spd = () => (J.inj() ? .6 : 1);
  J.noCar = () => { if (J.jail) { toast('🔒 أنت مسجون — ما تقدر تسوق'); return true; } if (J.inj()) { toast('🤕 أنت مصاب — ما تقدر تسوق. روح 🏥 المستشفى أو اطلب طبيب'); return true; } return false; };
  J.stopNow = () => now() < J.stopUntil;
  J.crash = () => {};   // حوادث السيارة ما عاد تصيب (طلب صاحب المدينة) — الإصابة بس من الموت بعالم البناء
  J.hurt = s => { if (!J.inj() && !J.jail) netSend({ t: 'jin', s: s | 0 }); };
  function toCell() { if (C.leaveAll) C.leaveAll(); if (C.ensureWalk) C.ensureWalk(); const c = J.cellPos(); placeAt(c.x, c.z, 0); }   // يطالع للقضبان (+z) والكاميرا ورا عند الجدار

  J.onNet = m => {
    switch (m.t) {
      case 'jb': {
        const first = !J.info; J.info = m; J.my = m.my; if (!J.my) J.siren = false; C.updCount && C.updCount(); C.syncWalker && C.syncWalker(); render(); paintCard();
        if (first && !J.my && !m.app && totalOpen() > 0) { let td = ''; try { td = new Date().toISOString().slice(0, 10); if (localStorage.getItem('mnalsifr_jobnote') === td) td = ''; else localStorage.setItem('mnalsifr_jobnote', td); } catch {}
          if (td) setTimeout(() => { if (!J.my && J.info) (window.tip || toast)('💼 وظائف متاحة: ' + J.info.jobs.filter(x => x.slots > x.used).map(x => JOBS[x.id].i + ' ' + JOBS[x.id].n + ' (' + (x.slots - x.used) + ')').join(' • ') + ' — اضغط 💼 فوق وقدّم!'); }, 9000); }
        if (J.info.rv > 0 && isOpen() && J.tab === 'mg') netSend({ t: 'jm' });
        return true;
      }
      case 'jl': {
        if (m.on) {
          const was = J.jail; J.jail = { until: now() + m.left, r: m.r, bn: m.bn, cell: m.cell | 0, ap: !!m.ap, bail: m.bail || 100 };
          if (!was) { sfx('cuff'); toast(`🚔 انسجنت ${Math.ceil(m.left / 60000)} دقايق — السبب: ${JAIL_REASONS[m.r] || ''} (سجنك ${m.bn})`); }
          toCell();
        } else if (J.jail) { J.jail = null; const p = P0(); placeAt(p.x - 70, p.z - 110, 0); sfx('door'); toast('🔓 طلعت من السجن' + (m.by ? ' — ' + (m.by === 'كفالة' ? 'بالكفالة' : 'أطلقك ' + m.by) : '') + ' — التزم بالنظام 👮'); }
        paintHud(true); return true;
      }
      case 'jx': toast(m.m || ''); if (m.win) sfx('win'); if (m.rv && isOpen() && J.tab === 'mg') netSend({ t: 'jm' }); return true;
      case 'jm': J.mg = m; render(); return true;
      case 'jof': showOffer(m); return true;
      case 'jfull': {   // الوظيفة ممتلئة: مين بينشال بدال مين؟
        const D = JOBS[m.j] || { n: '' };
        if (confirm(`💼 وظيفة ${D.n} ممتلئة (${m.used}/${m.slots})

سيتم إزالة «${m.rn}»${m.on ? '' : ' (غايب)'} بدل «${m.n}» — موافق؟

(أو زِد المقاعد من 💼 ← الإدارة ➕)`)) {
          if (m.f) netSend({ t: 'jh', f: m.f, j: m.j, rep: m.rk }); else if (m.a) netSend({ t: 'jd', k: m.a, ok: true, rep: m.rk });
        } else toast(`ما تغيّر شي — وظيفة ${D.n} ممتلئة (${m.used}/${m.slots})، تقدر تزيد المقاعد ➕ من 💼 ← الإدارة`);
        return true;
      }
      case 'jpn': J.appeals = J.appeals.filter(a => a.k !== m.k); J.appeals.push(m); if (J.appeals.length > 5) J.appeals.shift(); sfx('door'); paintAppeals(); return true;
      case 'jst': J.stopUntil = now() + 4000; sfx('whistle'); toast(`👮 الشرطي ${m.n} يطلب منك توقف سيارتك 🛑`); return true;
      case 'jhl':
        if (!m.on && m.q) { if (J.injury) { J.injury = null; bedT = 0; paintHud(true); } return true; }   // تأكيد من السيرفر بعد الاتصال: أنت سليم (بدون رسالة)
        if (m.on && m.back) { J.injury = { until: now() + m.left }; bedT = 0; paintHud(true); return true; }   // رجعت للعبة وأنت مصاب: تكمل الإصابة
        if (m.on) { J.injury = { until: now() + m.left }; if (CAR.on && C.leaveCar) C.leaveCar(); toast(m.s === 1 ? '🤕 انصبت بعالم البناء — مشيك أبطأ. روح 🏥 المستشفى أو اطلب طبيب' : '🤕 انصبت من الصدمة! مشيك أبطأ وما تقدر تسوق — روح 🏥 المستشفى أو اطلب طبيب'); }
        else { J.injury = null; sfx('win'); toast(m.n ? `🩺 عالجك الطبيب ${m.n} — صرت بخير 💪` : '🏥 تعالجت — صرت بخير 💪'); }
        bedT = 0; paintHud(true); return true;
      case 'th':
        if (m.on) { const was = !!J.th; J.th = { t0: m.t0, o: m.o, d: m.d, sp: m.sp }; if (!was) { sfx('siren'); toast('🚨 حرامي هارب بالساحة! أول واحد يمسكه ياخذ 60 🪙 (الشرطي 120 🪙) 🦹'); } }
        else { if (J.th && m.esc) toast('🦹 الحرامي هرب! المرة الجاية امسكوه 💨'); J.th = null; }
        paintHud(true); return true;
      case 'thw': if (m.id === (C.myId && C.myId())) { sfx('win'); toast('🎉 مسكت الحرامي! 🦹🚔'); } else toast(`🚔 ${m.n} مسك الحرامي!${m.pol ? ' (شرطي 👮)' : ''}`); return true;
    }
    return false;
  };
  function paintAppeals() {
    if (!J.appeals.length) { jpBox.style.display = 'none'; return; }
    jpBox.innerHTML = '<b>📢 اعتراضات على السجن</b>' + J.appeals.map(a => `<div class="jrow"><span>${esc(a.n)} • ${JAIL_REASONS[a.r] || ''} • سجنه ${esc(a.bn)}</span><span><button data-ak="${esc(a.k)}">🔓</button> <button data-ax="${esc(a.k)}">✖</button></span></div>`).join('');
    jpBox.style.display = 'block';
  }
  jpBox.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return; const k = t.dataset.ak || t.dataset.ax; if (t.dataset.ak) netSend({ t: 'jr', k }); J.appeals = J.appeals.filter(a => a.k !== k); paintAppeals(); });
  hud.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.hp) { netSend({ t: 'jp' }); if (J.jail) J.jail.ap = true; paintHud(true); }
    else if (t.dataset.hb) { sure(`دفع كفالة ${J.jail ? J.jail.bail : 100} 🪙`, '', 'تطلع من السجن الحين', 'نعم، ادفع').then(y => { if (y) netSend({ t: 'jbl' }); }); }
    else if (t.dataset.hh) { if (J.jail) return; if (C.leaveAll) C.leaveAll(); const p = P0(); placeAt(p.x + 39, p.z - 150, Math.PI); toast('🏥 وصلت المستشفى — قف جنب السرير 20 ثانية'); }
  });
  sirenBtn.onclick = () => { J.siren = !J.siren; netSend({ t: 'jsr', on: J.siren }); sirenBtn.classList.toggle('on', J.siren); if (J.siren) sfx('siren'); };

  // ================= الإطار =================
  let hudT = 0, hudKey = '', bedT = 0, bedSend = 0, thW = null, thLab = null, thPhase = 0, sirT = 0, catchT = 0;
  const lightGeo = new THREE.BoxGeometry(.7, .22, .45), lightR = new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), lightB = new THREE.MeshBasicMaterial({ color: '#2a6bff' }), lightOff = new THREE.MeshBasicMaterial({ color: '#3a3f46' });
  function lightBar(g) { if (g.userData.lb) return g.userData.lb; const lb = new THREE.Group(), a = new THREE.Mesh(lightGeo, lightR), b = new THREE.Mesh(lightGeo, lightB); a.position.x = -.38; b.position.x = .38; lb.add(a, b); lb.position.set(0, 2.05, .2); lb.userData.a = a; lb.userData.b = b; g.add(lb); g.userData.lb = lb; return lb; }
  function flash(lb, t, on) { lb.visible = on; if (!on) return; const k = Math.floor(t * 6) % 2; lb.userData.a.material = k ? lightR : lightOff; lb.userData.b.material = k ? lightOff : lightB; }
  function paintHud(force) {
    const rows = [];
    if (J.jail) { const left = J.jail.until - now(); rows.push(`<div class="jail">🔒 مسجون — باقي ${mmss(left)}<div style="font-size:12px;opacity:.9">${JAIL_REASONS[J.jail.r] || ''} • سجنك ${esc(J.jail.bn || '')}</div><button data-hp="1" ${J.jail.ap ? 'disabled' : ''} style="background:#ffd34d">${J.jail.ap ? '📢 انرسل اعتراضك' : '📢 اعتراض'}</button><button data-hb="1" style="background:#fff">💰 كفالة ${J.jail.bail} 🪙</button></div>`); }
    if (J.inj()) { const left = J.injury.until - now(); rows.push(`<div>🤕 مصاب — باقي ${mmss(left)}${bedT > 0 ? ' • 🛏️ تتعالج ' + Math.floor(bedT) + '/20' : ''}<div style="font-size:12px;opacity:.9">مشيك أبطأ • الطبيب 🩺 يعالجك أو قف جنب سرير بالمستشفى</div>${J.jail ? '' : '<button data-hh="1" style="background:#fff">🏥 خذني للمستشفى</button>'}</div>`); }
    if (J.th && !J.jail) { const th = thPos(); const p = P0(); let d = 0, ang = 0; if (WK.on && th) { const dx = p.x + th[0] - WK.p.x, dz = p.z + th[1] - WK.p.z; d = Math.hypot(dx, dz); ang = Math.atan2(dx, dz) - (WK.camYaw + Math.PI); }
      rows.push(`<div class="thf">🚨 حرامي هارب بالساحة! ${WK.on ? `<span class="arr" style="transform:rotate(${(-ang * 180 / Math.PI).toFixed(0)}deg)">⬆️</span> ${Math.round(d)} م` : ''}<div style="font-size:12px;opacity:.95">قرّب منه وامسكه 🦹 • باقي ${mmss(J.th.t0 + J.th.d - C.serverNow())}</div></div>`); }
    const html = rows.join(''); if (!force && html === hudKey) return; hudKey = html; hud.innerHTML = html; hud.style.display = rows.length ? 'flex' : 'none';
  }
  const thPos = () => J.th ? thiefLocal(J.th.o + J.th.sp * (C.serverNow() - J.th.t0) / 1000) : null;
  J.frame = (dt, t) => {
    const p = P0();
    if (sg) sg.position.set(p.x, 0, p.z);
    // الحبس
    if (J.jail && J.jail.until < now() - 4000) netSend({ t: 'jb' });   // احتياط لو ضاعت رسالة الطلوع
    // الإصابة: سرير المستشفى
    if (J.inj() && WK.on && !CAR.on && inR(BEDZ, WK.p.x - p.x, WK.p.z - p.z)) { bedT += dt; if (bedT >= 20 && now() - bedSend > 3000) { bedSend = now(); netSend({ t: 'jhb' }); } } else bedT = 0;
    if (J.injury && !J.inj()) { J.injury = null; paintHud(true); }
    // الصفارة: زري + أضواء سيارتي + سيارات الشرطة الثانية + الصوت
    const drv = WK.on && CAR.on && pol(); const sd = drv ? 'block' : 'none'; if (sirenBtn.style.display !== sd) sirenBtn.style.display = sd;
    if (!drv && J.siren) { J.siren = false; sirenBtn.classList.remove('on'); }
    if (CAR.on && CAR.car && CAR.car.g) { if (J.siren) flash(lightBar(CAR.car.g), t, true); else if (CAR.car.g.userData.lb) CAR.car.g.userData.lb.visible = false; }
    let near = J.siren ? 0 : 1e9;
    for (const q of PEERS.values()) { const me = META.get(q.id), on = !!me && (me.f & 2) && !!q.car; if (q.car) { if (on) flash(lightBar(q.car), t, true); else if (q.car.userData.lb) q.car.userData.lb.visible = false; } if (on && WK.on) near = Math.min(near, Math.hypot(q.x - WK.p.x, q.z - WK.p.z)); }
    if (near < 70 && t - sirT > .66) { sirT = t; sfx('siren', Math.max(.15, 1 - near / 70)); }
    // الحرامي
    const th = J.th && thPos(), vis = !!th && Math.hypot(p.x - (WK.on ? WK.p.x : p.x), p.z - (WK.on ? WK.p.z : p.z)) < 420;
    if (vis) {
      if (!thW && C.makeWalker) { thW = C.makeWalker(19, C.CM, 9, 1); thW.root.rotation.order = 'YXZ'; S.add(thW.root); thLab = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('🦹 حرامي! امسكه', 512, 128, '#c2261c', '#ffffff', 66), transparent: true, depthWrite: false, depthTest: false })); thLab.renderOrder = 9; S.add(thLab); }
      if (thW) {
        const x = p.x + th[0], z = p.z + th[1], y = C.groundAt ? C.groundAt(x, z) : .3; thPhase += dt * 13; thW.pose(thPhase, 1, t);
        thW.root.position.set(x, y + (thW.bob || 0), z); thW.root.rotation.y = th[2]; thW.root.visible = true;
        const d = WK.on ? Math.hypot(WK.p.x - x, WK.p.z - z) : 60, ds = Math.max(1, d / 35); thLab.visible = true; thLab.position.set(x, y + 3.2 + .6 * (ds - 1), z); thLab.scale.set(4.2 * ds, 1.05 * ds, 1);
        if (WK.on && !WK.intro && !J.jail && d < 2.8 && now() - catchT > 900) { catchT = now(); netSend({ t: 'thc' }); }
      }
    } else if (thW) { thW.root.visible = false; thLab.visible = false; }
    if (t - hudT > .5) { hudT = t; paintHud(false); }
  };
  J.spot = () => { const p = P0(); return { x: p.x - 70, z: p.z - 110 }; };
  return J;
}
