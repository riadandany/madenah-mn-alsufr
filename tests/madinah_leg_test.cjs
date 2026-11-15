// اختبار السكنات الأسطورية: تُمنح للموجودين اليوم وبكره فقط، وتبقى لحسابهم، ومن يدخل بعدها ما يحصلها
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_leg_houses.json'), EFILE = path.join(__dirname, 'economy.json');
const HOUSES = [{ id: 'legh000001', plot: 3, type: 1, name: 'مالك', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 2, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }];
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
function startServer(port, env) {
  return new Promise(res => { const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT: port, DATA_FILE: DATA, ...env }, stdio: ['ignore', 'pipe', 'inherit'] }); srv.stdout.once('data', () => res(srv)); });
}
function client(port) {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: `http://127.0.0.1:${port}`, 'X-Forwarded-For': '10.0.0.' + Math.floor(Math.random() * 250) } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) c.inbox.push(JSON.parse(s)); } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const req = (port, u, body) => fetch(`http://127.0.0.1:${port}${u}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.9.' + Math.floor(Math.random() * 250) }, body: JSON.stringify(body) }).then(async r => ({ s: r.status, d: await r.json().catch(() => ({})) }));
const lastEco = c => [...c.inbox].reverse().find(m => m.t === 'eco');
const join = async (port, dev, name) => { const c = await client(port); c.send({ t: 'hi', d: dev, n: name }); await wait(300); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); return c; };
const metaOf = (c, id) => [...c.inbox.filter(m => m.t === 's' && m.m).flatMap(m => m.m)].reverse().find(x => x[0] === id);
(async () => {
  for (const f of [EFILE, path.join(__dirname, 'moderation.json')]) { try { fs.unlinkSync(f); } catch {} }
  fs.writeFileSync(DATA, JSON.stringify(HOUSES));
  // ================= فترة الاستحقاق (اليوم وبكره) =================
  let srv = await startServer(3974, { LEG_UNTIL: '2099-01-01' });
  let x = await req(3974, '/api/char', { device: 'devH-xxxxxxxx', ch: 13 });
  ok(x.s === 200 && x.d.house.ch === 13, 'صاحب بيت موجود: السكن الأسطوري مفتوح له حتى قبل ما يدخل اللعبة (13 الساحر الأعظم)');
  x = await req(3974, '/api/char', { device: 'devH-xxxxxxxx', ch: 16 }); ok(x.s === 400, 'رقم سكن غير موجود (16) مرفوض');
  const H = await join(3974, 'devH-xxxxxxxx', 'x'); let e = lastEco(H);
  ok(e && e.s.lg === 1 && /أسطورية/.test(e.ev || ''), 'عند الدخول: إشعار «حصلت على 5 سكنات أسطورية»');
  const V = await join(3974, 'devV-xxxxxxxx', 'زائر'), W = await join(3974, 'devW-xxxxxxxx', 'مراقب');
  e = lastEco(V); ok(e && e.s.lg === 1, 'زائر جديد دخل اليوم: ياخذ السكنات لحسابه');
  const vid = V.inbox.find(m => m.t === 'me').id; V.send({ t: 'c', c: 14 }); await wait(2500);
  const mv = metaOf(W, vid); ok(mv && mv[2] === 14 && mv[6] === 11, 'الناس يشوفون سكن «صقر الصحراء» وشارته 🦅 (ch=14, tag=11): ' + JSON.stringify(mv));
  W.inbox.length = 0; await wait(300); V.send({ t: 'say', k: 0 }); await wait(500);
  const msg = W.inbox.find(m => m.t === 'msg'); ok(msg && msg.n.startsWith('🦅'), 'اسمه بالدردشة يحمل شارة السكن: ' + (msg && msg.n));
  V.send({ t: 'c', c: 99 }); await wait(300);
  H.sock.destroy(); V.sock.destroy(); W.sock.destroy(); await wait(600);
  await wait(6800); srv.kill('SIGTERM'); await wait(900);   // الاقتصاد ينحفظ كل 6 ثواني (بويندوز ما فيه إغلاق نظيف)
  const saved = JSON.parse(fs.readFileSync(EFILE, 'utf8')); ok(Object.values(saved).some(a => a.leg === 1), 'الاستحقاق محفوظ بحسابهم (economy.json)');
  // ================= إعادة تشغيل: السكن يبقى =================
  srv = await startServer(3973, { LEG_UNTIL: '2099-01-01' });
  const hs = await (await fetch('http://127.0.0.1:3973/api/houses')).json(); ok(hs.houses.find(h => h.id === 'legh000001').ch === 13, 'بعد إعادة التشغيل: سكن صاحب البيت ما انمسح (13)');
  srv.kill('SIGTERM'); await wait(900);
  // ================= بعد انتهاء الفترة: ما ياخذها اللي يدخل بعدها =================
  for (const f of [EFILE]) { try { fs.unlinkSync(f); } catch {} }
  fs.writeFileSync(DATA, JSON.stringify(HOUSES.map(h => ({ ...h, ch: 2 }))));
  srv = await startServer(3972, { LEG_UNTIL: '2000-01-01' });
  x = await req(3972, '/api/char', { device: 'devH-xxxxxxxx', ch: 13 }); ok(x.s === 400 && /حصرية/.test(x.d.error || ''), 'بعد الفترة: صاحب بيت ما يقدر يختار سكن أسطوري');
  const N = await join(3972, 'devN-xxxxxxxx', 'جديد'), O = await join(3972, 'devO-xxxxxxxx', 'مراقب2');
  e = lastEco(N); ok(e && e.s.lg === 0 && !/أسطورية/.test(e.ev || ''), 'بعد الفترة: لاعب جديد ما ياخذ السكنات ولا إشعار');
  const nid = N.inbox.find(m => m.t === 'me').id; N.send({ t: 'c', c: 12 }); await wait(2500);
  const mn = metaOf(O, nid); ok(mn && mn[2] === 0, 'بعد الفترة: محاولة لبس سكن أسطوري بالشبكة تُتجاهل (ch=' + (mn && mn[2]) + ')');
  N.sock.destroy(); O.sock.destroy(); srv.kill('SIGTERM'); await wait(600);
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  for (const f of [EFILE, path.join(__dirname, 'moderation.json')]) { try { fs.unlinkSync(f); } catch {} }
  process.exit(fail ? 1 : 0);
})();
