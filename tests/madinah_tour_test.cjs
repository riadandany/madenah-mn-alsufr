// اختبار: زيارة مدينة المشتركين المجانية (مرة وحدة)، مستوى اللاعب، وطلب المرافقة
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_tour_houses.json');
fs.writeFileSync(DATA, '[]'); for (const f of ['economy.json', 'moderation.json', 'vip.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3971, ADMIN = 'admintok-xyz', B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, VIP_TOUR_MIN: '0.04' }, stdio: ['ignore', 'pipe', 'inherit'] });
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
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(300); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
srv.stdout.once('data', async () => {
  await wait(600);
  // ---- زيارة مجانية ----
  const V = await mk('devTour-aaaaaaa', 'زائر1'); let vh = last(V, m => m.t === 'vh');
  ok(vh && vh.tour === 0 && !vh.pass, 'الزيارة المجانية متاحة لأول مرة');
  const e0 = last(V, m => m.t === 'eco'); ok(e0 && e0.s.lv >= 1, 'المستوى يوصل بحالة الاقتصاد: ' + (e0 && e0.s.lv));
  clr(V); V.send({ t: 'vt' }); await wait(300);
  const v1 = last(V, m => m.t === 'vip'); ok(v1 && v1.ok && v1.guest && v1.tour >= 1, 'بدأت الزيارة بدون طرق');
  vh = last(V, m => m.t === 'vh'); ok(vh && vh.pass && vh.tour === 1, 'تصريح الزيارة شغّال');
  V.sock.destroy(); await wait(300);
  const V2 = await mk('devTour-aaaaaaa', 'زائر1'); vh = last(V2, m => m.t === 'vh');
  ok(vh && vh.pass && vh.tour === 1, 'تحديث الصفحة خلال الزيارة ما يضيّعها');
  const W = await mk('devTour-bbbbbbb', 'زائر2'); vh = last(W, m => m.t === 'vh'); ok(vh && vh.tour === 0 && !vh.pass, 'شخص ثاني: زيارته المجانية متاحة له');
  await wait(5600);
  ok(last(V2, m => m.t === 'vipend'), 'انتهت الزيارة: وصلت رسالة النهاية');
  vh = last(V2, m => m.t === 'vh'); ok(vh && !vh.pass && vh.tour === 2, 'بعد الانتهاء: بدون تصريح والزيارة مستخدمة');
  clr(V2); V2.send({ t: 'vt' }); await wait(300); ok(last(V2, m => m.t === 'vipno') && !last(V2, m => m.t === 'vip'), 'محاولة ثانية: «القصور خاصة بالمشتركين»');
  V2.sock.destroy(); await wait(200);
  const V3 = await mk('devTour-aaaaaaa', 'زائر1'); vh = last(V3, m => m.t === 'vh'); ok(vh && !vh.pass && vh.tour === 2, 'رجع بعدين: ما ينفتح له مرة ثانية');
  // ---- طلب مرافقة ----
  const A = await mk('devCq-aaaaaaaaa', 'أحمد'), B = await mk('devCq-bbbbbbbbb', 'بدر'), C = await mk('devCq-ccccccccc', 'جاسم');
  clr(A, B, C); A.send({ t: 'cq', d: 'plaza', to: [B.id, C.id] }); await wait(300);
  const qb = last(B, m => m.t === 'cqi'), qc = last(C, m => m.t === 'cqi');
  ok(qb && qb.f === A.id && qb.d === 'plaza' && qb.n === 'أحمد' && qc && qc.f === A.id, 'الطلب وصل للاثنين باسم الطالب والمكان');
  ok(last(A, m => m.t === 'cqs' && m.n === 2), 'الطالب يعرف إن الطلب أُرسل لاثنين');
  clr(A, B, C); B.send({ t: 'cr', f: A.id, ok: true }); await wait(300);
  let gb = last(B, m => m.t === 'cg'), ga = last(A, m => m.t === 'cg');
  ok(gb && gb.d === 'plaza' && gb.me === 0 && ga && ga.me === 1 && ga.first === 1, 'وافق بدر: ننتقل الاثنين (الطالب ينتقل أول مرة)');
  clr(A, C); C.send({ t: 'cr', f: A.id, ok: true }); await wait(300);
  { var ga2 = last(A, m => m.t === "cg"); } ga = last(A, m => m.t === "cg"); ok(last(C, m => m.t === 'cg') && ga && ga.me === 1 && ga.first === 0, 'وافق جاسم بعده: هو ينتقل والطالب ما يتحرك مرة ثانية');
  clr(B); B.send({ t: 'cr', f: A.id, ok: true }); await wait(300); ok(!last(B, m => m.t === 'cg'), 'الرد مرتين على نفس الطلب ما يعيد النقل');
  await wait(3000); clr(A, B); A.send({ t: 'cq', d: 'mall', to: [B.id] }); await wait(300); clr(A); B.send({ t: 'cr', f: A.id, ok: false }); await wait(300);
  ok(last(A, m => m.t === 'cx' && m.n === 'بدر') && !last(B, m => m.t === 'cg'), 'اعتذار: الطالب يعرف وما أحد ينتقل');
  await wait(3000); clr(A, B); A.send({ t: 'cq', d: 'home', to: [B.id] }); await wait(300); ok(last(A, m => m.t === 'err') && !last(B, m => m.t === 'cqi'), 'مرافقة لبيتي بدون بيت: مرفوضة');
  A.send({ t: 'cq', d: 'plaza', to: [B.id] }); await wait(200); ok(last(A, m => m.t === 'err' && m.e === 'slow'), 'تكرار الطلب بسرعة مرفوض');
  await wait(3000); clr(B); A.send({ t: 'cq', d: 'narnia', to: [B.id] }); A.send({ t: 'cq', d: 'plaza', to: [A.id] }); await wait(300); ok(!last(B, m => m.t === 'cqi'), 'مكان غير معروف / طلب لنفسي: مرفوض');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
