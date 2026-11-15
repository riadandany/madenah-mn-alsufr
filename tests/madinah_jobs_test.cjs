// اختبار الوظائف + الشرطة والسجن + المستشفى + هدية المول + الحرامي (سيرفر فقط)
// node tests/madinah_jobs_test.cjs server.js
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_jobs_houses.json'), PORT = 3984, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-jobs';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'jobs.json', 'craft.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name, days) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devA-xxxxxxxx', 'شرطيا', 3), hs('h000000002', 1, 'devD-xxxxxxxx', 'دكتورا', 3), hs('h000000003', 2, 'devM-xxxxxxxx', 'مولا', 3),
  hs('h000000004', 3, 'devL-xxxxxxxx', 'جديدا', 1), hs('h000000005', 4, 'devP-xxxxxxxx', 'شرطيب', 3), hs('h000000006', 5, 'devT-xxxxxxxx', 'صيادا', 3), hs('h000000007', 6, 'devG-xxxxxxxx', 'مديرا', 5)]));
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, JOB_TICK_MS: '300', JAIL_MS: '6000', THIEF_MIN: '999' }, stdio: ['ignore', 'pipe', 'inherit'] });
let ipN = 1;
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.0.' + (ipN++) + '.7' } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) c.inbox.push(JSON.parse(s)); } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined && !c ? '  → ' + x : '')); };
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const PZ = 8 * 78;   // مركز الساحة (6 بيوت → 48 مربع → maxR 3)
const at = (c, x, z, v = -1) => c.send({ t: 'p', x, z: PZ + z, y: 0, r: 0, m: 1, v });
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(350); at(c, 0, -60); c.id = last(c, m => m.t === 'me').id; c.ka = setInterval(() => { if (!c.sock.destroyed) c.send({ t: 'jb' }); }, 4000); return c; };   // نبقى متصلين (السيرفر يقطع اللي ساكت 20ث)
const metaOf = (c, id) => c.inbox.filter(m => m.t === 's' && m.m).flatMap(m => m.m).filter(r => r[0] === id).pop();
const jb = c => last(c, m => m.t === 'jb');
const toast = (c, re) => last(c, m => (m.t === 'jx' || m.t === 'err') && re.test(m.m || ''));
const ecoEv = (c, re) => last(c, m => m.t === 'eco' && m.ev && re.test(m.ev));
const step = () => wait(320);
const keyOfName = () => '';
// نفس المسار بالسيرفر/العميل
const TP = [[0, -40], [4, -78], [3, -104], [-10, -124], [-12, -140], [6, -147], [12, -128], [9, -104], [15, -78], [28, -29], [39, -9], [40, 10], [31, 26], [15, 37], [0, 41], [-15, 37], [-28, 28], [-38, 12], [-40, -8], [-31, -26], [-16, -37]];
const TL = TP.reduce((s, a, i) => { const b = TP[(i + 1) % TP.length]; return s + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0);
function thiefAt(d) { d = ((d % TL) + TL) % TL; for (let i = 0; i < TP.length; i++) { const a = TP[i], b = TP[(i + 1) % TP.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= l) { const u = l ? d / l : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; } d -= l; } return TP[0]; }

srv.stdout.once('data', async () => {
  await wait(700);
  const A = await mk('devA-xxxxxxxx'), D = await mk('devD-xxxxxxxx'), M = await mk('devM-xxxxxxxx'), L = await mk('devL-xxxxxxxx'), P = await mk('devP-xxxxxxxx'), T = await mk('devT-xxxxxxxx');
  const V = await mk('devV-visitor1', 'زائر'), AD = await mk('devAdm-xxxxxxx'), G = await mk('devG-xxxxxxxx');
  AD.send({ t: 'admin', k: ADMIN }); await wait(500);
  // ---- الإشعار والتقديم ----
  const j0 = jb(A); ok(j0 && j0.jobs.length === 4 && j0.jobs[0].id === 'police' && j0.jobs[0].slots === 6 && j0.jobs[0].used === 0 && !j0.my, 'عند الدخول يوصل ملخص الوظائف (4 وظائف، مقاعد فاضية)', JSON.stringify(j0));
  clr(V); V.send({ t: 'ja', j: 'police' }); await step(); ok(toast(V, /ابنِ بيتك/), 'الزائر بدون بيت ما يقدر يقدّم');
  clr(L); L.send({ t: 'ja', j: 'police' }); await step(); ok(toast(L, /المستوى 3/), 'المستوى الأقل من المطلوب مرفوض');
  clr(A, AD); A.send({ t: 'ja', j: 'police' }); await wait(700); ok(toast(A, /قدّمت/) && toast(AD, /طلب توظيف جديد/), 'التقديم يوصل للأدمن');
  ok(jb(A).app === 'police' && jb(AD).rv === 1, 'الطلب ظاهر: طلبي قيد المراجعة + عدّاد الأدمن 1', JSON.stringify([jb(A).app, jb(AD).rv]));
  clr(AD); AD.send({ t: 'jm' }); await step(); const jm = last(AD, m => m.t === 'jm'); ok(jm && jm.apps.length === 1 && jm.apps[0][2] === 'police', 'لوحة الإدارة فيها الطلب');
  clr(A); AD.send({ t: 'jd', k: jm.apps[0][0], ok: true }); await wait(700); ok(last(A, m => m.t === 'jx' && m.win) && jb(A).my && jb(A).my.j === 'police', 'الأدمن قبل → صار شرطي');
  await wait(400); at(V, 1, -60); at(A, 0, -60); await wait(900); const ma = metaOf(V, A.id); ok(ma && ma[8] === 'p' && ma[2] === 16, 'الناس يشوفونه شرطي بالزي', JSON.stringify(ma));
  // ---- السجن ----
  clr(A, V); A.send({ t: 'jj', f: V.id, r: 0 }); await wait(500); const jl = last(V, m => m.t === 'jl'); ok(jl && jl.on === 1 && jl.r === 0 && jl.left > 4000, 'الشرطي سجن الزائر', JSON.stringify(jl));
  await wait(600); clr(V); V.send({ t: 'cq', d: 'plaza', to: [A.id] }); await step(); ok(toast(V, /مسجون/), 'المسجون ما يقدر يطلب مرافقة');
  clr(V); at(V, 80, 0); await wait(400); ok(last(V, m => m.t === 'jl' && m.on === 1), 'لو طلع المسجون برّا المركز السيرفر يرجّعه');
  clr(A); A.send({ t: 'jj', f: V.id, r: 1 }); await step(); ok(toast(A, /مسجون أصلاً/), 'ما ينسجن مرتين');
  clr(AD); V.send({ t: 'jp' }); await step(); ok(last(AD, m => m.t === 'jpn' && m.n), 'الاعتراض يوصل للأدمن');
  clr(V); V.send({ t: 'jbl' }); await step(); ok(toast(V, /الكفالة 100/), 'الكفالة بدون ذهب كافي مرفوضة');
  await wait(300); clr(V, A); A.send({ t: 'jr', f: V.id }); await wait(500); ok(last(V, m => m.t === 'jl' && m.on === 0), 'اللي سجنه أطلقه');
  clr(A); at(V, 1, -60); await wait(300); A.send({ t: 'jj', f: V.id, r: 2 }); await step(); ok(toast(A, /توه طالع/), 'ما ينسجن مرة ثانية قبل 10 دقايق من طلوعه');
  clr(A); A.send({ t: 'jj', f: AD.id, r: 0 }); await step(); ok(toast(A, /المشرفين/), 'ما يقدر يسجن صاحب المدينة');
  clr(A); at(L, 200, 0); await wait(200); A.send({ t: 'jj', f: L.id, r: 0 }); await step(); ok(toast(A, /قريب منه/), 'لازم يكون قريب (20م)');
  // الشرطي الثاني: الشرطي ما يسجن شرطي
  clr(P); P.send({ t: 'ja', j: 'police' }); await step(); AD.send({ t: 'jm' }); await step(); { const r = last(AD, m => m.t === 'jm'); AD.send({ t: 'jd', k: r.apps[0][0], ok: true }); } await wait(600);
  clr(A); at(P, 2, -60); await wait(200); A.send({ t: 'jj', f: P.id, r: 0 }); await step(); ok(toast(A, /الشرطي ما يسجن شرطي/), 'الشرطي ما يسجن شرطي');
  // مدة السجن تخلص لحالها (JAIL_MS=6ث بالاختبار)
  clr(L); at(L, 3, -60); await wait(300); A.send({ t: 'jj', f: L.id, r: 4 }); await wait(400); ok(last(L, m => m.t === 'jl' && m.on === 1), 'سجن ثاني');
  // السجن يبقى بعد إعادة الاتصال
  clearInterval(L.ka); L.sock.destroy(); await wait(400); const L2 = await mk('devL-xxxxxxxx'); await wait(200); ok(last(L2, m => m.t === 'jl' && m.on === 1), 'تحديث الصفحة ما يطلّع من السجن');
  clr(L2); await wait(6500); ok(last(L2, m => m.t === 'jl' && m.on === 0), 'السجن ينتهي لحاله بعد مدته');
  // ---- مشرف وظيفة ----
  clr(D, AD); AD.send({ t: 'js', f: D.id, j: 'doctor' }); await wait(600); ok(jb(D).my && jb(D).my.sup === 1 && jb(D).my.j === 'doctor' && jb(A).jobs[1].sup, 'الأدمن عيّن مشرف المستشفى (والاسم يظهر للكل)');
  clr(T); D.send({ t: 'jh', f: T.id, j: 'doctor' }); await wait(600); ok(jb(T).my && jb(T).my.j === 'doctor', 'المشرف وظّف مباشرة من بطاقة الشخص');
  clr(T); A.send({ t: 'jf', f: T.id }); await step(); ok(!last(T, m => m.t === 'jx' && /انشالت/.test(m.m)), 'الشرطي ما يقدر يفصل طبيب');
  clr(T); D.send({ t: 'jf', f: T.id }); await wait(600); ok(last(T, m => m.t === 'jx' && /ممنوع من كل الوظائف 3 أيام/.test(m.m)) && !jb(T).my, 'المشرف فصله → رجع شخص عادي + عقوبة منع 3 أيام');
  await wait(500); ok(jb(T).nb > 2 * 86400e3, 'المفصول يوصله وقت المنع', JSON.stringify(jb(T).nb)); clr(T); T.send({ t: 'ja', j: 'mall' }); await step(); ok(toast(T, /ممنوع من الوظائف/), 'المفصول ما يقدر يقدّم 3 أيام');
  await wait(300); D.send({ t: 'jh', f: T.id, j: 'doctor' }); await step(); ok(toast(D, /ممنوع من الوظائف/), 'حتى المشرف ما يقدر يوظّفه (بس صاحب المدينة)');
  A.send({ t: 'jf', f: D.id }); await step(); ok(jb(D).my && jb(D).my.sup === 1, 'غير الأدمن ما يشيل المشرف');
  // ---- قبول تلقائي (وظيفة بدون مشرف: المول 15 «دقيقة» = 4.5ث بالاختبار) ----
  clr(M); M.send({ t: 'ja', j: 'mall' }); await wait(5600); ok(jb(M).my && jb(M).my.j === 'mall', 'وظيفة بدون مشرف: ينقبل تلقائياً بعد المدة');
  // ---- هدية المول ----
  clr(M, T); at(M, -200, 0); at(T, -198, 0); await wait(300); M.send({ t: 'jg', f: T.id }); await wait(500); ok(ecoEv(T, /هدية المول/), 'موظف المول أعطى هدية');
  clr(M); await wait(2700); M.send({ t: 'jg', f: T.id }); await step(); ok(toast(M, /أخذ هدية المول اليوم/), 'الهدية مرة باليوم');
  clr(M, V); at(M, 0, -60); at(V, 1, -60); await wait(300); M.send({ t: 'jg', f: V.id }); await step(); ok(toast(M, /داخل المول/), 'الهدايا داخل المول بس');
  // ---- الإصابة والعلاج ----
  clr(V); V.send({ t: 'jin', s: 0 }); await wait(400); ok(last(V, m => m.t === 'jhl' && m.on === 1), 'الإصابة تنسجل');
  at(V, 1, -60); await wait(900); const mv = metaOf(A, V.id); ok(mv && (mv[9] & 1), 'الناس يشوفونه مصاب', JSON.stringify(mv));
  clr(V); at(D, 2, -60); await wait(200); D.send({ t: 'jhl', f: V.id }); await wait(500); ok(last(V, m => m.t === 'jhl' && m.on === 0), 'الطبيب عالجه') ; ok(ecoEv(D, /عالجت/), 'الطبيب أخذ مكافأة');
  clr(V); V.send({ t: 'jin', s: 0 }); await step(); ok(!last(V, m => m.t === 'jhl' && m.on === 1), 'ما تنصاب مرة ثانية فوراً (تبريد 3 دقايق)');
  // ---- صفارة + أمر وقوف ----
  clr(V); at(A, 0, -60, 0); await step(); A.send({ t: 'jsr', on: true }); await wait(900); const ms = metaOf(V, A.id); ok(ms && (ms[9] & 2), 'الصفارة تظهر للناس', JSON.stringify(ms));
  clr(T); at(T, 4, -60, 1); await wait(300); A.send({ t: 'jst', f: T.id }); await step(); ok(last(T, m => m.t === 'jst'), 'أمر الوقوف يوصل للسائق');
  clr(V); at(A, 0, -60, -1); await wait(900); const ms2 = metaOf(V, A.id); ok(ms2 && !(ms2[9] & 2), 'الصفارة تطفى لما ينزل من السيارة', JSON.stringify(ms2));
  // ---- الراتب (10 «دقايق» دوام = 3ث) ----
  clr(A); for (let i = 0; i < 14; i++) { at(A, i % 2 ? 3 : -3, -60); await wait(300); } ok(ecoEv(A, /راتبك/), 'الراتب ينزل بعد الدوام');
  // ---- الحرامي ----
  clr(T, AD, V); AD.send({ t: 'thn' }); await wait(400); const t1 = last(T, m => m.t === 'th' && m.on === 1); ok(t1 && t1.sp > 0, 'الأدمن بدأ فعالية الحرامي (توصل للكل)');
  { const [lx, lz] = thiefAt(t1.o + t1.sp * (Date.now() + 150 - t1.t0) / 1000); at(V, lx + 30, lz); await wait(150); V.send({ t: 'thc' }); await wait(300); ok(!last(V, m => m.t === 'thw'), 'البعيد ما يمسكه'); }
  { const [lx, lz] = thiefAt(t1.o + t1.sp * (Date.now() + 150 - t1.t0) / 1000); at(T, lx, lz); await wait(150); T.send({ t: 'thc' }); await wait(500); ok(last(V, m => m.t === 'thw' && m.id === T.id) && ecoEv(T, /مسكت الحرامي/), 'اللي قرّب مسكه وأخذ الذهب (والكل عرف)'); }
  // ---- 🛒 بيع موظف المول ----
  await wait(1000); clr(M, T); at(M, -200, 0); at(T, -198, 0); await wait(300); M.send({ t: 'jo', f: T.id, i: 't:1' }); await wait(500);
  const of = last(T, m => m.t === 'jof'); ok(of && of.p === 45 && of.op === 50 && of.n, 'الموظف عرض شارة بخصم 10% (45 بدل 50)', JSON.stringify(of));
  clr(M, T); T.send({ t: 'jy', ok: true }); await wait(700); ok(last(T, m => m.t === 'mkok' && m.i === 't:1') && toast(T, /وفّرت 5/), 'الزائر اشترى من الموظف (ووصلته الشارة)');
  ok(ecoEv(M, /بعت/) && ecoEv(M, /بعت/).ev.includes("+3"), 'الموظف أخذ عمولة 5% (3 🪙)', JSON.stringify(ecoEv(M, /بعت/)));
  await wait(3100); clr(M); M.send({ t: 'jo', f: T.id, i: 't:1' }); await step(); ok(toast(M, /من قبل/), 'ما يعرض غرض عنده أصلاً');
  await wait(3100); clr(M, T); M.send({ t: 'jo', f: T.id, i: 't:2' }); await wait(400); ok(last(T, m => m.t === 'jof'), 'عرض ثاني'); T.send({ t: 'jy', ok: false }); await wait(400); ok(toast(M, /ما اشترى/), 'الرفض يوصل للموظف');
  await wait(3100); clr(M); at(M, 0, -60); at(T, 1, -60); await wait(300); M.send({ t: 'jo', f: T.id, i: 't:6' }); await step(); ok(toast(M, /داخل المول/), 'البيع داخل المول بس');
  clr(A); A.send({ t: 'jo', f: T.id, i: 't:2' }); await step(); ok(!last(T, m => m.t === 'jof' && m.f === A.id), 'غير موظف المول ما يقدر يبيع');
  // ---- 👔 المدير العام ----
  ok(jb(G).jobs.some(x => x.id === 'gm' && x.slots === 1 && x.lv === 5 && x.auto === 0), 'وظيفة «المدير العام» موجودة (مقعد واحد، مستوى 5)');
  clr(G, AD); G.send({ t: 'ja', j: 'gm' }); await wait(500); ok(toast(G, /صاحب المدينة/) && toast(AD, /طلب توظيف جديد/), 'قدّم على المدير العام والطلب وصل للأدمن');
  await wait(5600); ok(!jb(G).my, 'المدير العام ما ينقبل تلقائياً');
  AD.send({ t: 'jm' }); await step(); { const r = last(AD, m => m.t === 'jm'); const a = r.apps.find(x => x[2] === 'gm'); AD.send({ t: 'jd', k: a[0], ok: true }); } await wait(700);
  ok(jb(G).my && jb(G).my.j === 'gm', 'الأدمن قبله → صار المدير العام');
  at(G, 0, -60); at(V, 1, -60); await wait(900); const mg = metaOf(V, G.id); ok(mg && mg[8] === 'g' && mg[2] === 28, 'يظهر بالبدلة الرسمية وعلامة المدير العام', JSON.stringify(mg));
  clr(L2); G.send({ t: 'jh', f: L2.id, j: 'mall' }); await wait(600); ok(jb(L2).my && jb(L2).my.j === 'mall', 'المدير العام وظّف شخص');
  clr(D); await wait(300); G.send({ t: 'jf', f: D.id }); await wait(700); ok(!jb(D).my && toast(D, /ممنوع من كل الوظائف/), 'المدير العام فصل مشرف المستشفى (مع العقوبة)');
  clr(P); await wait(300); G.send({ t: 'js', f: P.id, j: 'police' }); await wait(700); ok(jb(P).my && jb(P).my.sup === 1 && jb(P).my.j === 'police', 'المدير العام عيّن مشرف الشرطة');
  clr(P); await wait(300); P.send({ t: 'jf', f: G.id }); await step(); ok(jb(G).my && jb(G).my.j === 'gm', 'المشرف ما يقدر يفصل المدير العام');
  clr(A); at(A, 2, -60); await wait(300); G.send({ t: 'jj', f: A.id, r: 5 }); await wait(500); ok(last(A, m => m.t === 'jl' && m.on === 1), 'المدير العام يسجن (حتى الشرطي)');
  clr(A); await wait(300); G.send({ t: 'jr', f: A.id }); await wait(500); ok(last(A, m => m.t === 'jl' && m.on === 0), 'والمدير العام يطلق');
  clr(G); G.send({ t: 'jm' }); await step(); { const r = last(G, m => m.t === 'jm'); ok(r && r.log.length > 0 && r.emps.some(x => x[2] === 'police') && r.emps.some(x => x[2] === 'mall'), 'لوحة إدارة المدير العام فيها كل الوظائف وسجل السجن'); }
  // الأدمن يعيّن المدير العام مباشرة (حتى لو عنده وظيفة) — والقديم تنشال منه
  clr(P, G); await wait(300); AD.send({ t: 'js', f: P.id, j: 'gm' }); await wait(800); ok(jb(P).my && jb(P).my.j === 'gm' && !jb(G).my && toast(G, /انشالت منك رتبة المدير العام/), 'الأدمن عيّن مدير عام جديد مباشرة (والقديم انشالت منه)');
  clr(P); await wait(300); AD.send({ t: 'js', f: P.id, j: null }); await wait(800); ok(!jb(P).my, 'الأدمن شال رتبة المدير العام');
  await wait(300); A.send({ t: 'js', f: G.id, j: 'gm' }); await step(); ok(!jb(G).my, 'غير الأدمن ما يعيّن مدير عام');
  // ---- 👑 إعلان للكل + 📡 رسائل الجميع ----
  clr(V, T, A); AD.send({ t: 'ab', x: 'هلا بالجميع 🎉 فعالية الليلة بالساحة' }); await wait(500); ok(last(V, m => m.t === 'ann' && /فعالية/.test(m.x)) && last(T, m => m.t === 'ann') && last(A, m => m.t === 'ann'), 'إعلان صاحب المدينة وصل للكل');
  clr(V); V.send({ t: 'ab', x: 'غش' }); await step(); ok(!last(T, m => m.t === 'ann' && m.x === 'غش'), 'غير الأدمن ما يقدر يعلن');
  clr(AD); AD.send({ t: 'aw', on: true }); await wait(300); ok(last(AD, m => m.t === 'aw' && m.on === true), '📡 تشغيل عرض رسائل الجميع');
  at(AD, 0, 300); at(T, -200, 0); await wait(400); clr(AD); await wait(1300); T.send({ t: 'say', k: 1 }); await wait(500); { const r = last(AD, m => m.t === 'msg' && m.f === T.id); ok(r && r.far === 1 && /المول/.test(r.w), 'رسالة من بعيد وصلت للأدمن مع المكان (🏬 المول)', JSON.stringify(r)); }
  clr(AD); AD.send({ t: 'aw', on: false }); await wait(300); await wait(1300); T.send({ t: 'say', k: 2 }); await wait(500); ok(!last(AD, m => m.t === 'msg' && m.f === T.id), 'بعد الإطفاء ما توصله رسائل البعيدين');
  // ---- 🤕 الإصابة تبقى بعد إعادة الاتصال + السرير ما يعلق ----
  const H1 = await mk('devH1-xxxxxxxx', 'مصاب'); H1.send({ t: 'jin', s: 0 }); await wait(400); ok(last(H1, m => m.t === 'jhl' && m.on === 1), 'انصاب');
  clearInterval(H1.ka); H1.sock.destroy(); await wait(400); const H2 = await mk('devH1-xxxxxxxx', 'مصاب'); await wait(200); ok(last(H2, m => m.t === 'jhl' && m.on === 1 && m.back === 1), 'طلع ورجع: الإصابة ترجع له (مو تعلق)');
  const H3 = await mk('devH3-xxxxxxxx', 'سليم'); clr(H3); at(H3, 39, -150); await wait(300); H3.send({ t: 'jhb' }); await wait(300); ok(last(H3, m => m.t === 'jhl' && m.on === 0), 'طلب العلاج وهو سليم عند السيرفر → يفك الإصابة عند جواله');
  // ---- 💼 صاحب المدينة يغيّر عدد المقاعد ----
  clr(AD); AD.send({ t: 'jsl', j: 'police', n: 9 }); await wait(700); ok(jb(AD).jobs.find(x => x.id === 'police').slots === 9 && toast(AD, /صار عدد المقاعد 9/), 'الأدمن زاد مقاعد الشرطة إلى 9');
  await wait(300); A.send({ t: 'jsl', j: 'police', n: 50 }); await wait(600); ok(jb(AD).jobs.find(x => x.id === 'police').slots === 9, 'غير الأدمن ما يغيّر المقاعد');
  // ---- 💼 الوظيفة ممتلئة: «سيتم إزالة فلان بدل فلان» ----
  await wait(400); { const mu = jb(AD).jobs.find(x => x.id === 'mall').used; AD.send({ t: 'jsl', j: 'mall', n: mu }); await wait(700);
    AD.inbox.length = 0; AD.send({ t: 'jh', f: T.id, j: 'mall' }); await wait(500); const jf = last(AD, m => m.t === 'jfull');
    ok(jf && jf.j === 'mall' && jf.rn && jf.rk && jf.used === mu && jf.n, 'توظيف بوظيفة ممتلئة: يخبر الأدمن مين بينشال بدال مين', JSON.stringify(jf));
    ok(!(jb(T).my), 'ما يتوظّف قبل الموافقة');
    const victim = [M, L2].find(x => x && jb(x) && jb(x).my && jb(x).my.j === 'mall' && keyOfName(x) === jf.rk) || null;
    T.inbox.length = 0; AD.send({ t: 'jh', f: T.id, j: 'mall', rep: jf.rk }); await wait(800);
    ok(jb(T).my && jb(T).my.j === 'mall', 'بعد الموافقة: انشال الموظف وانضاف الجديد');
    ok(jb(AD).jobs.find(x => x.id === 'mall').used === mu, 'العدد ما زاد عن المقاعد'); }
  // ---- الاستقالة ----
  clr(A, V); A.send({ t: 'jw', q: 'res' }); await wait(1300); ok(!jb(A).my, 'الاستقالة ترجّعه شخص عادي'); const mr = metaOf(V, A.id); ok(mr && mr[8] === '' && mr[2] !== 16, 'الزي والعلامة اختفت', JSON.stringify(mr));
  await wait(1800); const J = JSON.parse(fs.readFileSync(path.join(__dirname, 'jobs.json'), 'utf8')); ok(J.emp && J.log.length >= 2, 'الوظائف والسجل محفوظين بالملف');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
