// اختبار الألعاب الثنائية بالسيرفر: مباراة سريعة، تحقق الحركات، فوز، تعادل، انسحاب، مباراة ثانية
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_games_houses.json'); fs.writeFileSync(DATA, JSON.stringify([{ id: 'gchat00001', plot: 3, type: 1, name: 'احمد', t: 1, dev: 'devA-xxxxxxxx', ip: 'z', days: 2, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }]));
try { fs.unlinkSync(path.join(__dirname, 'economy.json')); fs.unlinkSync(path.join(__dirname, 'moderation.json')); } catch {}
const PORT = 3997;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: `http://127.0.0.1:${PORT}` } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) c.inbox.push(JSON.parse(s)); } });
      res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const last = (c, f) => [...c.inbox].reverse().find(f), clear = (...cs) => cs.forEach(c => c.inbox.length = 0);
srv.stdout.once('data', async () => {
  const A = await client(), B = await client(), C = await client();
  A.send({ t: 'hi', d: 'devA-xxxxxxxx', n: 'احمد' }); B.send({ t: 'hi', d: 'devB-xxxxxxxx', n: 'سالم' }); C.send({ t: 'hi', d: 'devC-xxxxxxxx', n: 'خالد' });
  await wait(300);
  // ---- إكس أو ----
  A.send({ t: 'gq', g: 'ttt' }); await wait(200);
  ok(last(A, m => m.t === 'g' && m.s === 'wait'), 'لاعب واحد: انتظار');
  B.send({ t: 'gq', g: 'ttt' }); await wait(300);
  const sa = last(A, m => m.t === 'g' && m.s === 'start'), sb = last(B, m => m.t === 'g' && m.s === 'start');
  ok(sa && sb && sa.you === 0 && sb.you === 1 && sa.opp === 'سالم' && sb.opp === 'احمد', 'اثنين: بدأت المباراة بأسماء الخصم');
  clear(A, B); B.send({ t: 'gm', m: 4 }); await wait(200);
  ok(!last(A, m => m.s === 'st'), 'حركة بدون دورك مرفوضة');
  A.send({ t: 'gm', m: 4 }); await wait(200);
  let st = last(B, m => m.s === 'st'); ok(st && st.b[4] === 0 && st.turn === 1, 'حركة صحيحة وانتقل الدور');
  clear(A, B); A.send({ t: 'gm', m: 0 }); B.send({ t: 'gm', m: 4 }); await wait(200); ok(!last(B, m => m.s === 'st' && m.b[4] !== 0), 'الخانة المحجوزة ما تنكتب');
  B.send({ t: 'gm', m: 0 }); await wait(100); A.send({ t: 'gm', m: 1 }); await wait(100); B.send({ t: 'gm', m: 2 }); await wait(100); A.send({ t: 'gm', m: 7 }); await wait(300);   // A: 4,1,7 = عمود
  const ea = last(A, m => m.s === 'end'), eb = last(B, m => m.s === 'end');
  ok(ea && ea.res === 'win' && eb.res === 'lose', 'الفوز بصف/عمود يُعلن (فزت/خسرت)');
  // مباراة ثانية
  clear(A, B); A.send({ t: 'gr' }); await wait(200); ok(last(B, m => m.s === 'rq'), 'طلب مباراة ثانية يوصل للخصم');
  B.send({ t: 'gr' }); await wait(300); const ra = last(A, m => m.s === 'start'); ok(ra && ra.you === 1, 'المباراة الثانية: تبديل الأدوار');
  // انسحاب
  clear(A, B); A.send({ t: 'gl' }); await wait(300); const lf = last(B, m => m.s === 'end'); ok(lf && lf.res === 'left', 'انسحاب الخصم = فوز لك');

  // ---- أربعة تتصل ----
  clear(A, B); A.send({ t: 'gq', g: 'c4' }); await wait(100); B.send({ t: 'gq', g: 'c4' }); await wait(300);
  let moves = [[A, 0], [B, 1], [A, 0], [B, 1], [A, 0], [B, 1], [A, 0]]; for (const [p, c] of moves) { p.send({ t: 'gm', m: c }); await wait(120); }
  const c4a = last(A, m => m.s === 'end'); ok(c4a && c4a.res === 'win', 'أربعة تتصل: 4 عمودياً = فوز');
  clear(A, B); A.send({ t: 'gl' }); B.send({ t: 'gl' }); await wait(200);
  A.send({ t: 'gq', g: 'c4' }); B.send({ t: 'gq', g: 'c4' }); await wait(300); A.send({ t: 'gm', m: 9 }); A.send({ t: 'gm', m: -1 }); await wait(200); ok(!last(A, m => m.s === 'st'), 'عمود خارج النطاق مرفوض');

  // ---- حجر ورقة مقص ----
  clear(A, B, C); A.send({ t: 'gl' }); B.send({ t: 'gl' }); await wait(150);
  A.send({ t: 'gq', g: 'rps' }); B.send({ t: 'gq', g: 'rps' }); await wait(300);
  A.send({ t: 'gm', m: 0 }); await wait(150); ok(!last(A, m => m.s === 'rps'), 'اختيار واحد: يستنى الثاني');
  A.send({ t: 'gm', m: 2 }); await wait(100); ok(!last(A, m => m.s === 'rps'), 'ما يغيّر اختياره بنفس الجولة');
  B.send({ t: 'gm', m: 2 }); await wait(250); const r1 = last(A, m => m.s === 'rps'); ok(r1 && r1.w === 0 && r1.sc[0] === 1 && r1.r[0] === 0 && r1.r[1] === 2, 'حجر يكسر مقص: A يكسب الجولة');
  A.send({ t: 'gm', m: 0 }); B.send({ t: 'gm', m: 2 }); await wait(300); const r2 = last(A, m => m.s === 'end'); ok(r2 && r2.res === 'win' && last(B, m => m.s === 'end').res === 'lose', 'الأفضل من 3: A فاز 2-0');
  // ---- انتظار ثم قطع ----
  clear(A, B, C); C.send({ t: 'gq', g: 'ttt' }); await wait(200); C.sock.destroy(); await wait(900);
  A.send({ t: 'gl' }); B.send({ t: 'gl' }); await wait(150); A.inbox.length = 0; A.send({ t: 'gq', g: 'ttt' }); await wait(300); ok(last(A, m => m.s === 'wait'), 'اللي قطع ما يبقى بالطابور (ما يتجاور مع لاعب ميت)');
  // ---- دردشة داخل المباراة ----
  clear(A, B, C); A.send({ t: 'gl' }); B.send({ t: 'gl' }); await wait(200);
  A.send({ t: 'gq', g: 'ttt' }); await wait(150); B.send({ t: 'gq', g: 'ttt' }); await wait(300); clear(A, B, C);
  A.send({ t: 'gc', k: 2 }); await wait(250);
  ok(last(B, m => m.t === 'g' && m.s === 'chat' && m.k === 2 && !m.me) && last(A, m => m.t === 'g' && m.s === 'chat' && m.me === 1), 'رسالة جاهزة بالمباراة: توصل للخصم وتظهر لي');
  ok(!last(C, m => m.s === 'chat'), 'لاعب خارج المباراة ما يسمع');
  await wait(1000); clear(A, B); A.send({ t: 'gc', x: 'يلا نلعب' }); await wait(250);
  const cx = last(B, m => m.t === 'g' && m.s === 'chat' && m.x === 'يلا نلعب'); ok(cx && cx.n === 'احمد', 'صاحب بيت: نص حر يوصل للخصم باسمه');
  await wait(1000); clear(A, B); B.send({ t: 'gc', x: 'هلا' }); await wait(250); ok(last(B, m => m.t === 'err' && m.e === 'guest') && !last(A, m => m.s === 'chat'), 'الزائر بدون بيت: نص حر مرفوض');
  await wait(1000); clear(A, B); B.send({ t: 'gc', k: 99 }); await wait(250); ok(!last(A, m => m.s === 'chat'), 'رقم رسالة جاهزة غلط مرفوض');
  await wait(1000); clear(A, B); A.send({ t: 'gc', x: 'ضيفني سناب' }); await wait(250); ok(last(A, m => m.t === 'err' && m.e === 'contact') && !last(B, m => m.s === 'chat'), 'حسابات التواصل ممنوعة بالدردشة');
  await wait(1000); clear(A, B); A.send({ t: 'gc', x: 'يا شرموط' }); await wait(250); ok(last(A, m => m.t === 'err' && m.e === 'banned') && !last(B, m => m.s === 'chat'), 'كلمة بذيئة: منع ساعة وما توصل');
  await wait(300); clear(A, B); A.send({ t: 'gl' }); await wait(250); B.send({ t: 'gc', k: 0 }); await wait(250); ok(!last(A, m => m.s === 'chat'), 'بعد خروج الخصم ما فيه دردشة');
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  srv.kill('SIGTERM'); await wait(500); for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} } process.exit(fail ? 1 : 0);
});
