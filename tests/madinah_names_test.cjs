// اختبار فلتر الأسماء: بيوت قائمة بأسماء سيئة تُخفى، وتسمية بيت جديد بكلمة سيئة أو سب تُرفض، والأسماء العادية تمر
const http = require('http'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_names_houses.json'), PORT = 3987, B = `http://127.0.0.1:${PORT}`;
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, name) => ({ id, plot, type: 0, name, t: 1, dev: 'dev' + plot + '-xxxxxxxx', ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h1', 0, 'الزب الكبير'), hs('h2', 1, 'كس'), hs('h3', 2, 'زبير'), hs('h4', 3, 'خولة'), hs('h5', 4, 'يا حمار'), hs('h6', 5, 'فخري')]));
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const get = p => new Promise(r => http.get(B + p, rs => { let b = ''; rs.on('data', d => b += d); rs.on('end', () => r(JSON.parse(b))); }));
const post = (p, o) => new Promise(r => { const d = JSON.stringify(o), q = http.request(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, rs => { let b = ''; rs.on('data', x => b += x); rs.on('end', () => r({ s: rs.statusCode, b })); }); q.end(d); });
srv.stdout.once('data', async () => {
  await new Promise(r => setTimeout(r, 600));
  const l = (await get('/api/houses')).houses, nm = id => l.find(x => x.id === id).name;
  ok(nm('h1') !== 'الزب الكبير' && nm('h2') !== 'كس' && nm('h5') !== 'يا حمار', 'البيوت بأسماء سيئة/سب: الاسم يُخفى للجميع');
  ok(nm('h3') === 'زبير' && nm('h4') === 'خولة' && nm('h6') === 'فخري', 'أسماء عادية (زبير، خولة، فخري) تبقى');
  for (const bad of ['الزب الكبير', 'كس', 'يا كلب', 'نيك امك', 'fuck']) { const r = await post('/api/house', { name: bad, pin: '1234', plot: 50, type: 0, device: 'devX-xxxxxxxx' }); ok(r.s === 400, 'تسمية بيت «' + bad + '» مرفوضة'); }
  const g = await post('/api/house', { name: 'زبير', pin: '1234', plot: 51, type: 0, device: 'devY-xxxxxxxx' }); ok(g.s !== 400 || !/الاسم غير مقبول/.test(g.b), 'اسم عادي (زبير) مقبول');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
