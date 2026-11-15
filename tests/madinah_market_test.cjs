// اختبار السوق: شراء سكنات/قبعات/ظهر/شارات/ألوان/ديكور/تغيير اسم بالذهب، اللبس، وحماية من الغش
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_market_houses.json'), PORT = 3989, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-xyz';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devA-xxxxxxxx', 'بيتاحمد'), hs('h000000002', 1, 'devB-xxxxxxxx', 'بيتبدر')]));
const dh = d => crypto.createHash('sha256').update('dev:' + d).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(__dirname, 'economy.json'), JSON.stringify({ [dh('devA-xxxxxxxx')]: { c: 5000, s: 0, ld: '', d: '', tk: [], bx: 0, tut: [0, 0, 0, 0], fnd: [], o: [], bd: -1, wk: { w: 0, xo: 0, rc: 0 }, cap: {}, n: '', zt: 0 } }));
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
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m + (x !== undefined && !c ? "  → " + x : "")); };
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
const ecoF = path.join(__dirname, 'economy.json');
srv.stdout.once('data', async () => {
  await wait(700);
  const A = await mk('devA-xxxxxxxx', 'احمد'), V = await mk('devV-xxxxxxxx', 'زائر');
  A.send({ t: 'mkl' }); await wait(300); const L = last(A, m => m.t === 'mkl'); ok(L && L.items.length >= 50 && L.items.every(x => x.p >= 50 && x.p <= 100000) && L.items.some(x => x.p === 100000), 'قائمة السوق كبيرة (50+ غرض) والأسعار من 50 لين 100,000', L && L.items.length);
  clr(A); A.send({ t: 'mk', i: 'ch:27' }); await wait(300); ok(last(A, m => m.t === 'err' && /ما يكفي/.test(m.m)), 'ما يقدر يشتري شي أغلى من رصيده');
  // نعطيه ذهب (نعدّل ملف الاقتصاد ونعيد التشغيل؟ أسهل: نستخدم مفتاح الاختبار) — نكتب مباشرة بالسيرفر عن طريق مكافأة؟ نستخدم env MK_TEST_GOLD
  A.send({ t: 'eco' }); await wait(300); const c0 = last(A, m => m.t === 'eco').s.c;
  clr(A); A.send({ t: 'mk', i: 'h:8' }); await wait(300); const ok1 = last(A, m => m.t === 'mkok' && m.i === 'h:8'), e1 = last(A, m => m.t === 'eco' && m.ev);
  ok(ok1 && ok1.house.st[0] === 8 && e1 && e1.s.c === c0 - 200 && e1.s.own.h.includes(8), 'اشترى قبعة شمس (200): انخصم الذهب، وصارت ملكه وتلبّس على طول', JSON.stringify({ c0, c: e1 && e1.s.c }));
  await wait(450); clr(A); A.send({ t: 'mk', i: 'h:8' }); await wait(300); const w = last(A, m => m.t === 'mkok'); const e2 = last(A, m => m.t === 'eco' && m.ev); ok(w && w.wear === 1 && !e2, 'شي عندك: يلبس بدون ما ينخصم مرة ثانية');
  await wait(450); clr(V); V.send({ t: 'mk', i: 'h:1' }); await wait(300); ok(last(V, m => m.t === 'err' && /ابنِ بيتك/.test(m.m)), 'اللي ما عنده بيت: يطلب منه يبني بيت أول');
  await wait(450); clr(A); A.send({ t: 'mk', i: 'h:7' }); A.send({ t: 'mk', i: 'zz' }); await wait(300); ok(!last(A, m => m.t === 'mkok'), 'غرض مو موجود (أو حصري لصاحب المدينة) ما ينشرى');
  // تغيير الاسم: اسم سيء مرفوض
  await wait(450); clr(A); A.send({ t: 'mk', i: 'rename', n: 'كس' }); await wait(300); ok(last(A, m => m.t === 'err' && /غير مقبول/.test(m.m)), 'تغيير الاسم لكلمة سيئة مرفوض');
  // لبس شي ما اشتراه عن طريق /api/style مرفوض
  const st = await new Promise(r => { const d = JSON.stringify({ device: 'devA-xxxxxxxx', st: [13, 0, 0, 0, 0] }), q = http.request(B + '/api/style', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, rs => { let b = ''; rs.on('data', x => b += x); rs.on('end', () => r(rs.statusCode)); }); q.end(d); });
  ok(st === 400, 'تاج الماس (ما اشتراه) ما يقدر يلبسه بالطريق الثاني');
  const ch = await new Promise(r => { const d = JSON.stringify({ device: 'devA-xxxxxxxx', ch: 20 }), q = http.request(B + '/api/char', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, rs => { let b = ''; rs.on('data', x => b += x); rs.on('end', () => r(rs.statusCode)); }); q.end(d); });
  ok(ch === 400, 'سكن القرصان (ما اشتراه) ما يقدر يختاره');
  await wait(450); clr(A); A.send({ t: 'eco' }); await wait(300); const cA = last(A, m => m.t === 'eco').s.c; clr(A); A.send({ t: 'mk', i: 'ch:16' }); await wait(300); const sk = last(A, m => m.t === 'mkok'), es = last(A, m => m.t === 'eco' && m.ev);
  ok(sk && sk.house.ch === 16 && es && es.s.c === cA - 800 && es.s.own.ch.includes(16), 'اشترى سكن «الشرطي» (800): صار يلبسه وانحفظ عنده');
  await wait(450); clr(A); A.send({ t: 'mk', i: 'x:palm' }); await wait(300); const xp = last(A, m => m.t === 'mkok'); ok(xp && xp.house.dx.includes('palm'), 'اشترى نخلة للحوش: تظهر ببيته');
  await wait(450); clr(A); A.send({ t: 'mk', i: 'rename', n: 'بيت البطل' }); await wait(300); const rn = last(A, m => m.t === 'mkok'); ok(rn && rn.house.name === 'بيت البطل', 'تغيير الاسم (500): الاسم الجديد انحفظ');
  await wait(450); const cs = await new Promise(r => { const d = JSON.stringify({ device: 'devA-xxxxxxxx', ch: 16 }), q = http.request(B + '/api/char', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, rs => { rs.resume(); rs.on('end', () => r(rs.statusCode)); }); q.end(d); }); ok(cs === 200, 'السكن اللي اشتراه يقدر يختاره من لوحة الشخصية');
  await wait(7000); const E = JSON.parse(fs.readFileSync(ecoF, 'utf8'))[dh('devA-xxxxxxxx')]; ok(E && E.own && E.own.ch.includes(16) && E.own.h.includes(8), 'المشتريات تنحفظ بالملف (تبقى للأبد)');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
