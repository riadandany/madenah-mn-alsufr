// اختبار الاقتصاد: عملة، سلسلة أيام، مهام، كنوز، متجر، لوحات، + زر حظر المشرف على الرسائل
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_eco_houses.json');
fs.writeFileSync(DATA, JSON.stringify([{ id: 'ecoh000001', plot: 3, type: 0, name: 'صاحب', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }]));
for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3985, ADMIN = 'admintok-xyz', B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN }, stdio: ['ignore', 'pipe', 'inherit'] });
function client(ip) {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': ip || '10.0.0.' + Math.floor(Math.random() * 250) } });
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
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const lastEco = c => [...c.inbox].reverse().find(m => m.t === 'eco');
const req = (m, u, body, headers = {}) => fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.9.9', ...headers }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ s: r.status, d: await r.json().catch(() => ({})) }));
async function join(dev, name, x) { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(250); c.send({ t: 'p', x: x || 0, z: 0, y: 0, r: 0, m: 0 }); await wait(100); return c; }
srv.stdout.once('data', async () => {
  const A = await join('devA-xxxxxxxx', 'احمد'), Bc = await join('devB-xxxxxxxx', 'سالم', 5), H = await join('devH-xxxxxxxx', 'صاحب', 8);
  setInterval(() => { A.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); Bc.send({ t: 'p', x: 5, z: 0, y: 0, r: 0, m: 0 }); H.send({ t: 'p', x: 8, z: 0, y: 0, r: 0, m: 0 }); }, 3000).unref();
  // ---- دخول يومي ----
  let e = lastEco(A);
  ok(e && e.s.c === 10 && e.s.s === 1 && /اليوم 1/.test(e.ev || ''), 'أول دخول: سلسلة يوم 1 = +10 🪙');
  ok(e.s.tk.length === 3 && e.s.tk.every(t => t.g > 0 && !t.ok), '3 مهام يومية');
  A.send({ t: 'hi', d: 'devA-xxxxxxxx', n: 'احمد' }); await wait(300);
  ok(lastEco(A).s.c === 10, 'دخول ثاني بنفس اليوم ما يعطي مرة ثانية');
  // ---- كنوز ----
  A.send({ t: 'fd', i: 0 }); await wait(400); e = lastEco(A); ok(e.s.c === 30 && e.s.fnd.includes(0), 'كنز: +20');
  await wait(300); A.send({ t: 'fd', i: 0 }); await wait(400); ok(lastEco(A).s.c === 30, 'نفس الكنز مرة وحدة بس');
  await wait(300); A.send({ t: 'fd', i: 99 }); await wait(300); ok(lastEco(A).s.c === 30, 'رقم كنز غلط مرفوض');
  await wait(300); A.send({ t: 'fd', i: 8 }); await wait(400); e = lastEco(A); ok(e.s.c === 90 && e.s.o.includes(0), 'النخلة الذهبية: +60 وشارة 🌴');
  // ---- متجر ----
  await wait(300); A.send({ t: 'buy', i: 1 }); await wait(400); ok(A.inbox.some(m => m.t === 'err' && /ما يكفي/.test(m.m || '')) || lastEco(A).s.c === 90, 'شراء شارة 120 برصيد 90 مرفوض');
  await wait(300); A.send({ t: 'buy', i: 'boost' }); await wait(400); ok(A.inbox.some(m => m.t === 'err' && /بيت/.test(m.m || '')), 'التسريع لمن عنده بيت فقط');
  await wait(300); A.send({ t: 'buy', i: 0 }); await wait(300); ok(lastEco(A).s.c === 90, 'شارة الكنز ما تنشترى');
  await wait(300); A.send({ t: 'eq', i: 3 }); await wait(300); ok(lastEco(A).s.bd === -1, 'لبس شارة غير مملوكة ما يغيّر');
  await wait(300); A.send({ t: 'eq', i: 0 }); await wait(400); ok(lastEco(A).s.bd === 0, 'لبس شارة مملوكة');
  A.inbox.length = 0; Bc.inbox.length = 0; A.send({ t: 'say', x: 'هلا' }); await wait(1300);   // زائر: مرفوض
  ok(A.inbox.some(m => m.t === 'err' && m.e === 'guest'), 'الزائر ما يكتب نص (للتأكيد)');
  // رسالة جاهزة تعدّ مهمة + بداية سريعة + اسم بالشارة
  await wait(1300); A.inbox.length = 0; Bc.inbox.length = 0; A.send({ t: 'say', k: 0 }); await wait(500);
  const bm = Bc.inbox.find(m => m.t === 'msg'); ok(bm && bm.n.startsWith('🌴 '), 'الشارة تظهر قدّام الاسم بالدردشة: ' + (bm && bm.n));
  e = lastEco(A); ok(e && e.s.tut[3] === 1, 'بداية سريعة: رسالة جاهزة');
  // ---- ألعاب فردية ----
  A.send({ t: 'ev', e: 'z', g: 'snake', s: 2 }); await wait(400); ok(lastEco(A).s.c === (e.s.c + 15 === lastEco(A).s.c ? lastEco(A).s.c : e.s.c), 'نتيجة ضعيفة ما تُحسب');
  const c0 = lastEco(A).s.c;
  await wait(300); A.send({ t: 'ev', e: 'z', g: 'snake', s: 9 }); await wait(400); ok(lastEco(A).s.c >= c0 + 6, 'فوز بالثعبان +6');
  await wait(300); const c1 = lastEco(A).s.c; A.send({ t: 'ev', e: 'z', g: 'snake', s: 9 }); await wait(400); ok(lastEco(A).s.c === c1, 'تكرار سريع خلال 15 ثانية مرفوض');
  A.send({ t: 'ev', e: 'z', g: 'hack', s: 99 }); await wait(300);
  // ---- إكس أو: فوز + مهمة + لوحة ----
  Bc.send({ t: 'eco' }); await wait(400); const c2 = lastEco(Bc).s.c;
  Bc.send({ t: 'gq', g: 'ttt' }); await wait(200); H.send({ t: 'gq', g: 'ttt' }); await wait(400);
  ok(lastEco(Bc).s.tut[1] === 1, 'بداية سريعة: لعب XO');
  // أول من يبدأ = اللاعب 0 (Bc)
  for (const [p, m] of [[Bc, 4], [H, 0], [Bc, 1], [H, 2], [Bc, 7]]) { p.send({ t: 'gm', m }); await wait(150); }
  await wait(400); e = lastEco(Bc);
  ok(e.s.xo === 1 && e.s.c >= c2 + 10, 'فوز XO: +10 🪙 وعدّاد الأسبوع');
  ok(!lastEco(H) || lastEco(H).s.xo === 0, 'الخاسر ما ياخذ فوز');
  Bc.send({ t: 'lb' }); await wait(300); const lb = Bc.inbox.find(m => m.t === 'lb'); ok(lb && lb.xo.length >= 1 && lb.xo[0][0] === 'سالم' && lb.left >= 1, 'لوحة أسبوعية: أكثر فوز');
  // ---- تسريع البيت لصاحب بيت ----
  H.send({ t: 'fd', i: 1 }); await wait(300); H.send({ t: 'fd', i: 2 }); await wait(400); H.send({ t: 'fd', i: 3 }); await wait(300);
  const hb = lastEco(H).s.c; ok(hb >= 60, 'صاحب البيت جمّع رصيد: ' + hb);
  H.inbox.length = 0; await wait(300); H.send({ t: 'buy', i: 'boost' }); await wait(500);
  ok(H.inbox.some(m => m.t === 'boost') && lastEco(H).s.c === hb - 60, 'تسريع البيت: يخصم 60 ويرد boost');
  const mine = await req('POST', '/api/mine', { device: 'devH-xxxxxxxx' }); ok(mine.d.days >= 2, 'البيت تقدّم يوم: ' + mine.d.days);
  // ---- ديكور البيت + سر البرج ----
  await wait(300); H.send({ t: 'fd', i: 4 }); await wait(400); H.send({ t: 'fd', i: 5 }); await wait(400);
  const hc = lastEco(H).s.c; ok(hc >= 65, 'رصيد صاحب البيت للديكور: ' + hc);
  await wait(300); H.send({ t: 'buy', i: 'x:pool' }); await wait(400); ok(H.inbox.some(m => m.t === 'err' && /ما يكفي/.test(m.m || '')), 'المسبح 150 برصيد قليل مرفوض');
  H.inbox.length = 0; await wait(300); H.send({ t: 'buy', i: 'x:palm' }); await wait(500);
  ok(H.inbox.some(m => m.t === 'boost') && lastEco(H).s.c === hc - 50, 'شراء نخلة: يخصم 50');
  let hs = await req('GET', '/api/houses'); ok(hs.d.houses.find(h => h.id === 'ecoh000001').dx.includes('palm'), 'الديكور يظهر بالبيت للكل (/api/houses)');
  const hc2 = lastEco(H).s.c; await wait(300); H.send({ t: 'buy', i: 'x:palm' }); await wait(400); ok(lastEco(H).s.c === hc2, 'نفس الديكور ما ينشترى مرتين');
  await wait(300); H.send({ t: 'buy', i: 'x:ufo' }); await wait(300); ok(lastEco(H).s.c === hc2, 'ديكور غير موجود مرفوض');
  A.inbox.length = 0; await wait(300); A.send({ t: 'buy', i: 'x:lamp' }); await wait(400); ok(A.inbox.some(m => m.t === 'err' && /بيت/.test(m.m || '')), 'الديكور لصاحب بيت فقط');
  await wait(300); A.send({ t: 'fd', i: 9 }); await wait(500); ok(lastEco(A).s.o.includes(6) && lastEco(A).s.fnd.includes(9), 'سر البرج: شارة 🗼');
  // ---- المشرف: ak بالرسائل + حظر دائم ----
  const AD = await client(); AD.send({ t: 'hi', d: 'devAD-xxxxxxxx', n: 'x' }); await wait(200); AD.send({ t: 'admin', k: ADMIN }); await wait(200); AD.send({ t: 'p', x: 1, z: 0, y: 0, r: 0, m: 0 }); await wait(200);
  H.inbox.length = 0; AD.inbox.length = 0; await wait(1300); H.send({ t: 'say', x: 'مرحبا' }); await wait(500);
  const am = AD.inbox.find(m => m.t === 'msg'); ok(am && typeof am.ak === 'string' && am.ak.length > 3, 'المشرف يستلم مفتاح اللاعب مع الرسالة');
  ok(!Bc.inbox.some(m => m.t === 'msg' && m.ak), 'اللاعب العادي ما يشوف المفتاح');
  let x = await req('POST', '/api/admin/act', { a: 'ban', k: am.ak }, { 'X-Admin': ADMIN }); ok(x.s === 200, 'المشرف يحظر من الرسالة');
  await wait(1300); H.inbox.length = 0; H.send({ t: 'say', x: 'ابي اكتب' }); await wait(400); ok(H.inbox.some(m => m.t === 'err' && m.e === 'banned'), 'المحظور ما يرسل (نهائي)');
  x = await req('POST', '/api/admin/act', { a: 'unban', k: am.ak }, { 'X-Admin': ADMIN }); await wait(1300); H.inbox.length = 0; H.send({ t: 'say', x: 'رجعت' }); await wait(400);
  ok(H.inbox.some(m => m.t === 'sent'), 'فك الحظر يرجّع الكتابة');
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  srv.kill('SIGTERM'); await wait(800); for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} } process.exit(fail ? 1 : 0);
});
