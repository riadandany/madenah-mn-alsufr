// اختبار طرق قصور المشتركين: الطرق يوصل لأصحاب القصور اللي داخل فقط (مو الزوار ولا الغايبين)، وأي صاحب قصر داخل يقدر يسمح
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_knock_houses.json'), PORT = 3976, B = `http://127.0.0.1:${PORT}`;
fs.writeFileSync(DATA, '[]'); for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
fs.writeFileSync(path.join(__dirname, 'vip_seed.json'), JSON.stringify([{ name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }, { name: 'قصر الملك', pin: 'KingPin@2026', adm: true }]));
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
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
  const O = await mk('devO-xxxxxxxxx', 'صاحب'); const vh = last(O, m => m.t === 'vh'); const omar = vh.l.find(x => x.name === 'عمر').id, salma = vh.l.find(x => x.name === 'سلمى').id;
  O.send({ t: 'vp', i: omar, p: '1234' }); await wait(700); O.send({ t: 'in', h: omar }); await wait(300); ok(last(O, m => m.t === 'in' && m.own), 'صاحب قصر عمر دخل قصره');
  // سلمى (صاحبة قصر ثاني) تطرق قصر عمر → صاحبه يسمح لها
  const R = await mk('devR-xxxxxxxxx', 'سلمى'); R.send({ t: 'vp', i: salma, p: 'salma99' }); await wait(1700); clr(O, R); R.send({ t: 'kn', h: omar }); await wait(400);
  ok(last(O, m => m.t === 'kn' && m.f === R.id), 'صاحب القصر (داخل) يوصله طرق سلمى');
  O.send({ t: 'ka', f: R.id, ok: true }); await wait(400); ok(last(R, m => m.t === 'in' && m.h === omar), 'سلمى دخلت قصر عمر');
  // زائر (زيارة مجانية) يطرق: يوصل لعمر ولسلمى (صاحبة قصر وداخل) — وسلمى تقدر تسمح
  const T = await mk('devT-xxxxxxxxx', 'زائر1'); T.send({ t: 'vt' }); await wait(400); clr(O, R, T); T.send({ t: 'kn', h: omar }); await wait(400);
  ok(last(O, m => m.t === 'kn' && m.f === T.id) && last(R, m => m.t === 'kn' && m.f === T.id), 'الطرق يوصل لأي صاحب قصر داخل (مو بس صاحب القصر)');
  R.send({ t: 'ka', f: T.id, ok: true }); await wait(400); ok(last(T, m => m.t === 'in' && m.h === omar), 'سلمى (صاحبة قصر ثاني) قدرت تدخّل الزائر');
  // الزائر الداخل ما يقدر يسمح ولا يوصله طرق
  const T2 = await mk('devT2-xxxxxxxxx', 'زائر2'); T2.send({ t: 'vt' }); await wait(400); clr(O, R, T, T2); T2.send({ t: 'kn', h: omar }); await wait(400);
  ok(!last(T, m => m.t === 'kn'), 'الزائر الداخل ما يوصله طرق (مو صاحب قصر)');
  T.send({ t: 'ka', f: T2.id, ok: true }); await wait(300); ok(!last(T2, m => m.t === 'in'), 'الزائر ما يقدر يسمح لأحد');
  O.send({ t: 'ka', f: T2.id, ok: false }); await wait(300); ok(last(T2, m => m.t === 'kd'), 'صاحب القصر يرفض');
  // طرق بوابة المدينة: يوصل لأصحاب القصور اللي داخل المدينة فقط
  const V = await mk('devV-xxxxxxxxx', 'ضيف'); clr(O, R, T, V); V.send({ t: 'vk' }); await wait(400);
  ok(last(O, m => m.t === 'vkn' && m.f === V.id) && last(R, m => m.t === 'vkn') && !last(T, m => m.t === 'vkn'), 'طرق البوابة: لأصحاب القصور داخل المدينة، وما يوصل للزوار');
  T.send({ t: 'vka', f: V.id, ok: true }); await wait(300); ok(!last(V, m => m.t === 'vip'), 'الزائر ما يقدر يسمح بطرق البوابة');
  R.send({ t: 'vka', f: V.id, ok: true }); await wait(300); ok(last(V, m => m.t === 'vip' && m.ok), 'صاحبة قصر داخل المدينة تسمح بطرق البوابة');
  // ما فيه أحد داخل: ما ينفتح (مثل البيوت)
  O.send({ t: 'out' }); R.send({ t: 'out' }); T.send({ t: 'out' }); await wait(500); O.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); R.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); await wait(300);
  const W = await mk('devW-xxxxxxxxx', 'ضيف2'); W.send({ t: 'vt' }); await wait(300); clr(W); W.send({ t: 'kn', h: omar }); await wait(400);
  ok(last(W, m => m.t === 'err' && /مو داخل/.test(m.m || '')), 'ما فيه أحد داخل القصر: «صاحب البيت مو داخل»');
  const V2 = await mk('devV2-xxxxxxxxx', 'ضيف3'); clr(V2); V2.send({ t: 'vk' }); await wait(400);
  ok(last(V2, m => m.t === 'err' && /ما فيه أحد من أصحاب القصور/.test(m.m || '')), 'طرق البوابة بدون أحد داخل المدينة: رسالة واضحة');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
