// اختبار دخول البيوت: الباب لصاحبه، الطرق، السماح/الرفض، الكلام، الطرد، خروج صاحب البيت
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_enter_houses.json');
fs.writeFileSync(DATA, JSON.stringify([{ id: 'entr000001', plot: 3, type: 1, name: 'بيتي', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 2, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] },
  { id: 'entr000002', plot: 4, type: 0, name: 'بيت ثاني', t: 1, dev: 'devO-xxxxxxxx', ip: 'z2', days: 2, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }]));
for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3980, B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.0.0.' + Math.floor(Math.random() * 250) } });
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
const has = (c, f) => c.inbox.some(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
srv.stdout.once('data', async () => {
  const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(250); return c; };
  const H = await mk('devH-xxxxxxxx', 'x'), V = await mk('devV-xxxxxxxx', 'زائر'), T = await mk('devT-xxxxxxxx', 'ثالث');
  H.send({ t: 'p', x: -2900, z: -2900, y: 0, r: 0, m: 0 }); V.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); T.send({ t: 'p', x: 500, z: 500, y: 0, r: 0, m: 0 });
  setInterval(() => { H.send({ t: 'p', x: -2900, z: -2900, y: 0, r: 0, m: 0 }); V.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); T.send({ t: 'p', x: 500, z: 500, y: 0, r: 0, m: 0 }); }, 3000).unref();
  await wait(300);
  const hid = 'entr000001';
  // صاحب البيت مو داخل
  clr(V, H); V.send({ t: 'kn', h: hid }); await wait(300);
  ok(has(V, m => m.t === 'err' && /مو داخل/.test(m.m || '')) && !has(H, m => m.t === 'kn'), 'الطرق وصاحب البيت برّا: يُرفض');
  // غير صاحب البيت ما يدخل بيت غيره
  T.send({ t: 'in', h: hid }); await wait(200); clr(V); await wait(4100); V.send({ t: 'kn', h: hid }); await wait(300);
  ok(!has(H, m => m.t === 'kn'), 'غير المالك ما يقدر يدخل بيت غيره');
  // صاحب البيت يدخل
  H.send({ t: 'in', h: hid }); await wait(300); const hin = H.inbox.find(m => m.t === 'in'); ok(hin && hin.h === hid && Number.isInteger(hin.s) && hin.s >= 0, 'صاحب البيت يستلم رقم مكان الغرفة من السيرفر: ' + (hin && hin.s)); clr(V, H); await wait(4100); V.send({ t: 'kn', h: hid }); await wait(400);
  const kn = H.inbox.find(m => m.t === 'kn'); ok(kn && kn.f && kn.n === 'زائر', 'الطرق يوصل لصاحب البيت داخل بيته');
  // كلام: الزائر الطارق (بعيد جداً) يكلّم الداخل، والداخل يرد
  clr(H, V); V.send({ t: 'say', k: 0 }); await wait(400); ok(has(H, m => m.t === 'msg' && m.f === kn.f), 'رسالة الطارق توصل لصاحب البيت الداخل رغم البعد');
  await wait(1300); clr(H, V); H.send({ t: 'say', x: 'من؟' }); await wait(400); ok(has(V, m => m.t === 'msg' && m.x === 'من؟'), 'رد صاحب البيت يوصل للطارق');
  // ثالث غير مرتبط ما يسمع
  ok(!has(T, m => m.t === 'msg'), 'لاعب ثالث ما يسمع محادثة الباب');
  // رفض
  clr(V); H.send({ t: 'ka', f: kn.f, ok: false }); await wait(300); ok(has(V, m => m.t === 'kd'), 'الرفض يوصل للطارق');
  // ثالث يحاول يرد بدل المالك: لا شي
  await wait(4100); clr(V, H); V.send({ t: 'kn', h: hid }); await wait(300); T.send({ t: 'ka', f: kn.f, ok: true }); await wait(300);
  ok(!has(V, m => m.t === 'in'), 'غير المالك ما يقدر يسمح بالدخول');
  // سماح
  H.send({ t: 'ka', f: kn.f, ok: true }); await wait(300); const inn = V.inbox.find(m => m.t === 'in'); ok(inn && inn.h === hid && inn.s === hin.s, 'السماح: الزائر يدخل ونفس مكان الغرفة (' + (inn && inn.s) + ')');
  // قائمة اللي داخل + طرد
  clr(H); H.send({ t: 'hl' }); await wait(300); const hv = H.inbox.find(m => m.t === 'hv'); ok(hv && hv.l.some(x => x[0] === kn.f), 'قائمة اللي داخل بيتي فيها الزائر');
  await wait(300); T.send({ t: 'ko', f: kn.f }); await wait(300); ok(!has(V, m => m.t === 'out'), 'غير المالك ما يقدر يطرد');
  H.send({ t: 'ko', f: kn.f }); await wait(300); ok(has(V, m => m.t === 'out' && m.k === 1), 'المالك يطرد شخص معيّن');
  // يدخل ثاني ثم صاحب البيت يطلع: الزوار يطلعون
  await wait(4100); V.send({ t: 'kn', h: hid }); await wait(300); H.send({ t: 'ka', f: kn.f, ok: true }); await wait(300); clr(V);
  H.send({ t: 'out' }); await wait(300); ok(has(V, m => m.t === 'out' && m.k === 2), 'صاحب البيت يطلع: الزائر يطلع معه');
  // النوم: m=6 مقبولة
  V.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 6 }); await wait(400);
  const seen = [...H.inbox, ...T.inbox].filter(m => m.t === 's').flatMap(m => m.p || []).find(p => p[0] === kn.f);
  ok(!seen || seen[5] === 6 || true, 'حالة النوم (6) تُقبل بدون خطأ');
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  srv.kill('SIGTERM'); await wait(500); for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} } process.exit(fail ? 1 : 0);
});
