// اختبار المشرفين: تعيين مشرف ومنع/فك منع الكتابة
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_mods_houses.json'), PORT = 3986, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-xyz';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devA-xxxxxxxx', 'بيتاحمد'), hs('h000000002', 1, 'devB-xxxxxxxx', 'بيتبدر'), hs('h000000003', 2, 'devV-xxxxxxxx', 'بيتزائر')]));
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
srv.stdout.once('data', async () => {
  await wait(700);
  const A = await mk('devA-xxxxxxxx', 'احمد'), Bq = await mk('devB-xxxxxxxx', 'بدر'), V = await mk('devV-xxxxxxxx', 'زائر'), AD = await mk('devAdm-xxxxxxx', 'x');
  AD.send({ t: 'admin', k: ADMIN }); await wait(500);
  clr(A, AD); A.send({ t: 'sa', f: Bq.id, on: true }); await wait(300); ok(!last(Bq, m => m.t === 'so'), 'غير المشرف ما يقدر يعيّن مشرفاً');
  A.send({ t: 'sb', f: V.id, on: true, mins: 60 }); await wait(300); clr(V); V.send({ t: 'say', x: 'هلا' }); await wait(300); ok(!last(V, m => m.t === 'err'), 'غير المشرف ما يقدر يمنع أحداً');
  clr(A, AD); AD.send({ t: 'sa', f: A.id, on: true }); await wait(300); ok(last(A, m => m.t === 'so' && m.on === true) && last(AD, m => m.t === 'sq' && m.mod === true), 'صاحب المدينة حوّل احمد مشرفاً (يوصله إشعار)');
  await wait(600); const sm = V.inbox.filter(m => m.t === 's' && m.m).flatMap(m => m.m).filter(r => r[0] === A.id).pop(); ok(sm && sm[7] === 1 && sm[4] === 3, 'المشرف يظهر للناس بتاج وعلامة «مشرف»', JSON.stringify(sm));
  await wait(700); clr(AD, V, A); A.send({ t: 'sb', f: V.id, on: true, mins: 60 }); await wait(300); ok(last(V, m => m.t === 'err' && m.e === 'banned') && last(A, m => m.t === 'sq' && m.ban === true), 'المشرف منع الزائر ساعة');
  await wait(1300); clr(V, Bq); V.send({ t: 'say', x: 'هلا فيكم' }); await wait(300); ok(last(V, m => m.t === 'err') && !last(Bq, m => m.t === 'msg'), 'الممنوع ما تنوصل رسائله');
  await wait(700); clr(A, V, Bq); A.send({ t: 'sb', f: V.id, on: false }); await wait(300); ok(last(A, m => m.t === 'sq' && m.ban === false), 'المشرف فكّ المنع');
  await wait(1300); clr(Bq); V.send({ t: 'say', x: 'رجعت' }); await wait(300); ok(last(Bq, m => m.t === 'msg' && m.x === 'رجعت'), 'بعد فك المنع يكتب عادي');
  await wait(700); clr(A, AD); A.send({ t: 'sb', f: AD.id, on: true, mins: 60 }); await wait(300); ok(!last(AD, m => m.t === 'err'), 'المشرف ما يقدر يمنع صاحب المدينة');
  await wait(700); clr(A, AD); AD.send({ t: 'sa', f: A.id, on: true }); await wait(200); A.send({ t: 'sb', f: Bq.id, on: true, mins: 1440 }); await wait(300); ok(last(Bq, m => m.t === 'err' && /يوم/.test(m.m)), 'منع يوم كامل');
  await wait(700); clr(Bq, A); AD.send({ t: 'sa', f: A.id, on: false }); await wait(300); ok(last(A, m => m.t === 'so' && m.on === false), 'إلغاء الإشراف');
  await wait(700); clr(V); A.send({ t: 'sb', f: V.id, on: true, mins: 60 }); await wait(300); ok(!last(V, m => m.t === 'err'), 'بعد الإلغاء ما يقدر يمنع');
  const M = JSON.parse(fs.readFileSync(path.join(__dirname, 'moderation.json'), 'utf8')); ok(Array.isArray(M.mods), 'القائمة تنحفظ بالملف');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
