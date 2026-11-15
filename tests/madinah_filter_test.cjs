// فلتر الكلام: درجتان (فحش = منع، إهانة خفيفة = تحذير)، مطابقة داخل الكلمة، ذكر المنصّة بدون طلب مسموح
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_filter_houses.json');
fs.writeFileSync(DATA, JSON.stringify([{ id: 'ecoh000001', plot: 3, type: 0, name: 'صاحب', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0,0,0,0,0] },{ id: 'ecoh000002', plot: 4, type: 0, name: 'احمد', t: 1, dev: 'devA-xxxxxxxx', ip: 'y', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0,0,0,0,0] }]));
for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3988, ADMIN = 'admintok-xyz', B = `http://127.0.0.1:${PORT}`;
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
  const A = await join('devA-xxxxxxxx', 'احمد'), H = await join('devH-xxxxxxxx', 'صاحب', 5);
  const say = async (x) => { A.inbox.length = 0; H.inbox.length = 0; A.send({ t: 'say', x }); await wait(1400); return { err: A.inbox.find(m => m.t === 'err'), got: H.inbox.find(m => m.t === 'msg' && m.x === x) }; };
  let r = await say('تلعبين اكس او'); ok(!r.err && r.got, 'جملة عادية «تلعبين اكس او» توصل (كانت تطلع «يناك»)');
  r = await say('بدكم تكسي'); ok(!r.err && r.got, '«تكسي» توصل (كانت تطلع «كسي»)');
  r = await say('ابغا اروح المول'); ok(!r.err && r.got, '«ابغا» توصل');
  r = await say('مين جاي من التيك توك'); ok(!r.err && r.got, 'ذكر تيك توك بدون طلب حساب يوصل');
  r = await say('وش رمز بوابة التيك توك'); ok(!r.err && r.got, 'سؤال عن رمز بوابة التيك توك (داخل اللعبة) يوصل');
  r = await say('عندك سناب'); ok(r.err && r.err.e === 'contact' && !r.got, 'طلب سناب محجوب');
  r = await say('سنابي ux.z511'); ok(r.err && r.err.e === 'contact', 'يوزر لاتيني مع منصّة محجوب');
  r = await say('شرطي غبي'); ok(r.err && r.err.e === 'rude' && /تحذير/.test(r.err.m) && !r.got, 'إهانة خفيفة: الرسالة تنحجب بتحذير بدون منع: ' + (r.err && r.err.m));
  r = await say('السلام عليكم'); ok(!r.err && r.got, 'بعد التحذير يقدر يكتب عادي (ما انمنع)');
  await say('يا حمار'); r = await say('تافه');
  ok(r.err && r.err.e === 'banned' && /إساءات متكررة/.test(r.err.m), 'ثالث إهانة خلال 10 دقايق = منع: ' + (r.err && r.err.m));
  r = await say('السلام عليكم'); ok(r.err && r.err.e === 'banned', 'وهو ممنوع ما يرسل');
  const Bq = await join('devB-xxxxxxxx', 'زائر2', 9);
  // صاحب البيت الثاني: فحش = منع ساعة مباشرة
  H.inbox.length = 0; H.send({ t: 'say', x: 'كس امك' }); await wait(1200);
  const e2 = H.inbox.find(m => m.t === 'err'); ok(e2 && e2.e === 'banned' && /كلمة بذيئة/.test(e2.m), 'الفحش = منع مباشر: ' + (e2 && e2.m));
  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill(); process.exit(0);
});
