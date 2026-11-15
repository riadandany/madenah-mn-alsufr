// اختبار الحظر من الدردشة: ساعة/يوم/للأبد (للأبد لصاحب المدينة بس)، المشرف يقدر، التظلّم يوصل، فك المنع، والحالة ترجع بعد إعادة الاتصال
// node tests/madinah_chatban_test.cjs server.js
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_chatban_houses.json'), PORT = 3968, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-ban';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'jobs.json', 'push.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devU-xxxxxxxx', 'عمر'), hs('h000000002', 1, 'devM-xxxxxxxx', 'مشرف'), hs('h000000003', 2, 'devW-xxxxxxxx', 'وليد')]));
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN }, stdio: ['ignore', 'pipe', 'inherit'] });
let ipN = 1;
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.6.' + (ipN++) + '.7' } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) { try { c.inbox.push(JSON.parse(s)); } catch {} } } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined && !c ? '  → ' + x : '')); };
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const mk = async dev => { const c = await client(); c.send({ t: 'hi', d: dev }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
srv.stdout.once('data', async () => {
  await wait(700);
  const AD = await mk('devAdm-xxxxxxx'); AD.send({ t: 'admin', k: ADMIN }); await wait(400);
  const U = await mk('devU-xxxxxxxx'), M = await mk('devM-xxxxxxxx'), W = await mk('devW-xxxxxxxx');
  AD.send({ t: 'sa', f: M.id, on: true }); await wait(500);
  clr(AD, M); U.send({ t: 'say', x: 'هلا والله' }); await wait(500);
  const am = last(AD, m => m.t === 'msg' && m.f === U.id), mm = last(M, m => m.t === 'msg' && m.f === U.id);
  ok(am && am.ak && mm && mm.ak === am.ak, 'زر الحظر يوصل لصاحب المدينة وللمشرف (مفتاح المرسل)', JSON.stringify([am, mm]));
  const k = am.ak;
  clr(U, AD); AD.send({ t: 'kb', k, mins: 60 }); await wait(500);
  const bn = last(U, m => m.t === 'bn'); ok(bn && bn.on === 1 && bn.left > 3500e3 && bn.left <= 3600e3, 'حظر ساعة: المحظور يوصله شريط المنع بالمدة', JSON.stringify(bn));
  ok(last(AD, m => m.t === 'jx' && /ساعة/.test(m.m)), 'صاحب المدينة يشوف تأكيد');
  await wait(1300); clr(U, W); U.send({ t: 'say', x: 'جربت' }); await wait(400); ok(last(U, m => m.t === 'err' && m.e === 'banned') && !last(W, m => m.t === 'msg' && m.f === U.id) && last(U, m => m.t === 'bn' && m.on === 1), 'المحظور ما تنوصل رسائله (ويطلع له زر التظلّم)');
  clr(AD, M, U); U.send({ t: 'bap' }); await wait(500);
  const ap = last(AD, m => m.t === 'bapn'); ok(ap && ap.k === k && ap.n && Array.isArray(ap.log) && last(M, m => m.t === 'bapn'), 'التظلّم وصل لصاحب المدينة والمشرف مع آخر رسائله', JSON.stringify(ap));
  ok(last(U, m => m.t === 'bn' && m.ap === 1), 'زر التظلّم صار «انرسل»');
  clr(AD); await wait(300); U.send({ t: 'bap' }); await wait(400); ok(!last(AD, m => m.t === 'bapn'), 'التظلّم مرة وحدة لكل منع');
  // إعادة الاتصال: الحالة ترجع
  U.sock.destroy(); await wait(400); const U2 = await mk('devU-xxxxxxxx'); ok(last(U2, m => m.t === 'bn' && m.on === 1), 'بعد إعادة الاتصال يرجع شريط المنع');
  clr(U2); AD.send({ t: 'ku', k }); await wait(500); ok(last(U2, m => m.t === 'bn' && m.on === 0), 'فك المنع يوصل للشخص');
  // المشرف: يوم مسموح، للأبد لا، وما يحظر مشرف/صاحب المدينة
  clr(M); await wait(600); M.send({ t: 'kb', k, mins: 0 }); await wait(400); ok(last(M, m => m.t === 'err' && /لصاحب المدينة/.test(m.m)), 'المشرف ما يقدر يحظر للأبد');
  clr(U2); await wait(600); M.send({ t: 'kb', k, mins: 1440 }); await wait(500); const b2 = last(U2, m => m.t === 'bn'); ok(b2 && b2.on === 1 && b2.left > 23 * 3600e3, 'المشرف حظر يوم', JSON.stringify(b2));
  clr(AD); await wait(600); AD.send({ t: 'kb', k, mins: 0 }); await wait(500); ok(last(U2, m => m.t === 'bn' && m.on === 1 && m.left === -1), 'صاحب المدينة حظر للأبد');
  const am2 = last(AD, m => m.t === 'msg' && m.f === M.id); clr(M); await wait(600); M.send({ t: 'say', x: 'تست' }); await wait(400); const mk2 = last(AD, m => m.t === 'msg' && m.f === M.id);
  clr(W); await wait(600); W.send({ t: 'kb', k: mk2 ? mk2.ak : 'x', mins: 60 }); await wait(300); ok(!last(M, m => m.t === 'bn' && m.on === 1), 'اللاعب العادي ما يقدر يحظر');
  clr(M); await wait(600); M.send({ t: 'kb', k: mk2 && mk2.ak, mins: 60 }); await wait(400); ok(last(M, m => m.t === 'err' && /ما تقدر تحظر مشرفاً/.test(m.m)), 'المشرف ما يحظر مشرف');
  const MOD = JSON.parse(fs.readFileSync(path.join(__dirname, 'moderation.json'), 'utf8')); ok(MOD.bans[k] && !MOD.bans[k].until && MOD.bans[k].ap === undefined, 'المنع الدائم محفوظ بالملف (والتظلّم ينفتح من جديد لمنع جديد)', JSON.stringify(MOD.bans[k]));
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
