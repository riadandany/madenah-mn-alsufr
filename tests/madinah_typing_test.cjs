// اختبار: الكتابة الحرة مقفولة على الكل إلا المشرف ومن يفتح له الكتابة؛ والرسائل الجاهزة (80) مفتوحة للكل
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_typing_houses.json'), PORT = 3978, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-xyz';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devA-xxxxxxxx', 'بيتاحمد'), hs('h000000002', 1, 'devB-xxxxxxxx', 'بيتبدر')]));
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
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
srv.stdout.once('data', async () => {
  await wait(700);
  const A = await mk('devA-xxxxxxxx', 'احمد'), Bq = await mk('devB-xxxxxxxx', 'بدر'), V = await mk('devV-xxxxxxxx', 'زائر');
  ok(last(A, m => m.t === 'ct' && m.on === true) && last(V, m => m.t === 'ct' && m.on === false), 'الكتابة الحرة لصاحب البيت، والزائر بدون بيت لا');
  clr(Bq); A.send({ t: 'say', x: 'مرحبا يا شباب' }); await wait(300); ok(last(Bq, m => m.t === 'msg' && m.x === 'مرحبا يا شباب'), 'صاحب بيت: الكتابة الحرة توصل');
  await wait(1300); clr(V, Bq); V.send({ t: 'say', x: 'هلا فيكم' }); await wait(300); ok(!last(Bq, m => m.t === 'msg') && last(V, m => m.t === 'err'), 'زائر بدون بيت: الكتابة الحرة مقفلة');
  await wait(1300); clr(Bq); V.send({ t: 'say', k: 1 }); await wait(300); ok(last(Bq, m => m.t === 'msg' && m.k === 1), 'زائر بدون بيت: الرسائل الجاهزة شغّالة');
  await wait(1300); clr(A, Bq); A.send({ t: 'say', x: 'كلمني على 0555123456' }); await wait(300); ok(last(A, m => m.t === 'err') && !last(Bq, m => m.t === 'msg'), 'الفلاتر تبقى: الأرقام ممنوعة');
  await wait(1300); clr(A, Bq); A.send({ t: 'say', x: 'زور موقعي www.test.com' }); await wait(300); ok(last(A, m => m.t === 'err') && !last(Bq, m => m.t === 'msg'), 'الفلاتر تبقى: الروابط ممنوعة');
  await wait(1300); clr(Bq); A.send({ t: 'say', k: 79 }); await wait(300); ok(last(Bq, m => m.t === 'msg' && m.k === 79), 'الرسائل الجاهزة تبقى شغّالة');
  const AD = await mk('devAdm-xxxxxxx', 'x'); AD.send({ t: 'admin', k: ADMIN }); await wait(500); clr(Bq, AD); AD.send({ t: 'say', x: 'اهلا بكم' }); await wait(300); ok(last(Bq, m => m.t === 'msg' && m.x === 'اهلا بكم'), 'المشرف يكتب كالعادة');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
