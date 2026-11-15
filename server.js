// مدينة من الصفر — سيرفر بملف واحد، بدون مكتبات خارجية
// تشغيل: node server.js   (المنفذ الافتراضي 3010، يستمع على 127.0.0.1 فقط خلف nginx)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 3010;
const HOST = process.env.HOST || '127.0.0.1';                // لا تكشف المنفذ للإنترنت — nginx فقط
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';          // لحذف بيت مسيء
const MAX_PER_IP = +process.env.MAX_PER_IP || 5;            // أقصى بيوت جديدة من نفس الشبكة خلال 24 ساعة (شبكات الجوال يتشاركها ناس كثير، والجهاز الواحد = بيت واحد أصلاً)
const MAX_LIKES_PER_IP = +process.env.MAX_LIKES_PER_IP || 3; // أقصى لايكات لنفس البيت من نفس الشبكة
const DATA = process.env.DATA_FILE || path.join(__dirname, 'data', 'houses.json');
const PUB = path.join(__dirname, 'public');

// ---------- البيانات ----------
fs.mkdirSync(path.dirname(DATA), { recursive: true });
let houses = [];
try { houses = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { houses = []; }
// الحوش صار 3 مواقف: السيارات القديمة (كانت 8 أماكن) ترتّب على أول 3
for (const h of houses) if (Array.isArray(h.pk) && h.pk.some(p => p[1] > 2)) { const seen = new Set(); h.pk = h.pk.filter(p => !seen.has(p[0]) && seen.add(p[0])).slice(0, 3).map((p, i) => [p[0], i]); }

// الرمز السري للبيت: يختاره صاحبه وقت البناء، ويستخدمه لاسترجاع بيته من جهاز ثاني ولتغيير الاسم أو الحذف.
// يُخزَّن مشفّراً (scrypt + ملح) — حتى صاحب السيرفر ما يشوفه.
const PIN_MAX_FAILS = 10;                                   // محاولات خاطئة باليوم لكل بيت
const cleanPin = p => {
  if (typeof p !== 'string') return null;
  const s = p.trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));   // الأرقام العربية = الإنجليزية
  return s.length >= 4 && s.length <= 20 ? s : null;
};
const scrypt = (pin, salt) => new Promise((ok, no) => crypto.scrypt(pin, salt, 32, (e, k) => e ? no(e) : ok(k.toString('hex'))));
async function setPin(h, pin) { h.ps = crypto.randomBytes(12).toString('hex'); h.ph = await scrypt(pin, h.ps); }
// يتحقق من الرمز مع عدّاد المحاولات الخاطئة اليومي: يرجع 'ok' أو 'bad' أو 'locked' أو 'nopin'
async function checkPin(h, pin) {
  if (!h.ph) return 'nopin';
  const td = today();
  if (h.fd !== td) { h.fd = td; h.fails = 0; }
  if ((h.fails || 0) >= PIN_MAX_FAILS) return 'locked';
  const k = await scrypt(pin || '', h.ps);
  if (pin && crypto.timingSafeEqual(Buffer.from(k, 'hex'), Buffer.from(h.ph, 'hex'))) { if (h.fails) { h.fails = 0; save(); } return 'ok'; }
  h.fails = (h.fails || 0) + 1; save();
  return 'bad';
}
const PIN_ERR = { bad: 'الرمز غير صحيح', locked: 'محاولات كثيرة على هذا البيت، جرّب بكرة', nopin: 'هذا البيت ما له رمز' };

// الشخصية اللي يتمشى فيها صاحب البيت (10 شخصيات، 0 = الافتراضية)
const CHAR_COUNT = 10;
// سكنات أسطورية (11..15): حصرية لحسابات اللي كانوا موجودين اليوم وبكره (LEG_UNTIL) — اللي يدخل بعدها ما يحصلها
const LEG_UNTIL = process.env.LEG_UNTIL || '2026-11-13', LEGT = ['🐉', '⚔️', '🔮', '🦅', '💠'];
const cleanCh = (c, leg, own) => Number.isInteger(c) && c >= 0 && (c < CHAR_COUNT || (leg && c >= 11 && c <= 15) || (!!own && Array.isArray(own.ch) && own.ch.includes(c))) ? c : null;
const ownOf = dev => { const e = typeof dev === 'string' && dev.length >= 8 && eco[devHash(dev)]; return (e && e.own) || null; };   // مشتريات السوق
const isLeg = dev => { const e = typeof dev === 'string' && dev.length >= 8 && eco[devHash(dev)]; return !!(e && e.leg); };

// ---------- الجوائز اليومية والتخصيص ----------
// كل يوم دخول يفتح عنصر جديد بهذا الترتيب (لازم يطابق REWARD_ORDER في public/app.js):
// h = قبعة، c = لون البيت، d = زينة البيت، b = شيء الظهر، t = شارة بجانب الاسم
const REWARD_ORDER = 'h1 c1 d1 b1 t1 h2 c2 d2 b2 t2 h3 c3 d3 b3 t3 h4 c4 d4 b4 t4 h5 c5 h6 c6 t5 t6'.split(' ');
const STYLE_KEYS = ['h', 'b', 't', 'c', 'd'], STYLE_MAX = { h: 15, b: 10, t: 6, c: 6, d: 4 };   // h7/b5 حصرية لصاحب المدينة   // st = [قبعة، ظهر، شارة، لون بيت، زينة بيت]
const unlockedFor = days => REWARD_ORDER.slice(0, Math.max(1, days | 0));
function cleanStyle(st, days, own) {
  if (!Array.isArray(st) || st.length !== 5) return null;
  const u = new Set(unlockedFor(days));
  for (let i = 0; i < 5; i++) {
    const k = STYLE_KEYS[i], v = st[i];
    if (!Number.isInteger(v) || v < 0 || v > STYLE_MAX[k] || (k === 'h' && v === 7) || (k === 'b' && v === 5)) return null;
    if (v > 0 && !u.has(k + v) && !(own && Array.isArray(own[k]) && own[k].includes(v))) return null;   // انفتحت بالأيام أو اشتراها من السوق
  }
  return st.slice();
}

let migrated = false;
for (const h of houses) {
  if (!Array.isArray(h.st) || h.st.length !== 5) { h.st = [0, 0, 0, 0, 0]; migrated = true; }
  if (!h.lki) { h.lki = {}; migrated = true; }
  if (h.rc) { delete h.rc; migrated = true; }
  if (cleanCh(h.ch, true) === null) { h.ch = 0; migrated = true; }   // البيوت القديمة تاخذ الشخصية الافتراضية
}

// الحفظ: مؤجل نصف ثانية (عشرات اللايكات = كتابة وحدة)، غير متزامن، وذرّي (ملف مؤقت ثم إعادة تسمية)
let version = Date.now(), saveTimer = null, writing = false, dirty = false;
function save() {
  version++;
  dirty = true;
  if (!saveTimer) saveTimer = setTimeout(flush, 2500);
}
async function flush() {
  saveTimer = null;
  if (writing) { saveTimer = setTimeout(flush, 200); return; }
  if (!dirty) return;
  writing = true; dirty = false;
  const tmp = DATA + '.tmp';
  try {
    await fs.promises.writeFile(tmp, JSON.stringify(houses));
    await fs.promises.rename(tmp, DATA);
  } catch (e) { console.error('فشل الحفظ:', e.message); dirty = true; if (!saveTimer) saveTimer = setTimeout(flush, 2000); }
  writing = false;
}
function flushSync() {
  if (!dirty && !saveTimer) return;
  clearTimeout(saveTimer); saveTimer = null;
  try { fs.writeFileSync(DATA + '.tmp', JSON.stringify(houses)); fs.renameSync(DATA + '.tmp', DATA); dirty = false; } catch (e) { console.error('فشل الحفظ عند الإغلاق:', e.message); }
}
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { flushSync(); try { if (typeof ecoTimer !== 'undefined' && (ecoTimer || ecoWriting)) saveEcoNow(true); } catch {} try { if (typeof cwDirty !== 'undefined' && cwDirty) saveCwNow(); } catch {} try { if (typeof jobTimer !== 'undefined' && jobTimer) saveJobNow(); } catch {} try { if (typeof pushTimer !== 'undefined' && pushTimer) savePushNow(); } catch {} try { if (typeof evSaveNow !== 'undefined' && evDirty) evSaveNow(); } catch {} try { if (typeof stSaveNow !== 'undefined') { for (const o of clients) stEnd(o); stSaveNow(); } } catch {} process.exit(0); });
process.on('unhandledRejection', e => console.error('خطأ غير متوقع:', e));
if (migrated) save();

// نفس قاعدة الواجهة: عدد المربعات يكبر مع عدد البيوت ويبقى دائماً أراضٍ فاضية
// الحد الأدنى 48 مربع = ثلاث حلقات كاملة حول البرج (شبكة 7×7)
const nBlocks = count => Math.max(48, Math.ceil((count + 120) / 4));   // دايماً ~120 أرض فاضية (كانت 12 بس فتخلص بسرعة لما يبني ناس كثير بنفس الوقت) — لازم تطابق public/app.js
const capacity = count => nBlocks(count) * 4;
// تطور البيت: عدد الأيام اللي دخل فيها صاحبه (مو لازم ورا بعض)
const LEVEL_DAYS = [1, 2, 4, 7, 12];            // خيمة، بيت طين، فيلا، برج، قلعة
const levelFor = d => { let l = 0; LEVEL_DAYS.forEach((x, i) => { if (d >= x) l = i; }); return l; };
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // توقيت السعودية
const devHash = d => crypto.createHash('sha256').update('dev:' + d).digest('hex').slice(0, 12);

// ---------- فلترة الأسماء ----------
// (كلمات قصيرة مثل «زب» تُركت عمداً لأنها جزء من أسماء عادية: زبير، زبيدة)
const BAD = ['خنزير','قحب','شرموط','منيك','نيكني','طيز','لوطي','عاهر','ديوث','وسخ','حقير','كسمك','كسخت','متناك',
  'fuck','shit','bitch','dick','pussy','sex','porn','nigg','whore','slut','cunt','asshole','penis'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };
const norm = s => s.toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\s_]+/g, '');
const variants = s => {
  const n = norm(s);
  const leet = n.replace(/[0-9]/g, d => LEET[d] || '');
  const noDigits = n.replace(/[0-9٠-٩]/g, '');
  return [n, leet, noDigits].flatMap(v => [v, v.replace(/(.)\1+/g, '$1')]);   // و«كككس» → «كس»
};
// كلمات طويلة تُطابق داخل النص (فحش وسب)
const BAD_MORE = [
  // جنس وفحش (عربي بكل اللهجات): تُطابق داخل النص
  'سكس','سكسي','نيكني','نيكك','نيكها','نيكمك','نياكه','ناكح','انيكك','انيكها','ينيكك','يناك','اتناك','تتناك','متناكه','منيوك','منيوكه','منيك','منايك','فشخ','فشخه','يفشخ','قضيب','بظر','خصاوي','ايريك','ايرك','عيرك','عيري','زغب','زغبه',
  'كسامك','كسختك','كسخالتك','كساختك','كسعمك','كسمك','كسمه','كسمين','كسام','كسخواتك','كساخت','شرموطه','شراميط','قحبه','قحبات','قحاب','كحبه','عاهرات','داعره','مومس','مومسه','بغايا','معرص','معرصه','عرصات','ديوثه','قوادين','لواط','لوطيه','شواذ','مخنث','متخنث','زاملات','اغتصاب','اغتصبك','دعاره','ابنالشرموطه','ابنالقحبه','ابنالعاهره','ابنالوسخه','ابنالحرام','ابنالزانيه','ابنالمتناكه','ابنالكلب','ابنالكلبه','ابنالخول','ابنالعرص','ولدالحرام','ولدالزنا','ولدالقحبه','بنتالقحبه','بنتالكلب','يلعنابو','يلعندين','يلعنامك','يلعنشرف','يلعنربك','دينامك','دينابوك','دينختك',
  // سب وشتائم
  'حيوان','حثاله','منحط','ملعون','كلبه','خرابوك','خراعليك','تفوعليك','خنزير','خنازير','قحب','شرموط','طيزك','بزازها','بزازك','طيازه',
  // إنجليزي وفرانكو
  'fuk','fuck','vagina','boobs','rape','hentai','nude','xxx','motherfuck','bastard','dumbass','faggot','retard','blowjob','handjob','cumshot','orgasm','erotic','idiot','stupid','sharmoot','sharmouta','sharmota','sharmuta','charmouta','manyak','manyok','kosomak','ksomak','kosomk','khawal'
];
const BADN = [...new Set([...BAD, ...BAD_MORE])].map(norm);
// كلمات قصيرة/سب: تُطابق ككلمة كاملة فقط (حتى ما نظلم أسماء مثل زبير وخولة وكسرى وفخري)
const BAD_TOK = [
  'كس','كسي','كسك','كسه','كسها','كسم','كسخت','كسخاله','زب','زبي','زبك','زبه','زبر','زبره','زبوره','زغب','نيك','انيك','ينيك','نيكه','ناك','ناكو','ناكها','نكني','تناك','متناك','منيوك','مناك','عرص','عرصه','خرا','خره','طيز','طبون','بزاز','بزول','بزازه','قحبه','قحب','كحبه','لوطي','لواط','خول','خولات','مخنث','زامل','زاملي','ديوث','قواد','كواد','عاهر','عاهره','داعر','مومس','بغي','زاني','زانيه','زنا','جماع','سكس','وسخ','وصخ','وسخه','قذر','قذره','حقير','حقيره','سافل','ساقط','ساقطه','واطي','نذل','تافه','احمق','غبي','غبيه','اهبل','هبيل','هبله','عبيط','معفن','متخلف','زفت','زباله','زبل','جحش','تيس','كلب','كلاب','كلبه','حمار','حماره','حمير','يلعن','ابليس','طز',
  'ass','anal','cum','tits','dick','cock','boob','sex','kos','kus','kss','fck','fag','stfu','wtf','porn','slut','whore','bitch','shit','cunt'
].map(norm);
const PRE = ['وال','بال','كال','فال','لل','ال','و','ب','ل','ف','ك'];   // بدون ي/ت: كانت تحوّل «تكسي» لـ«كسي» و«تبغى» لـ«بغي»
const tokHit = (tk) => { const vs = variants(tk).flat(); const all = new Set(vs); for (const v of vs) for (const p of PRE) if (v.length > p.length + 1 && v.startsWith(p)) all.add(v.slice(p.length)); return BAD_TOK.find(b => all.has(b)) || ''; };
const splitTok = s => s.split(/[^ء-يa-zA-Z0-9ً-ٟ]+/).filter(Boolean);
// درجتان: فحش/جنس (bad → منع تلقائي) وإهانات خفيفة (rude → الرسالة تنحجب مع تحذير، و3 خلال 10 دقايق = منع نص ساعة)
const MILD = new Set(['حيوان','حثاله','منحط','ملعون','كلبه','كلب','كلاب','حمار','حماره','حمير','جحش','تيس','غبي','غبيه','اهبل','هبيل','هبله','عبيط','معفن','متخلف','زفت','زباله','زبل','تافه','احمق','نذل','واطي','ساقط','ساقطه','سافل','حقير','حقيره','قذر','قذره','وسخ','وصخ','وسخه','خنزير','خنازير','يلعن','ابليس','طز','idiot','stupid','dumbass','retard','bastard','stfu','wtf'].map(norm));
// الكلمات المركّبة (تُكتب غالباً كلمتين: «ابن الكلب»، «كس امك») هي الوحيدة اللي تُطابق عبر الكلمات — الباقي داخل الكلمة الواحدة (كان «ابغا يا» يطلع «بغايا» و«تلعبين اكس او» يطلع «يناك»)
const COMPOUND = new Set(BADN.filter(b => /^(ابنال|ولدال|بنتال|يلعن|دين|كس|خرا|تفو)/.test(b)));
const EN_RE = /^[a-z]/;
// يرجّع {n: فحش, m: إهانات خفيفة}
function badTier(s0) {
  const s = String(s0).replace(/[.\-*+•·,،'"~`|\\/]+/g, '');
  const toks = splitTok(s), tv = toks.map(t => variants(t)), joined = variants(s);
  let n = 0, m = 0; const hit = b => { if (MILD.has(b)) m++; else n++; };
  for (const b of BADN) {
    const en = EN_RE.test(b);
    if (tv.some(vs => vs.some(v => en ? v.startsWith(b) : v.includes(b)))) { hit(b); continue; }   // إنجليزي: بداية الكلمة بس (rape ≠ grape)
    if (!en && COMPOUND.has(b) && joined.some(v => v.includes(b))) hit(b);
  }
  for (const tk of toks) { const w = tokHit(tk); if (w) hit(w); }
  return { n: Math.min(n, Math.max(1, toks.length)), m };   // «كس امك» كانت تنحسب 3 كلمات = 3 ساعات
}
// يرجّع عدد الكلمات السيئة بالنص بكل الدرجات (0 = نظيف) — للأسماء
function badCount(s0) { const t = badTier(s0); return t.n + t.m; }
const _badMemo = new Map();   // نخزّن نتيجة فحص كل اسم (فحص آلاف الأسماء بكل طلب كان يعلّق السيرفر)
const isBadName = s => { if (typeof s !== 'string') return false; let r = _badMemo.get(s); if (r === undefined) { r = badCount(s) > 0; if (_badMemo.size > 60000) _badMemo.clear(); _badMemo.set(s, r); } return r; };
const safeNm = (s, alt) => (isBadName(s) ? (alt || 'بيت') : s);
const CHATBAD = ['كس','كسك','كسم','كسي','كسها','كسه','زب','زبي','زبك','نيك','انيك','ينيك','نيكه','عرص','عرصه','شرمطه','قحبه','طيزك','كسامك','كسمين','كسختك','متناكه','ابنالكلب','fuk','fck','sex','kos','kss'].map(norm);
function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 18) return null;
  if (!/^[ء-ي٠-٩a-zA-Z0-9 _ً-ٟ]+$/.test(s)) return null;
  if (/https?|www|\.com/i.test(s)) return null;
  if (norm(s).includes('منالصفر')) return null;      // «من الصفر» اسم صاحب المدينة — محجوز
  if (badCount(s) > 0) return null;
  return s;
}

// ---------- حماية من الإغراق ----------
function limiter(windowMs, max) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k); }, windowMs).unref();
  return ip => {
    const now = Date.now();
    const k = netKey(ip);
    const h = (hits.get(k) || []).filter(t => now - t < windowMs);
    h.push(now); hits.set(k, h);
    return h.length > max;
  };
}
const limited = limiter(60000, 20);            // بناء ولايك: 20 بالدقيقة
const recoverLimited = limiter(10 * 60000, 15); // عمليات الرمز السري: 15 محاولة كل 10 دقائق لكل شبكة

// IP الزائر الحقيقي: nginx يحوّل CF-Connecting-IP (من عناوين Cloudflare الموثوقة فقط) إلى $remote_addr ويمرره هنا
const ipOf = req => {
  const fwd = req.headers['x-forwarded-for'];
  const remote = req.socket.remoteAddress || '';
  if (fwd && (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1')) return fwd.split(',')[0].trim();
  return remote;
};
// IPv6: كل مشترك عنده /64 كامل (ملايين العناوين) — نحسب الشبكة بأول 4 مقاطع حتى ما يتجاوز الحدود بتغيير العنوان
function netKey(ip) {
  ip = String(ip).replace(/^::ffff:/i, '');
  if (!ip.includes(':')) return ip;
  let [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [], t = tail !== undefined && tail ? tail.split(':') : [];
  const full = tail !== undefined ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map(x => (parseInt(x, 16) || 0).toString(16)).join(':') + '::/64';
}
const hashIp = ip => crypto.createHash('sha256').update('mnalsifr:' + netKey(ip)).digest('hex').slice(0, 16);
const pub = h => ({ id: h.id, plot: h.plot, type: h.type, name: safeNm(h.name, 'بيت ' + (h.plot + 1)), t: h.t, days: h.days || 1, likes: (h.lk || []).length, ch: h.ch | 0, st: h.st || [0, 0, 0, 0, 0], dx: h.dx || [], pk: h.pk || [] });

const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};
// cloudflareinsights = إحصائيات Cloudflare Web Analytics (يحقنها Cloudflare في الصفحة)
const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";

const zlib = require('zlib');
let housesCache = { v: -1, t: 0, body: '', gz: null }, cerrT = 0, cerrN = 0;
function housesSnap() { const now = Date.now(); if (housesCache.v !== version && (now - housesCache.t > 8000 || housesCache.v < 0)) { const body = JSON.stringify({ houses: houses.map(pub), count: houses.length }); housesCache = { v: version, t: now, body, gz: zlib.gzipSync(body, { level: 6 }) }; } return housesCache; }
const housesNow = () => { housesCache.t = 0; hCache.t = 0; };
// صيغة مضغوطة (بدون مفاتيح، الفاضي يُحذف من الآخر): [id, plot, type, name, days, likes, ch, st, dx, pk] — العميل يفكّها (unpackH)
const pubC = h => { const a = [h.id, h.plot, h.type, safeNm(h.name, 'بيت ' + (h.plot + 1)), h.days || 1, (h.lk || []).length, h.ch | 0, h.st && h.st.some(x => x) ? h.st : 0, h.dx && h.dx.length ? h.dx : 0, h.pk && h.pk.length ? h.pk : 0]; while (a.length > 4 && (!a[a.length - 1] || (a.length === 5 && a[4] === 1))) a.pop(); return a; };
let hCache = { v: -1, t: 0, body: '', gz: null };
// 🏕️ الخيام المهجورة: خيمة (المرحلة 0) ما دخل صاحبها TENT_DAYS يوم تنحذف (قرار صاحب المدينة 2026-11-14) — نسخة منها بـ removed-tents.jsonl
const TENT_DAYS = +process.env.TENT_DAYS || 14;
function pruneTents() {
  if (!TENT_DAYS || houses.length < (+process.env.PRUNE_MIN || 500)) return 0;   // مدينة صغيرة (والاختبارات): ما نحذف أحد
  const cut = Date.now() - TENT_DAYS * 86400e3, gone = [];
  for (const h of houses) { const last = h.last ? Date.parse(h.last + 'T00:00:00Z') : 0; if ((h.type | 0) === 0 && Math.max(last || 0, h.t || 0) < cut) gone.push(h); }
  if (!gone.length) return 0;
  const gs = new Set(gone); houses = houses.filter(h => !gs.has(h));
  try { fs.appendFileSync(path.join(path.dirname(DATA), 'removed-tents.jsonl'), gone.map(h => JSON.stringify(h)).join('\n') + '\n'); } catch (e) { console.error('سجل الخيام:', e.message); }
  save(); housesNow(); console.log(`🏕️ حذف ${gone.length} خيمة مهجورة (باقي ${houses.length})`); return gone.length;
}
setTimeout(pruneTents, +process.env.PRUNE_DELAY_MS || 15000); setInterval(pruneTents, 3600e3);
function housesSnapC() { const now = Date.now(); if (hCache.v !== version && (now - hCache.t > 8000 || hCache.v < 0)) { const body = JSON.stringify({ h: houses.map(pubC), count: houses.length }); hCache = { v: version, t: now, body, gz: zlib.gzipSync(body, { level: 6 }) }; } return hCache; }   // بيت انبنى/انشال: القائمة تتحدّث بالطلب الجاي
function json(res, code, obj, extra) {
  res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(obj));
}
function body(req, cb, max = 2000) {
  let b = '', done = false;
  req.on('data', c => { b += c; if (b.length > max && !done) { done = true; cb(null); req.destroy(); } });
  req.on('end', () => { if (done) return; done = true; try { cb(JSON.parse(b || '{}')); } catch { cb(null); } });
}

// ---------- الملفات الثابتة ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8' };
function serveStatic(req, res) {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400, SEC); return res.end(); }
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(PUB, p));
  if (!f.startsWith(PUB + path.sep)) { res.writeHead(403, SEC); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, { ...SEC, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    const ext = path.extname(f);
    const versioned = /[?&]v=/.test(req.url);
    const headers = { ...SEC, 'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' || ext === '.webmanifest' || /[\\/]sw\.js$/.test(f) ? 'no-cache' : versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=86400' };
    if (ext === '.html') {   // اتصال اللعب المباشر (WebSocket) لنفس الموقع فقط
      const host = /^[a-z0-9.:-]{1,100}$/i.test(req.headers.host || '') ? req.headers.host : '';
      headers['Content-Security-Policy'] = host ? CSP.replace("connect-src 'self'", `connect-src 'self' wss://${host} ws://${host}`) : CSP;
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

// ---------- الواجهات ----------
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const ip = ipOf(req);

  // أخطاء تحميل اللعبة عند اللاعبين (من boot.js) — تنكتب بسجل السيرفر بحد أقصى عشان ما تغرقه
  if (url === '/api/cerr' && req.method === 'POST') {
    return body(req, d => {
      const now = Date.now(); if (now - cerrT > 3600e3) { cerrT = now; cerrN = 0; }
      if (d && cerrN < 300 && !limited(ip)) { cerrN++; const cl = v => String(v || '').replace(/[\r\n]+/g, ' ').slice(0, 300); console.log('CLIENTERR', cl(d.k), '|', cl(d.st), '|', cl(d.m), '|', cl(d.w), '|', cl(d.ua)); }
      res.writeHead(204, SEC); res.end();
    }, 1500);
  }
  // كل البيوت — مع ETag: لو ما تغيّر شي يرجع 304 بدون جسم (الواجهة تسأل كل 20 ثانية)
  if ((url === '/api/houses' || url === '/api/h') && req.method === 'GET') {
    const snap = url === '/api/h' ? housesSnapC() : housesSnap(), etag = `W/"${snap.v}"`;
    const inm = (req.headers['if-none-match'] || '').replace(/^W\//, '');
    if (inm && inm === etag.replace(/^W\//, '')) { res.writeHead(304, { ...SEC, ETag: etag, 'Cache-Control': 'no-cache' }); return res.end(); }
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && snap.gz;
    res.writeHead(200, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', ETag: etag, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) }); return res.end(gz || snap.body);
  }

  if (url === '/api/house' && req.method === 'POST') {
    if (limited(ip)) return json(res, 429, { error: 'كثير طلبات، جرّب بعد دقيقة' });
    return body(req, async d => {
      if (!d) return json(res, 400, { error: 'طلب غير صحيح' });
      const name = cleanName(d.name);
      if (!name) return json(res, 400, { error: 'الاسم غير مقبول (حروف وأرقام فقط، من 2 إلى 18 حرف)' });
      const dev0 = typeof d.device === 'string' ? d.device.slice(0, 64) : '', gsub0 = dev0.length >= 8 ? accByDev.get(dev0) : null;
      const pin = cleanPin(d.pin);
      if (!pin && !gsub0) return json(res, 400, { error: 'اكتب رمز سري لبيتك (4 خانات أو أكثر)' });
      const plot = d.plot | 0;
      if (plot < 0 || plot >= capacity(houses.length)) return json(res, 400, { error: 'الأرض غير متاحة' });
      const dev = typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      if (dev.length < 8) return json(res, 400, { error: 'طلب غير صحيح' });
      const ih = hashIp(ip);
      if (houses.some(h => h.dev === dev)) return json(res, 409, { error: 'عندك بيت من قبل 🙂' });
      { const day = Date.now() - 86400000; if (houses.filter(h => h.ip === ih && h.t > day).length >= MAX_PER_IP) return json(res, 409, { error: 'انبنى بيوت كثير من هذي الشبكة اليوم — جرّب بكرة أو من شبكة ثانية (واي فاي/بيانات)' }); }
      if (houses.some(h => h.plot === plot)) return json(res, 409, { error: 'أحد سبقك على هذي الأرض، اختر غيرها' });
      const ch = cleanCh(d.ch, isLeg(dev)) ?? 0;
      ecoDo(dev.length >= 8 ? devHash(dev) : null, (e, evs) => ecoTut(e, 0, evs));
      const h = { id: crypto.randomBytes(5).toString('hex'), plot, type: 0, name, t: Date.now(), dev, ip: ih, days: 1, last: today(), lk: [], lki: {}, ch, st: [0, 0, 0, 0, 0] };
      if (pin && !gsub0) await setPin(h, pin); else if (gsub0) h.g = gsub0;   // حساب قوقل موثّق: البيت يرتبط بحسابه وما يحتاج رمز
      // بعد انتظار التشفير: تأكد ما أحد سبقه على نفس الأرض أو بنى من نفس الجهاز
      if (houses.some(x => x.plot === plot)) return json(res, 409, { error: 'أحد سبقك على هذي الأرض، اختر غيرها' });
      if (houses.some(x => x.dev === dev)) return json(res, 409, { error: 'عندك بيت من قبل 🙂' });
      // 🎁 دعوة صديق: لو دخل من رابط لاعب (ref = رقم بيت الداعي) وفتح بيت جديد → الداعي ياخذ 100 🪙
      // حماية: مو نفس الجهاز ولا نفس الشبكة ولا نفس حساب قوقل، وحد أقصى 10 دعوات باليوم لكل لاعب
      const ref = typeof d.ref === 'string' && /^[0-9a-f]{10}$/.test(d.ref) ? d.ref : '';
      if (ref) {
        const h0 = houses.find(x => x.id === ref);
        if (h0 && h0.dev && h0.dev !== dev && h0.ip !== ih && !(gsub0 && h0.g === gsub0)) {
          const k0 = devHash(h0.dev), e0 = ecoGet(k0), td = today();
          if (e0.rfDay !== td) { e0.rfDay = td; e0.rfToday = 0; }
          if ((e0.rfToday | 0) < REF_MAX_DAY) { h.rb = h0.id; ecoDo(k0, (e, evs) => { e.c += REF_GOLD; e.rfc = (e.rfc | 0) + 1; e.rfToday = (e.rfToday | 0) + 1; evs.push('🎉 «' + safeNm(name, 'صديقك') + '» فتح بيت من رابطك! +' + REF_GOLD + ' 🪙'); }); }
        }
      }
      houses.push(h); save(); housesNow();
      return json(res, 200, { house: pub(h), hasPin: true });
    });
  }

  // بيتي (حسب الجهاز) + احتساب زيارة اليوم + البيوت اللي عطيتها لايك + هل له رمز سري
  if (url === '/api/mine' && req.method === 'POST') {
    return body(req, d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      const h = dev && houses.find(x => x.dev === dev);
      let upgraded = false, newDay = false;
      if (h && !h.g) { const gs = accByDev.get(dev); if (gs) { h.g = gs; save(); } }   // البيت يرتبط بحساب صاحبه الموثّق
      if (h) {
        const td = today();
        if (h.last !== td) {
          h.days = (h.days || 1) + 1; h.last = td; newDay = true;
          const nl = levelFor(h.days); if (nl > h.type) { h.type = nl; upgraded = true; }
          save();
        }
      }
      const dh = dev ? devHash(dev) : '';
      const liked = dh ? houses.filter(x => (x.lk || []).includes(dh)).map(x => x.id) : [];
      const next = h ? LEVEL_DAYS.find(x => x > (h.days || 1)) || null : null;
      const dys = h ? (h.days || 1) : 0;
      json(res, 200, { house: h ? pub(h) : null, upgraded, next, liked, hasPin: h ? (!!h.ph || !!h.g) : false,
        days: dys, unl: h ? unlockedFor(dys) : [], rw: h && newDay ? REWARD_ORDER[dys - 1] || null : null, nrw: h ? REWARD_ORDER[dys] || null : null });
    });
  }

  // حط رمز لبيت قديم ما له رمز (من جهاز صاحبه فقط)، أو غيّر الرمز بالرمز القديم
  if (url === '/api/pin' && req.method === 'POST') {
    if (recoverLimited(ip)) return json(res, 429, { error: 'محاولات كثيرة، جرّب بعد 10 دقائق' });
    return body(req, async d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      const h = dev.length >= 8 && houses.find(x => x.dev === dev);
      if (!h) return json(res, 403, { error: 'هذا مو بيتك' });
      const pin = cleanPin(d.pin);
      if (!pin) return json(res, 400, { error: 'الرمز 4 خانات أو أكثر' });
      if (h.ph) { const r = await checkPin(h, d.old); if (r !== 'ok') return json(res, 403, { error: r === 'bad' ? 'الرمز القديم غير صحيح' : PIN_ERR[r] }); }
      await setPin(h, pin); save();
      return json(res, 200, { ok: true });
    });
  }

  // تخصيص الشخصية والبيت بالعناصر اللي انفتحت بأيام الدخول
  if (url === '/api/style' && req.method === 'POST') {
    if (limited(ip)) return json(res, 429, { error: 'كثير طلبات، جرّب بعد دقيقة' });
    return body(req, d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      const h = dev.length >= 8 && houses.find(x => x.dev === dev);
      if (!h) return json(res, 403, { error: 'ابنِ بيتك أول' });
      const st = cleanStyle(d.st, h.days || 1, ownOf(dev));
      if (!st) return json(res, 400, { error: 'هذا العنصر لسا ما انفتح — ارجع في أيام ثانية أو اشتره من السوق 🛒' });
      if (st.some((v, i) => v !== (h.st || [])[i])) { h.st = st; save(); }
      return json(res, 200, { house: pub(h) });
    });
  }

  // تغيير شخصيتي (من جهاز صاحب البيت — ما يحتاج رمز، مجرد شكل)
  if (url === '/api/char' && req.method === 'POST') {
    if (limited(ip)) return json(res, 429, { error: 'كثير طلبات، جرّب بعد دقيقة' });
    return body(req, d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      const h = dev.length >= 8 && houses.find(x => x.dev === dev);
      if (!h) return json(res, 403, { error: 'ابنِ بيتك أول' });
      const ch = cleanCh(d.ch, isLeg(dev), ownOf(dev));
      if (ch === null) return json(res, 400, { error: d.ch >= 16 ? 'هذا السكن تشتريه من السوق 🛒' : d.ch >= 11 ? 'هذي السكنات الأسطورية حصرية للي كانوا معنا اليوم وبكره 🌟' : 'طلب غير صحيح' });
      if (h.ch !== ch) { h.ch = ch; save(); }
      return json(res, 200, { house: pub(h) });
    });
  }

  // تحكم ببيتي: تغيير الاسم أو الحذف — يحتاج الرمز السري
  if (url === '/api/manage' && req.method === 'POST') {
    if (recoverLimited(ip)) return json(res, 429, { error: 'محاولات كثيرة، جرّب بعد 10 دقائق' });
    return body(req, async d => {
      const h = d && houses.find(x => x.id === d.id);
      if (!h) return json(res, 404, { error: 'البيت غير موجود' });
      const mdev = typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      if (h.g) { if (!(mdev.length >= 8 && h.dev === mdev && accByDev.get(mdev) === h.g)) return json(res, 403, { error: 'هذا البيت موثّق بحساب قوقل — سجّل دخولك بقوقل من جهازك' }); }   // بيت موثّق: بدون رمز، يفتح لصاحب الحساب بس
      else { const r = await checkPin(h, cleanPin(d.pin)); if (r !== 'ok') return json(res, 403, { error: PIN_ERR[r] }); }
      if (d.action === 'rename') {
        const name = cleanName(d.name);
        if (!name) return json(res, 400, { error: 'الاسم غير مقبول (حروف وأرقام فقط، من 2 إلى 18 حرف)' });
        h.name = name; save();
        return json(res, 200, { house: pub(h) });
      }
      if (d.action === 'delete') {
        houses = houses.filter(x => x !== h); save(); housesNow();
        return json(res, 200, { removed: 1 });
      }
      return json(res, 400, { error: 'طلب غير صحيح' });
    });
  }

  // «هذا بيتي»: استرجاع البيت على جهاز جديد بالرمز السري (الجهاز القديم يفقده)
  if (url === '/api/claim' && req.method === 'POST') {
    if (recoverLimited(ip)) return json(res, 429, { error: 'محاولات كثيرة، جرّب بعد 10 دقائق' });
    return body(req, async d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      const h = d && houses.find(x => x.id === d.id);
      if (dev.length < 8 || !h) return json(res, 400, { error: 'طلب غير صحيح' });
      if (h.dev === dev) return json(res, 200, { house: pub(h) });
      if (h.g) return json(res, 403, { error: 'هذا البيت موثّق بحساب قوقل — صاحبه يدخل بحسابه (⚙️ الإعدادات ← ربط الحساب بقوقل)' });
      if (houses.some(x => x.dev === dev)) return json(res, 409, { error: 'هذا الجهاز عنده بيت ثاني' });
      const r = await checkPin(h, cleanPin(d.pin));
      if (r !== 'ok') return json(res, 403, { error: PIN_ERR[r] });
      // انقل لايكات الجهاز القديم للجهاز الجديد حتى ما تضيع
      const oldDh = devHash(h.dev), newDh = devHash(dev);
      for (const x of houses) {
        const i = (x.lk || []).indexOf(oldDh);
        if (i >= 0 && !x.lk.includes(newDh)) { x.lk[i] = newDh; if (x.lki && x.lki[oldDh]) { x.lki[newDh] = x.lki[oldDh]; delete x.lki[oldDh]; } }
      }
      h.dev = dev; save();
      return json(res, 200, { house: pub(h) });
    });
  }

  // لايك / إلغاء لايك
  if (url === '/api/like' && req.method === 'POST') {
    if (limited(ip)) return json(res, 429, { error: 'كثير طلبات، جرّب بعد دقيقة' });
    return body(req, d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      const h = d && houses.find(x => x.id === d.id);
      if (dev.length < 8 || !h) return json(res, 400, { error: 'طلب غير صحيح' });
      if (h.dev === dev) return json(res, 400, { error: 'ما تقدر تعطي بيتك لايك 😄' });
      const dh = devHash(dev), ih = hashIp(ip); h.lk = h.lk || []; h.lki = h.lki || {};
      const i = h.lk.indexOf(dh); let liked;
      if (i >= 0) { h.lk.splice(i, 1); delete h.lki[dh]; liked = false; }
      else {
        const fromNet = Object.values(h.lki).filter(x => x === ih).length;
        if (fromNet >= MAX_LIKES_PER_IP) return json(res, 409, { error: 'وصلت حد اللايكات لهذا البيت من شبكتك' });
        h.lk.push(dh); h.lki[dh] = ih; liked = true; ecoDo(dh, (e, evs) => ecoTask(e, 'lk', 1, evs));
      }
      save();
      json(res, 200, { likes: h.lk.length, liked });
    });
  }

  // تبليغ عن لاعب: peer = رقمه بالجلسة، أو house = رقم بيته. الأسباب أرقام جاهزة (بدون كتابة حرة)
  if (url === '/api/report' && req.method === 'POST') {
    if (reportLimited(ip)) return json(res, 429, { error: 'بلاغات كثيرة، جرّب بعد شوي' });
    return body(req, d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      if (dev.length < 8) return json(res, 400, { error: 'طلب غير صحيح' });
      if (!Number.isInteger(d.reason) || d.reason < 0 || d.reason >= REPORT_REASONS) return json(res, 400, { error: 'اختر سبب البلاغ' });
      let t = null;
      if (typeof d.peer === 'string') { const live = [...clients].find(x => x.id === d.peer), o = live || ghosts.get(d.peer); if (o) t = { home: o.home || null, name: o.name, dev: o.dev || '', w: live ? (() => { try { return zoneOf(live); } catch { return ''; } })() : (o.w || '') + ' (طلع)' }; }
      else if (typeof d.house === 'string') { const h = houses.find(x => x.id === d.house); if (h) { const live = [...clients].find(x => x.ready && x.home === h.id); t = { home: h.id, name: h.name, dev: h.dev, w: live ? (() => { try { return zoneOf(live); } catch { return ''; } })() : 'مو متصل (بلاغ على البيت)' }; } }
      if (!t) return json(res, 404, { error: 'ما لقينا اللاعب (يمكن طلع)' });
      if (t.dev && t.dev === dev) return json(res, 400, { error: 'ما تقدر تبلّغ عن نفسك' });
      const k = t.home || 'd:' + devHash(t.dev), by = devHash(dev), now = Date.now(); t.log = evGet(k);
      if (mod.reports.some(r => r.k === k && r.by === by && now - r.t < 86400e3)) return json(res, 200, { ok: true, dup: true });
      mod.reports.push({ id: crypto.randomBytes(4).toString('hex'), t: now, k, name: t.name, home: t.home, reason: d.reason, by, log: t.log, w: t.w || '', done: false });
      if (mod.reports.length > 500) mod.reports.splice(0, mod.reports.length - 500);
      saveMod(); setImmediate(ccPing);
      return json(res, 200, { ok: true });
    });
  }

  // ===== ربط الحساب بقوقل (تحويل OAuth — ما نحمّل أي سكربت من قوقل بصفحة اللعبة) =====
  if (url === '/api/g/status' && req.method === 'POST') {
    return body(req, d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      const sub = dev.length >= 8 ? accByDev.get(dev) : null;
      json(res, 200, { on: gaOn(), linked: !!sub, em: sub ? acc.subs[sub].em : '' });
    });
  }
  if (url === '/api/g/sync' && req.method === 'POST') {   // قائمة المحظورين + أفضل النتائج تنحفظ بالحساب (مدمجة بين الأجهزة)
    if (limited(ip)) return json(res, 429, { error: 'كثير طلبات' });
    return body(req, d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '', sub = dev.length >= 8 ? accByDev.get(dev) : null;
      if (!sub) return json(res, 404, { error: 'الحساب غير مربوط' });
      const a = acc.subs[sub], dt = a.d || (a.d = { bl: [], gs: {} });
      const ids = Array.isArray(d.bl) ? [...new Set(d.bl.filter(x => typeof x === 'string' && /^[a-f0-9]{10}$/.test(x)))].slice(-300) : [];
      if (d.mode === 'union') dt.bl = [...new Set([...dt.bl, ...ids])].slice(-300); else if (d.mode === 'set') dt.bl = ids;   // adopt: نرجّع اللي عند السيرفر
      for (const k of GS_KEYS) {
        const v = d.gs && Number.isInteger(d.gs[k]) && d.gs[k] > 0 && d.gs[k] <= 1e7 ? d.gs[k] : 0, cur = dt.gs[k] || 0;
        dt.gs[k] = !v ? cur : !cur ? v : k === 'memory' ? Math.min(v, cur) : Math.max(v, cur);   // الذاكرة: الأقل أفضل
      }
      saveAcc(); return json(res, 200, { bl: dt.bl, gs: dt.gs });
    }, 8000);
  }
  if (url === '/api/g/start' && req.method === 'POST') {
    if (limited(ip)) return json(res, 429, { error: 'كثير طلبات، جرّب بعد دقيقة' });
    return body(req, d => {
      const dev = d && typeof d.device === 'string' ? d.device.slice(0, 64) : '';
      if (dev.length < 8) return json(res, 400, { error: 'طلب غير صحيح' });
      if (!gaOn()) return json(res, 503, { error: 'الربط بقوقل غير مفعّل بعد' });
      return json(res, 200, { url: gaStart(dev) });
    });
  }
  if (url === '/auth/google/callback' && req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams;
    return gaCallback(q.get('code') || '', q.get('state') || '').then(code => {
      res.writeHead(302, { ...SEC, Location: '/?g=' + code, 'Cache-Control': 'no-store' }); res.end();
    });
  }

  // ===== لوحة المشرف (رمز المدير بالترويسة X-Admin) =====
  if (url.startsWith('/api/admin/')) {
    const code = adminAuth(req, ip);
    if (code !== 200) return json(res, code, { error: code === 429 ? 'محاولات كثيرة، جرّب بعد 10 دقايق' : 'الرمز غير صحيح' });
    if (url === '/api/admin/state' && req.method === 'GET') {
      const g = new Map();
      for (const r of mod.reports) { if (r.done) continue; let x = g.get(r.k); if (!x) g.set(r.k, x = { k: r.k, name: r.name, home: r.home, count: 0, reasons: {}, last: 0, log: [] }); x.count++; x.reasons[r.reason] = (x.reasons[r.reason] || 0) + 1; if (r.t >= x.last) { x.last = r.t; x.name = r.name; if (r.log.length) x.log = r.log; } }
      const reports = [...g.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 100).map(x => ({ ...x, banned: !!mod.bans[x.k], log: x.log.map(l => ({ x: l.x })) }));
      const online = [...clients].filter(o => o.ready).map(o => ({ id: o.id, name: o.name, home: o.home || null, k: keyOf(o), banned: isBanned(o), mins: Math.round((Date.now() - o.tt0) / 60000) }));
      const bans = Object.keys(mod.bans).filter(k => banLeft(k) > 0).map(k => ({ k, name: mod.bans[k].name, t: mod.bans[k].t, until: mod.bans[k].until || 0, auto: mod.bans[k].auto ? 1 : 0, ev: evGet(k, 4) }));
      return json(res, 200, { reports, online, bans, houses: houses.length, stats: statsView() });
    }
    if (url === '/api/admin/act' && req.method === 'POST') return body(req, d => {
      const k = d && typeof d.k === 'string' ? d.k.slice(0, 40) : '';
      switch (d && d.a) {
        case 'dismiss': mod.reports.forEach(r => { if (r.k === k) r.done = true; }); break;
        case 'ban': { if (!k) return json(res, 400, { error: 'طلب غير صحيح' }); const r = mod.reports.find(x => x.k === k), o = [...clients].find(x => keyOf(x) === k);
          mod.bans[k] = { t: Date.now(), name: (o && o.name) || (r && r.name) || '' }; break; }
        case 'unban': delete mod.bans[k]; break;
        case 'kick': { const o = [...clients].find(x => x.id === d.id); if (o) wsClose(o); break; }
        case 'delhouse': { const n = houses.length; houses = houses.filter(h => h.id !== d.id); if (houses.length !== n) { save(); housesNow(); }
          mod.reports.forEach(r => { if (r.home === d.id) r.done = true; }); for (const o of [...clients]) if (o.home === d.id) wsClose(o); break; }
        default: return json(res, 400, { error: 'طلب غير صحيح' });
      }
      saveMod(); setImmediate(ccPing);
      return json(res, 200, { ok: true });
    });
    return json(res, 404, { error: 'غير موجود' });
  }

  // حذف (للمدير فقط): DELETE /api/house/<id>?token=...
  if (url.startsWith('/api/house/') && req.method === 'DELETE') {
    const token = new URL(req.url, 'http://x').searchParams.get('token') || '';
    const a = Buffer.from(token), b = Buffer.from(ADMIN_TOKEN);
    const ok = ADMIN_TOKEN && a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return json(res, 403, { error: 'ممنوع' });
    const id = url.split('/').pop();
    const n = houses.length; houses = houses.filter(h => h.id !== id);
    if (houses.length !== n) save();
    return json(res, 200, { removed: n - houses.length });
  }

  if (url.startsWith('/api/')) return json(res, 404, { error: 'غير موجود' });
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  res.writeHead(405, SEC); res.end();
});

// ================= الإشراف: بلاغات + منع كتابة =================
// البلاغات والممنوعين في ملف منفصل (moderation.json جنب houses.json). المنع = ما يقدر يرسل رسائل (بيته وحركته تبقى).
// مفتاح اللاعب: رقم بيته لو عنده بيت، وإلا d:<بصمة جهازه>.
const MOD_FILE = path.join(path.dirname(DATA), 'moderation.json');
let mod = { reports: [], bans: {}, typers: [], mods: [] };
try { mod = { reports: [], bans: {}, typers: [], mods: [], ...JSON.parse(fs.readFileSync(MOD_FILE, 'utf8')) }; } catch {}
let modTimer = null;
function saveMod() {
  if (modTimer) return;
  modTimer = setTimeout(() => { modTimer = null; try { fs.writeFileSync(MOD_FILE + '.tmp', JSON.stringify(mod)); fs.renameSync(MOD_FILE + '.tmp', MOD_FILE); } catch (e) { console.error('فشل حفظ الإشراف:', e.message); } }, 400);
}
const REPORT_REASONS = 6;      // 0 كلام سيء، 1 تحرش/ملاحقة، 2 يطلب أرقام/حسابات، 3 اسم غير لائق، 4 إزعاج، 5 غير ذلك
const keyOf = c => c.home || 'd:' + devHash(c.dev || '');
// الكتابة الحرة مقفولة على الكل (اللعبة صارت للتعارف: الرسائل الجاهزة فقط) إلا المشرف ومن يفتح له المشرف الكتابة بالضغط على اسمه
const canType = c => !!c.admin || !!c.home || (mod.mods || []).includes(keyOf(c)) || (mod.typers || []).includes(keyOf(c));   // الزائر بدون بيت: رسائل جاهزة فقط   // الرسائل المفتوحة مفعّلة للكل (فلتر الكلام السيء والروابط والأرقام والمنع والحظر كلها تبقى)
//(سابقاً: المشرف ومن يسمح له فقط — mod.typers/tp ما زالت بالكود وما لها أثر)   // TEST_TYPE_HOMES: للاختبارات القديمة فقط (يرجّع سلوك «أصحاب البيوت يكتبون»)
// منع مؤقت تلقائي: ساعة عن كل كلمة بذيئة (تتراكم). المنع اليدوي من المشرف بدون until = دائم
const HOUR = 3600000;
function banLeft(k) { const b = mod.bans[k]; if (!b) return 0; if (!b.until) return Infinity; const l = b.until - Date.now(); if (l <= 0) { delete mod.bans[k]; saveMod(); return 0; } return l; }
const banExempt = c => !!c.admin || (mod.mods || []).includes(keyOf(c));   // صاحب المدينة والمشرفون ما ينمنعون أبداً (لا تلقائي ولا يدوي)
const isBanned = c => !banExempt(c) && banLeft(keyOf(c)) > 0;
const RUDE_WIN = 10 * 60e3, RUDE_MAX = 3;
function autoBan(c, words) {
  const k = keyOf(c), cur = mod.bans[k], base = cur && !cur.until ? null : Math.max(Date.now(), (cur && cur.until) || 0);
  if (base === null) return Infinity;                    // ممنوع دائم أصلاً
  mod.bans[k] = { t: (cur && cur.t) || Date.now(), name: c.name || '', until: base + words * HOUR, auto: true }; saveMod();
  return mod.bans[k].until - Date.now();
}
function bnSend(c) {   // حالة منعي من الكتابة (للزر «📢 تظلّم»)
  const k = keyOf(c), b = mod.bans[k], l = banLeft(k); if (!b || l <= 0) return wsSend(c, { t: 'bn', on: 0 });
  wsSend(c, { t: 'bn', on: 1, left: l === Infinity ? -1 : l, ap: b.ap ? 1 : 0 });
}
const leftTxt = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} ساعة${m % 60 ? ' و' + (m % 60) + ' دقيقة' : ''}` : `${m} دقيقة`; };
const reportLimited = limiter(60000, 5);     // 5 بلاغات بالدقيقة لكل شبكة
const adminFails = new Map();                // محاولات خاطئة لرمز المدير: 10 كل 10 دقايق لكل شبكة
function adminAuth(req, ip) { return adminCheck(String(req.headers['x-admin'] || ''), netKey(ip)); }
function adminCheck(tok, k) {
  const now = Date.now(), fails = (adminFails.get(k) || []).filter(t => now - t < 600000);
  if (fails.length >= 10) return 429;
  const a = Buffer.from(String(tok)), b = Buffer.from(ADMIN_TOKEN);
  if (ADMIN_TOKEN && a.length === b.length && crypto.timingSafeEqual(a, b)) return 200;
  fails.push(now); adminFails.set(k, fails); return 403;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of adminFails) if (!v.some(t => now - t < 600000)) adminFails.delete(k); }, 600000).unref();

// ================= اللعب المباشر: اللاعبين يشوفون بعض + رسائل جاهزة =================
// WebSocket مكتوب يدوياً (بدون مكتبات). كل لاعب يرسل مكانه ~8 مرات بالثانية، والسيرفر يرسل له القريبين منه فقط.
// الرسائل بين اللاعبين أرقام من قائمة جاهزة (ما فيه كتابة حرة) → ما يقدر أحد يكتب كلام سيء.
const SAY_N = 80;          // عدد الرسائل الجاهزة (النصوص في الواجهة)
const SAY_COUNTRY = 6;     // رقم رسالة «أنا من …» (تحتاج رقم الدولة)
const COUNTRY_N = 23;      // عدد الدول في القائمة
const MAX_CONN_PER_NET = +process.env.MAX_CONN_PER_NET || 6;
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 1500;
const VIEW_WALK = 150, VIEW_SKY = 340, MAX_SEEN = 30;
const CAR_N = 8;           // عدد السيارات (لازم يطابق CARS في public/chars.js)
const CHAT_R = 70;        // الرسالة يشوفها كل اللي داخل هالمسافة منك
const clients = new Set(), CQ_DEST = ['plaza', 'mall', 'craft', 'fair', 'track', 'games', 'home', 'wp'];
const ghosts = new Map();      // لاعبين طلعوا قريب (15 دقيقة): يظلون قابلين للتبليغ
let nextId = 1;

// يرتّب المصفوفة بحيث أول k عناصر هم الأقرب (اختيار سريع O(n) بدل ترتيب كامل)
function nearestK(arr, k) {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const pv = arr[(lo + hi) >> 1][0]; let i = lo, j = hi;
    while (i <= j) { while (arr[i][0] < pv) i++; while (arr[j][0] > pv) j--; if (i <= j) { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; i++; j--; } }
    if (k - 1 <= j) hi = j; else if (k - 1 >= i) lo = i; else break;
  }
}
function wsSend(c, obj) { return wsSendRaw(c, JSON.stringify(obj)); }
function wsSendRaw(c, str) {
  if (c.dead) return;
  if (c.sock.writableLength > 256 * 1024) return wsClose(c);   // جهاز بطيء ما يلحق — نقطعه بدل ما تتكدس الذاكرة
  const p = Buffer.from(str);
  let h;
  if (p.length < 126) h = Buffer.from([0x81, p.length]);
  else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(p.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
  c.sock.write(Buffer.concat([h, p]));
}
const hSlots = new Map(), hUsed = new Set();   // بيت → رقم مكان غرفته (الداخل يُبنى بإحداثيات بعيدة، لازم نفس الرقم لكل اللي داخله)
// رقم غرفة ثابت لكل بيت (القصور 0..999، البيوت 1000+رقم الأرض) — كان يتوزّع مؤقتاً ويتحرّر، فبعد إعادة تشغيل/انقطاع يتشارك بيتين نفس الغرفة (غرباء داخل بيتك وزوارك ما يبانون)
function slotOf(hid) { if (typeof hid === 'string' && hid[0] === 'v') { const i = vip.houses.findIndex(x => x.id === hid); return i >= 0 ? i % 1000 : 999; } const h = houses.find(x => x.id === hid); return h ? 1000 + (h.plot | 0) : 999; }
// يقدر يسمح للطارقين: صاحب البيت/القصر، أو أي صاحب قصر (مو زائر) واقف داخل هذا القصر
const canAdmit = (c, id) => owns(c, id) || (typeof id === 'string' && id[0] === 'v' && c.inH === id && !!c.vip && !c.vtour && !!c.vhs && c.vhs.length > 0);
const inCity = o => (!!o.inH && o.inH[0] === 'v') || vipInside(o.x, o.z);   // داخل مدينة المشتركين (أو داخل أحد قصورها)
const owns = (c, id) => !!id && (id === c.home || (!!c.vhs && c.vhs.includes(id)));   // بيتي أو أي قصر من قصوري (VIP)
function houseLeave(c) {   // يطلع من البيت؛ لو هو صاحبه كل الزوار يطلعون
  const was = c.inH; c.inH = null; c.kh = null;
  if (was && owns(c, was)) for (const o of clients) if (o !== c && o.inH === was) { o.inH = null; wsSend(o, { t: 'out', k: 2 }); }
}
function wsClose(c) {   houseLeave(c); mgLeave(c);
  if (c.dead) return;
  c.dead = true; clients.delete(c); gLeave(c); try { stEnd(c); } catch {}
  if (c.ready) { ghosts.set(c.id, { id: c.id, name: c.name, home: c.home || null, dev: c.dev || '', log: c.log, t: Date.now(), w: (() => { try { return zoneOf(c); } catch { return ''; } })() }); if (ghosts.size > 300) ghosts.delete(ghosts.keys().next().value); }
  try { c.sock.end(Buffer.from([0x88, 0])); } catch {}
  setTimeout(() => c.sock.destroy(), 1000).unref();
  for (const o of clients) o.known.delete(c.id);
}
// يفك إطارات العميل (مقنّعة، نصية، بدون تجزئة، حجم صغير)
function wsData(c, chunk) {
  c.buf = c.buf.length ? Buffer.concat([c.buf, chunk]) : chunk;
  if (c.buf.length > 8192) return wsClose(c);
  while (c.buf.length >= 2) {
    const b0 = c.buf[0], b1 = c.buf[1], op = b0 & 0x0f, fin = b0 & 0x80;
    let len = b1 & 0x7f, off = 2;
    if (!(b1 & 0x80)) return wsClose(c);                       // العميل لازم يقنّع
    if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
    else if (len === 127) return wsClose(c);
    if (len > 1024) return wsClose(c);
    if (c.buf.length < off + 4 + len) return;
    const mask = c.buf.subarray(off, off + 4), data = Buffer.from(c.buf.subarray(off + 4, off + 4 + len));
    for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    c.buf = c.buf.subarray(off + 4 + len);
    if (!fin || op === 0) return wsClose(c);
    if (op === 8) return wsClose(c);
    if (op === 9) { if (data.length < 126) c.sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
    if (op === 10) continue;
    if (op !== 1) return wsClose(c);
    // حد السرعة: 25 رسالة بالثانية كحد أقصى
    const now = Date.now();
    c.tokens = Math.min(25, c.tokens + (now - c.tt) / 1000 * 25); c.tt = now;
    if (c.tokens < 1) return wsClose(c);
    c.tokens--; c.seen = now;
    let m; try { m = JSON.parse(data.toString('utf8')); } catch { return wsClose(c); }
    if (m && typeof m === 'object') onMsg(c, m);
  }
}
const num = (v, lim) => typeof v === 'number' && Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0;
const isModC = c => !c.admin && (mod.mods || []).includes(keyOf(c));   // مشرف (مو صاحب المدينة)
// ===== 📨 مركز الشكاوي: البلاغات + تظلّمات الحظر + اعتراضات السجن — لصاحب المدينة والمشرفين والمدير العام =====
const ccCan = c => !!c && c.ready && (c.admin || isModC(c) || isGM(c));
// ===== 🧾 سجل الأدلة: آخر EV_N رسائل لكل شخص (مفتاحه keyOf) — k: w مكتوبة، s جاهزة (i,a)، g لعبة (x أو i)، b محجوبة بالفلتر (e السبب)، w المكان =====
// يشوفه بس صاحب المدينة والمشرفين والمدير العام (عبر البلاغات/التظلّمات). محفوظ بـdata/evidence.json (يومين)
const EV_FILE = path.join(path.dirname(DATA), 'evidence.json'), EV_N = 12, EV_KEEP = 2 * 86400e3, EV_MAXK = 20000;
let evd = {}; try { evd = JSON.parse(fs.readFileSync(EV_FILE, 'utf8')) || {}; } catch {}
let evDirty = false;
function evAdd(c, e) { if (!c || !c.dev) return; const k = keyOf(c), a = evd[k] || (evd[k] = []); e.t = Date.now(); try { e.w = zoneOf(c); } catch {} a.push(e); if (a.length > EV_N) a.splice(0, a.length - EV_N); evDirty = true; }
const evGet = (k, n = EV_N) => (evd[k] || []).slice(-n);
function evSaveNow() { const lim = Date.now() - EV_KEEP; let ks = Object.keys(evd); for (const k of ks) { const a = evd[k].filter(e => e.t > lim); if (a.length) evd[k] = a; else delete evd[k]; }
  ks = Object.keys(evd); if (ks.length > EV_MAXK) { ks.sort((a, b) => evd[a][evd[a].length - 1].t - evd[b][evd[b].length - 1].t); for (const k of ks.slice(0, ks.length - EV_MAXK)) delete evd[k]; }
  try { fs.writeFileSync(EV_FILE, JSON.stringify(evd)); } catch (e) { console.error('حفظ الأدلة:', e.message); } evDirty = false; }
setInterval(() => { if (evDirty) evSaveNow(); }, +process.env.EV_SAVE_MS || 60e3).unref();
const evText = x => typeof x === 'string' ? x.slice(0, 120) : '';
const ccProt = k => (mod.mods || []).includes(k) || [...clients].some(x => x.admin && keyOf(x) === k) || (job.emp[k] && job.emp[k].j === 'gm');   // ما ينحظر
function ccReps() {
  const g = new Map();
  for (const r of mod.reports) { if (r.done) continue; let x = g.get(r.k); if (!x) g.set(r.k, x = { k: r.k, n: r.name, home: r.home, c: 0, rs: {}, t0: r.t, t: 0, log: [] }); x.c++; x.rs[r.reason] = (x.rs[r.reason] || 0) + 1; if (r.t < x.t0) x.t0 = r.t; if (r.t >= x.t) { x.t = r.t; x.n = r.name; x.w = r.w || x.w; if (r.log && r.log.length) x.log = r.log; } }
  return [...g.values()].sort((a, b) => b.c - a.c || b.t - a.t);
}
const ccAps = () => (mod.appeals || []).filter(a => !a.done && banLeft(a.k) > 0);
const ccJails = () => Object.entries(job.jail).filter(([, r]) => r.ap && !r.apx && r.until > Date.now());
const DEL_DAY = +process.env.DEL_DAY || 10;   // كم بيت يقدر يحذف المشرف/المدير العام باليوم (صاحب المدينة بلا حد)
const ccDelLeft = c => { if (c.admin) return -1; const q = (mod.dq || {})[keyOf(c)]; return Math.max(0, DEL_DAY - (q && q.d === gulfDay() ? q.n : 0)); };
function ccCount(c) { return ccReps().length + ccAps().length + (jPolBoss(c) ? ccJails().length : 0); }
function ccData(c) {
  const now = Date.now(), on = new Set([...clients].filter(o => o.ready).map(keyOf));
  const reps = ccReps().slice(0, 80).map(x => ({ k: x.k, n: x.n, h: x.home ? 1 : 0, c: x.c, rs: x.rs, t0: x.t0, t: x.t, log: ((x.log && x.log.length ? x.log : evGet(x.k)) || []).slice(-EV_N), lv: !(x.log && x.log.length), w: x.w || '', ban: banLeft(x.k) > 0 ? 1 : 0, on: on.has(x.k) ? 1 : 0, p: ccProt(x.k) ? 1 : 0 }));
  const aps = ccAps().map(a => { const l = banLeft(a.k); return { id: a.id, k: a.k, n: a.n, t: a.t, left: l === Infinity ? -1 : l, by: a.by || (a.auto || (mod.bans[a.k] && mod.bans[a.k].auto) ? '🤖 الفلتر التلقائي' : ''), log: a.log && a.log.length ? a.log : evGet(a.k, 8), on: on.has(a.k) ? 1 : 0 }; });
  const jails = jPolBoss(c) ? ccJails().map(([k, r]) => ({ k, n: r.n, left: r.until - now, bn: r.bn || '', r: r.r, on: on.has(k) ? 1 : 0 })) : [];
  return { t: 'ccl', reps, aps, jails, hist: (mod.cch || []).slice(-40).reverse(), adm: c.admin ? 1 : 0, jp: jPolBoss(c) ? 1 : 0, dl: ccDelLeft(c) };
}
function ccLog(c, n, a) { mod.cch = mod.cch || []; mod.cch.push([Date.now(), n || '', a, c.admin ? 'صاحب المدينة' : c.name || '']); if (mod.cch.length > 150) mod.cch.splice(0, mod.cch.length - 150); saveMod(); }
function ccPing() { for (const o of clients) { if (!o.ready) continue; if (ccCan(o)) { const n = ccCount(o); if (n !== o.ccN) { o.ccN = n; wsSend(o, { t: 'ccn', n }); } } else if (o.ccN !== undefined) { delete o.ccN; wsSend(o, { t: 'ccn', off: 1 }); } } }
setInterval(ccPing, 4000).unref();
function meta(c) { const st = c.st || [0, 0, 0, 0, 0], md = isModC(c), je = jEmp(c), J = je && JOBS[je.j], uni = J && c.juni !== false && J.uni >= 0 ? J.uni : c.ch; return [c.id, badgeName(c), uni, c.home || '', md ? 3 : st[0], st[1], c.ch >= 11 && c.ch <= 15 ? 8 + (c.ch - 11) : st[2], md ? 1 : 0, J ? (je.sup ? J.c.toUpperCase() : J.c) : '', jFlags(c)]; }   // [8] الوظيفة [9] أعلام (مصاب/صفارة/مسجون) — والزي يغيّر السكن   // المشرف: تاج ذهبي + «مشرف» بالأحمر فوق راسه   // السكن الأسطوري له شارة اسم خاصة (8..12)
function onMsg(c, m) {
  if (typeof m.t === 'string' && c.ready && JAIL_BLOCK.has(m.t) && isJailed(c)) return jErr(c, '🔒 أنت مسجون — ما تقدر تسوي هذا لين تطلع');
  if (typeof m.t === 'string' && (m.t[0] === 'j' || m.t === 'thc' || m.t === 'thn') && m.t.length <= 3) return jobMsg(c, m);
  switch (m.t) {
    case 'hi': {   // من أنا: صاحب بيت (حسب الجهاز) أو زائر
      const dev = typeof m.d === 'string' ? m.d.slice(0, 64) : '';
      const h = dev.length >= 8 && houses.find(x => x.dev === dev);
      c.name = h ? safeNm(h.name, 'زائر') : (cleanName(m.n) || 'زائر');
      c.home = h ? h.id : null;
      c.dev = dev;
      c.ch = h ? (h.ch | 0) : (cleanCh(m.c, isLeg(dev), ownOf(dev)) ?? 0);
      c.st = h && h.st ? h.st : [0, 0, 0, 0, 0];
      if (c.admin) { c.name = 'من الصفر'; c.ch = 10; c.st = [7, 5, 7, 0, 0]; }
      c.ready = true; ecoHi(c);
      wsSend(c, { t: 'race', s: race.s === 'run' ? 'run' : race.s === 'cd' ? 'run' : race.s === 'lobby' ? 'lobby' : 'idle', n: race.racers.size, left: race.s === 'lobby' ? Math.max(0, Math.ceil((race.lobbyEnd - Date.now()) / 1000)) : 0 });   // يعرف حالة السباق الحالية (وما يعلق بحالة قديمة بعد إعادة الاتصال)
      { const ss = c.dh && vipSess.get(c.dh); if (ss && Date.now() - ss.t < 12 * 3600e3) { const hs = (ss.hs || []).filter(id => vip.houses.some(x => x.id === id)); if (hs.length || !(ss.hs || []).length) { c.vip = true; c.vhs = hs; } } c.gsub = c.dev && accByDev.get(c.dev) || null;
        if (c.gsub) { vipBindAcct(c); const mh = vip.houses.filter(x => x.g === c.gsub); if (mh.length) { vipGrant(c, mh[0]); c.vhs = [...new Set(mh.flatMap(x => vipGroup(x).map(y => y.id)))]; } }   // قصرك مربوط بحساب قوقل → يفتح لك تلقائياً
        if (!c.vip && vipTour(c) === 1) vipTourStart(c);   // رجع/حدّث الصفحة وزيارته المجانية للحين شغّالة
        wsSend(c, vhMsg(c)); }
      for (const o of clients) if (o !== c) o.known.delete(c.id);   // الكل ياخذ اسمه/شخصيته الجديدة
      wsSend(c, { t: 'ct', on: canType(c) }); if ((mod.mods || []).includes(keyOf(c))) wsSend(c, { t: 'so', on: true });
      wsSend(c, { t: 'me', id: c.id, n: c.name, ts: Date.now() });
      { const je = jEmp(c); if (je) { je.last = Date.now(); if (c.name && je.n !== c.name) je.n = c.name; } } wsSend(c, jbMsg(c)); if (isJailed(c)) wsSend(c, jlMsg(c)); wsSend(c, { t: 'pkey', k: b64u(VAPID_PUB), has: c.dh && push.subs[c.dh] ? 1 : 0 }); if (!banExempt(c) && banLeft(keyOf(c)) > 0) bnSend(c);   // 🔔
      { const ij = injK.get(keyOf(c)), nw = Date.now(); if (ij && ij.until > nw) { c.inj = ij.until; c.injS = ij.s; c.injT = nw; wsSend(c, { t: 'jhl', on: 1, left: ij.until - nw, s: 0, back: 1 }); } else { if (ij) injK.delete(keyOf(c)); wsSend(c, { t: 'jhl', on: 0, n: '', q: 1 }); } }   // الإصابة ترجع بعد إعادة الاتصال (أو تنفك لو خلصت) if (th.on) wsSend(c, thMsg());   // 💼 الوظائف + السجن + الحرامي
      return;
    }
    case 'admin': {   // صاحب المدينة: يثبت نفسه برمز المدير فيظهر باسم «من الصفر» ولبس ملكي وتاج حصري
      if (typeof m.k !== 'string' || m.k.length > 100) return;
      if (adminCheck(m.k, c.net) !== 200) return;
      c.admin = true; c.name = 'من الصفر'; c.ch = 10; c.st = [7, 5, 7, 0, 0]; c.vip = true; { const ah = vip.houses.find(x => x.adm); c.vhs = ah ? vipGroup(ah).map(x => x.id) : []; if (ah && c.gsub) { let ch = false; for (const x of vipGroup(ah)) if (!x.g) { x.g = c.gsub; if (c.home && !x.hh) x.hh = c.home; ch = true; } if (ch) saveVip(); } }   // قصر صاحب المدينة يرتبط بحسابه أول ما يدخل كمشرف
      for (const o of clients) if (o !== c) o.known.delete(c.id);
      wsSend(c, vhMsg(c));
      wsSend(c, { t: 'ct', on: true }); wsSend(c, jbMsg(c));
      return wsSend(c, { t: 'admin', ok: true });
    }
    // ===== المشرفون: صاحب المدينة يعيّن مشرفاً (بالضغط على اسمه) يقدر يمنع الناس من الكتابة (ساعة/يوم) ويفكّ المنع =====
    case 'sa': {
      if (!c.admin || typeof m.f !== 'string') return; const o = [...clients].find(x => x.id === m.f && x.ready); if (!o || o === c || o.admin) return;
      const k = keyOf(o); mod.mods = mod.mods || []; const has = mod.mods.includes(k);
      if (m.on === true && !has) mod.mods.push(k); else if (m.on === false && has) mod.mods = mod.mods.filter(x => x !== k);
      if (mod.mods.length > 200) mod.mods = mod.mods.slice(-200);
      saveMod(); for (const x of clients) if (x.ready && !x.admin && keyOf(x) === k) { wsSend(x, { t: 'so', on: mod.mods.includes(k) }); for (const y of clients) y.known.delete(x.id); }   // نعيد إرسال شكله للكل (التاج والعلامة)
      return wsSend(c, { t: 'sq', f: o.id, mod: mod.mods.includes(k), ban: banLeft(k) > 0 });
    }
    // ===== 🚫 حظر من الدردشة (صاحب المدينة والمشرفين): ساعة / يوم / للأبد — والمحظور يقدر يتظلّم =====
    case 'cc': { if (!ccCan(c)) return wsSend(c, { t: 'ccn', off: 1 }); const now = Date.now(), w = 400 - (now - (c.ccT || 0));
      if (w > 0) { if (!c.ccW) c.ccW = setTimeout(() => { c.ccW = null; if (!c.dead && ccCan(c)) { c.ccT = Date.now(); wsSend(c, ccData(c)); } }, w); return; }   // طلب سريع ورا طلب: نأجّله بدل ما نرميه
      c.ccT = now; return wsSend(c, ccData(c)); }
    case 'cca': {   // إجراء من مركز الشكاوي
      if (!ccCan(c) || typeof m.a !== 'string') return; const k = typeof m.k === 'string' ? m.k.slice(0, 40) : '', now = Date.now(); if (now - (c.ccaT || 0) < 300) return; c.ccaT = now;
      const nmOf = k => { const g = ccReps().find(x => x.k === k); const o = [...clients].find(x => x.ready && keyOf(x) === k); return (o && o.name) || (g && g.n) || (mod.bans[k] && mod.bans[k].name) || (job.jail[k] && job.jail[k].n) || ''; };
      const doneR = k => mod.reports.forEach(r => { if (r.k === k && !r.done) { r.done = true; r.dn = c.name; } });
      const doneA = k => (mod.appeals || []).forEach(a => { if (a.k === k) a.done = true; });
      const nm = nmOf(k);
      switch (m.a) {
        case 'dis': if (!k) return; doneR(k); ccLog(c, nm, '☑️ تجاهل البلاغات'); break;
        case 'ban': { if (!k) return; const mins = m.mins === 60 || m.mins === 1440 ? m.mins : m.mins === 0 ? 0 : -1; if (mins < 0) return;
          if (ccProt(k)) return jErr(c, 'ما تقدر تحظر مشرفاً 🛡️'); if (mins === 0 && !c.admin) return jErr(c, 'الحظر للأبد لصاحب المدينة بس');
          c.kbT = 0; onMsg(c, { t: 'kb', k, mins }); if (banLeft(k) <= 0) return; doneR(k); ccLog(c, nm, '🚫 حظر من الكتابة ' + (mins === 60 ? 'ساعة' : mins === 1440 ? 'يوم' : 'للأبد')); break; }
        case 'unb': if (!k) return; c.kbT = 0; onMsg(c, { t: 'ku', k }); doneA(k); ccLog(c, nm, '✅ فك الحظر'); break;
        case 'apx': if (!k) return; doneA(k); saveMod(); ccLog(c, nm, '✖ رفض التظلّم'); break;
        case 'kick': { if (!c.admin || !k) return; let n = 0; for (const o of [...clients]) if (o.ready && keyOf(o) === k && !o.admin) { wsClose(o); n++; } if (!n) return jErr(c, 'الشخص مو متصل'); ccLog(c, nm, '⏏️ طرد'); break; }
        case 'delh': { if (!k || k.startsWith('d:')) return; if (ccProt(k)) return jErr(c, 'ما تقدر تحذف بيت مشرف 🛡️');
          if (!c.admin && ccDelLeft(c) <= 0) return jErr(c, `خلصت حذوفاتك اليوم (${DEL_DAY} بيوت) — ترجع بكره`);
          const n0 = houses.length; houses = houses.filter(h => h.id !== k); if (houses.length === n0) return jErr(c, 'البيت محذوف من قبل');
          save(); housesNow(); if (!c.admin) { mod.dq = mod.dq || {}; const ck = keyOf(c), td = gulfDay(), q = mod.dq[ck]; mod.dq[ck] = { d: td, n: (q && q.d === td ? q.n : 0) + 1 }; }
          doneR(k); for (const o of [...clients]) if (o.home === k) wsClose(o); ccLog(c, nm, '🗑️ حذف البيت'); break; }
        case 'jrl': { if (!jPolBoss(c) || !jailOf(k)) return; jOverturn(jailOf(k), c); jRelease(k, c.name); ccLog(c, nm, '🔓 إطلاق من السجن'); break; }
        case 'jpx': { if (!jPolBoss(c)) return; const r = jailOf(k); if (!r) return; r.apx = 1; saveJob(); ccLog(c, nm, '✖ رفض اعتراض السجن'); break; }
        default: return;
      }
      saveMod(); ccPing(); return wsSend(c, ccData(c));
    }
    case 'kb': case 'ku': {
      const isM = c.admin || (mod.mods || []).includes(keyOf(c)) || isGM(c); if (!isM || typeof m.k !== 'string' || m.k.length > 40) return; const now = Date.now(); if (now - (c.kbT || 0) < 500) return; c.kbT = now;
      const k = m.k, o = [...clients].find(x => x.ready && keyOf(x) === k), nm = (o && o.name) || (mod.bans[k] && mod.bans[k].name) || '';
      if (m.t === 'ku') { delete mod.bans[k]; saveMod(); for (const x of clients) if (x.ready && keyOf(x) === k) { bnSend(x); wsSend(x, { t: 'err', e: 'x', m: '✅ انفك منعك من الكتابة' }); } return wsSend(c, { t: 'jx', m: '✅ انفك المنع' + (nm ? ' عن ' + nm : '') }); }
      if (ccProt(k)) return jErr(c, 'ما تقدر تحظر مشرفاً 🛡️');
      const mins = m.mins === 60 || m.mins === 1440 ? m.mins : m.mins === 0 && c.admin ? 0 : -1; if (mins < 0) return jErr(c, 'الحظر للأبد لصاحب المدينة بس');
      mod.bans[k] = { t: now, name: nm, until: mins ? now + mins * 60000 : undefined, by: c.admin ? 'admin' : 'mod', bn: c.name }; saveMod();
      const lbl = mins === 60 ? 'ساعة' : mins === 1440 ? 'يوم' : 'للأبد';
      for (const x of clients) if (x.ready && keyOf(x) === k) { wsSend(x, { t: 'err', e: 'banned', m: '🚫 انمنعت من الكتابة ' + lbl + ' بقرار المشرف' }); bnSend(x); }
      return wsSend(c, { t: 'jx', m: '🚫 انمنع' + (nm ? ' ' + nm : '') + ' من الكتابة ' + lbl });
    }
    case 'bap': {   // المحظور يتظلّم (مرة لكل منع) → يوصل لصاحب المدينة والمشرفين المتصلين
      const k = keyOf(c), b = mod.bans[k]; if (!b || banLeft(k) <= 0 || b.ap) return bnSend(c); b.ap = 1; mod.appeals = (mod.appeals || []).filter(a => a.k !== k && (!a.done || Date.now() - a.t < 7 * 86400e3)).slice(-200); mod.appeals.push({ id: crypto.randomBytes(4).toString('hex'), k, n: c.name, t: Date.now(), by: b.bn || '', auto: b.auto ? 1 : 0, log: evGet(k, 8) }); saveMod(); setImmediate(ccPing); let n = 0;
      for (const o of clients) if (o.ready && o !== c && ccCan(o)) { wsSend(o, { t: 'bapn', k, n: c.name, left: banLeft(k) === Infinity ? -1 : banLeft(k), by: b.bn || '', log: (c.log || []).slice(-3).map(x => x.x) }); n++; }
      bnSend(c); return wsSend(c, { t: 'err', e: 'x', m: n ? '📢 وصل تظلّمك للمشرف — انتظر رده' : '📢 انسجل تظلّمك — ما فيه مشرف متصل الحين' });
    }
    case 'sb': case 'sq': {
      const isM = c.admin || (mod.mods || []).includes(keyOf(c)); if (!isM || typeof m.f !== 'string') return;
      const o = [...clients].find(x => x.id === m.f && x.ready); if (!o || o === c) return; const k = keyOf(o);
      if (m.t === 'sb') {
        if (o.admin || (mod.mods || []).includes(k)) return wsSend(c, { t: 'err', e: 'x', m: 'ما تقدر تمنع مشرفاً' });
        const now = Date.now(); if (now - (c.mbT || 0) < 600) return; c.mbT = now;
        if (m.on === true) { const mins = m.mins === 1440 ? 1440 : 60; mod.bans[k] = { t: now, name: o.name || '', until: now + mins * 60000, by: 'mod' }; wsSend(o, { t: 'err', e: 'banned', m: 'تم منعك من الكتابة ' + (mins === 1440 ? 'يوم' : 'ساعة') + ' 🚫' }); }
        else if (m.on === false) delete mod.bans[k];
        saveMod();
      }
      return wsSend(c, { t: 'sq', f: o.id, mod: (mod.mods || []).includes(k), ban: banLeft(k) > 0 });
    }
    case 'tq': case 'tp': {   // المشرف: هل الكتابة مفتوحة لهذا الشخص؟ / افتحها أو اقفلها له (بالضغط على اسمه)
      if (!c.admin || typeof m.f !== 'string') return; const o = [...clients].find(x => x.id === m.f && x.ready); if (!o || o === c) return;
      const k = keyOf(o); mod.typers = mod.typers || [];
      if (m.t === 'tp') {
        const has = mod.typers.includes(k);
        if (m.on === true && !has) mod.typers.push(k); else if (m.on === false && has) mod.typers = mod.typers.filter(x => x !== k);
        if (mod.typers.length > 1000) mod.typers = mod.typers.slice(-1000);
        saveMod(); for (const x of clients) if (x.ready && !x.admin && keyOf(x) === k) wsSend(x, { t: 'ct', on: canType(x) });
      }
      return wsSend(c, { t: 'tq', f: o.id, n: o.name, on: mod.typers.includes(k) });
    }
    case 'p':      // مكاني وأنا أتمشى
      if (c.ride) return;           // راكب مع سائق: مكانه من السائق
      c.x = num(m.x, 60000); c.z = num(m.z, 60000); c.y = num(m.y, 80); c.r = num(m.r, 10); c.mv = Number.isInteger(m.m) && m.m >= 0 && m.m <= 6 ? m.m : 0;   // 0 واقف 1 يمشي 2 يجري 3 يسبح 4 يرقص 5 جالس
      c.v = Number.isInteger(m.v) && m.v >= 0 && m.v < CAR_N ? m.v : -1;   // راكب سيارة رقم كذا (-1 = يمشي)
      c.walk = true;
      if (c.lmx === undefined || Math.abs(c.x - c.lmx) + Math.abs(c.z - c.lmz) > .8) { c.lmx = c.x; c.lmz = c.z; c.lastMv = Date.now(); }   // للدوام: يتحرك فعلاً
      if (c.siren && c.v < 0) { c.siren = false; jRef(c); }
      if (isJailed(c) && !inLocal(c, PS, 3) && Date.now() - (c.jlT || 0) > 2500) { c.jlT = Date.now(); wsSend(c, jlMsg(c)); }   // طلع من السجن → نرجّعه
      if (!c.vip && vipInside(c.x, c.z) && Date.now() - (c.voT || 0) > 1500) { c.voT = Date.now(); wsSend(c, { t: 'vipout' }); }   // دخل مدينة المشتركين بدون تصريح → نرجّعه
      return;
    case 'v':      // أتفرج من فوق (ما أظهر للناس، بس أشوفهم)
      if (c.ride) return;
      c.x = num(m.x, 3000); c.z = num(m.z, 3000); c.walk = false; return;
    case 'gq': {   // أبي ألعب (إكس أو / أربعة تتصل / حجر ورقة مقص) مع لاعب حقيقي
      if (!c.ready || !GAME_IDS.includes(m.g) || (c.gm && !c.gm.over)) return;
      mgLeave(c); gLeave(c); const w = gQueue[m.g];
      if (w && w !== c && !w.dead && w.ready && !w.sock.destroyed && w.sock.writable) { gQueue[m.g] = null; gStart(m.g, w, c); } else { gQueue[m.g] = c; gSend(c, { s: 'wait', g: m.g }); }
      return;
    }
    case 'gl': gLeave(c); return;
    case 'gr': {   // مباراة ثانية (لازم الاثنين يوافقون)
      const g = c.gm; if (!g || !g.over) return;
      const o = g.p[1 - c.gi]; if (!o || o.dead || o.gm !== g) return gSend(c, { s: 'end', g: g.g, res: 'left' });
      g.rq.add(c); if (g.rq.has(o)) gStart(g.g, c, o); else gSend(o, { s: 'rq', g: g.g });
      return;
    }
    case 'gm': gMove(c, m.m); return;
    // ===== مدينة مشتركي تيك توك =====
    // ===== طلب مرافقة: أطلب من شخص (أو أكثر) يرافقني لمكان؛ لما يوافق ننتقل الاثنين =====
    // ===== عالم البناء (شرق البحيرة السابقة): نفس عالم اللعبة، اللاعبين يشوفون بعض. السيرفر يخزّن التعديلات والصناديق كأرقام صغيرة ويوزّعها =====
    // ===== سيارات الحوش: صاحب البيت يركن سياراته بالحوش (8 أماكن) وتنحفظ ويشوفها كل الناس =====
    case 'pk': case 'pu': {
      if (!c.ready || !c.home) return; const now = Date.now(); if (now - (c.pkT || 0) < 700) return; c.pkT = now; const hh = houses.find(x => x.id === c.home); if (!hh) return; hh.pk = Array.isArray(hh.pk) ? hh.pk : []; const sl = m.s | 0;
      if (sl < 0 || sl > 2) return;
      if (m.t === 'pk') { const mdl = m.m | 0; if (mdl < 0 || mdl >= CAR_N) return; if (c.dh && !ecoGet(c.dh).car.o.includes(mdl)) return wsSend(c, { t: 'err', e: 'x', m: 'تقدر تركن سيارتك بس 🚗' }); if (hh.pk.some(p => p[1] === sl && p[0] !== mdl)) return wsSend(c, { t: 'err', e: 'x', m: 'المكان محجوز بسيارة ثانية' }); hh.pk = hh.pk.filter(p => p[0] !== mdl && p[1] !== sl); hh.pk.push([mdl, sl]); }
      else hh.pk = hh.pk.filter(p => p[1] !== sl);
      save(); for (const o of clients) if (o.ready) wsSend(o, { t: 'hk', id: hh.id, pk: hh.pk }); return;
    }
    case 'vz': { c.vox = !!m.on; if (!c.vox) c.ctOpen = null; return; }
    case 'vf': { c.vfp = !!m.on; return; }
    case 'vy': { if (!c.vox) return; const now = Date.now(); if (now - (c.vpT || 0) < 70) return; c.vpT = now; c.vpos = { x: num(m.x, 3e7), y: num(m.y, 70), z: num(m.z, 3e7) }; return; }
    case 'cwq': {
      if (!c.vox || !Array.isArray(m.ks)) return; const ks = m.ks.slice(0, 32).filter(k => typeof k === 'string' && /^-?\d{1,7},-?\d{1,7}$/.test(k)), e = {};
      for (const k of ks) { const ed = cwEd.get(k); if (ed && ed.size) { const a = []; for (const [i, id] of ed) a.push(i, id); e[k] = a; } }
      return wsSend(c, { t: 'cwe', e, ks });
    }
    case 'cwb': {
      if (!c.vox || !c.vpos) return; const now = Date.now(); if (now - (c.cwB || 0) < 40) return; c.cwB = now;
      const x = m.x | 0, y = m.y | 0, z = m.z | 0, id = m.id | 0; if (Math.abs(x) > 3e7 || Math.abs(z) > 3e7 || y < 1 || y > 62 || !(id === 0 || (id >= 1 && id <= 41 && id !== 16))) return;
      if (Math.abs(x + .5 - c.vpos.x) > 12 || Math.abs(z + .5 - c.vpos.z) > 12 || Math.abs(y - c.vpos.y) > 14) return;   // بعيد عنك
      if (!c.admin && x >= 0 && (z === -200 || z === -199 || ((z === 204 || z === 203) && x <= 73) || ((x === 72 || x === 73) && z >= 203))) return wsSend(c, { t: 'cwx', x, y, z });   // 🧱 سور الحدود (لازم يطابق isWall بـvoxcore)
      if (!c.admin && PROT_R > 0 && (x <= PROT_R || z <= -200 + PROT_R || (x <= 71 + PROT_R && z >= 205 - PROT_R))) {   // أول ٣٠ مكعب من حدود العالم: ممنوع الكسر (إلا مكعب حطّه لاعب)، البناء مسموح
        const ccx = Math.floor(x / 16), ccz = Math.floor(z / 16), e0 = cwEd.get(ccx + ',' + ccz), placed = !!e0 && (e0.get((y * 16 + (z - ccz * 16)) * 16 + (x - ccx * 16)) | 0) > 0;
        if (id !== 0 || !placed) return wsSend(c, { t: 'cwx', x, y, z });
      }
      const cx = Math.floor(x / 16), cz = Math.floor(z / 16), k = cx + ',' + cz, i = (y * 16 + (z - cz * 16)) * 16 + (x - cx * 16); let ed = cwEd.get(k);
      if (!ed) { if (cwEd.size > 40000) return; cwEd.set(k, ed = new Map()); } if (!ed.has(i)) { if (cwCount >= 2500000 || ed.size >= 12000) return wsSend(c, { t: 'err', e: 'x', m: 'العالم وصل حدّه 🌍' }); cwCount++; } ed.set(i, id);
      const ck = x + ',' + y + ',' + z, ct = cwCt.get(ck);
      if (ct && !((ct.t === 'F' && id === 25) || (ct.t === 'C' && id === 26))) { cwCt.delete(ck); wsSend(c, { t: 'ctd', k: ck, items: ctItems(ct) }); for (const o of clients) if (o.ctOpen === ck) { o.ctOpen = null; wsSend(o, { t: 'cts', k: ck, d: null }); } }
      if (id === 25 || id === 26) { if (!cwCt.has(ck)) cwCt.set(ck, id === 25 ? { t: 'F', i: null, fu: null, o: null, burn: 0, burnMax: 0, prog: 0, ts: Date.now() } : { t: 'C', s: Array(27).fill(null) }); }
      saveCw(); const out = { t: 'cwb', x, y, z, id, f: c.id }; for (const o of clients) if (o.vox && o.ready) wsSend(o, out); return;
    }
    case 'ctop': {
      if (!c.vox || !c.vpos || typeof m.k !== 'string' || !/^-?\d{1,8},\d{1,2},-?\d{1,8}$/.test(m.k)) return; const [x, y, z] = m.k.split(',').map(Number); if (Math.hypot(x + .5 - c.vpos.x, z + .5 - c.vpos.z) > 12) return;
      let ct = cwCt.get(m.k); if (!ct) { if (m.b !== 25 && m.b !== 26) return; ct = m.b === 25 ? { t: 'F', i: null, fu: null, o: null, burn: 0, burnMax: 0, prog: 0, ts: Date.now() } : { t: 'C', s: Array(27).fill(null) }; cwCt.set(m.k, ct); saveCw(); }
      ctTick(ct); c.ctOpen = m.k; return wsSend(c, { t: 'cts', k: m.k, d: ct });
    }
    case 'ctclose': { c.ctOpen = null; return; }
    case 'ctake': case 'ctput': {
      const k = c.ctOpen, ct = k && cwCt.get(k); if (!c.vox || !ct) return; const now = Date.now(); if (now - (c.ctT || 0) < 80) return; c.ctT = now; ctTick(ct); const ref = String(m.r || '');
      const slot = ct.t === 'C' ? (/^s\d+$/.test(ref) && +ref.slice(1) < 27 ? { g: () => ct.s[+ref.slice(1)], s: v => { ct.s[+ref.slice(1)] = v; } } : null) : (ref === 'in' || ref === 'fu' || ref === 'o' ? { g: () => ct[ref === 'o' ? 'o' : ref === 'in' ? 'i' : 'fu'], s: v => { ct[ref === 'o' ? 'o' : ref === 'in' ? 'i' : 'fu'] = v; } } : null); if (!slot) return;
      if (m.t === 'ctake') { const it = slot.g(); if (!it) return wsSend(c, { t: 'ctg', k, r: ref, it: null }); slot.s(null); saveCw(); wsSend(c, { t: 'ctg', k, r: ref, it }); }
      else {
        const it = cleanItem(m.it); if (!it) return; const cur = slot.g(); let back = null;
        if (ct.t === 'F' && ((ref === 'o') || (ref === 'in' && SMELT_S[it.id] === undefined) || (ref === 'fu' && FUEL_S[it.id] === undefined))) back = it;
        else if (!cur) slot.s(it); else if (cur.id === it.id && it.id < 120 && cur.n < 64) { const q = Math.min(it.n, 64 - cur.n); cur.n += q; if (it.n > q) back = { ...it, n: it.n - q }; } else back = it;
        if (back) wsSend(c, { t: 'ctn', it: back }); saveCw();
      }
      for (const o of clients) if (o.ctOpen === k) wsSend(o, { t: 'cts', k, d: ct }); return;
    }
    case 'hit': {   // قتال بين اللاعبين بعالم البناء (فقط داخل المنطقة): السيرفر يتأكد من القرب والتبريد ويمرّر الضربة
      if (!c.vfp || !c.ready) return; const now = Date.now(); if (now - (c.hitT || 0) < 350) return; c.hitT = now;
      const o = [...clients].find(x => x.id === m.to && x.ready && x.vfp && x !== c && !x.dead); if (!o) return;
      if (Math.hypot(o.x - c.x, o.z - c.z) > 6.5 || Math.abs((o.y || 0) - (c.y || 0)) > 4) return;
      const d = Math.max(1, Math.min(14, m.d | 0)), dx = o.x - c.x, dz = o.z - c.z, l = Math.hypot(dx, dz) || 1;
      wsSend(o, { t: 'hurt', f: c.id, n: c.name, d, kx: dx / l * 6, kz: dz / l * 6 });
      for (const x of clients) if (x.vox && x.ready) wsSend(x, { t: 'hfx', to: o.id, f: c.id });   // الكل يشوف تأثير الضرب على اللاعب
      return;
    }
    case 'died': {
      if (!c.vfp) return; const now = Date.now(); if (now - (c.diedT || 0) < 3000) return; c.diedT = now; const by = [...clients].find(x => x.id === m.by);
      for (const o of clients) if (o.vox && o.ready) wsSend(o, { t: 'kill', k: by ? by.name : '', v: c.name }); return;
    }
    // ===== عالم المكعّبات: السيرفر يحفظ بس مكانك وأعداد أغراضك (أرقام صغيرة)، والعالم نفسه بمتصفحك =====
    case 'mc': {
      if (!c.ready || !c.dh) return; const w = m.w === 'craft' ? m.w : null; if (!w) return;
      const now = Date.now(); if (now - (c.mcT || 0) < 4000) return; c.mcT = now;
      const n = (x, l) => Number.isFinite(x) ? Math.max(-l, Math.min(l, Math.round(x))) : 0, inv = [];
      if (Array.isArray(m.inv)) for (let i = 0; i + 3 < Math.min(m.inv.length, 144); i += 4) { const sl = m.inv[i] | 0, id = m.inv[i + 1] | 0, k = m.inv[i + 2] | 0, d = m.inv[i + 3] | 0; if (sl >= 0 && sl < 36 && cwValidId(id) && k > 0 && k <= 64) inv.push(sl, id, k, Math.max(0, Math.min(d, 2000))); }
      const pl = []; if (Array.isArray(m.pl)) for (let i = 0; i + 3 < Math.min(m.pl.length, 32); i += 4) { const ni = m.pl[i] | 0, px = m.pl[i + 1] | 0, py = m.pl[i + 2] | 0, pz = m.pl[i + 3] | 0; if (ni >= 0 && ni <= 20 && Math.abs(px) < 3e7 && Math.abs(pz) < 3e7 && py >= 1 && py <= 62) pl.push(ni, px, py, pz); }
      const e = ecoGet(c.dh); e.mc = e.mc || {}; e.mc[w] = { x: n(m.x, 3e7), y: n(m.y, 64), z: n(m.z, 3e7), inv, pl }; saveEco(); return;
    }
    case 'mcl': {
      if (!c.ready || !c.dh) return; const w = m.w === 'craft' ? m.w : null; if (!w) return; const e = eco[c.dh], s = e && e.mc && e.mc[w];
      if (s) wsSend(c, { t: 'mcs', w, x: s.x, y: s.y, z: s.z, inv: s.inv || [], pl: s.pl || [] }); return;
    }
    case 'cq': {
      if (!c.ready) return; const now = Date.now(); if (now - (c.cqT || 0) < 3000) return wsSend(c, { t: 'err', e: 'slow' }); c.cqT = now;
      if (!CQ_DEST.includes(m.d) || !Array.isArray(m.to)) return; if (m.d === 'home' && !c.home) return wsSend(c, { t: 'err', e: 'x', m: 'ابنِ بيتك أول عشان تطلب مرافقة لبيتك' });
      let wp = null; if (m.d === 'wp') { const w = m.w; if (!Array.isArray(w) || w.length !== 4) return; const ni = w[0] | 0, x = w[1] | 0, y = w[2] | 0, z = w[3] | 0; if (ni < 0 || ni > 20 || Math.abs(x) > 3e7 || Math.abs(z) > 3e7 || y < 1 || y > 62) return; wp = [ni, x, y, z]; }   // مكان محفوظ بعالم البناء (أرقام فقط)
      const to = new Set(); for (const id of m.to.slice(0, 8)) { const o = typeof id === 'string' && [...clients].find(x => x.id === id); if (o && o !== c && o.ready && !o.dead) to.add(o); }
      if (!to.size) return; c.cq = { d: m.d, t: now, to: new Set([...to].map(o => o.id)), moved: false, w: wp };
      for (const o of to) wsSend(o, { t: 'cqi', f: c.id, n: c.name, d: m.d, h: m.d === 'home' ? c.home : '', w: wp || undefined });
      return wsSend(c, { t: 'cqs', n: to.size });
    }
    case 'cr': {   // رد على طلب المرافقة
      if (!c.ready || typeof m.f !== 'string') return; const a = [...clients].find(x => x.id === m.f);
      if (!a || !a.cq || !a.cq.to.has(c.id) || Date.now() - a.cq.t > 60e3) return wsSend(c, { t: 'cx', n: '', gone: 1 });
      a.cq.to.delete(c.id);
      if (m.ok !== true) return wsSend(a, { t: 'cx', n: c.name });
      const first = !a.cq.moved; a.cq.moved = true;
      wsSend(c, { t: 'cg', d: a.cq.d, h: a.cq.d === 'home' ? a.home : '', n: a.name, me: 0, w: a.cq.w || undefined });
      wsSend(a, { t: 'cg', d: a.cq.d, n: c.name, me: 1, first: first ? 1 : 0, w: a.cq.w || undefined });
      return;
    }
    case 'vl': return wsSend(c, vhMsg(c));
    case 'vt': {   // زيارة مجانية لمدينة المشتركين: مرة وحدة لكل شخص، بدون طرق
      if (!c.ready || c.vip) return; const s = vipTour(c);
      if (s === 2) return wsSend(c, { t: 'vipno' });
      if (s === 0) { const now = Date.now(); for (const k of vipKeys(c)) vip.seen[k] = now; saveVip(); }
      vipTourStart(c); return;
    }
    case 'vp': {   // دخول بالرمز: اختار بيته وكتب رمزه
      if (m.i === undefined) {   // توافق مع الصفحات القديمة المخزّنة: كانت ترسل موقعها بالعالم بنفس الاسم (vp) — نعاملها كموقع، وما نمرّرها لفحص الرمز الثقيل
        if (!c.vox) return; const nw = Date.now(); if (nw - (c.vpT || 0) < 70) return; c.vpT = nw; c.vpos = { x: num(m.x, 3e7), y: num(m.y, 70), z: num(m.z, 3e7) }; return;
      }
      if (!c.ready) return; const now = Date.now(); if (now - (c.vpT || 0) < 1500) return wsSend(c, { t: 'err', e: 'slow' }); c.vpT = now;
      const h = vip.houses.find(x => x.id === m.i), pin = cleanPin(m.p); if (!h) return wsSend(c, { t: 'err', e: 'x', m: 'اختر بيتك من القائمة' });
      if (!pin) return wsSend(c, { t: 'err', e: 'x', m: 'اكتب رمز بيتك' });
      checkPin(h, pin).then(r => { saveVip(); if (r === 'ok') { vipGrant(c, h); if (c.dh) { const en = vip.ent[c.dh] || (vip.ent[c.dh] = []); for (const x of vipGroup(h)) if (!en.includes(x.id)) en.push(x.id); } for (const x of vipGroup(h)) { if (c.gsub && !x.g) x.g = c.gsub; if (c.home && !x.hh) x.hh = c.home; } saveVip(); wsSend(c, { t: 'vip', ok: 1, h: h.id, name: h.name, n: c.vhs.length, nog: c.gsub ? 0 : 1 }); vipBroadcast(); } else wsSend(c, { t: 'err', e: 'x', m: PIN_ERR[r] || 'الرمز غير صحيح' }); });
      return;
    }
    case 'vk': {   // زائر يطرق باب المدينة (المشرف يسمح له يشوفها)
      if (!c.ready || c.vip) return; const now = Date.now(); if (now - (c.vkT || 0) < 6000) return wsSend(c, { t: 'err', e: 'slow' }); c.vkT = now;
      const ad = [...clients].filter(o => o.ready && o.vip && !o.vtour && o.vhs && o.vhs.length && inCity(o)); if (!ad.length) return wsSend(c, { t: 'err', e: 'x', m: '🏰 ما فيه أحد من أصحاب القصور داخل المدينة الحين — جرّب لاحقاً أو ادخل برمز قصرك' });
      c.vkq = true; for (const o of ad) wsSend(o, { t: 'vkn', f: c.id, n: c.name });
      return wsSend(c, { t: 'err', e: 'x', m: '✊ طرقت باب المدينة… ننتظر رد صاحبها' });
    }
    case 'vka': {   // أي صاحب قصر داخل المدينة (مو زائر) يسمح/يرفض
      if (!(c.ready && c.vip && !c.vtour && c.vhs && c.vhs.length && inCity(c))) return; const v = [...clients].find(o => o.id === m.f && o.vkq); if (!v) return; v.vkq = false;
      if (m.ok === true) { vipGrant(v, null, true); wsSend(v, { t: 'vip', ok: 1, guest: 1 }); vipBroadcast(); } else wsSend(v, { t: 'vkd' });
      return;
    }
    case 'va': {   // المشرف يضيف بيت VIP (اسم + رمز)
      if (!c.admin) return;
      vipAdd(m.n, m.p, !!m.adm).then(h => { if (!h) return wsSend(c, { t: 'err', e: 'x', m: 'ما انضاف: تأكد من الاسم (2–18 حرف) والرمز (4+ خانات) وأن فيه مكان' }); if (h.adm) { c.vhs = [...new Set([...(c.vhs || []), h.id])]; } vipBroadcast(); wsSend(c, { t: 'err', e: 'x', m: '✅ انضاف قصر «' + h.name + '»' }); });
      return;
    }
    case 'vd': {   // المشرف يحذف بيت VIP
      if (!c.admin || typeof m.i !== 'string') return; const n = vip.houses.length; vip.houses = vip.houses.filter(h => h.id !== m.i); if (vip.houses.length === n) return;
      for (const o of clients) { if (o.vhs && o.vhs.includes(m.i)) { o.vhs = o.vhs.filter(id => id !== m.i); } if (o.inH === m.i) { o.inH = null; wsSend(o, { t: 'out', k: 2 }); } }
      saveVip(); vipBroadcast(); return;
    }
    case 'mq': if (c.ready && MG_MAX[m.g]) mgJoin(c, m.g); return;
    case 'mb': { const L = c.mg; if (L && !mgRooms.has(L)) { L.want = m.n === 2 ? 2 : m.n === 4 ? 4 : 0; mgStart(L); } return; }
    case 'ml': mgLeave(c); return;
    case 'mm': mgMove(c, m); return;
    case 'mr': { const R = c.mg; if (R && mgRooms.has(R) && R.over) mgInit(R); return; }
    case 'gc': {   // دردشة داخل المباراة: بين اللاعبين بس (نص حر لأصحاب البيوت، والزائر جاهزة)
      const g = c.gm, R = c.mg; if (!c.ready || (!g && !R)) return;
      const o = g ? g.p[1 - c.gi] : null; if (g && (!o || o.dead || o.gm !== g)) return;
      const now = Date.now(); if (now - (c.gcT || 0) < 900) return wsSend(c, { t: 'err', e: 'slow' });
      { const l = banExempt(c) ? 0 : banLeft(keyOf(c)); if (l > 0) { bnSend(c); } if (l > 0) return wsSend(c, { t: 'err', e: 'banned', m: l === Infinity ? 'تم منعك من الكتابة بقرار المشرف 🚫' : `ممنوع من الكتابة، باقي ${leftTxt(l)} ⛔` }); }
      const out = { s: 'chat', n: chatName(c) };
      if (m.x !== undefined) {
        if (!canType(c)) return wsSend(c, { t: 'err', e: 'guest' });
        const r = cleanText(m.x);
        if (r.e === 'bad' || r.e === 'contact' || r.e === 'rude') evAdd(c, { k: 'b', x: evText(m.x), e: r.e, g: 1 });
        if ((r.e === 'bad' || r.e === 'rude') && banExempt(c)) return wsSend(c, { t: 'err', e: 'bad' });
        if (r.e === 'rude') { c.rude = (c.rude || []).filter(t => now - t < RUDE_WIN); c.rude.push(now); if (c.rude.length >= RUDE_MAX) { c.rude = []; const l = autoBan(c, .5); return wsSend(c, { t: 'err', e: 'banned', m: `🚫 إساءات متكررة — انمنعت من الكتابة ${leftTxt(l)}` }); } return wsSend(c, { t: 'err', e: 'rude', m: `⚠️ كلمة جارحة — الرسالة ما وصلت (باقي ${RUDE_MAX - c.rude.length} تحذير قبل المنع)` }); }
        if (r.e === 'bad') { const l = autoBan(c, r.n || 1); return wsSend(c, { t: 'err', e: 'banned', m: l === Infinity ? 'تم منعك من الكتابة 🚫' : `🚫 كلمة بذيئة! انمنعت من الكتابة ${leftTxt(l)}` }); }
        if (r.e) return wsSend(c, { t: 'err', e: r.e });
        out.x = r.s; evAdd(c, { k: 'g', x: r.s });
      } else { if (!Number.isInteger(m.k) || m.k < 0 || m.k >= GC_N) return; out.k = m.k; evAdd(c, { k: 'g', i: m.k }); }
      c.gcT = now;
      if (out.x !== undefined) for (const a of clients) if (a.admin && a.aw && a !== c && a !== o && !(R && R.players.some(p => p.c === a))) wsSend(a, { t: 'msg', f: c.id, n: out.n, x: out.x, ak: keyOf(c), far: 1, w: '🎮 لعبة' });   // 📡 دردشة الألعاب المكتوبة
      if (g) { gSend(o, out); gSend(c, { ...out, me: 1 }); return; }
      for (const p of R.players) if (p.c && !p.c.dead) wsSend(p.c, { t: 'g', ...out, me: p.c === c ? 1 : 0 }); return;   // دردشة الألعاب الجماعية: لكل اللي بالغرفة
    }
    case 'mkl': case 'mk': return marketMsg(c, m);   // 🛒 السوق
    case 'eco': case 'lb': case 'ev': case 'fd': case 'buy': case 'eq': case 'cbuy': case 'csel': case 'cup': return ecoMsg(c, m);
    // ===== دخول البيوت: الباب لصاحبه، والزائر يطرق وصاحب البيت يسمح/يرفض/يطرد =====
    case 'in': {   // صاحب البيت يدخل بيته
      if (!c.ready || typeof m.h !== 'string' || !owns(c, m.h)) return;
      c.inH = m.h; c.kh = null; return wsSend(c, { t: 'in', h: m.h, s: slotOf(m.h), own: 1 });
    }
    case 'kn': {   // زائر يطرق باب بيت (لازم صاحبه داخله)
      if (!c.ready || c.inH || typeof m.h !== 'string' || owns(c, m.h) || (m.h[0] === 'v' && !c.vip)) return;
      const now = Date.now(); if (now - (c.knT || 0) < 4000) return wsSend(c, { t: 'err', e: 'slow' }); c.knT = now;
      const owners = [...clients].filter(o => o.ready && o.inH === m.h && canAdmit(o, m.h));
      if (!owners.length) return wsSend(c, { t: 'err', e: 'x', m: 'صاحب البيت مو داخل البيت الحين 🚪' });
      c.kh = m.h; for (const o of owners) wsSend(o, { t: 'kn', f: c.id, n: c.name });
      return wsSend(c, { t: 'err', e: 'x', m: '✊ طرقت الباب… انتظر الرد (تقدر تكلّمه بالدردشة)' });
    }
    case 'ka': {   // صاحب البيت يرد على الطارق
      const v = [...clients].find(o => o.id === m.f && o.ready);
      if (!v || !c.inH || !canAdmit(c, c.inH) || v.kh !== c.inH) return;
      v.kh = null;
      if (m.ok === true) { v.inH = c.inH; return wsSend(v, { t: 'in', h: c.inH, s: slotOf(c.inH), n: c.name }); }
      return wsSend(v, { t: 'kd', n: c.name });
    }
    case 'ko': {   // طرد شخص معيّن من بيتي
      const v = [...clients].find(o => o.id === m.f);
      if (!v || v === c || !c.inH || !owns(c, c.inH) || v.inH !== c.inH) return;
      v.inH = null; return wsSend(v, { t: 'out', k: 1 });
    }
    case 'out': return houseLeave(c);
    case 'hl': {   // مين داخل بيتي
      if (!c.inH || !owns(c, c.inH)) return;
      return wsSend(c, { t: 'hv', l: [...clients].filter(o => o.ready && o !== c && o.inH === c.inH).map(o => [o.id, o.name]) });
    }
    case 'ride': {   // أركب مع سائق (حد أقصى 3 ركاب)، أو أنزل لو to = null
      if (m.to === null || m.to === undefined) { if (c.ride) { c.ride = null; c.seat = 0; c.v = -1; c.mv = 0; } return; }
      if (!c.ready || c.x === undefined || c.ride) return;
      if (c.v >= 0) return wsSend(c, { t: 'ride', ok: false, e: 'car' });
      const d = [...clients].find(o => o.id === m.to && o.ready && o !== c && o.v >= 0 && !o.ride);
      if (!d) return wsSend(c, { t: 'ride', ok: false, e: 'no' });
      if ((d.x - c.x) ** 2 + (d.z - c.z) ** 2 > 15 * 15) return wsSend(c, { t: 'ride', ok: false, e: 'far' });
      const used = new Set([...clients].filter(o => o.ride === d.id).map(o => o.seat));
      const seat = [1, 2, 3].find(k => !used.has(k));
      if (!seat) return wsSend(c, { t: 'ride', ok: false, e: 'full' });
      c.ride = d.id; c.seat = seat; c.x = d.x; c.z = d.z; c.y = d.y; c.r = d.r; c.v = d.v; c.mv = 0; c.walk = true;
      return wsSend(c, { t: 'ride', ok: true, d: d.id, s: seat });
    }
    case 'rj': {   // وصلت منطقة انتظار السباق (يرسلها كل 3 ثواني وأنا واقف فيها)
      if (!c.ready || (race.s !== 'idle' && race.s !== 'lobby') || Date.now() < race.cool) return;
      race.mem.set(c, Date.now()); return;
    }
    case 'rl': {   // طلعت من المنطقة / تركت السباق
      race.mem.delete(c);
      if (race.racers.has(c) && (race.s === 'cd' || race.s === 'run')) { race.racers.delete(c); if (race.s === 'run') raceRanks(); }
      return;
    }
    case 'rg': {   // مررت بنقطة تفتيش رقم g (لازم بالترتيب، وبفاصل زمني معقول بين النقاط)
      const r = race.racers.get(c), now = Date.now();
      if (race.s !== 'run' || !r || r.fin !== null || !Number.isInteger(m.g) || m.g !== (r.cnt + 1) % RACE_G || now - r.last < 1200) return;
      r.cnt++; r.last = now;
      if (r.cnt >= RACE_G * RACE_LAPS) { r.fin = now - race.t0; const pos = [...race.racers.values()].filter(x => x.fin !== null).length; raceAll({ t: 'rfin', id: c.id, name: c.name, pos, time: r.fin }); if (c.dh) ecoDo(c.dh, (e, evs) => { const g = ecoCoins(e, pos === 1 ? 30 : pos === 2 ? 20 : 10, 'rc', 120); if (g) evs.push(`🏁 +${g} 🪙 للسباق`); ecoBest(e, r.fin); ecoTask(e, 'race', 1, evs); }); }
      else if (r.cnt % RACE_G === 0) wsSend(c, { t: 'rlap', id: c.id, lap: r.cnt / RACE_G + 1 });
      raceRanks(); return;
    }
    case 'c': {    // غيّرت شخصيتي
      if (c.admin) return;
      const ch = cleanCh(m.c, isLeg(c.dev), ownOf(c.dev)); if (ch === null) return;
      if (c.home) { const h = houses.find(x => x.id === c.home); if (h) { c.ch = h.ch | 0; c.st = h.st || [0, 0, 0, 0, 0]; } } else c.ch = ch;
      for (const o of clients) if (o !== c) o.known.delete(c.id);
      return;
    }
    // ===== 👑 صاحب المدينة: إعلان للكل + عرض رسائل الجميع =====
    // ===== 🔔 اشتراك الجهاز بالإشعارات (عنوان خادم الإشعارات + مفتاحين) =====
    case 'ps': {
      if (!c.ready || !c.dh) return; const e = typeof m.e === 'string' && m.e.length <= 800 ? m.e : ''; let u; try { u = new URL(e); } catch { return; } if (!pushHostOk(u)) return;
      let p, a; try { p = Buffer.from(String(m.p || ''), 'base64url'); a = Buffer.from(String(m.a || ''), 'base64url'); } catch { return; } if (p.length !== 65 || p[0] !== 4 || a.length !== 16) return;
      push.subs[c.dh] = { e, p: b64u(p), a: b64u(a), t: Date.now() }; savePush(); return wsSend(c, { t: 'pkey', k: b64u(VAPID_PUB), has: 1 });
    }
    case 'px': { if (c.dh && push.subs[c.dh]) { delete push.subs[c.dh]; savePush(); } return wsSend(c, { t: 'pkey', k: b64u(VAPID_PUB), has: 0 }); }
    case 'pt': {   // صاحب المدينة: إشعار تجربة لجهازه هو (حتى لو داخل اللعبة)
      if (!c.admin || !c.dh || !push.subs[c.dh]) return jErr(c, '🔔 فعّل الإشعارات على جهازك أول (من ⚙️)'); const now = Date.now(); if (now - (c.ptT || 0) < 5000) return; c.ptT = now;
      pushQ.push([c.dh, { t: 'مدينة من الصفر', b: '🔔 هذا إشعار تجربة — الإشعارات شغّالة ✅', g: 'test' }]); pushPump(); return jErr(c, '🔔 انرسل إشعار تجربة لجوالك');
    }
    case 'ab': {   // إعلان يشوفه كل اللاعبين (شريط كبير + بالدردشة)
      if (!c.admin || typeof m.x !== 'string') return; const now = Date.now(); if (now - (c.abT || 0) < 3000) return jErr(c, 'شوي شوي 🙂');
      const x = m.x.replace(/[ -​-‏‪-‮⁦-⁩]/g, '').replace(/s+/g, ' ').trim().slice(0, 160); if (!x) return; c.abT = now;
      let n = 0; for (const o of clients) if (o.ready) { wsSend(o, { t: 'ann', n: 'من الصفر', x }); n++; }
      console.log('إعلان من صاحب المدينة:', x);
      if (m.p === true) { if (now - (push.abT || 0) < 10 * 60e3) return wsSend(c, { t: 'jx', m: `📢 وصل إعلانك لـ ${n} لاعب — والإشعار للجوالات مرة كل 10 دقايق بس` }); push.abT = now; let k = 0; for (const dh of Object.keys(push.subs)) if (pushTo(dh, { b: '📢 ' + x, g: 'ann', ttl: 21600 }, true)) k++; return wsSend(c, { t: 'jx', m: `📢 وصل إعلانك لـ ${n} لاعب داخل اللعبة + 📲 إشعار لـ ${k} جوال` }); }
      return wsSend(c, { t: 'jx', m: `📢 وصل إعلانك لـ ${n} لاعب` });
    }
    case 'aw': { if (!c.admin) return; c.aw = !!m.on; return wsSend(c, { t: 'aw', on: c.aw }); }   // 📡 توصلني رسائل الكل
    case 'say': {  // رسالة (مكتوبة أو جاهزة) — يشوفها كل اللي حولك، و«to» بس يعلّم مين المقصود
      const now = Date.now();
      if (now - c.lastSay < 1200) return wsSend(c, { t: 'err', e: 'slow' });
      if (!c.ready || c.x === undefined) return;
      { const l = banExempt(c) ? 0 : banLeft(keyOf(c)); if (l > 0) { bnSend(c); } if (l > 0) return wsSend(c, { t: 'err', e: 'banned', m: l === Infinity ? 'تم منعك من الكتابة بقرار المشرف 🚫' : `ممنوع من الكتابة، باقي ${leftTxt(l)} ⛔` }); }
      const out = { t: 'msg', f: c.id, n: chatName(c) };
      if (m.x !== undefined) {   // مكتوبة: تمر على الفلتر
        if (!canType(c)) return wsSend(c, { t: 'err', e: 'guest' });   // الكتابة الحرة للمشرف ومن سمح لهم فقط
        const r = cleanText(m.x);
        if (r.e === 'bad' || r.e === 'contact' || r.e === 'rude') evAdd(c, { k: 'b', x: evText(m.x), e: r.e });   // 🚫 محجوبة: تنحفظ دليل للمشرفين
        if ((r.e === 'bad' || r.e === 'rude') && banExempt(c)) return wsSend(c, { t: 'err', e: 'bad' });
        if (r.e === 'rude') {   // إهانة خفيفة: الرسالة تنحجب + تحذير، 3 خلال 10 دقايق = منع نص ساعة
          c.rude = (c.rude || []).filter(t => now - t < RUDE_WIN); c.rude.push(now);
          if (c.rude.length >= RUDE_MAX) { c.rude = []; const l = autoBan(c, .5); console.log('منع تلقائي (إساءات متكررة)', c.name); return wsSend(c, { t: 'err', e: 'banned', m: `🚫 إساءات متكررة — انمنعت من الكتابة ${leftTxt(l)}` }); }
          return wsSend(c, { t: 'err', e: 'rude', m: `⚠️ كلمة جارحة — الرسالة ما وصلت (باقي ${RUDE_MAX - c.rude.length} تحذير قبل المنع)` });
        }
        if (r.e === 'bad') { const l = autoBan(c, r.n || 1); console.log('منع تلقائي', c.name, r.n); return wsSend(c, { t: 'err', e: 'banned', m: l === Infinity ? 'تم منعك من الكتابة 🚫' : `🚫 كلمة بذيئة! انمنعت من الكتابة ${leftTxt(l)}` }); }
        if (r.e) return wsSend(c, { t: 'err', e: r.e });
        out.x = r.s; c.log.push({ t: now, x: r.s }); if (c.log.length > 8) c.log.shift(); evAdd(c, { k: 'w', x: r.s });
      } else {
        const k = m.k, a = m.a;
        if (!Number.isInteger(k) || k < 0 || k >= SAY_N) return;
        if (k === SAY_COUNTRY && !(Number.isInteger(a) && a >= 0 && a < COUNTRY_N)) return;
        out.k = k; if (k === SAY_COUNTRY) out.a = a;
        evAdd(c, k === SAY_COUNTRY ? { k: 's', i: k, a } : { k: 's', i: k });
        if (c.dh) ecoDo(c.dh, (e, evs) => { ecoTask(e, 'say', 1, evs); ecoTut(e, 3, evs); });
      }
      const to = m.to !== undefined ? [...clients].find(o => o.id === m.to && o.ready && o !== c) : null;
      if (to) out.to = to.id;
      c.lastSay = now;
      let n = 0;
      for (const o of clients) {
        if (o === c || !o.ready || o.x === undefined) continue;
        if (o === to || (o.x - c.x) ** 2 + (o.z - c.z) ** 2 < CHAT_R * CHAT_R || (c.kh && o.inH === c.kh && canAdmit(o, c.kh)) || (c.inH && owns(c, c.inH) && o.kh === c.inH)) { wsSend(o, o.admin || isModC(o) || isGM(o) ? { ...out, ak: keyOf(c) } : out); n++; }
        else if (o.admin && o.aw) wsSend(o, { ...out, ak: keyOf(c), far: 1, w: zoneOf(c) });   // 📡 صاحب المدينة يشوف رسائل الكل (بدون فقاعة)
      }
      return wsSend(c, { ...out, t: 'sent', heard: n });
    }
  }
}
// رسالة مكتوبة: نفس فلتر الكلام السيء + منع الروابط والأرقام والحسابات (حماية الصغار من التواصل برّا اللعبة)
const CONTACT_HARD = /(wa\.me|t\.me|يوزر|user ?name|رقمي|رقمك|جوالي|جوالك|نمرتي|نمرتك|واتساب|واتس اب|whatsapp)/i;
const PLATFORM = /(snap|سناب|insta|انستا|إنستا|تيك ?توك|tik ?tok|واتس|whats|تلي ?جرام|تليقرام|telegram|discord|ديسكورد|ديس كورد|فيس ?بوك|facebook|تويتر|twitter|يوتيوب|youtube|kik|كيك|ايمو|imo)/i;
const PLATFORM_G = new RegExp(PLATFORM.source, 'gi');
const CONTACT_REQ = /(عندك|عندج|عندش|عندكم|عندو|عنده|عندها|معك|معاك|معج|معكم|معه|معاه|معها|ارسل|أرسل|ارسلي|اعطيني|عطني|عطيني|اعطوني|حسابك|حسابي|حسابه|حسابها|اسمي|اسمك|اسمه|اسمها|تعال|تعالو|تعالوا|ضيفني|اضيفوني|اضفني|ضيفوني|اضافه|اضافة|قروب|جروب|ابي|ابغى|ابغا|بدي|عايز|عاوز|نتكلم|نتواصل|تواصل|كلمني|كلموني|راسلني|راسلوني|ادخل|ادخلو|ابحث|دور|دورو|يجي|user|add|dm|follow|تابعني|تابعوني|متابعه|متابعة|فولو|سجل|سجلي)/i;
const IN_GAME = /(قصور|قصر|مدينه|مدينة|مشتركين|مشتركي|بوابه|بوابة|رمز|كود|اللعبه|اللعبة|جاي من|جايه من|جا من|جيت من|جيتو من|شفت)/;
const isContact = s => { if (CONTACT_HARD.test(s) || CONTACT_HARD.test(norm(s))) return true; if (!PLATFORM.test(s) && !PLATFORM.test(norm(s))) return false; const t = s.replace(PLATFORM_G, ' '), handle = /[a-z][a-z0-9._]*[0-9._][a-z0-9._]*/i.test(t) || /[a-z]{7,}/i.test(t), digits = (s.replace(/[٠-٩]/g, '0').match(/[0-9]/g) || []).length >= 4; if (handle || digits) return true; if (IN_GAME.test(s) && !CONTACT_HARD.test(s)) return false; return CONTACT_REQ.test(s); };
function cleanText(raw) {
  if (typeof raw !== 'string') return { e: 'bad' };
  const s = raw.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return { e: 'empty' };
  if (s.length > 80) return { e: 'long' };
  if (/https?|www\.|\.(com|net|org|me|io|gg|ly)\b/i.test(s)) return { e: 'contact' };
  if ((s.replace(/[٠-٩]/g, '0').match(/[0-9]/g) || []).length >= 6) return { e: 'contact' };   // أرقام جوال
  if (/@\s*\w{2,}/.test(s) || isContact(s)) return { e: 'contact' };
  const { n, m } = badTier(s);   // كل كلمة فاحشة = ساعة منع؛ الإهانة الخفيفة = حجب الرسالة بتحذير
  if (n) return { e: 'bad', n: Math.min(n, 24) };
  if (m) return { e: 'rude', n: m };
  return { s };
}

// ===== الاقتصاد: عملة وحدة 🪙 + مهام يومية + سلسلة أيام + لوحات أسبوعية + كنوز (السيرفر يحسب كل شي) =====
const ECO_FILE = path.join(path.dirname(DATA), 'economy.json');
let eco = {};
try { eco = JSON.parse(fs.readFileSync(ECO_FILE, 'utf8')); } catch {}
let ecoTimer = null;
let ecoWriting = false, ecoAgain = false;
function saveEcoNow(sync) {   // الكتابة بالخلفية (الملف 11MB — الكتابة المتزامنة كانت توقف السيرفر)؛ sync=true عند الإغلاق فقط
  clearTimeout(ecoTimer); ecoTimer = null;
  if (sync) { try { fs.writeFileSync(ECO_FILE + '.tmp', JSON.stringify(eco)); fs.renameSync(ECO_FILE + '.tmp', ECO_FILE); } catch (e) { console.error('فشل حفظ الاقتصاد:', e.message); } return; }
  if (ecoWriting) { ecoAgain = true; return; }
  ecoWriting = true; const body = JSON.stringify(eco);
  fs.promises.writeFile(ECO_FILE + '.tmp', body).then(() => fs.promises.rename(ECO_FILE + '.tmp', ECO_FILE)).catch(e => console.error('فشل حفظ الاقتصاد:', e.message)).finally(() => { ecoWriting = false; if (ecoAgain) { ecoAgain = false; saveEco(); } });
}
function saveEco() {
  if (ecoTimer) return;
  ecoTimer = setTimeout(saveEcoNow, 6000);   // نجمّع التغييرات (كان كل نص ثانية ويثقل المعالج) — وعند الإغلاق نحفظ فوراً
}
const GULF = 3 * 3600e3;
const gulfDay = (off = 0) => new Date(Date.now() + GULF + off).toISOString().slice(0, 10);
const dayNum = () => Math.floor((Date.now() + GULF) / 86400e3);
const weekNum = () => Math.floor((dayNum() - 2) / 7);          // الأسبوع يبدأ السبت
const TASKS = [
  { id: 'xo', n: 'افز مرتين في ألعاب اللاعبين (XO وغيرها) ⭕', g: 2 },
  { id: 'race', n: 'خلّص سباق كامل 🏁', g: 1 },
  { id: 'lk', n: 'اعط 5 لايكات لبيوت الناس ❤️', g: 5 },
  { id: 'z', n: 'اربح 3 ألعاب فردية (ثعبان/ذاكرة/خبط/2048) 🎮', g: 3 },
  { id: 'say', n: 'ارسل 5 رسائل جاهزة للناس 💬', g: 5 },
];
const TASK_COINS = 15, BOX_COINS = 40, SECRETS = 10;      // 0..7 صناديق، 8 النخلة الذهبية، 9 سر تحت البرج
const DECOR = { palm: 50, lamp: 60, garden: 80, fountain: 100, pool: 150 }, DECOR_N = { palm: 'نخلة', lamp: 'أعمدة إنارة', garden: 'حديقة ورد', fountain: 'نافورة', pool: 'مسبح' };
const TUT = ['حط بيتك بالمدينة 🏠', 'العب لعبة بقسم الألعاب 🎮', 'نزّل سيارة وسوق 🚗', 'ارسل رسالة جاهزة 💬'];
const BADGES = [{ e: '🌴', p: 0 }, { e: '💎', p: 120 }, { e: '🏎️', p: 80 }, { e: '🔥', p: 60 }, { e: '⭐', p: 100 }, { e: '🗝️', p: 0 }, { e: '🗼', p: 0 }];   // p=0 → تنفتح بالكنوز بس
const BOOST_COST = 60;
// 🚗 سيارة اللاعب: كل واحد ياخذ السيدان مجاناً، ويشتري موديلات ويطوّر المحرك (لازم يطابق CAR_PRICE/CAR_EN_COST بـapp.js)
const CAR_PRICE = [250, 150, 0, 600, 120, 300, 80, 700], CAR_FREE = 2, CAR_EN_COST = [100, 200, 350, 550];
function ecoGet(k) {
  let e = eco[k];
  if (!e) e = eco[k] = { c: 0, s: 0, ld: '', d: '', tk: [], bx: 0, tut: [0, 0, 0, 0], fnd: [], o: [], bd: -1, wk: { w: 0, xo: 0, rc: 0 }, cap: {}, n: '', zt: 0 };
  const td = gulfDay();
  if (e.d !== td) {
    e.d = td; e.bx = 0; e.cap = {}; const st = dayNum() % TASKS.length;
    e.tk = [0, 1, 2].map(i => ({ id: TASKS[(st + i) % TASKS.length].id, p: 0, ok: 0 }));
  }
  if (e.wk.w !== weekNum()) e.wk = { w: weekNum(), xo: 0, rc: 0 };
  if (!e.car) e.car = { o: [CAR_FREE], s: CAR_FREE, en: 0 };
  return e;
}
const REF_GOLD = 100, REF_MAX_DAY = 10;   // دعوة صديق
// ===== 🛒 السوق: كل شي ينشرى بالذهب (الأسعار والملكية هنا بالسيرفر — العميل يعرض بس) =====
// الأسماء لازم تطابق public/chars.js (SHOP_SKINS / HATS / BACKS) و app.js (HCNAMES / HDECOS)
const MK_SKINS = ['الشرطي', 'الإطفائي', 'الدكتور', 'النينجا', 'القرصان', 'لاعب الكورة', 'الطيّار', 'الفضائي', 'البطل الخارق', 'الملك', 'الشيخ الذهبي', 'أسطورة الماس'];
const MK_HATS = ['', 'طاقية', 'كاوبوي', 'تاج', 'خوذة', 'قبعة حفلة', 'قبعة ساحر', '', 'قبعة شمس', 'قبعة قرصان', 'هالة ذهبية', 'أذان أرنب', 'سماعات قيمنق', 'تاج الماس', 'قبعة تخرّج', 'خوذة فايكنج'];
const MK_BACKS = ['', 'شنطة ظهر', 'عباءة سوبر', 'أجنحة', 'أجنحة ذهبية', '', 'جيتار', 'سيف', 'صاروخ ظهر', 'درع', 'أجنحة تنين'];
const MK_TAGS = ['', '⭐', '🔥', '💎', '🚀', '👑', '🌹'], MK_HC = ['', 'وردي', 'سماوي', 'نعناعي', 'أصفر', 'بنفسجي', 'برتقالي'], MK_HD = ['', 'علم', 'نخلتين', 'فوانيس', 'تمثال ذهبي'];
const RENAME_COST = 500;
const MARKET = [];
[800, 1200, 1500, 3000, 4500, 2000, 6000, 9000, 15000, 30000, 60000, 100000].forEach((p, k) => MARKET.push({ i: 'ch:' + (16 + k), cat: 'skin', n: MK_SKINS[k], p }));
for (const [v, p] of Object.entries({ 1: 50, 5: 120, 2: 150, 8: 200, 4: 300, 11: 400, 12: 700, 6: 900, 14: 1000, 9: 1800, 15: 2200, 3: 2500, 10: 8000, 13: 40000 })) MARKET.push({ i: 'h:' + v, cat: 'hat', n: MK_HATS[v], p });
for (const [v, p] of Object.entries({ 1: 100, 6: 600, 2: 1500, 7: 2500, 3: 3500, 9: 5000, 8: 12000, 4: 20000, 10: 50000 })) MARKET.push({ i: 'b:' + v, cat: 'back', n: MK_BACKS[v], p });
for (const [v, p] of Object.entries({ 1: 50, 2: 80, 6: 200, 4: 400, 3: 600, 5: 5000 })) MARKET.push({ i: 't:' + v, cat: 'tag', n: 'شارة ' + MK_TAGS[v], p });
for (const [v, p] of Object.entries({ 1: 300, 2: 350, 3: 350, 4: 400, 5: 500, 6: 600 })) MARKET.push({ i: 'c:' + v, cat: 'house', n: 'لون بيت ' + MK_HC[v], p });
for (const [v, p] of Object.entries({ 1: 400, 2: 800, 3: 1200, 4: 10000 })) MARKET.push({ i: 'd:' + v, cat: 'house', n: 'زينة بيت: ' + MK_HD[v], p });
for (const id of ['palm', 'lamp', 'garden', 'fountain', 'pool']) MARKET.push({ i: 'x:' + id, cat: 'yard', n: DECOR_N[id], p: DECOR[id] });
MARKET.push({ i: 'rename', cat: 'service', n: 'تغيير اسم بيتك', p: RENAME_COST }, { i: 'boost', cat: 'service', n: 'تسريع بيتك يوم', p: BOOST_COST });
const MARKET_MAP = new Map(MARKET.map(x => [x.i, x])), ST_IDX = { h: 0, b: 1, t: 2, c: 3, d: 4 };
function marketMsg(c, m, pr) {   // pr = سعر خاص (بيع موظف المول بخصم)
  if (!c.ready || !c.dh) return;
  if (m.t === 'mkl') return wsSend(c, { t: 'mkl', items: MARKET });
  const now = Date.now(); if (pr === undefined && now - (c.mkT || 0) < 400) return; c.mkT = now;
  const it = typeof m.i === 'string' && MARKET_MAP.get(m.i); if (!it) return; const price = pr !== undefined ? pr : it.p;
  const h = c.home && houses.find(x => x.id === c.home);
  if (!h) return wsSend(c, { t: 'err', e: 'x', m: 'السوق للي عنده بيت 🏠 — ابنِ بيتك أول' });
  const k = c.dh, e0 = ecoGet(k); e0.own = e0.own || {}; for (const kk of ['h', 'b', 't', 'c', 'd', 'ch']) if (!Array.isArray(e0.own[kk])) e0.own[kk] = [];
  const [kind, vs] = it.i.split(':'), v = vs !== undefined && kind !== 'x' ? +vs : null;
  h.st = Array.isArray(h.st) && h.st.length === 5 ? h.st : [0, 0, 0, 0, 0];
  const equip = () => { if (kind === 'ch') { h.ch = v; c.ch = v; } else if (ST_IDX[kind] !== undefined) h.st[ST_IDX[kind]] = v; };
  // عندك أصلاً (اشتريته أو انفتح لك بالأيام) → لبس بدون فلوس
  if (v !== null && (e0.own[kind].includes(v) || (kind !== 'ch' && unlockedFor(h.days || 1).includes(kind + v)))) { equip(); save(); return wsSend(c, { t: 'mkok', i: it.i, wear: 1, house: pub(h) }); }
  if (kind === 'x') { h.dx = Array.isArray(h.dx) ? h.dx : []; if (h.dx.includes(vs)) return wsSend(c, { t: 'err', e: 'x', m: 'عندك هذا الديكور ✅' }); }
  let newName = null;
  if (it.i === 'rename') { newName = cleanName(m.n); if (!newName) return wsSend(c, { t: 'err', e: 'x', m: 'الاسم غير مقبول (حروف وأرقام فقط، من 2 إلى 18 حرف، بدون كلمات سيئة)' }); if (newName === h.name) return wsSend(c, { t: 'err', e: 'x', m: 'هذا نفس اسمك الحالي' }); }
  if (e0.c < price) return wsSend(c, { t: 'err', e: 'x', m: 'ما يكفي ذهب: تحتاج ' + price + ' 🪙 (عندك ' + e0.c + ')' });
  ecoDo(k, (e, evs) => {
    e.c -= price;
    if (v !== null) { e.own[kind].push(v); equip(); }
    else if (kind === 'x') h.dx.push(vs);
    else if (it.i === 'rename') { h.name = newName; c.name = newName; for (const o of clients) if (o !== c) o.known.delete(c.id); }
    else if (it.i === 'boost') { h.days = (h.days || 1) + 1; const nl = levelFor(h.days); if (nl > h.type) h.type = nl; }
    evs.push('🛍️ اشتريت «' + (it.i === 'rename' ? 'اسم جديد: ' + newName : it.n) + '»!');
  });
  save(); return wsSend(c, { t: 'mkok', i: it.i, house: pub(h) });
}
function mkOwns(c, it) {   // عنده هذا الغرض من قبل؟ (اشتراه أو انفتح له بالأيام)
  const h = c.home && houses.find(x => x.id === c.home); if (!h || !c.dh) return false; const e = ecoGet(c.dh), own = e.own || {}, [kind, vs] = it.i.split(':');
  if (kind === 'x') return (h.dx || []).includes(vs); if (vs === undefined) return false; const v = +vs;
  return (own[kind] || []).includes(v) || (kind !== 'ch' && unlockedFor(h.days || 1).includes(kind + v));
}
// 🎯 هدفك الجاي: هدف واحد واضح لكل لاعب — أول خطوة تعليم ناقصة ← أول مهمة يوم ناقصة ← اجمع عملات لأرخص شي ما تملكه
// a = وش يسوي العميل لما اللاعب يضغط الهدف (build/games/car/chat/track/plaza أو mk:<غرض>)
const TUT_ACT = ['build', 'games', 'car', 'chat'];
const TASK_ACT = { xo: 'games', race: 'track', lk: 'plaza', z: 'games', say: 'chat' };
const GOAL_LADDER = ['h:1', 't:1', 'b:1', 'h:5', 'h:2', 't:2', 'h:8', 'c:1', 'b:6', 'd:1', 'h:4', 'b:2', 'h:11', 'c:2', 'h:12', 'b:7'];
const HTYPE_N = ['خيمة', 'بيت طين', 'فيلا', 'برج', 'قلعة'];
function nextGoal(e, h) {
  const tu = e.tut || [], ti = tu.findIndex(x => !x);
  if (ti >= 0) return { k: 'tut', i: ti, n: TUT[ti], p: tu.filter(x => x).length, g: tu.length, a: TUT_ACT[ti] };
  const t = (e.tk || []).find(x => !x.ok), d = t && TASKS.find(x => x.id === t.id);
  if (d) return { k: 'task', n: d.n, p: Math.min(t.p, d.g), g: d.g, a: TASK_ACT[t.id] || 'plaza' };
  // 🏠 مسار تطوير البيت (خيمة ← طين ← فيلا ← برج ← قلعة): يتقدّم بأيام الدخول، أو تسريع يوم بالعملات
  if (h && (h.type | 0) < LEVEL_DAYS.length - 1) {
    const nt = (h.type | 0) + 1, need = Math.max(1, LEVEL_DAYS[nt] - (h.days || 1));
    return { k: 'house', t: nt, n: `طوّر بيتك لـ«${HTYPE_N[nt]}»: ناقصك ${need} يوم — أو سرّع يوم بـ${BOOST_COST} 🪙`, p: Math.min(e.c | 0, BOOST_COST), g: BOOST_COST, a: 'boost' };
  }
  const own = e.own || {};
  for (const id of GOAL_LADDER) {
    const it = MARKET_MAP.get(id), [kind, v] = id.split(':');
    if (!it || (own[kind] || []).includes(+v)) continue;
    return { k: 'mk', n: `اجمع ${it.p} 🪙 واشترِ «${it.n}» 🛒`, p: Math.min(e.c | 0, it.p), g: it.p, a: 'mk:' + id };
  }
  return { k: 'free', n: 'العب مع الناس وكمّل سلسلة أيامك 🔥', p: 0, g: 0, a: 'plaza' };
}
const ecoView = (e, h) => ({ ng: nextGoal(e, h), car: e.car || { o: [CAR_FREE], s: CAR_FREE, en: 0 }, own: e.own || {}, rf: e.rfc | 0, rfg: REF_GOLD, c: e.c, s: e.s, tk: e.tk.map(t => { const d = TASKS.find(x => x.id === t.id); return { n: d.n, g: d.g, p: Math.min(t.p, d.g), ok: t.ok }; }), bx: e.bx, tut: e.tut, fnd: e.fnd, o: e.o, bd: e.bd, xo: e.wk.xo, rc: e.wk.rc, bc: BOOST_COST, lg: e.leg ? 1 : 0, lv: e.lv || Math.max(1, e.s) });
function ecoPush(k, ev) { const e = eco[k]; if (!e) return; for (const c of clients) if (c.ready && c.dh === k) { const v = ecoView(e, c.home && houses.find(x => x.id === c.home)); wsSend(c, ev ? { t: 'eco', s: v, ev } : { t: 'eco', s: v }); }}
// ينفّذ تغيير على حساب لاعب ثم يحفظ ويبلّغ كل أجهزته المتصلة
function ecoDo(k, fn) { if (!k) return; const e = ecoGet(k), evs = []; fn(e, evs); saveEco(); ecoPush(k, evs.join('  •  ')); }
function ecoCoins(e, amt, src, cap) {   // يضيف عملات مع سقف يومي للمصدر (حماية من التكرار)
  if (src) { const used = e.cap[src] || 0; amt = Math.max(0, Math.min(amt, cap - used)); e.cap[src] = used + amt; }
  if (amt > 0) e.c += amt; return amt;
}
function ecoTask(e, id, n, evs) {
  const t = e.tk.find(x => x.id === id); if (!t || t.ok) return; const d = TASKS.find(x => x.id === id);
  t.p += n; if (t.p < d.g) return;
  t.ok = 1; e.c += TASK_COINS; evs.push(`✅ خلّصت مهمة! +${TASK_COINS} 🪙`);
  if (e.tk.every(x => x.ok) && !e.bx) { e.bx = 1; e.c += BOX_COINS; evs.push(`🎁 صندوق المهام: +${BOX_COINS} 🪙`); }
}
function ecoTut(e, i, evs) {
  if (e.tut[i]) return; e.tut[i] = 1; e.c += 15; evs.push(`🎓 ${TUT[i]} +15 🪙`); stTut(i);
  if (e.tut.every(x => x)) { e.c += 25; evs.push('🎓 خلّصت البداية السريعة! +25 🪙'); stTut(TUT.length); }
}
const ecoBest = (e, ms) => { if (e.wk.rc === 0 || ms < e.wk.rc) e.wk.rc = ms; };
function ecoHi(c) {   // عند دخول اللاعب: ربط الحساب + سلسلة الأيام
  try { wsSend(c, evtMsg()); } catch {}   // 🎉 الفعالية الحين/الجاية
  c.dh = c.dev && c.dev.length >= 8 ? devHash(c.dev) : null; if (!c.dh) return;
  { const e0 = eco[c.dh]; try { stHi(c.dh, !e0, !!e0 && e0.ld === gulfDay(-86400e3)); } catch {} }   // 📊
  const k = c.dh; ecoDo(k, (e, evs) => {
    e.n = c.name || e.n; c.bd = e.bd; const td = gulfDay();
    if (c.home && e.tut && !e.tut[0]) ecoTut(e, 0, evs);   // عنده بيت (بناه قبل نظام المهام أو رجّعه بالرمز/قوقل) → مهمة «حط بيتك» خالصة
    if (td <= LEG_UNTIL && !e.leg) e.leg = 1;   // كل من يدخل اليوم أو بكره ياخذ السكنات الأسطورية لحسابه للأبد
    if (e.leg && !e.legN) { e.legN = 1; evs.push('🌟 مبروك! حصلت على 5 سكنات أسطورية حصرية بشارات أسماء خاصة — شوفها من 👕'); }
    if (e.ld !== td) {
      e.s = e.ld === gulfDay(-86400e3) ? e.s + 1 : 1; e.ld = td;
      { const hh = c.home && houses.find(x => x.id === c.home); e.lv = e.lv ? e.lv + 1 : Math.max(e.s, hh ? hh.days || 1 : 1); }   // المستوى: يزيد واحد كل يوم تدخل فيه
      const d = ((e.s - 1) % 7) + 1, amt = d === 7 ? 100 : d * 10; e.c += amt;
      evs.push(`🔥 اليوم ${e.s} ورا بعض: +${amt} 🪙${d === 7 ? ' (صندوق كبير!)' : ''}`);
    }
  });
}
const PUZ = { snake: 5, memory: 0, whack: 8, g2048: 300 };   // الحد الأدنى للنتيجة عشان تُحسب فوز
function ecoMsg(c, m) {
  const now = Date.now(); if (!c.ready || !c.dh || now - (c.eT || 0) < 250) return; c.eT = now; const k = c.dh;
  switch (m.t) {
    case 'eco': return ecoPush(k);
    case 'lb': {
      const wn = weekNum(), rows = Object.values(eco).filter(e => e.wk && e.wk.w === wn);
      return wsSend(c, { t: 'lb', xo: rows.filter(e => e.wk.xo > 0).sort((a, b) => b.wk.xo - a.wk.xo).slice(0, 10).map(e => [e.n || 'لاعب', e.wk.xo]),
        rc: rows.filter(e => e.wk.rc > 0).sort((a, b) => a.wk.rc - b.wk.rc).slice(0, 10).map(e => [e.n || 'لاعب', e.wk.rc]), left: 7 - ((dayNum() - 2) % 7) });
    }
    case 'ev': {
      if (m.e === 'car') return ecoDo(k, (e, evs) => ecoTut(e, 2, evs));
      if (m.e === 'z' && typeof m.g === 'string' && m.g in PUZ && Number.isFinite(m.s) && m.s >= PUZ[m.g]) {
        return ecoDo(k, (e, evs) => { ecoTut(e, 1, evs); if (now - e.zt < 15000) return; e.zt = now; const g = ecoCoins(e, 6, 'z', 48); if (g) evs.push(`+${g} 🪙 فوز بلعبة`); ecoTask(e, 'z', 1, evs); });
      }
      return;
    }
    case 'fd': {   // لقيت كنز مخفي
      if (!Number.isInteger(m.i) || m.i < 0 || m.i >= SECRETS) return;
      return ecoDo(k, (e, evs) => {
        if (e.fnd.includes(m.i)) return; e.fnd.push(m.i);
        const gold = m.i === 8, tw = m.i === 9, amt = gold ? 60 : tw ? 40 : 20; e.c += amt;
        evs.push(gold ? `🌴✨ النخلة الذهبية! +${amt} 🪙 وشارة 🌴` : tw ? `🗼 السر تحت البرج! +${amt} 🪙 وشارة 🗼` : `🗝️ لقيت كنز! +${amt} 🪙 (${e.fnd.filter(x => x < 8).length}/8)`);
        if (tw && !e.o.includes(6)) e.o.push(6);
        if (gold && !e.o.includes(0)) e.o.push(0);
        if (e.fnd.filter(x => x < 8).length === 8 && !e.o.includes(5)) { e.o.push(5); e.c += 50; evs.push('🏆 لقيت كل الصناديق! +50 🪙 وشارة 🗝️'); }
      });
    }
    case 'buy': {
      if (typeof m.i === 'string' && m.i.startsWith('x:')) {   // ديكور البيت (يشوفه كل الناس)
        const id = m.i.slice(2), pr = DECOR[id], h = c.home && houses.find(x => x.id === c.home), e0 = ecoGet(k);
        if (!pr) return;
        if (!h) return wsSend(c, { t: 'err', e: 'x', m: 'الديكور للي عنده بيت 🏠' });
        h.dx = Array.isArray(h.dx) ? h.dx : []; if (h.dx.includes(id)) return;
        if (e0.c < pr) return wsSend(c, { t: 'err', e: 'x', m: `ما يكفي: تحتاج ${pr} 🪙` });
        ecoDo(k, (e, evs) => { e.c -= pr; h.dx.push(id); save(); evs.push(`🏡 ${DECOR_N[id]} صارت ببيتك!`); });
        return wsSend(c, { t: 'boost' });
      }
      if (m.i === 'boost') {
        const h = c.home && houses.find(x => x.id === c.home), e0 = ecoGet(k);
        if (!h) return wsSend(c, { t: 'err', e: 'x', m: 'التسريع للي عنده بيت 🏠' });
        if (e0.c < BOOST_COST) return wsSend(c, { t: 'err', e: 'x', m: `ما يكفي: تحتاج ${BOOST_COST} 🪙` });
        ecoDo(k, (e, evs) => { e.c -= BOOST_COST; h.days = (h.days || 1) + 1; const nl = levelFor(h.days); if (nl > h.type) h.type = nl; save(); evs.push(`⏩ بيتك تقدّم يوم! (اليوم ${h.days})`); });
        return wsSend(c, { t: 'boost' });
      }
      if (!Number.isInteger(m.i) || m.i < 0 || m.i >= BADGES.length) return;
      const b = BADGES[m.i], e0 = ecoGet(k);
      if (!b.p || e0.o.includes(m.i)) return;
      if (e0.c < b.p) return wsSend(c, { t: 'err', e: 'x', m: `ما يكفي: تحتاج ${b.p} 🪙` });
      return ecoDo(k, (e, evs) => { e.c -= b.p; e.o.push(m.i); evs.push(`${b.e} شارة جديدة!`); });
    }
    case 'cbuy': case 'csel': {   // 🚗 شراء موديل سيارة / اختيار موديل أملكه
      const i = m.i, e0 = ecoGet(k); if (!Number.isInteger(i) || i < 0 || i >= CAR_N) return;
      if (m.t === 'csel') { if (!e0.car.o.includes(i)) return; return ecoDo(k, e => { e.car.s = i; }); }
      if (e0.car.o.includes(i)) return ecoDo(k, e => { e.car.s = i; });
      if (e0.c < CAR_PRICE[i]) return wsSend(c, { t: 'err', e: 'x', m: `ما يكفي: تحتاج ${CAR_PRICE[i]} 🪙` });
      return ecoDo(k, (e, evs) => { e.c -= CAR_PRICE[i]; e.car.o.push(i); e.car.s = i; evs.push('🚗 مبروك السيارة الجديدة! صارت سيارتك'); });
    }
    case 'cup': {   // 🔧 تطوير المحرك (5 مستويات)
      const e0 = ecoGet(k), lv = e0.car.en | 0; if (lv >= CAR_EN_COST.length) return; const pr = CAR_EN_COST[lv];
      if (e0.c < pr) return wsSend(c, { t: 'err', e: 'x', m: `ما يكفي: تحتاج ${pr} 🪙` });
      return ecoDo(k, (e, evs) => { e.c -= pr; e.car.en = lv + 1; evs.push(`🔧 محرك سيارتك صار مستوى ${lv + 2}!`); });
    }
    case 'eq': {   // لبس شارة (أو إزالتها)
      const e0 = ecoGet(k); const i = m.i === -1 ? -1 : m.i; if (i !== -1 && !(Number.isInteger(i) && e0.o.includes(i))) return;
      return ecoDo(k, e => { e.bd = i; c.bd = i; for (const o of clients) if (o !== c) o.known.delete(c.id); });
    }
  }
}
const badgeName = c => (c.bd >= 0 && !c.admin ? BADGES[c.bd].e + ' ' : '') + c.name;
const chatName = c => (c.ch >= 11 && c.ch <= 15 ? LEGT[c.ch - 11] + ' ' : '') + badgeName(c);
// كل أصحاب البيوت الموجودين الحين (قبل نهاية بكره) ياخذون السكنات أيضاً
if (gulfDay() <= LEG_UNTIL) { for (const h of houses) if (h.dev && h.dev.length >= 8) { const e = ecoGet(devHash(h.dev)); if (!e.leg) e.leg = 1; if (!e.n) e.n = h.name; } saveEco(); }

// ===== 💼 الوظائف + 🚔 الشرطة والسجن + 🏥 المستشفى + 🦹 فعالية الحرامي =====
// قليلة عمداً (متوسط 120 لاعب): 6 شرطة + 3 أطباء + 4 موظفين مول، ولكل وظيفة مشرف واحد يعيّنه صاحب المدينة.
// المفتاح keyOf (رقم البيت للي عنده بيت). الحقول بـmeta: [8] رمز الوظيفة (p/d/m، الكبير = مشرف) و[9] أعلام (1 مصاب، 2 صفارة، 4 مسجون).
// لازم تطابق public/jobs.js: JOBS (الترتيب والرموز)، JAIL_REASONS (6)، أماكن المباني PS/HS، THIEF_PATH وسرعته.
const JOB_FILE = path.join(path.dirname(DATA), 'jobs.json');
let job = { emp: {}, apps: [], jail: {}, cd: {}, log: [], gift: {}, cnt: {}, nb: {}, slots: {} };   // nb = ممنوع من الوظائف (مفصول بسبب مخالفة) لين وقت
try { job = { ...job, ...JSON.parse(fs.readFileSync(JOB_FILE, 'utf8')) }; } catch {}
let jobTimer = null;
function saveJobNow() { clearTimeout(jobTimer); jobTimer = null; try { fs.writeFileSync(JOB_FILE + '.tmp', JSON.stringify(job)); fs.renameSync(JOB_FILE + '.tmp', JOB_FILE); } catch (e) { console.error('فشل حفظ الوظائف:', e.message); } }
function saveJob() { if (jobTimer) return; jobTimer = setTimeout(saveJobNow, 1500); }
const JSL = String(process.env.JOB_SLOTS || '6,3,4').split(',').map(x => Math.max(0, Math.min(60, parseInt(x, 10) || 0)));
const JOBS = {
  police: { c: 'p', n: 'شرطي', i: '👮', slots: JSL[0] ?? 6, lv: 3, pay: 25, cap: 150, uni: 16, auto: 30 },
  doctor: { c: 'd', n: 'طبيب', i: '🩺', slots: JSL[1] ?? 3, lv: 2, pay: 20, cap: 120, uni: 18, auto: 15 },
  mall: { c: 'm', n: 'موظف المول', i: '🛍️', slots: JSL[2] ?? 4, lv: 2, pay: 15, cap: 90, uni: -1, auto: 15 },
  gm: { c: 'g', n: 'المدير العام', i: '👔', slots: 1, lv: 5, pay: 40, cap: 240, uni: 28, auto: 0 },   // فوق مشرفي الوظائف: يوظّف ويفصل أي موظف أو مشرف، ويعيّن المشرفين، ويسجن مثل مشرف الشرطة — يقبله صاحب المدينة بس
};
for (const [k, v] of Object.entries(job.slots || {})) if (JOBS[k] && k !== 'gm' && Number.isInteger(v)) JOBS[k].slots = Math.max(0, Math.min(60, v));   // عدد المقاعد اللي غيّره صاحب المدينة من اللعبة
const JOB_IDS = Object.keys(JOBS), JOB_SUPN = { police: 'مشرف الشرطة', doctor: 'مشرف المستشفى', mall: 'مشرف المول', gm: 'المدير العام' };
const JOB_TICK = +process.env.JOB_TICK_MS || 60000;                  // «دقيقة» الدوام والقبول التلقائي (الاختبارات تصغّرها)
const JAIL_MS = +process.env.JAIL_MS || 5 * 60e3, JAIL_OFF_MS = +process.env.JAIL_OFF_MS || Math.min(3 * 60e3, +process.env.JAIL_MS || 5 * 60e3), JAIL_CD = 10 * 60e3, JAIL_PER_PLAYER = 2, OV_MAX = 3, JAIL_REASONS = 6, BAIL = 100, INJ_MS = +process.env.INJ_MS || 4 * 60e3;
const PS = { x0: -112, x1: -28, z0: -158, z1: -116 }, HS = { x0: 18, x1: 60, z0: -158, z1: -116 };   // مركز الشرطة والمستشفى (محلياً نسبةً لمركز الساحة)
const plazaC = () => { const nb = nBlocks(houses.length), maxR = Math.ceil((Math.sqrt(nb + 1) - 1) / 2); return { x: 0, z: (maxR + 5) * 78 }; };   // نفس plazaFor بالعميل (STEP = 78)
const inLocal = (c, r, m = 0) => { if (c.x === undefined) return false; const P = plazaC(), x = c.x - P.x, z = c.z - P.z; return x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m; };
const MALL_Z = { x0: -318, x1: -128, z0: -70, z1: 70 }, PLAZA_Z = { x0: -105, x1: 105, z0: -105, z1: 105 };
const zoneOf = o => o.vox ? '⛏️ عالم البناء' : o.inH ? (o.inH[0] === 'v' ? '🏰 قصر' : '🏠 داخل بيت') : inLocal(o, MALL_Z) ? '🏬 المول' : inLocal(o, PS) ? '🚔 الشرطة' : inLocal(o, HS) ? '🏥 المستشفى' : inLocal(o, PLAZA_Z) ? '🏟️ الساحة' : vipInside(o.x, o.z) ? '🏰 مدينة المشتركين' : '🏙️ المدينة';
const jEmp = c => (c && c.ready && job.emp[keyOf(c)]) || null;
const jOf = c => { const e = jEmp(c); return e ? e.j : null; };
const jSup = (c, j) => { const e = jEmp(c); return !!e && !!e.sup && (!j || e.j === j); };
const isGM = c => jOf(c) === 'gm';
const jCanManage = (c, j) => !!c.admin || jSup(c, j) || (j !== 'gm' && isGM(c));   // المدير العام يدير كل الوظائف (إلا وظيفته)
const jPolBoss = c => !!c.admin || jSup(c, 'police') || isGM(c);   // صلاحيات مشرف الشرطة
const jUsed = j => { let n = 0; for (const k in job.emp) if (job.emp[k].j === j && !job.emp[k].sup) n++; return n; };
const jSupOf = j => { for (const k in job.emp) if (job.emp[k].j === j && job.emp[k].sup) return [k, job.emp[k]]; return null; };
const jailOf = k => { const r = job.jail[k]; return r && r.until > Date.now() ? r : null; };
const isJailed = c => !!c.ready && !!jailOf(keyOf(c));
const jFlags = c => (c.inj > Date.now() ? 1 : 0) | (c.siren ? 2 : 0) | (isJailed(c) ? 4 : 0);
const jOnline = k => { for (const x of clients) if (x.ready && keyOf(x) === k) return true; return false; };
const jLv = dh => (dh && eco[dh] && (eco[dh].lv || Math.max(1, eco[dh].s || 1))) || 1;
function jCnt(k) { const d = dayNum(); let x = job.cnt[k]; if (!x || x.d !== d) x = job.cnt[k] = { d, jl: 0 }; return x; }
function jRef(c) { for (const o of clients) o.known.delete(c.id); }   // الكل ياخذ شكله الجديد (الزي/العلامة)
function jForKey(k, fn) { for (const x of clients) if (x.ready && keyOf(x) === k) fn(x); }
const jErr = (c, m) => wsSend(c, { t: 'err', e: 'x', m });
const JOB_NB_MS = 3 * 86400e3, jNb = k => { const u = (job.nb || {})[k]; return u && u > Date.now() ? u - Date.now() : 0; };   // عقوبة الفصل: منع من كل الوظائف 3 أيام
const nbTxt = ms => { const h = Math.ceil(ms / 3600e3); return h >= 24 ? Math.ceil(h / 24) + ' يوم' : h + ' ساعة'; };
function jbMsg(c) {
  const e = jEmp(c), k = c.ready ? keyOf(c) : '', app = job.apps.find(a => a.k === k);
  const jobs = JOB_IDS.map(id => { const J = JOBS[id], s = jSupOf(id); return { id, n: J.n, i: J.i, slots: J.slots, used: jUsed(id), lv: J.lv, pay: J.pay, cap: J.cap, auto: J.auto, sup: s ? s[1].n : '' }; });
  const rv = c.admin ? job.apps.length : e && e.j === 'gm' ? job.apps.filter(a => a.j !== 'gm').length : e && e.sup ? job.apps.filter(a => a.j === e.j).length : 0;
  const ec = c.dh && eco[c.dh];
  return { t: 'jb', nb: c.ready ? jNb(keyOf(c)) : 0, jobs, my: e ? { j: e.j, sup: e.sup ? 1 : 0, uni: c.juni === false ? 0 : 1, earn: ec && ec.d === gulfDay() && ec.cap ? (ec.cap.job || 0) : 0 } : null, app: app ? app.j : null, rv, adm: c.admin ? 1 : 0, home: c.home ? 1 : 0, lv: jLv(c.dh), bail: BAIL, jm: Math.round(JAIL_MS / 60e3) };
}
let jbT = null;
function jbAll() { if (jbT) return; jbT = setTimeout(() => { jbT = null; for (const o of clients) if (o.ready) wsSend(o, jbMsg(o)); }, 400); }
function jlMsg(c) { const r = jailOf(keyOf(c)); return r ? { t: 'jl', on: 1, left: r.until - Date.now(), r: r.r, bn: r.bn, cell: r.cell, ap: r.ap ? 1 : 0, bail: BAIL } : { t: 'jl', on: 0 }; }
function jLog(row) { job.log.push(row); if (job.log.length > 200) job.log = job.log.slice(-200); }
function jReplCand(j) {
  const L = Object.entries(job.emp).filter(([, e]) => e.j === j && !e.sup).map(([k, e]) => [k, e, jOnline(k) ? 1 : 0]).sort((a, b) => a[2] - b[2] || (a[1].last || a[1].t) - (b[1].last || b[1].t));
  return L[0] || null;
}
// الوظيفة ممتلئة: نخبر اللي يوظّف مين بينشال بداله، ولو وافق (rep) نشيله بدون عقوبة
function jFullCheck(c, j, newName, rep, extra) {
  const J = JOBS[j]; if (jUsed(j) < J.slots) return true;
  if (typeof rep === 'string' && job.emp[rep] && job.emp[rep].j === j && !job.emp[rep].sup) { jFire(rep, `📤 انشالت وظيفة ${J.n} منك عشان المقاعد امتلت وانضاف موظف جديد بدالك — تقدر تقدّم مرة ثانية بعدين`); return true; }
  const cd = jReplCand(j); if (!cd) { jErr(c, `الوظيفة ممتلئة (${jUsed(j)}/${J.slots})`); return false; }
  wsSend(c, { t: 'jfull', j, n: newName, rk: cd[0], rn: cd[1].n, on: cd[2], used: jUsed(j), slots: J.slots, ...extra }); return false;
}
function jHire(k, j, n, by) {
  const J = JOBS[j]; if (!J || job.emp[k]) return 'has'; if (jUsed(j) >= J.slots) return 'full';
  job.emp[k] = { j, sup: 0, t: Date.now(), n: String(n || '').slice(0, 24), last: Date.now() }; job.apps = job.apps.filter(a => a.k !== k); saveJob();
  jForKey(k, x => { wsSend(x, { t: 'jx', win: 1, m: `🎉 مبروك! صرت ${J.i} ${J.n}${by ? ' (وظّفك ' + by + ')' : ''} — شوف امتيازاتك من 💼` }); jRef(x); });
  pushKey(k, { b: `🎉 مبروك! انقبلت ${J.i} ${J.n} — ادخل وشوف امتيازاتك 💼`, g: 'job' });   // 🔔 لو مو داخل اللعبة
  jbAll(); return 'ok';
}
function jFire(k, why) {
  const e = job.emp[k]; if (!e) return; delete job.emp[k]; saveJob(); const J = JOBS[e.j];
  jForKey(k, x => { x.siren = false; wsSend(x, { t: 'jx', m: why || `📤 انشالت منك ${e.sup ? 'رتبة ' + JOB_SUPN[e.j] : 'وظيفة ' + J.n} — رجعت شخص عادي` }); jRef(x); });
  jbAll();
}
function jOverturn(r, c) {   // مشرف/أدمن أطلق سجيناً معترضاً قبل وقته = اعتراض مقبول ضد الشرطي اللي سجنه
  if (!r || !r.by || r.by === keyOf(c) || !r.ap || r.until <= Date.now()) return;
  const oc = jCnt(r.by); oc.ov = (oc.ov || 0) + 1; ccLog && ccLog(c, r.bn || '', '⚖️ اعتراض مقبول ضد ' + (r.bn || 'شرطي'));
  if (oc.ov >= OV_MAX && !(oc.sus > Date.now())) { oc.sus = Date.now() + 86400e3; jForKey(r.by, x => wsSend(x, { t: 'jx', m: '⛔ انقبلت 3 اعتراضات ضد سجناتك اليوم — صلاحية السجن موقوفة عنك 24 ساعة' })); }
}
function jRelease(k, by) {
  const r = job.jail[k]; if (!r) return; delete job.jail[k]; job.cd[k] = Date.now();
  const L = job.log.find(x => x[0] === r.t); if (L && by) L[5] = by; saveJob();
  jForKey(k, x => { wsSend(x, { t: 'jl', on: 0, by: by || '' }); jRef(x); });
}
function jJail(c, o, reason, mins) {
  const now = Date.now(), k = keyOf(o), ck = keyOf(c), pol = jOf(c) === 'police' || isGM(c), psup = jSup(c, 'police') || isGM(c);
  if (!c.admin && !pol) return jErr(c, 'السجن للشرطة بس 👮');
  if (o === c || isJailed(c)) return;
  if (!Number.isInteger(reason) || reason < 0 || reason >= JAIL_REASONS) return;
  if (jailOf(k)) return jErr(c, 'مسجون أصلاً 🔒');
  if (o.admin || (mod.mods || []).includes(k)) return jErr(c, 'ما تقدر تسجن المشرفين 🛡️');
  const oe = job.emp[k];
  if (oe && (oe.sup || oe.j === 'gm') && !c.admin && !(isGM(c) && oe.j !== 'gm')) return jErr(c, 'ما تقدر تسجن مشرف وظيفة');
  if (oe && oe.j === 'police' && !c.admin && !psup) return jErr(c, 'الشرطي ما يسجن شرطي — هذي لمشرف الشرطة');
  if (!c.admin && (o.x === undefined || c.x === undefined || Math.hypot(o.x - c.x, o.z - c.z) > 20)) return jErr(c, 'لازم تكون قريب منه (20 متر) 👀');
  if (!c.admin && now - (job.cd[k] || 0) < JAIL_CD) return jErr(c, 'توه طالع من السجن — انتظر 10 دقايق من طلوعه');
  const cn = jCnt(ck), lim = c.admin ? 1e9 : psup ? 20 : 8; if (cn.jl >= lim) return jErr(c, `وصلت حدّك اليوم (${lim} سجنات)`);
  // عدالة: الشرطي العادي سجنه 3 دقايق، ما يسجن نفس الشخص مرتين باليوم، والشخص ما ينسجن أكثر من مرتين باليوم من الشرطة (الثالثة لمشرف الشرطة)، ولو انقبلت 3 اعتراضات ضده بيوم تتوقف صلاحيته 24 ساعة
  const pc = jCnt(k);
  if (!c.admin && !psup) {
    if ((cn.sus || 0) > now) return jErr(c, 'صلاحية السجن موقوفة عنك 24 ساعة: انقبلت 3 اعتراضات ضد سجناتك ⛔');
    cn.who = cn.who || {}; if (cn.who[k]) return jErr(c, 'سجنته اليوم من قبل — ما تسجن نفس الشخص مرتين باليوم');
    if ((pc.jd || 0) >= JAIL_PER_PLAYER) return jErr(c, `انسجن ${JAIL_PER_PLAYER} مرات اليوم — المرة الجاية لمشرف الشرطة أو صاحب المدينة`);
  }
  const ms = mins === 15 && (c.admin || psup) ? JAIL_MS * 3 : (c.admin || psup) ? JAIL_MS : JAIL_OFF_MS; cn.jl++; cn.who = cn.who || {}; cn.who[k] = 1; pc.jd = (pc.jd || 0) + 1;
  const used = new Set(Object.values(job.jail).filter(r => r.until > now).map(r => r.cell)); let cell = 0; while (used.has(cell) && cell < 5) cell++;
  job.jail[k] = { until: now + ms, t: now, by: ck, bn: c.name, n: o.name, r: reason, cell, m: Math.max(1, Math.round(ms / 60e3)), ap: 0 };
  jLog([now, c.name, o.name, reason, Math.max(1, Math.round(ms / 60e3)), '']); saveJob();
  jForKey(k, x => {   // يطلع من كل شي ويروح الزنزانة
    x.siren = false; if (x.ride) { x.ride = null; x.seat = 0; x.v = -1; } houseLeave(x); gLeave(x); mgLeave(x); x.cq = null;
    race.mem.delete(x); if (race.racers.has(x) && (race.s === 'cd' || race.s === 'run')) { race.racers.delete(x); if (race.s === 'run') raceRanks(); }
    wsSend(x, jlMsg(x)); jRef(x);
  });
  wsSend(c, { t: 'jx', m: `🚔 سجنت ${o.name} ${Math.round(ms / 60e3)} دقايق` });
}
// ===== 🦹 الحرامي الهارب: مسار ثابت (لازم يطابق jobs.js) والسيرفر يحسب مكانه بالساعة =====
const THIEF_PATH = [[0, -40], [4, -78], [3, -104], [-10, -124], [-12, -140], [6, -147], [12, -128], [9, -104], [15, -78], [28, -29], [39, -9], [40, 10], [31, 26], [15, 37], [0, 41], [-15, 37], [-28, 28], [-38, 12], [-40, -8], [-31, -26], [-16, -37]];
const THIEF_SP = 8.5, THIEF_MS = +process.env.THIEF_MS || 180e3, THIEF_EVERY = (+process.env.THIEF_MIN || 20) * 60e3, THIEF_MINP = +process.env.THIEF_MINP || 3;
const TH_LEN = (() => { let L = 0; for (let i = 0; i < THIEF_PATH.length; i++) { const a = THIEF_PATH[i], b = THIEF_PATH[(i + 1) % THIEF_PATH.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return L; })();
function thiefLocal(d) { d = ((d % TH_LEN) + TH_LEN) % TH_LEN; for (let i = 0; i < THIEF_PATH.length; i++) { const a = THIEF_PATH[i], b = THIEF_PATH[(i + 1) % THIEF_PATH.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= l) { const u = l ? d / l : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; } d -= l; } return THIEF_PATH[0]; }
const th = { on: false, t0: 0, o: 0, end: 0, next: Date.now() + Math.min(THIEF_EVERY, 5 * 60e3) };
const thMsg = () => th.on ? { t: 'th', on: 1, t0: th.t0, o: th.o, d: th.end - th.t0, sp: THIEF_SP } : { t: 'th', on: 0 };
function thAll(obj) { for (const o of clients) if (o.ready) wsSend(o, obj); }
function thStart() { const now = Date.now(); th.on = true; th.t0 = now; th.o = Math.random() * TH_LEN; th.end = now + THIEF_MS; thAll(thMsg());
  const h = gulfHour(), td = gulfDay(); if (h >= 16 && h < 22) { if (push.thd !== td) { push.thd = td; push.th = {}; } for (const dh of Object.keys(push.subs)) if (!push.th[dh] && pushTo(dh, { b: '🚨 حرامي هارب بالساحة الحين! أول واحد يمسكه ياخذ ذهب 🦹', g: 'thief', ttl: 180 })) push.th[dh] = 1; }   // 🔔 مرة باليوم لكل جهاز (4–10 المسا)
}
setInterval(() => {
  const now = Date.now();
  if (th.on && now > th.end) { th.on = false; th.next = now + THIEF_EVERY; thAll({ t: 'th', on: 0, esc: 1 }); }
  else if (!th.on && now >= th.next) { let n = 0; for (const o of clients) if (o.ready) n++; if (n >= THIEF_MINP) thStart(); else th.next = now + 60e3; }
  for (const k in job.jail) if (job.jail[k].until <= now) jRelease(k, '');   // خلصت المدة
}, 1000).unref();
// كل «دقيقة»: الدوام والرواتب + قبول تلقائي (وظيفة ما لها مشرف) + تنظيف
setInterval(() => {
  const now = Date.now(); let ch = false;
  for (const c of clients) {
    if (!c.ready || !c.dh) continue; const e = jEmp(c); if (!e) continue; e.last = now; ch = true;
    if (c.name && e.n !== c.name) e.n = c.name;
    if (now - (c.lastMv || 0) > 5 * JOB_TICK) continue;   // واقف من 5 دقايق = مو بالدوام
    c.duty = (c.duty || 0) + 1; if (c.duty < 10) continue; c.duty = 0;
    const J = JOBS[e.j], pay = J.pay + (e.sup ? 10 : 0), cap = J.cap + (e.sup ? 60 : 0);
    ecoDo(c.dh, (x, evs) => { const g = ecoCoins(x, pay, 'job', cap); if (g) evs.push(`💼 راتبك ${J.i}: +${g} 🪙`); });
  }
  const n0 = job.apps.length; job.apps = job.apps.filter(a => now - a.t < 48 * 3600e3 && !job.emp[a.k]); if (job.apps.length !== n0) ch = true;
  for (const a of [...job.apps]) { const J = JOBS[a.j]; if (!J || !J.auto || jSupOf(a.j)) continue; if (now - a.t >= J.auto * JOB_TICK && jUsed(a.j) < J.slots) { jHire(a.k, a.j, a.n, ''); ch = true; } }
  for (const k in job.emp) { const e = job.emp[k]; if (!e.sup && now - (e.last || e.t) > 3 * 86400e3) { jFire(k, '📤 انشالت وظيفتك لأنك ما دخلت 3 أيام'); ch = true; } }
  const d = dayNum(); for (const k in job.gift) if (job.gift[k] !== d) { delete job.gift[k]; ch = true; } for (const k in job.cnt) if (job.cnt[k].d !== d) { delete job.cnt[k]; ch = true; }
  for (const k in job.cd) if (now - job.cd[k] > JAIL_CD) { delete job.cd[k]; ch = true; }
  for (const k in job.nb || {}) if (job.nb[k] <= now) { delete job.nb[k]; ch = true; }
  if (ch) saveJob();
}, JOB_TICK).unref();
const healCd = new Map(), injK = new Map();   // injK: الإصابة محفوظة بمفتاح اللاعب (لو طلع ورجع تبقى، وما تعلق عند جواله)
function injSet(c, until) { const k = keyOf(c); if (until > Date.now()) injK.set(k, { until, s: c.injS || Date.now() }); else injK.delete(k); for (const x of clients) if (x.ready && keyOf(x) === k) { x.inj = until; if (until > Date.now()) x.injS = c.injS || Date.now(); } }
function jobMsg(c, m) {
  if (!c.ready) return; const now = Date.now();
  if (m.t !== 'jb' && m.t !== 'jm') { if (now - (c.jT || 0) < 250) return; c.jT = now; }   // jb/jm (تحديث العرض) ما تحسب
  const peer = () => typeof m.f === 'string' ? [...clients].find(x => x.id === m.f && x.ready && !x.dead && x !== c) : null;
  switch (m.t) {
    case 'jb': return wsSend(c, jbMsg(c));
    case 'ja': {   // أقدّم على وظيفة
      const J = JOBS[m.j]; if (!J) return;
      if (!c.home) return jErr(c, '🏠 ابنِ بيتك أول عشان تقدّم على وظيفة');
      if (jEmp(c)) return jErr(c, 'عندك وظيفة أصلاً — استقيل منها أول');
      if (isJailed(c)) return jErr(c, '🔒 ما تقدر تقدّم وأنت مسجون');
      if (isBanned(c)) return jErr(c, 'ما تقدر تقدّم وأنت ممنوع من الكتابة');
      { const l = jNb(keyOf(c)); if (l) return jErr(c, `⛔ ممنوع من الوظائف باقي ${nbTxt(l)} (انفصلت بسبب مخالفة)`); }
      if (jLv(c.dh) < J.lv) return jErr(c, `تحتاج المستوى ${J.lv} ⭐ (يزيد كل يوم تدخل فيه)`);
      if (jUsed(m.j) >= J.slots) return jErr(c, 'الوظيفة ممتلئة الحين — جرّب بعدين');
      const k = keyOf(c); job.apps = job.apps.filter(a => a.k !== k); job.apps.push({ k, j: m.j, t: now, n: c.name, dh: c.dh }); saveJob();
      { const sp = jSupOf(m.j); if (sp && now - (push.sa && push.sa[sp[0]] || 0) > 3600e3) { push.sa = push.sa || {}; if (pushKey(sp[0], { b: `📥 عندك طلب توظيف جديد (${J.i} ${J.n}) — ادخل وراجعه`, g: 'apps' })) push.sa[sp[0]] = now; } }   // 🔔 للمشرف (مرة بالساعة)
      for (const o of clients) if (o.ready && jCanManage(o, m.j)) wsSend(o, { t: 'jx', rv: 1, m: `📥 طلب توظيف جديد: ${c.name} — ${J.i} ${J.n} (من 💼)` });
      const s = jSupOf(m.j); wsSend(c, { t: 'jx', m: `📨 قدّمت على ${J.i} ${J.n} — ${!J.auto ? 'ننتظر رد صاحب المدينة 👑' : s ? 'ننتظر رد المشرف ' + s[1].n : 'ينقبل تلقائياً خلال ' + J.auto + ' دقيقة لو ما فيه مشرف يرد'}` });
      return jbAll();
    }
    case 'jw': {   // أسحب طلبي / أستقيل
      const k = keyOf(c);
      if (m.q === 'res') { const e = job.emp[k]; if (!e) return; return jFire(k, `👋 استقلت من ${e.sup ? JOB_SUPN[e.j] : JOBS[e.j].n} — رجعت شخص عادي`); }
      job.apps = job.apps.filter(a => a.k !== k); saveJob(); return jbAll();
    }
    case 'jd': {   // المشرف/الأدمن يقبل أو يرفض طلب
      const a = job.apps.find(x => x.k === m.k); if (!a || !jCanManage(c, a.j)) return;
      job.apps = job.apps.filter(x => x !== a); saveJob();
      if (m.ok === true) { if (!jFullCheck(c, a.j, a.n, m.rep, { a: a.k })) { job.apps.push(a); saveJob(); return; } const r = jHire(a.k, a.j, a.n, c.name); if (r === 'full') jErr(c, 'الوظيفة ممتلئة'); }
      else jForKey(a.k, x => wsSend(x, { t: 'jx', m: `🙏 انرفض طلبك لوظيفة ${JOBS[a.j].n} — تقدر تقدّم بعدين` }));
      jbAll(); return jobMsg(c, { t: 'jm' });
    }
    case 'jh': {   // توظيف مباشر من بطاقة الشخص
      const o = peer(), J = JOBS[m.j]; if (!o || !J || !jCanManage(c, m.j)) return;
      if (!o.home) return jErr(c, 'لازم يكون عنده بيت 🏠');
      if (isJailed(o)) return jErr(c, 'مسجون 🔒');
      if (!c.admin && jNb(keyOf(o))) return jErr(c, `⛔ ${o.name} ممنوع من الوظائف باقي ${nbTxt(jNb(keyOf(o)))} — بس صاحب المدينة يقدر يوظّفه`);
      if (c.admin && job.nb) delete job.nb[keyOf(o)];   // صاحب المدينة يقدر يرجّع المفصول
      if (job.emp[keyOf(o)]) return jErr(c, 'عنده وظيفة أصلاً'); if (!jFullCheck(c, m.j, o.name, m.rep, { f: o.id })) return;
      const r = jHire(keyOf(o), m.j, o.name, c.name); if (r === 'full') return jErr(c, 'الوظيفة ممتلئة'); if (r === 'has') return jErr(c, 'عنده وظيفة أصلاً');
      return wsSend(c, { t: 'jx', m: `✅ وظّفت ${o.name} ${J.n}` });
    }
    case 'jf': {   // فصل
      const o = m.f ? peer() : null, k = o ? keyOf(o) : typeof m.k === 'string' ? m.k : ''; const e = job.emp[k]; if (!e) return;
      if (e.j === 'gm' ? !c.admin : e.sup ? !(c.admin || isGM(c)) : !jCanManage(c, e.j)) return jErr(c, 'ما تقدر تفصله');
      job.nb = job.nb || {}; job.nb[k] = Date.now() + JOB_NB_MS; jFire(k, `📤 انفصلت من ${e.sup ? JOB_SUPN[e.j] : 'وظيفة ' + JOBS[e.j].n} بسبب مخالفة — ⛔ ممنوع من كل الوظائف 3 أيام`);
      wsSend(c, { t: 'jx', m: `❌ انفصل ${e.n} من ${e.sup ? JOB_SUPN[e.j] : JOBS[e.j].n} + ⛔ ممنوع من الوظائف 3 أيام` }); return m.k ? jobMsg(c, { t: 'jm' }) : undefined;
    }
    case 'js': {   // صاحب المدينة يعيّن مشرف وظيفة (أو يشيله)
      if (!c.admin && !isGM(c)) return; const o = peer(); if (!o) return; const k = keyOf(o);
      if (m.j === null || m.j === undefined) { const e0 = job.emp[k]; if (e0 && (e0.sup || (e0.j === 'gm' && c.admin))) { jFire(k); wsSend(c, { t: 'jx', m: `✅ شلت رتبة ${JOB_SUPN[e0.j]} من ${o.name}` }); } return; }
      if (!JOBS[m.j] || o.admin) return;
      if (m.j === 'gm') {   // صاحب المدينة يعيّن المدير العام مباشرة (حتى لو عنده وظيفة ثانية)
        if (!c.admin) return; if (!o.home) return jErr(c, 'لازم يكون عنده بيت 🏠');
        const old = Object.keys(job.emp).find(x => job.emp[x].j === 'gm'); if (old && old !== k) jFire(old, '📤 انشالت منك رتبة المدير العام');
        if (job.nb) delete job.nb[k]; job.emp[k] = { j: 'gm', sup: 0, t: now, n: o.name, last: now }; job.apps = job.apps.filter(a => a.k !== k); saveJob();
        wsSend(o, { t: 'jx', win: 1, m: '👔 صرت المدير العام! تدير كل الوظائف والمشرفين — من 💼' }); jRef(o); jbAll();
        return wsSend(c, { t: 'jx', m: `👔 ${o.name} صار المدير العام` });
      }
      if (!c.admin && jNb(k)) return jErr(c, `⛔ ${o.name} ممنوع من الوظائف — بس صاحب المدينة يقدر`); if (!o.home) return jErr(c, 'لازم يكون عنده بيت 🏠');
      const old = jSupOf(m.j); if (old && old[0] !== k) jFire(old[0], `📤 انشالت منك رتبة ${JOB_SUPN[m.j]}`);
      if (job.nb) delete job.nb[k]; job.emp[k] = { j: m.j, sup: 1, t: now, n: o.name, last: now }; job.apps = job.apps.filter(a => a.k !== k); saveJob();
      wsSend(o, { t: 'jx', win: 1, m: `⭐ صرت ${JOB_SUPN[m.j]}! تقبل الطلبات وتوظّف وتفصل — من 💼` }); jRef(o); jbAll();
      return wsSend(c, { t: 'jx', m: `⭐ ${o.name} صار ${JOB_SUPN[m.j]}` });
    }
    case 'jm': {   // لوحة الإدارة (المشرف يشوف وظيفته فقط)
      const e = jEmp(c), gm = isGM(c); if (!c.admin && !gm && !(e && e.sup)) return; const mine = j => c.admin || (gm ? j !== 'gm' : e.j === j), polV = jPolBoss(c);
      return wsSend(c, { t: 'jm', apps: job.apps.filter(a => mine(a.j)).map(a => [a.k, a.n, a.j, jLv(a.dh), a.t]),
        emps: Object.entries(job.emp).filter(([, x]) => mine(x.j)).map(([k, x]) => [k, x.n, x.j, x.sup ? 1 : 0, jOnline(k) ? 1 : 0, x.t]),
        jail: polV ? Object.entries(job.jail).filter(([, r]) => r.until > now).map(([k, r]) => [k, r.n, r.until - now, r.r, r.bn, r.ap ? 1 : 0]) : [],
        log: polV ? job.log.slice(-40).reverse() : [], th: c.admin ? { on: th.on ? 1 : 0, next: Math.max(0, th.next - now) } : null });
    }
    case 'jun': { if (!jEmp(c)) return; c.juni = !!m.on; jRef(c); return wsSend(c, jbMsg(c)); }   // ألبس زي الوظيفة أو لا
    case 'jj': { const o = peer(); if (!o) return jErr(c, 'الشخص طلع من المكان'); return jJail(c, o, m.r, m.m); }
    case 'jr': {   // إطلاق مبكر: اللي سجنه، مشرف الشرطة، الأدمن
      const o = m.f ? peer() : null, k = o ? keyOf(o) : typeof m.k === 'string' ? m.k : ''; const r = jailOf(k); if (!r) return;
      if (!(jPolBoss(c) || r.by === keyOf(c))) return jErr(c, 'ما تقدر تطلقه');
      if (jPolBoss(c)) jOverturn(r, c); jRelease(k, c.name); wsSend(c, { t: 'jx', m: `🔓 أطلقت ${r.n}` }); return m.k ? jobMsg(c, { t: 'jm' }) : undefined;
    }
    case 'jp': {   // المسجون يعترض (مرة وحدة)
      const r = jailOf(keyOf(c)); if (!r || r.ap) return; r.ap = 1; saveJob(); setImmediate(ccPing); let n = 0;
      for (const o of clients) if (o.ready && o !== c && jPolBoss(o)) { wsSend(o, { t: 'jpn', k: keyOf(c), n: c.name, bn: r.bn, r: r.r }); n++; }
      return wsSend(c, { t: 'jx', m: n ? '📢 وصل اعتراضك لمشرف الشرطة' : '📢 انسجل اعتراضك — ما فيه مشرف متصل الحين' });
    }
    case 'jbl': {   // كفالة
      const k = keyOf(c), r = jailOf(k); if (!r || !c.dh) return; const e = ecoGet(c.dh);
      if (e.c < BAIL) return jErr(c, `الكفالة ${BAIL} 🪙 — عندك ${e.c}`);
      ecoDo(c.dh, (x, evs) => { x.c -= BAIL; evs.push(`💰 دفعت كفالة ${BAIL} 🪙 وطلعت`); }); return jRelease(k, 'كفالة');
    }
    case 'jsr': {   // 🚨 صفارة الشرطة (وهو يسوق)
      if (jOf(c) !== 'police' || now - (c.srT || 0) < 700) return; c.srT = now; const on = !!m.on && c.v >= 0; if (on === !!c.siren) return; c.siren = on; return jRef(c);
    }
    case 'jst': {   // 🛑 أمر وقوف لسائق قريب
      if (jOf(c) !== 'police' && !c.admin && !isGM(c)) return; if (now - (c.stT || 0) < 6000) return jErr(c, 'شوي شوي 🙂'); const o = peer(); if (!o || !(o.v >= 0) || o.ride) return jErr(c, 'هو مو سايق الحين');
      if (Math.hypot(o.x - c.x, o.z - c.z) > 35) return jErr(c, 'بعيد عنك — قرّب منه (35 متر)'); c.stT = now;
      wsSend(o, { t: 'jst', n: c.name }); return wsSend(c, { t: 'jx', m: `🛑 طلبت من ${o.name} يوقف سيارته` });
    }
    case 'jin': {   // انصبت (صدمة قوية بالسيارة / موت بعالم البناء) — تضر صاحبها بس
      if (c.inj > now || now - (c.injT || 0) < 3 * 60e3 || isJailed(c)) return; c.injT = now; c.injS = now; injSet(c, now + INJ_MS); jRef(c);
      return wsSend(c, { t: 'jhl', on: 1, left: INJ_MS, s: m.s | 0 });
    }
    case 'jhl': {   // 🩺 الطبيب يعالج
      if (jOf(c) !== 'doctor' && !c.admin) return; const o = peer(); if (!o) return; if (!(o.inj > now)) return jErr(c, 'هو مو مصاب 🙂');
      if (Math.hypot(o.x - c.x, o.z - c.z) > 8) return jErr(c, 'قرّب منه (8 متر) عشان تعالجه');
      injSet(o, 0); jRef(o); wsSend(o, { t: 'jhl', on: 0, n: c.name }); const pk = keyOf(c) + '>' + keyOf(o);
      if (c.dh && now - (healCd.get(pk) || 0) > 10 * 60e3) { healCd.set(pk, now); if (healCd.size > 5000) healCd.delete(healCd.keys().next().value); ecoDo(c.dh, (x, evs) => { const g = ecoCoins(x, 5, 'hl', 60); evs.push(g ? `🩺 عالجت ${o.name}: +${g} 🪙` : `🩺 عالجت ${o.name}`); }); }
      else wsSend(c, { t: 'jx', m: `🩺 عالجت ${o.name}` }); return;
    }
    case 'jhb': {   // 🛏️ تعالجت بسرير المستشفى (لازم تكون داخل المستشفى ومصاب من 15 ثانية على الأقل)
      if (!(c.inj > now)) return wsSend(c, { t: 'jhl', on: 0, n: '' });   // السيرفر شايفك سليم (مثلاً طلعت ورجعت) → نفك الإصابة عند جوالك بدل ما تعلق
      if (now - (c.injS || 0) < 15000 || !inLocal(c, HS, 2)) return; injSet(c, 0); jRef(c); return wsSend(c, { t: 'jhl', on: 0, n: '' });
    }
    case 'jg': {   // 🎁 موظف المول يعطي هدية
      if (jOf(c) !== 'mall') return; if (now - (c.gfT || 0) < 2500) return jErr(c, 'شوي شوي 🙂'); const o = peer(); if (!o) return;
      if (!inLocal(c, MALL_Z, 8)) return jErr(c, 'الهدايا داخل المول بس 🏬');
      if (Math.hypot(o.x - c.x, o.z - c.z) > 10) return jErr(c, 'قرّب منه (10 متر)');
      if (!o.dh || o.net === c.net) return jErr(c, 'ما تقدر تعطيه هدية');
      if (job.gift[o.dh] === dayNum()) return jErr(c, `${o.name} أخذ هدية المول اليوم 🎁`);
      c.gfT = now; job.gift[o.dh] = dayNum(); saveJob(); const amt = 10 + Math.floor(Math.random() * 21);
      ecoDo(o.dh, (x, evs) => { x.c += amt; evs.push(`🎁 هدية المول من ${c.name}: +${amt} 🪙`); });
      if (c.dh) ecoDo(c.dh, (x, evs) => { const g = ecoCoins(x, 3, 'mg', 60); evs.push(`🎁 أعطيت ${o.name} هدية${g ? ' +' + g + ' 🪙' : ''}`); }); return;
    }
    case 'jo': {   // 🛒 موظف المول يعرض غرض من السوق على زائر (بخصم 10%، والموظف ياخذ عمولة 5% من المتجر)
      if (jOf(c) !== 'mall') return; if (now - (c.joT || 0) < 3000) return jErr(c, 'شوي شوي 🙂'); const o = peer(); if (!o) return jErr(c, 'الشخص طلع من المكان');
      const it = typeof m.i === 'string' && MARKET_MAP.get(m.i); if (!it || it.i === 'rename') return;
      if (!inLocal(c, MALL_Z, 8)) return jErr(c, 'البيع داخل المول بس 🏬'); if (Math.hypot(o.x - c.x, o.z - c.z) > 12) return jErr(c, 'قرّب منه (12 متر)');
      if (!o.home || !o.dh) return jErr(c, 'ما عنده بيت — السوق للي عنده بيت 🏠'); if (o.net === c.net) return jErr(c, 'ما تقدر تبيع لجهاز من نفس شبكتك');
      if (mkOwns(o, it)) return jErr(c, `${o.name} عنده «${it.n}» من قبل ✅`);
      if (o.jof && now - o.jof.t < 60e3 && o.jof.f !== c.id) return jErr(c, 'عنده عرض ثاني ينتظر رده — انتظر شوي');
      c.joT = now; const p = Math.max(1, Math.ceil(it.p * .9)); o.jof = { f: c.id, i: it.i, p, t: now };
      wsSend(o, { t: 'jof', f: c.id, n: c.name, i: it.i, nm: it.n, p, op: it.p }); return wsSend(c, { t: 'jx', m: `📨 عرضت «${it.n}» على ${o.name} بـ ${p} 🪙 — ننتظر رده` });
    }
    case 'jy': {   // الزائر يرد على عرض الموظف
      const of = c.jof; c.jof = null; if (!of || now - of.t > 60e3) return jErr(c, '⌛ انتهى العرض');
      const s = [...clients].find(x => x.id === of.f && x.ready && !x.dead); const it = MARKET_MAP.get(of.i); if (!it) return;
      if (m.ok !== true) { if (s) wsSend(s, { t: 'jx', m: `🙏 ${c.name} ما اشترى «${it.n}»` }); return; }
      if (!s || jOf(s) !== 'mall') return jErr(c, 'الموظف طلع — اشترِ من 🛒 السوق');
      const e0 = ecoGet(c.dh), before = e0.c; marketMsg(c, { t: 'mk', i: of.i }, of.p); const paid = before - ecoGet(c.dh).c;
      if (paid !== of.p) return;   // ما تم الشراء (ذهب ما يكفي/عنده) — marketMsg أرسل السبب
      const com = Math.max(1, Math.ceil(it.p * .05)); if (s.dh) ecoDo(s.dh, (x, evs) => { const g = ecoCoins(x, com, 'ms', 1500); x.sold = (x.sold | 0) + 1; evs.push(`💰 بعت «${it.n}» لـ ${c.name}${g ? ' — عمولتك +' + g + ' 🪙' : ' (وصلت حد العمولة اليوم)'}`); });
      return wsSend(c, { t: 'jx', win: 1, m: `🛍️ اشتريت «${it.n}» من ${s.name} بخصم 10% (وفّرت ${it.p - of.p} 🪙)` });
    }
    case 'jsl': {   // صاحب المدينة يغيّر عدد مقاعد وظيفة (+/-)
      if (!c.admin || !JOBS[m.j] || m.j === 'gm' || !Number.isInteger(m.n)) return; const n = Math.max(0, Math.min(60, m.n)); JOBS[m.j].slots = n; job.slots = job.slots || {}; job.slots[m.j] = n; saveJob(); jbAll();
      return wsSend(c, { t: 'jx', m: `💼 ${JOBS[m.j].n}: صار عدد المقاعد ${n}` + (jUsed(m.j) > n ? ` (فيه ${jUsed(m.j)} موظف — ما ينفصل أحد، بس ما ينقبل جديد لين ينزل العدد)` : '') });
    }
    case 'thc': {   // مسكت الحرامي؟ السيرفر يتأكد إنك قريب من مكانه الحقيقي
      if (!th.on || !c.walk || c.x === undefined || isJailed(c) || now - (c.thT || 0) < 800) return; c.thT = now;
      const P = plazaC(), [lx, lz] = thiefLocal(th.o + THIEF_SP * (now - th.t0) / 1000); if (Math.hypot(c.x - P.x - lx, c.z - P.z - lz) > 7) return;
      th.on = false; th.next = now + THIEF_EVERY; const pol = jOf(c) === 'police';
      if (c.dh) ecoDo(c.dh, (x, evs) => { const g = ecoCoins(x, pol ? 120 : 60, 'th', 240); evs.push(g ? `🦹 مسكت الحرامي! +${g} 🪙` : '🦹 مسكت الحرامي! (وصلت حدّك اليوم من الذهب)'); });
      thAll({ t: 'thw', n: c.name, id: c.id, pol: pol ? 1 : 0 }); return thAll({ t: 'th', on: 0 });
    }
    case 'thn': { if (!c.admin || th.on) return; thStart(); return wsSend(c, { t: 'jx', m: '🦹 بدأت فعالية الحرامي' }); }
  }
}
const JAIL_BLOCK = new Set(['cq', 'cr', 'in', 'kn', 'ride', 'rj', 'gq', 'mq', 'vt', 'vk', 'pk', 'pu', 'ja']);

// ===== مدينة مشتركي تيك توك (VIP): قصور برمز لكل مشترك + بوابة بتصريح =====
// لازم الثوابت تطابق vipcity.js: STEP=78، البوابة z=300 والعمق 330 نسبةً لمركز الساحة، نصف العرض 200.
const VIP_FILE = path.join(path.dirname(DATA), 'vip.json'), VIP_SEED = path.join(path.dirname(DATA), 'vip_seed.json');
let vip = { houses: [], seen: {}, ent: {} };
try { vip = { houses: [], seen: {}, ent: {}, ...JSON.parse(fs.readFileSync(VIP_FILE, 'utf8')) }; } catch {}
let vipTimer = null; const vipSess = new Map(), VIP_LOTS = 13;   // lot 0 = قصر المشرف الكبير، 1..12 = قصور المشتركين
function saveVip() { if (vipTimer) return; vipTimer = setTimeout(() => { vipTimer = null; try { fs.writeFileSync(VIP_FILE + '.tmp', JSON.stringify(vip)); fs.renameSync(VIP_FILE + '.tmp', VIP_FILE); } catch (e) { console.error('فشل حفظ VIP:', e.message); } }, 400); }
const vipPub = () => vip.houses.map(h => ({ id: h.id, name: h.name, lot: h.lot, adm: h.adm ? 1 : 0, inv: h.inv || h.id, lk: h.g ? 1 : 0 }));
const vipGroup = h => vip.houses.filter(x => (x.inv || x.id) === (h.inv || h.id));   // كل قصور نفس الدعوة (نفس الرمز)
function vipLot(adm) { const used = new Set(vip.houses.map(h => h.lot)); if (adm && !used.has(0)) return 0; for (let l = 1; l < VIP_LOTS; l++) if (!used.has(l)) return l; return -1; }
async function vipAdd(name, pin, adm) {
  const nm = adm ? String(name || 'قصر الملك').slice(0, 24) : cleanName(name), pn = cleanPin(pin), lot = vipLot(adm);
  if (!nm || !pn || lot < 0) return null;
  const h = { id: 'v' + crypto.randomBytes(4).toString('hex'), name: nm, lot, t: Date.now(), adm: !!adm };
  // نفس الرمز لقصر موجود = نفس الدعوة: صاحبها يملك كل قصورها (أكثر من قصر بدعوة وحدة)
  let shared = null; for (const x of vip.houses) { try { const k = await scrypt(pn, x.ps); if (crypto.timingSafeEqual(Buffer.from(k, 'hex'), Buffer.from(x.ph, 'hex'))) { shared = x; break; } } catch {} }
  if (shared) { h.ps = shared.ps; h.ph = shared.ph; h.inv = shared.inv || shared.id; shared.inv = h.inv; } else { await setPin(h, pn); h.inv = h.id; }
  vip.houses.push(h); saveVip();
  for (const o of clients) if (o.vhs && vipGroup(h).some(x => x !== h && o.vhs.includes(x.id))) o.vhs = [...new Set([...o.vhs, h.id])];   // اللي متصل وعنده الدعوة ياخذ القصر الجديد
  return h;
}
function vipBroadcast() { for (const o of clients) if (o.ready) wsSend(o, vhMsg(o)); }
const vhMsg = c => ({ t: 'vh', l: vipPub(), mine: c.vhs || [], pass: !!c.vip, tour: vipTour(c), lk: c.gsub ? 1 : 0 });
function vipBindAcct(c) {   // قصور دخلها هذا الجهاز بالرمز تنربط بحساب قوقل + بيته الأساسي (أول ما يتوثّق)
  if (!c.gsub || !c.dh) return; let any = false;
  for (const id of vip.ent[c.dh] || []) { const h = vip.houses.find(x => x.id === id); if (h && !h.g) { h.g = c.gsub; if (c.home && !h.hh) h.hh = c.home; any = true; } }
  if (any) saveVip();
}
function vipGrant(c, h, guest) { c.vtour = false; c.vip = true; c.vhs = h ? vipGroup(h).map(x => x.id) : []; if (!guest && c.dh) vipSess.set(c.dh, { hs: c.vhs, t: Date.now() }); }
// الزيارة المجانية: مرة وحدة لكل شخص (مفتاح الجهاز + حساب قوقل لو مربوط) ومدتها VIP_TOUR_MS؛ بعدها يطلع وما يرجع إلا برمز قصر
const VIP_TOUR_MS = (+process.env.VIP_TOUR_MIN || 15) * 60e3;
const vipKeys = c => [c.dh && 'd:' + c.dh, c.gsub && 'g:' + c.gsub].filter(Boolean);
function vipTour(c) {   // 0 متاحة، 1 شغّالة الحين، 2 انتهت/مستخدمة
  const ks = vipKeys(c); if (!ks.length) return 2; let t = 0; for (const k of ks) t = Math.max(t, vip.seen[k] || 0);
  if (!t) return 0; return Date.now() - t < VIP_TOUR_MS ? 1 : 2;
}
function vipTourStart(c) {
  let t = 0; for (const k of vipKeys(c)) t = Math.max(t, vip.seen[k] || 0);
  c.vip = true; c.vhs = []; c.vtour = true; c.vtEnd = t + VIP_TOUR_MS; c.vtw = false;
  wsSend(c, { t: 'vip', ok: 1, guest: 1, tour: Math.max(1, Math.ceil((c.vtEnd - Date.now()) / 60e3)) }); vipBroadcast();
}
setInterval(() => { const now = Date.now(); for (const c of clients) if (c.vtour && c.vip && !c.admin) {
  if (now > c.vtEnd) { c.vtour = false; c.vip = false; c.vhs = []; wsSend(c, { t: 'vipend' }); wsSend(c, vhMsg(c)); }
  else if (!c.vtw && c.vtEnd - now < 120e3) { c.vtw = true; wsSend(c, { t: 'vtw' }); }
} }, 5000).unref();
function vipInside(x, z) {   // داخل أسوار المدينة؟ (نفس حساب مكان الساحة بالعميل)
  const pz = plazaC().z;   // نفس nBlocks (كانت +12 القديمة فتنحسب الأسوار بمكان غلط)
  return Math.abs(x) < 206 && z > pz + 304 && z < pz + 636;
}
(async () => {   // بيوت جاهزة من ملف مؤقت على السيرفر (مثل بيت المشرف برمزه) — الرمز يُشفَّر وينمسح الملف
  try { const seed = JSON.parse(fs.readFileSync(VIP_SEED, 'utf8')); let any = false; for (const sd of seed) if (sd && !vip.houses.some(h => h.name === sd.name)) { if (await vipAdd(sd.name, sd.pin, !!sd.adm)) any = true; } fs.writeFileSync(VIP_SEED, '[]'); if (any) console.log('تم إنشاء بيوت VIP من ملف الإعداد'); } catch {}
})();

// ===== ألعاب ثنائية (السيرفر يتحقق من كل حركة) =====
const GC_N = 20, GAME_IDS = ['ttt', 'c4', 'rps'], gQueue = { ttt: null, c4: null, rps: null };
const TLINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const tttWin = b => { for (const [a, c, d] of TLINES) if (b[a] !== null && b[a] === b[c] && b[a] === b[d]) return b[a]; return b.every(x => x !== null) ? 'd' : null; };
const c4Drop = (b, col, p) => { for (let r = 5; r >= 0; r--) if (b[r * 7 + col] === null) { b[r * 7 + col] = p; return r; } return -1; };
const c4Win = (b, r, c, p) => { for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { let n = 1; for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (rr >= 0 && rr < 6 && cc >= 0 && cc < 7 && b[rr * 7 + cc] === p) { n++; rr += dr * s; cc += dc * s; } } if (n >= 4) return true; } return false; };
const rpsWin = (a, b) => a === b ? -1 : (a - b + 3) % 3 === 1 ? 0 : 1;   // 0 حجر 1 ورقة 2 مقص
const gSend = (o, obj) => wsSend(o, { t: 'g', ...obj });
function gStart(g, a, b) {
  const m = { g, p: [a, b], turn: 0, over: false, b: g === 'ttt' ? Array(9).fill(null) : g === 'c4' ? Array(42).fill(null) : null, pick: [null, null], sc: [0, 0], round: 1, rq: new Set() };
  a.gm = m; b.gm = m; a.gi = 0; b.gi = 1;
  for (const p of [a, b]) if (p.dh) ecoDo(p.dh, (e, evs) => ecoTut(e, 1, evs));
  [a, b].forEach((c, i) => gSend(c, { s: 'start', g, you: i, opp: [a, b][1 - i].name, turn: 0 }));
}
function gLeave(c) {
  for (const k of GAME_IDS) if (gQueue[k] === c) gQueue[k] = null;
  const m = c.gm; if (m && !m.over) { m.over = true; const o = m.p[1 - c.gi]; if (o && !o.dead && o.gm === m) gSend(o, { s: 'end', g: m.g, res: 'left' }); }
  c.gm = null;
}
function gWin(c) { if (c && c.dh) ecoDo(c.dh, (e, evs) => { e.wk.xo++; const g = ecoCoins(e, 10, 'xo', 100); if (g) evs.push(`+${g} 🪙 فزت!`); ecoTask(e, 'xo', 1, evs); }); }
function gEnd(m, w) { m.over = true; if (w === 0 || w === 1) gWin(m.p[w]); m.p.forEach((c, i) => { if (!c.dead) gSend(c, { s: 'end', g: m.g, res: w === 'd' ? 'draw' : w === i ? 'win' : 'lose', b: m.b, turn: m.turn }); }); }
function gUpdate(m, w) {
  if (w === null) { m.turn = 1 - m.turn; m.p.forEach(c => gSend(c, { s: 'st', g: m.g, b: m.b, turn: m.turn })); }
  else { m.p.forEach(c => gSend(c, { s: 'st', g: m.g, b: m.b, turn: m.turn })); gEnd(m, w); }
}
function gMove(c, mv) {
  const m = c.gm; if (!m || m.over) return;
  if (m.g === 'ttt') { if (c.gi !== m.turn || !Number.isInteger(mv) || mv < 0 || mv > 8 || m.b[mv] !== null) return; m.b[mv] = c.gi; gUpdate(m, tttWin(m.b)); }
  else if (m.g === 'c4') { if (c.gi !== m.turn || !Number.isInteger(mv) || mv < 0 || mv > 6) return; const r = c4Drop(m.b, mv, c.gi); if (r < 0) return; gUpdate(m, c4Win(m.b, r, mv, c.gi) ? c.gi : (m.b.every(x => x !== null) ? 'd' : null)); }
  else {
    if (![0, 1, 2].includes(mv) || m.pick[c.gi] !== null) return; m.pick[c.gi] = mv;
    if (m.pick[1 - c.gi] === null) return;
    const [a, b] = m.pick, w = rpsWin(a, b); if (w === 0) m.sc[0]++; else if (w === 1) m.sc[1]++; m.round++; m.pick = [null, null];
    const pay = { g: 'rps', r: [a, b], w, sc: [...m.sc], round: m.round }, done = m.sc[0] >= 2 || m.sc[1] >= 2;
    if (done) { m.over = true; gWin(m.p[m.sc[0] > m.sc[1] ? 0 : 1]); m.p.forEach((p, i) => gSend(p, { s: 'end', ...pay, res: (m.sc[0] > m.sc[1]) === (i === 0) ? 'win' : 'lose' })); } else m.p.forEach(p => gSend(p, { s: 'rps', ...pay }));
  }
}

// ===== ألعاب جماعية: لودو (2–4) + سباق النقر + خمّن الرقم =====
// لوبي: اللاعبين ينتظرون (يبدأ لما يكتمل العدد أو بعد 12 ثانية من لاعبين اثنين، أو أي لاعب يضغط «ابدأ مع بوتات»)، والناقص تعبّيه بوتات.
const MG_MAX = { ludo: 4, tap: 6, guess: 4 };   // لودو وخمّن الرقم: لاعبين أو أربعة (3 = نضيف بوت)
const mgTarget = (g, n, want) => g === 'tap' ? Math.max(n, want || 3) : Math.max(n <= 2 ? 2 : 4, want || 0);
const MGS = process.env.MG_FAST ? .04 : 1;                    // اختبارات: كل التأخيرات أسرع
const BOTN = ['🤖 سالم', '🤖 نورة', '🤖 فهد', '🤖 ريم', '🤖 ماجد', '🤖 هند'];
const mgLob = { ludo: null, tap: null, guess: null }, mgRooms = new Set();
const mgSend = (p, o) => { if (p.c && !p.c.dead) wsSend(p.c, { t: 'g', ...o }); };
const mgAll = (R, o) => R.players.forEach((p, i) => mgSend(p, { ...o, me: i }));
function mgLobbyMsg(L) { const left = L.t2 ? Math.max(0, Math.ceil((L.t2 - Date.now()) / 1000)) : 0; L.players.forEach((p, i) => mgSend(p, { s: 'lobby', g: L.g, names: L.players.map(x => x.name), max: MG_MAX[L.g], left, me: i })); }
function mgJoin(c, g) {
  mgLeave(c); gLeave(c);
  let L = mgLob[g]; if (!L) mgLob[g] = L = { g, players: [], t2: 0 };
  L.players.push({ c, name: badgeName(c), bot: false }); c.mg = L;
  if (L.players.length >= MG_MAX[g]) return mgStart(L);
  if (L.players.length >= 2 && !L.t2) L.t2 = Date.now() + 12000;
  mgLobbyMsg(L);
}
function mgStart(L) {
  mgLob[L.g] = null; L.t2 = 0; let n = 0;
  const tg = mgTarget(L.g, L.players.length, L.want);
  while (L.players.length < tg) L.players.push({ c: null, name: BOTN[n++ % BOTN.length], bot: true });
  mgRooms.add(L); L.players.forEach((p, i) => { if (p.c) { p.c.mg = L; p.c.mi = i; } });
  mgInit(L);
}
function mgInit(R) {
  const now = Date.now(); R.over = false; R.win = -1;
  R.players.forEach(p => { p.skip = 0; p.acc = 0; p.rate = 5 + Math.random() * 4; });
  if (R.g === 'ludo') {
    const n = R.players.length, seats = n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]; R.players.forEach((p, i) => p.seat = seats[i]);
    R.d = { toks: R.players.map(() => [-1, -1, -1, -1]), cur: 0, ph: 'roll', roll: 0, rn: 0, mv: [], dl: now + 25000, at: now + 1200 * MGS, auto: 0, last: '' };
  } else if (R.g === 'tap') R.d = { ph: 'cd', t0: now + 3300 * MGS + 300, taps: R.players.map(() => 0), goal: 60, lt: R.players.map(() => 0) };
  else R.d = { secret: 1 + Math.floor(Math.random() * 100), log: [], lo: 1, hi: 100, cur: 0, dl: now + 20000, bt: now + (1800 + Math.random() * 1500) * MGS };
  R.players.forEach((p, i) => mgSend(p, { s: 'mstart', g: R.g, names: R.players.map(x => x.name), seats: R.players.map(x => x.seat ?? 0), me: i }));
  mgState(R);
}
function mgState(R) {
  const d = R.d, now = Date.now();
  if (R.g === 'ludo') mgAll(R, { s: 'lst', g: 'ludo', toks: d.toks, cur: d.cur, ph: d.ph, roll: d.roll, rn: d.rn, mv: d.mv, left: Math.max(0, Math.ceil((d.dl - now) / 1000)), last: d.last, over: R.over });
  else if (R.g === 'tap') mgAll(R, { s: 'tst', g: 'tap', ph: d.ph, taps: d.taps, goal: d.goal, cd: Math.max(0, Math.ceil((d.t0 - now) / 1000)), over: R.over });
  else mgAll(R, { s: 'gst', g: 'guess', log: d.log.slice(-8), lo: d.lo, hi: d.hi, cur: d.cur, left: Math.max(0, Math.ceil((d.dl - now) / 1000)), over: R.over });
}
function mgEnd(R, wi) {
  R.over = true; R.win = wi; mgState(R);
  R.players.forEach((p, i) => { if (!p.c) return; mgSend(p, { s: 'mend', g: R.g, res: i === wi ? 'win' : 'lose', win: R.players[wi].name, me: i }); if (i === wi) gWin(p.c); });
}
function mgLeave(c) {
  const R = c.mg; if (!R) return; c.mg = null;
  if (!mgRooms.has(R)) {   // لسه بالانتظار
    R.players = R.players.filter(p => p.c !== c); if (R.players.length < 2) R.t2 = 0;
    if (!R.players.length) mgLob[R.g] = null; else mgLobbyMsg(R); return;
  }
  const p = R.players[c.mi]; if (p) { p.bot = true; p.c = null; p.name = p.name + ' (خرج)'; }
  if (!R.players.some(x => x.c)) { mgRooms.delete(R); return; }
  R.players.forEach((x, i) => mgSend(x, { s: 'mnames', names: R.players.map(y => y.name), me: i }));
}
// ---- لودو: 52 خانة، لاعب = مقعد (بداية كل مقعد = مقعد×13)، 0..50 مسار، 51..56 ممر البيت، 57 وصل ----
const LSAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]), labs = (seat, pos) => (seat * 13 + pos) % 52;
const ludoMovable = (R, pi, roll) => { const t = R.d.toks[pi], o = []; for (let i = 0; i < 4; i++) { const p = t[i]; if (p === -1 ? roll === 6 : p + roll <= 57) o.push(i); } return o; };
function ludoCaps(R, pi, np, apply) {   // كم قطعة للخصوم تنكل لو وقفت بالخانة np
  if (np > 50) return 0; const a = labs(R.players[pi].seat, np); if (LSAFE.has(a)) return 0; let n = 0;
  R.d.toks.forEach((ot, qi) => { if (qi === pi) return; for (let j = 0; j < 4; j++) if (ot[j] >= 0 && ot[j] <= 50 && labs(R.players[qi].seat, ot[j]) === a) { n++; if (apply) ot[j] = -1; } });
  return n;
}
function ludoNext(R, extra) {
  const d = R.d, now = Date.now(); if (!extra) d.cur = (d.cur + 1) % R.players.length;
  d.ph = 'roll'; d.roll = 0; d.mv = []; d.dl = now + 25000; d.at = now + 900 * MGS; mgState(R);
}
function ludoRoll(R) {
  const d = R.d, now = Date.now(); d.roll = 1 + Math.floor(Math.random() * 6); d.rn++; d.mv = ludoMovable(R, d.cur, d.roll); d.last = `${R.players[d.cur].name} رمى ${d.roll}`;
  if (!d.mv.length) { d.ph = 'pass'; d.at = now + 1300 * MGS; }
  else { d.ph = 'move'; d.dl = now + 25000; d.at = now + 900 * MGS; d.auto = d.mv.length === 1 ? now + 900 * MGS : 0; }
  mgState(R);
}
function ludoMove(R, ti) {
  const d = R.d; if (!d.mv.includes(ti)) return; const pi = d.cur, t = d.toks[pi], roll = d.roll, np = t[ti] === -1 ? 0 : t[ti] + roll; t[ti] = np;
  const cap = ludoCaps(R, pi, np, true), fin = np === 57; d.last = `${R.players[pi].name} حرّك${cap ? ' ونكل ' + cap : ''}${fin ? ' ووصل 🏠' : ''}`;
  if (t.every(x => x === 57)) return mgEnd(R, pi);
  ludoNext(R, roll === 6 || cap > 0 || fin);
}
function ludoBotPick(R) {
  const d = R.d, t = d.toks[d.cur]; let best = d.mv[0], bs = -1;
  for (const i of d.mv) { const np = t[i] === -1 ? 0 : t[i] + d.roll; const sc = (np === 57 ? 100 : 0) + ludoCaps(R, d.cur, np, false) * 80 + (t[i] === -1 ? 50 : 0) + (LSAFE.has(labs(R.players[d.cur].seat, np)) && np <= 50 ? 10 : 0) + Math.max(0, t[i]) * .1; if (sc > bs) { bs = sc; best = i; } }
  return best;
}
function mgApplyGuess(R, i, n) {
  const d = R.d, h = n === d.secret ? 'hit' : n < d.secret ? 'low' : 'high'; if (h === 'low') d.lo = Math.max(d.lo, n + 1); if (h === 'high') d.hi = Math.min(d.hi, n - 1);
  d.log.push({ who: R.players[i].name, n, h }); if (d.log.length > 40) d.log.shift();
  if (h === 'hit') return mgEnd(R, i);
  const now = Date.now(); d.cur = (d.cur + 1) % R.players.length; d.dl = now + 20000; d.bt = now + (1500 + Math.random() * 2000) * MGS; mgState(R);
}
function mgMove(c, m) {
  const R = c.mg; if (!R || !mgRooms.has(R) || R.over) return; const i = c.mi, now = Date.now(), d = R.d, p = R.players[i]; if (!p || p.c !== c) return;
  if (R.g === 'ludo') {
    if (i !== d.cur) return;
    if (m.a === 'roll' && d.ph === 'roll') { p.skip = 0; ludoRoll(R); } else if (m.a === 'mv' && d.ph === 'move' && Number.isInteger(m.i)) { p.skip = 0; ludoMove(R, m.i); }
  } else if (R.g === 'tap') {
    if (m.a !== 'tap' || d.ph !== 'run' || now - d.lt[i] < 55) return; d.lt[i] = now; d.taps[i]++; if (d.taps[i] >= d.goal) mgEnd(R, i);
  } else {
    if (m.a !== 'g' || i !== d.cur || !Number.isInteger(m.n) || m.n < 1 || m.n > 100) return; p.skip = 0; mgApplyGuess(R, i, m.n);
  }
}
let mgSec = 0;
function mgTick() {
  const now = Date.now(); mgSec++;
  for (const g of Object.keys(mgLob)) { const L = mgLob[g]; if (!L) continue; if (L.t2 && now >= L.t2 && L.players.length >= 2) mgStart(L); else if (mgSec % 4 === 0) mgLobbyMsg(L); }
  for (const R of [...mgRooms]) {
    if (R.over) continue; const d = R.d;
    if (R.g === 'ludo') {
      const p = R.players[d.cur];
      if (d.ph === 'roll') { if ((p.bot && now >= d.at) || (!p.bot && now >= d.dl)) { if (!p.bot && ++p.skip >= 3) p.bot = true; ludoRoll(R); } }
      else if (d.ph === 'pass') { if (now >= d.at) ludoNext(R, false); }
      else if (d.ph === 'move') {
        if (p.bot && now >= d.at) ludoMove(R, ludoBotPick(R));
        else if (d.auto && now >= d.auto) ludoMove(R, d.mv[0]);
        else if (!p.bot && now >= d.dl) { if (++p.skip >= 3) p.bot = true; ludoMove(R, d.mv[Math.floor(Math.random() * d.mv.length)]); }
      }
      if (mgSec % 4 === 0 && !R.over) mgState(R);   // العدّاد
    } else if (R.g === 'tap') {
      if (d.ph === 'cd') { if (now >= d.t0) { d.ph = 'run'; d.rt = now; } mgState(R); }
      else { const dt = Math.min(.5, (now - (R.tk || now)) / 1000); R.tk = now; let w = -1; R.players.forEach((p, i) => { if (!p.bot) return; p.acc += p.rate * dt; while (p.acc >= 1 && d.taps[i] < d.goal) { p.acc -= 1; d.taps[i]++; } if (d.taps[i] >= d.goal && w < 0) w = i; }); if (w >= 0) mgEnd(R, w); else mgState(R); }
    } else {
      const p = R.players[d.cur], lo = d.lo, hi = d.hi;   // بالدور: لاعب واحد كل مرة
      if (p.bot && now >= d.bt) mgApplyGuess(R, d.cur, Math.max(lo, Math.min(hi, Math.floor((lo + hi) / 2) + Math.floor((Math.random() - .5) * Math.max(2, (hi - lo) / 3)))));
      else if (!p.bot && now >= d.dl) { if (++p.skip >= 3) p.bot = true; mgApplyGuess(R, d.cur, lo + Math.floor(Math.random() * (hi - lo + 1))); }
      else if (mgSec % 4 === 0) mgState(R);   // العدّاد
    }
  }
}
setInterval(mgTick, process.env.MG_FAST ? 25 : 250).unref();

// ===== السباق: لوبي ← عدّ 3-2-1 ← انطلاق ← نهاية. السيرفر يدير الحالة فقط، والسيارات تتحرك عند اللاعبين =====
// (RACE_G و RACE_LAPS لازم تطابق G و LAPS في public/district.js)
const RACE_G = 16, RACE_LAPS = 2, RACE_MAX = 8;
const race = { s: 'idle', mem: new Map(), racers: new Map(), lobbyEnd: 0, lastLeft: -1, cdN: 0, cdAt: 0, t0: 0, cool: 0, lastRun: 0 };
function raceAll(obj) { for (const o of clients) if (o.ready) wsSend(o, obj); }
const raceSlots = () => [...race.racers].map(([c, r]) => [c.id, r.slot]);
function raceRanks() {
  const list = [...race.racers].sort(([, a], [, b]) => (a.fin !== null ? 0 : 1) - (b.fin !== null ? 0 : 1) || (a.fin !== null ? a.fin - b.fin : b.cnt - a.cnt || a.last - b.last));
  list.forEach(([c], i) => wsSend(c, { t: 'rk', p: i + 1, of: list.length }));
}
function raceEnd(abort) {
  const res = abort ? [] : [...race.racers].filter(([, r]) => r.fin !== null).sort(([, a], [, b]) => a.fin - b.fin).map(([c, r]) => [c.name, r.fin]);
  raceAll({ t: 'race', s: 'idle', res });
  race.s = 'idle'; race.racers.clear(); race.mem.clear(); race.lobbyEnd = 0; race.lastLeft = -1; race.cool = Date.now() + 8000;
}
const RACE_SOLO_MS = +process.env.RACE_SOLO_MS || 15000;   // انتظار السباق الفردي
const RACE_STUCK = +process.env.RACE_STUCK_MS || 75000;   // سباق ما عدّى نقطة تفتيش بهالمدة = يطلع (اختبارات: أقصر)
function raceTick() {
  const now = Date.now();
  for (const [c, t] of race.mem) if (c.dead || now - t > 8000) race.mem.delete(c);
  for (const c of race.racers.keys()) if (c.dead) race.racers.delete(c);
  if (race.s === 'idle' || race.s === 'lobby') {
    const n = race.mem.size;
    if (n >= 1) {   // لاعب واحد = سباق ضد الوقت بعد 15ث (عشان مهمة السباق تنحسب لو ما فيه أحد)
      if (race.s === 'idle') { race.s = 'lobby'; race.lobbyEnd = now + (n >= 2 ? 10000 : RACE_SOLO_MS); }
      else if (n >= 2 && race.lobbyEnd - now > 10000) race.lobbyEnd = now + 10000;
      const left = Math.max(0, Math.ceil((race.lobbyEnd - now) / 1000));
      if (now >= race.lobbyEnd) {
        race.racers.clear(); let slot = 0;
        for (const c of race.mem.keys()) { if (slot >= RACE_MAX) break; race.racers.set(c, { slot: slot++, cnt: 0, last: now, fin: null }); }
        race.s = 'cd'; race.cdN = 3; race.cdAt = now; raceAll({ t: 'race', s: 'cd', n: 3, slots: raceSlots() });
      } else if (left !== race.lastLeft || n !== race.lastN) { race.lastLeft = left; race.lastN = n; raceAll({ t: 'race', s: 'lobby', n, left }); }
    } else if (race.s === 'lobby') { race.s = 'idle'; race.lobbyEnd = 0; race.lastLeft = -1; raceAll({ t: 'race', s: 'idle' }); }
  } else if (race.s === 'cd') {
    if (!race.racers.size) return raceEnd(true);
    if (now - race.cdAt >= 1000) {
      race.cdN--; race.cdAt = now;
      if (race.cdN > 0) raceAll({ t: 'race', s: 'cd', n: race.cdN, slots: raceSlots() });
      else { race.s = 'run'; race.t0 = now; race.lastRun = now; raceAll({ t: 'race', s: 'go', n: race.racers.size }); }
    }
  } else if (race.s === 'run') {
    const left = [...race.racers.values()].filter(r => r.fin === null).length;
    for (const [c, r] of race.racers) if (r.fin === null && now - Math.max(r.last, race.t0) > RACE_STUCK) { race.racers.delete(c); wsSend(c, { t: 'race', s: 'idle', res: [] }); }   // متعطّل (ما عدّى نقطة 75 ثانية) = يطلع من السباق
    if (!left || !race.racers.size || now - race.t0 > 4 * 60000) return raceEnd(false);
    if (now - race.lastRun > 5000) { race.lastRun = now; raceAll({ t: 'race', s: 'run', n: race.racers.size }); }   // للي دخل متأخر
  }
}
setInterval(raceTick, 250).unref();

// كل 125ms: كل لاعب ياخذ أقرب الناس حوله (ونرسل بس لو تغيّر شي)
let tickN = 0;
setInterval(() => { const old = Date.now() - 15 * 60000; for (const [k, v] of ghosts) if (v.t < old) ghosts.delete(k); }, 60000).unref();
setInterval(() => {
  tickN++;
  for (const c of clients) {   // الركاب: مكانهم = مكان السائق
    if (!c.ride) continue;
    const d = [...clients].find(o => o.id === c.ride);
    if (!d || d.dead || !(d.v >= 0) || d.ride) { c.ride = null; c.seat = 0; c.v = -1; c.mv = 0; wsSend(c, { t: 'ride', end: true }); continue; }
    c.x = d.x; c.z = d.z; c.y = d.y; c.r = d.r; c.v = d.v; c.mv = 0; c.walk = true;
  }
  // نوزّع اللاعبين على مربعات (160م) ونحسب مدخل كل لاعب مرة وحدة — بدل ما كل لاعب يقارن نفسه بكل اللاعبين ويبني نفس البيانات من جديد
  const CELL = 160, grid = new Map(); let online = 0;
  for (const o of clients) {
    if (o.ready) online++;
    if (!o.ready || !o.walk || o.x === undefined) continue;
    o._pe = JSON.stringify([o.id, Math.round(o.x * 10), Math.round(o.z * 10), Math.round(o.y * 100), Math.round(o.r * 100), o.mv, o.v ?? -1, o.seat || 0, o.ride || 0]);
    const k = Math.floor(o.x / CELL) * 65536 + Math.floor(o.z / CELL); let arr = grid.get(k); if (!arr) grid.set(k, arr = []); arr.push(o);
  }
  const now = Date.now();
  for (const c of clients) {
    if (now - c.seen > 20000) { wsClose(c); continue; }        // ما وصلنا منه شي من 20 ثانية (الواجهة ترسل كل 5 ثواني على الأقل)
    if (!c.ready || c.x === undefined) continue;
    const R = c.walk ? VIEW_WALK : VIEW_SKY, R2 = R * R, cr = Math.ceil(R / CELL), gx = Math.floor(c.x / CELL), gz = Math.floor(c.z / CELL);
    const near = [];
    for (let ax = gx - cr; ax <= gx + cr; ax++) for (let az = gz - cr; az <= gz + cr; az++) { const arr = grid.get(ax * 65536 + az); if (!arr) continue; for (const o of arr) { if (o === c) continue; const d = (o.x - c.x) ** 2 + (o.z - c.z) ** 2; if (d < R2) near.push([d, o]); } }
    if (near.length > MAX_SEEN) { nearestK(near, MAX_SEEN); near.length = MAX_SEEN; }
    const nm = []; for (const [, o] of near) if (!c.known.has(o.id)) { c.known.add(o.id); nm.push(meta(o)); }
    const key = near.map(([, o]) => o._pe).join(',');
    if (key === c.lastKey && !nm.length && tickN % 16) continue;
    c.lastKey = key;
    wsSendRaw(c, '{"t":"s","p":[' + key + ']' + (nm.length ? ',"m":' + JSON.stringify(nm) : '') + (tickN % 16 === 0 ? ',"on":' + online : '') + '}');
  }
}, 125).unref();

server.on('upgrade', (req, sock) => {
  sock.on('error', () => {});
  const url = req.url.split('?')[0];
  // نفس الموقع فقط (يمنع مواقع ثانية تتصل باسم الزائر)
  let originOk = false;
  try { originOk = new URL(req.headers.origin || '').host === req.headers.host; } catch {}
  const key = req.headers['sec-websocket-key'];
  if (url !== '/ws' || !originOk || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
  const net = netKey(ipOf(req));
  if (clients.size >= MAX_PLAYERS) { sock.end('HTTP/1.1 503 Busy\r\n\r\n'); return; }
  { let n = 0; for (const o of clients) if (o.net === net && ++n >= MAX_CONN_PER_NET) { sock.end('HTTP/1.1 503 Busy\r\n\r\n'); return; } }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { id: (nextId++).toString(36), sock, net, buf: Buffer.alloc(0), known: new Set(), tokens: 25, tt: Date.now(), tt0: Date.now(), seen: Date.now(), lastSay: 0, ready: false, walk: false, log: [], dev: '' };
  clients.add(c);
  sock.on('data', d => wsData(c, d));
  sock.on('close', () => wsClose(c));
  sock.on('end', () => wsClose(c));   // الجهاز قطع بدون إطار إغلاق (جوال انقطع): نشيله فوراً بدل انتظار 20 ثانية
});

// ===== ربط الحساب بقوقل: يرتبط بـ«الهوية الثابتة» (sub) مو الإيميل؛ نخزّن sub + إيميل مخفي جزئياً فقط =====
// تحويل OAuth (code flow) من السيرفر: الصفحة ما تحمّل أي سكربت من قوقل، والسر (GOOGLE_CLIENT_SECRET) بملف الخدمة فقط.
const G_ID = process.env.GOOGLE_CLIENT_ID || '', G_SECRET = process.env.GOOGLE_CLIENT_SECRET || '', G_BASE = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const G_AUTH = process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const G_TOKEN = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const GS_KEYS = ['snake', 'memory', 'whack', 'g2048'];
const gaOn = () => !!(G_ID && G_SECRET && G_BASE);
const ACC_FILE = path.join(path.dirname(DATA), 'accounts.json');
let acc = { subs: {} };
try { acc = { subs: {}, ...JSON.parse(fs.readFileSync(ACC_FILE, 'utf8')) }; } catch {}
const accByDev = new Map(); for (const [s, a] of Object.entries(acc.subs)) if (a.dev) accByDev.set(a.dev, s);
let accTimer = null;
function saveAcc() { if (accTimer) return; accTimer = setTimeout(() => { accTimer = null; try { fs.writeFileSync(ACC_FILE + '.tmp', JSON.stringify(acc)); fs.renameSync(ACC_FILE + '.tmp', ACC_FILE); } catch (e) { console.error('فشل حفظ الحسابات:', e.message); } }, 300); }
const maskEm = e => { const [u, d] = String(e || '').split('@'); return u && d ? u.slice(0, 2) + '***@' + d : ''; };
const gaStates = new Map();
function gaStart(dev) {
  const now = Date.now(); for (const [k, v] of gaStates) if (now - v.t > 600e3) gaStates.delete(k);
  if (gaStates.size > 3000) gaStates.delete(gaStates.keys().next().value);
  const st = crypto.randomBytes(16).toString('hex'); gaStates.set(st, { dev, t: now });
  const p = new URLSearchParams({ client_id: G_ID, redirect_uri: G_BASE + '/auth/google/callback', response_type: 'code', scope: 'openid email', state: st, prompt: 'select_account' });
  return G_AUTH + '?' + p;
}
function gaPost(urlStr, form) {   // POST نموذج → JSON (أو null)
  return new Promise(ok => {
    const u = new URL(urlStr), lib = u.protocol === 'https:' ? require('https') : http, data = new URLSearchParams(form).toString();
    const r = lib.request(u, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) }, timeout: 8000 }, rs => {
      let b = ''; rs.on('data', c => { b += c; if (b.length > 20000) rs.destroy(); }); rs.on('end', () => { try { ok(JSON.parse(b)); } catch { ok(null); } });
    });
    r.on('error', () => ok(null)); r.on('timeout', () => { r.destroy(); ok(null); }); r.end(data);
  });
}
async function gaCallback(code, state) {   // يرجع رمز النتيجة: linked / same / moved / conflict / other / err
  const st = gaStates.get(state); gaStates.delete(state);
  if (!gaOn() || !st || Date.now() - st.t > 600e3 || !code || code.length > 600) return 'err';
  const tk = await gaPost(G_TOKEN, { code, client_id: G_ID, client_secret: G_SECRET, redirect_uri: G_BASE + '/auth/google/callback', grant_type: 'authorization_code' });
  let pl = null; try { pl = JSON.parse(Buffer.from(String(tk && tk.id_token).split('.')[1], 'base64url').toString()); } catch {}
  // الرمز وصل مباشرة من قوقل عبر TLS (بطلب منا بسرّنا) فما نحتاج توقيعه؛ نتأكد من الجمهور والمُصدر والصلاحية
  if (!pl || pl.aud !== G_ID || !/^(https:\/\/)?accounts\.google\.com$/.test(pl.iss || '') || !pl.sub || !(pl.exp * 1000 > Date.now())) return 'err';
  return gaLink(st.dev, String(pl.sub).slice(0, 40), pl.email_verified === false ? '' : maskEm(pl.email));
}
function gaBindHouse(dev, sub) { const hh = houses.find(x => x.dev === dev); if (hh && hh.g !== sub) { hh.g = sub; save(); } }
function gaLink(dev, sub, em) {
  const r = gaLink0(dev, sub, em); if (r === 'linked' || r === 'same' || r === 'moved') gaBindHouse(dev, sub); return r;
}
function gaLink0(dev, sub, em) {
  const ex = acc.subs[sub];
  if (!ex) {
    if (accByDev.has(dev)) return 'other';   // هذا الجهاز مربوط بحساب قوقل ثاني
    acc.subs[sub] = { dev, em, t: Date.now() }; accByDev.set(dev, sub); saveAcc(); return 'linked';
  }
  if (ex.dev === dev) { if (em && ex.em !== em) { ex.em = em; saveAcc(); } return 'same'; }
  if (accByDev.has(dev)) return 'other';
  if (houses.some(h => h.dev === dev)) return 'conflict';   // هذا الجهاز عنده بيت ثاني — ما نمسحه
  const old = ex.dev; accByDev.delete(old); ex.dev = dev; accByDev.set(dev, sub); moveDevice(old, dev); saveAcc();
  return 'moved';
}
function moveDevice(old, nw) {   // ينقل بيت الحساب + لايكاته + اقتصاده + جلسة VIP من الجهاز القديم للجديد
  const oldDh = devHash(old), newDh = devHash(nw), h = houses.find(x => x.dev === old);
  if (h) {
    for (const x of houses) { const i = (x.lk || []).indexOf(oldDh); if (i >= 0 && !x.lk.includes(newDh)) { x.lk[i] = newDh; if (x.lki && x.lki[oldDh]) { x.lki[newDh] = x.lki[oldDh]; delete x.lki[oldDh]; } } }
    h.dev = nw; save();
  }
  const eo = eco[oldDh]; if (eo) { const en = eco[newDh]; if (en) eo.c += en.c || 0; eco[newDh] = eo; delete eco[oldDh]; saveEco(); }
  const vs = vipSess.get(oldDh); if (vs) { vipSess.delete(oldDh); vipSess.set(newDh, vs); }
  for (const c of clients) if (c.dev === old) { c.home = null; c.dev = ''; c.dh = null; }   // الجهاز القديم يصير زائر لين يدخل من جديد
}

// ===== عالم البناء: حالة العالم المشترك =====
const PROT_R = process.env.PROT_R !== undefined ? +process.env.PROT_R : 30;   // نصف قطر المنطقة المحمية حول مدخل عالم البناء (للاختبارات فقط نغيّره)
const CW_FILE = path.join(path.dirname(DATA), 'craft.json');
const cwEd = new Map(), cwCt = new Map(); let cwDirty = null, cwCount = 0;
try { const j = JSON.parse(fs.readFileSync(CW_FILE, 'utf8')); for (const k in j.ed || {}) { const m = new Map(), a = j.ed[k]; for (let i = 0; i + 1 < a.length; i += 2) m.set(a[i], a[i + 1]); cwEd.set(k, m); cwCount += m.size; } for (const k in j.ct || {}) cwCt.set(k, j.ct[k]); } catch {}
function saveCwNow() { clearTimeout(cwDirty); cwDirty = null; const ed = {}; for (const [k, m] of cwEd) { const a = []; for (const [i, id] of m) a.push(i, id); ed[k] = a; } const ct = {}; for (const [k, v] of cwCt) ct[k] = v; try { fs.writeFileSync(CW_FILE + '.tmp', JSON.stringify({ ed, ct })); fs.renameSync(CW_FILE + '.tmp', CW_FILE); } catch (e) { console.error('فشل حفظ عالم البناء:', e.message); } }
function saveCw() { if (cwDirty) return; cwDirty = setTimeout(() => { cwDirty = null; const ed = {}; for (const [k, m] of cwEd) { const a = []; for (const [i, id] of m) a.push(i, id); ed[k] = a; } const ct = {}; for (const [k, v] of cwCt) ct[k] = v; fs.writeFile(CW_FILE + '.tmp', JSON.stringify({ ed, ct }), e => { if (!e) try { fs.renameSync(CW_FILE + '.tmp', CW_FILE); } catch {} }); }, 5000); }
const cwValidId = id => (id >= 1 && id <= 41) || (id >= 100 && id <= 112) || (id >= 120 && id <= 144);
const SMELT_S = { 10: 103, 11: 104, 4: 14, 8: 3, 5: 102 }, FUEL_S = { 101: 8, 102: 8, 5: 1.5, 7: 1.5, 24: 1.5, 100: .5 };   // لازم تطابق SMELT/FUEL بـpublic/voxcore.js
function cleanItem(it) { if (!it || typeof it !== 'object') return null; const id = it.id | 0, n = it.n | 0; if (!cwValidId(id) || n < 1 || n > 64) return null; return { id, n: id >= 120 ? 1 : n, d: Math.max(0, Math.min(it.d | 0, 2000)) }; }
const ctItems = ct => (ct.t === 'F' ? [ct.i, ct.fu, ct.o] : ct.s).filter(Boolean);
function furnaceStep(f, dt) {
  const can = () => f.i && SMELT_S[f.i.id] !== undefined && (!f.o || (f.o.id === SMELT_S[f.i.id] && f.o.n < 64));
  if (f.burn > 0) f.burn = Math.max(0, f.burn - dt);
  if (can() && f.burn <= 0 && f.fu && FUEL_S[f.fu.id] !== undefined) { f.burn = f.burnMax = FUEL_S[f.fu.id] * 10; f.fu.n--; if (f.fu.n <= 0) f.fu = null; }
  if (can() && f.burn > 0) { f.prog = (f.prog || 0) + dt; if (f.prog >= 10) { f.prog = 0; const out = SMELT_S[f.i.id]; if (f.o) f.o.n++; else f.o = { id: out, n: 1, d: 0 }; f.i.n--; if (f.i.n <= 0) f.i = null; } } else if (f.prog) f.prog = Math.max(0, f.prog - dt * 2);
}
function ctTick(f) { if (f.t !== 'F') return; const now = Date.now(); let dt = Math.min(600, (now - (f.ts || now)) / 1000); f.ts = now; while (dt > 0) { const st = Math.min(.5, dt); furnaceStep(f, st); dt -= st; } }
setInterval(() => { for (const c of clients) if (c.vox && c.ctOpen) { const ct = cwCt.get(c.ctOpen); if (ct && ct.t === 'F' && (ct.i || ct.burn > 0)) { ctTick(ct); wsSend(c, { t: 'cts', k: c.ctOpen, d: ct }); } } }, 1000).unref();

// ===== 🔔 إشعارات الجوال (Web Push) — بدون مكتبات: تشفير RFC 8291 (aes128gcm) + توقيع VAPID (ES256، RFC 8292) =====
// الاشتراك يُحفظ بمفتاح الجهاز (devHash) فقط — بدون أي بيانات شخصية. نرسل لخوادم الإشعارات المعروفة بس (قوقل/أبل/موزيلا/مايكروسوفت).
// السياسة: ما نرسل للي داخل اللعبة الحين، وقت هدوء 10م–8ص (للتلقائي)، حد يومي 2 تلقائي لكل جهاز، وإعلان صاحب المدينة بدون حد.
const PUSH_FILE = path.join(path.dirname(DATA), 'push.json');
let push = { subs: {}, n: {}, th: {}, daily: '' };
try { push = { subs: {}, n: {}, th: {}, daily: '', ...JSON.parse(fs.readFileSync(PUSH_FILE, 'utf8')) }; } catch {}
let pushTimer = null;
function savePushNow() { clearTimeout(pushTimer); pushTimer = null; try { fs.writeFileSync(PUSH_FILE + '.tmp', JSON.stringify(push), { mode: 0o600 }); fs.renameSync(PUSH_FILE + '.tmp', PUSH_FILE); } catch (e) { console.error('فشل حفظ الإشعارات:', e.message); } }
function savePush() { if (pushTimer) return; pushTimer = setTimeout(savePushNow, 3000); }
if (!push.vapid) { const k = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' }); push.vapid = { x: k.x, y: k.y, d: k.d }; savePushNow(); }   // مفاتيحنا (تنحفظ بملف البيانات على السيرفر فقط)
const VAPID_PUB = Buffer.concat([Buffer.from([4]), Buffer.from(push.vapid.x, 'base64url'), Buffer.from(push.vapid.y, 'base64url')]);
const VAPID_KEY = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: push.vapid.x, y: push.vapid.y, d: push.vapid.d }, format: 'jwk' });
const PUSH_SUBJ = (process.env.PUBLIC_URL || 'https://example.com').replace(/\/+$/, '');
const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]*\.push\.apple\.com|[a-z0-9.-]*\.notify\.windows\.com)$/;
const PUSH_TEST_HOST = process.env.PUSH_TEST_HOST || '';   // للاختبارات فقط (خادم إشعارات وهمي محلي)
const b64u = b => Buffer.from(b).toString('base64url'), hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
const jwtCache = new Map();
function vapidAuth(aud) {
  const now = Math.floor(Date.now() / 1000), c = jwtCache.get(aud); if (c && c.exp - now > 3600) return c.v;
  const exp = now + 12 * 3600, h = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + b64u(JSON.stringify({ aud, exp, sub: PUSH_SUBJ }));
  const sig = crypto.sign('sha256', Buffer.from(h), { key: VAPID_KEY, dsaEncoding: 'ieee-p1363' });
  const v = `vapid t=${h}.${b64u(sig)}, k=${b64u(VAPID_PUB)}`; jwtCache.set(aud, { v, exp }); return v;
}
function pushEncrypt(sub, text) {   // RFC 8291
  const ua = Buffer.from(sub.p, 'base64url'), auth = Buffer.from(sub.a, 'base64url'), ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), ikm = hmac(hmac(auth, ecdh.computeSecret(ua)), Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub, Buffer.from([1])]));
  const salt = crypto.randomBytes(16), prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16), nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const ci = crypto.createCipheriv('aes-128-gcm', cek, nonce), body = Buffer.concat([ci.update(Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([2])])), ci.final(), ci.getAuthTag()]);
  const hdr = Buffer.alloc(21); salt.copy(hdr, 0); hdr.writeUInt32BE(4096, 16); hdr[20] = 65;
  return Buffer.concat([hdr, asPub, body]);
}
const pushHostOk = u => (u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname)) || (!!PUSH_TEST_HOST && u.host === PUSH_TEST_HOST);
const pushQ = []; let pushBusy = 0; const pushStat = { ok: 0, gone: 0, err: 0 };
function pushPump() {
  while (pushBusy < 8 && pushQ.length) {
    const [dh, obj] = pushQ.shift(), s = push.subs[dh]; if (!s) continue; let u; try { u = new URL(s.e); } catch { delete push.subs[dh]; continue; } if (!pushHostOk(u)) continue;
    let body; try { body = pushEncrypt(s, JSON.stringify(obj)); } catch { delete push.subs[dh]; savePush(); continue; }
    pushBusy++; let done = false; const fin = () => { if (done) return; done = true; pushBusy--; setImmediate(pushPump); };
    const r = (u.protocol === 'https:' ? require('https') : http).request(u, { method: 'POST', timeout: 10000, headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'Content-Length': body.length, TTL: String(obj.ttl || 43200), Urgency: 'normal', Authorization: vapidAuth(u.origin) } }, rs => {
      const st = rs.statusCode; if (st >= 400 && st !== 404 && st !== 410 && pushStat.err < 30) { let t = ''; rs.on('data', d => { if (t.length < 300) t += d; }); rs.on('end', () => console.log('إشعار مرفوض', st, u.hostname, t.slice(0, 200))); } else rs.resume(); if (process.env.PUSH_LOG) console.log('PUSH', st, u.hostname); if (st >= 200 && st < 300) pushStat.ok++; else if (st === 404 || st === 410) { pushStat.gone++; delete push.subs[dh]; savePush(); } else pushStat.err++; fin();
    });
    r.on('error', () => { pushStat.err++; fin(); }); r.on('timeout', () => r.destroy()); r.end(body);
  }
}
const gulfHour = () => new Date(Date.now() + GULF).getUTCHours();
const pushQuiet = () => { if (process.env.PUSH_NOQUIET) return false; const h = gulfHour(); return h >= 22 || h < 8; };   // PUSH_NOQUIET للاختبارات
const devOnline = dh => { for (const x of clients) if (x.ready && x.dh === dh) return true; return false; };
// تلقائي: يحترم وقت الهدوء والحد اليومي، وما يرسل للي داخل اللعبة. force = إعلان صاحب المدينة
function pushTo(dh, obj, force) {
  if (!dh || !push.subs[dh] || devOnline(dh)) return false;
  if (!force) { if (pushQuiet()) return false; const d = gulfDay(), n = push.n[dh]; const cnt = n && n[0] === d ? n[1] : 0; if (cnt >= 2) return false; push.n[dh] = [d, cnt + 1]; savePush(); }
  pushQ.push([dh, { t: 'مدينة من الصفر', ...obj }]); pushPump(); return true;
}
const dhOfKey = k => { if (!k) return null; if (k.startsWith('d:')) return k.slice(2); const h = houses.find(x => x.id === k); return h && h.dev ? devHash(h.dev) : null; };
const pushKey = (k, obj) => pushTo(dhOfKey(k), obj);
// التذكير اليومي (5 العصر): للي ما دخل اليوم — يقوله وش ينتظره (تطوير بيته / سلسلة الأيام / جائزة اليوم)
const HTYPE = ['خيمة', 'بيت طين', 'فيلا', 'برج', 'قلعة'];
function pushDaily() {
  const td = gulfDay(), yd = gulfDay(-86400e3); if (push.daily === td || gulfHour() < (process.env.PUSH_DAILY_H !== undefined ? +process.env.PUSH_DAILY_H : 17) || pushQuiet()) return; push.daily = td; savePush();
  const hByDh = new Map(); for (const h of houses) if (h.dev) hByDh.set(devHash(h.dev), h); let n = 0;
  for (const dh of Object.keys(push.subs)) {
    const e = eco[dh]; if (e && e.ld === td) continue; const h = hByDh.get(dh), nd = (h && h.days || 1) + 1, lvl = LEVEL_DAYS.indexOf(nd);
    let b;
    if (h && lvl > 0) b = `🏡 ادخل اليوم وبيتك يتطور إلى ${HTYPE[lvl]}!`;
    else if (e && e.ld === yd) { const s = (e.s || 0) + 1, d = ((s - 1) % 7) + 1; b = `🔥 كمّل سلسلتك! اليوم ${s} ورا بعض = +${d === 7 ? 100 : d * 10} 🪙`; }
    else b = '🎁 جائزتك اليومية تنتظرك — المدينة اشتاقت لك 🏙️';
    if (pushTo(dh, { b, g: 'daily' })) n++;
  }
  console.log('إشعار التذكير اليومي:', n);
}
setInterval(pushDaily, +process.env.PUSH_TICK_MS || 60e3).unref();

// ===== 📊 إحصاءات اللعب — أرقام مجمّعة لكل يوم فقط (بدون أسماء ولا أجهزة). data/stats.json =====
// u أجهزة دخلت اليوم، nw جديدة أول مرة، rb رجعت من أمس، s جلسات (≥15ث)، ms مجموع مدة الجلسات، s5/s30/s60 جلسات أطول من 5/30/60 دقيقة،
// pk أعلى عدد متصلين، h أعلى متصلين بكل ساعة (24)، z دقائق لعب بكل مكان (عيّنة كل دقيقة)
const STATS_FILE = path.join(path.dirname(DATA), 'stats.json'), ST_MIN_MS = +process.env.ST_MIN_MS || 60e3;
let stats = { days: {}, seen: { d: '', a: [] } };
try { stats = { ...stats, ...JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) }; } catch {}
let stSeen = new Set(stats.seen && stats.seen.d === gulfDay() ? stats.seen.a : []), stDirty = false;
function stDay() {
  const d = gulfDay(); let x = stats.days[d];
  if (!x) { x = stats.days[d] = { u: 0, nw: 0, rb: 0, s: 0, ms: 0, s5: 0, s30: 0, s60: 0, pk: 0, h: Array(24).fill(0), z: {} }; const ks = Object.keys(stats.days).sort(); while (ks.length > 60) delete stats.days[ks.shift()]; }
  if (stats.seen.d !== d) { stats.seen = { d, a: [] }; stSeen = new Set(); }
  return x;
}
function stHi(dh, isNew, back) { const x = stDay(), k = dh.slice(0, 10); if (stSeen.has(k)) return; stSeen.add(k); stats.seen.a.push(k); x.u++; if (isNew) x.nw++; else if (back) x.rb++; stDirty = true; }
function stEnd(c) { const ms = Date.now() - (c.tt0 || Date.now()); if (!c.ready || !c.dh || ms < 15e3) return; const x = stDay(); x.s++; x.ms += ms; if (ms > 5 * 60e3) x.s5++; if (ms > 30 * 60e3) x.s30++; if (ms > 60 * 60e3) x.s60++; stDirty = true; }
// ===== 🎉 فعاليات مجدولة: كل 10 دقائق فعالية بمكان (بالتناوب)، أول 5 دقائق شغّالة، والحضور بمكانها يعطي عملات =====
// الهدف: تجميع اللاعبين بمكان واحد (المدينة كبيرة وتحس إنها فاضية). الحد اليومي EVT_CAP يمنع الاستغلال.
const EVT_SLOT = +process.env.EVT_SLOT_MS || 600000, EVT_ON = Math.round(EVT_SLOT / 2), EVT_TICK = +process.env.EVT_TICK_MS || 60000, EVT_COINS = 5, EVT_CAP = 100;
const EVENTS_ALL = [
  { id: 'plaza', n: 'تجمّع الساحة 🏟️', d: 'plaza', in: o => !o.vox && !o.inH && inLocal(o, PLAZA_Z), at: () => plazaC() },
  { id: 'mall', n: 'سوق المول 🏬', d: 'mall', in: o => !o.inH && inLocal(o, MALL_Z), at: () => { const P = plazaC(); return { x: P.x + (MALL_Z.x0 + MALL_Z.x1) / 2, z: P.z }; } },
  { id: 'build', n: 'ساعة البناء ⛏️', d: 'craft', in: o => !!o.vox, at: () => null },
  { id: 'games', n: 'بطولة الألعاب 🎮', d: 'games', in: o => !o.vox && !o.inH && inLocal(o, PLAZA_Z), at: () => plazaC() },
];
const EVENTS = process.env.EVT_LIST ? EVENTS_ALL.filter(e => process.env.EVT_LIST.split(',').includes(e.id)) : EVENTS_ALL;
const evtAt = slot => EVENTS[((slot % EVENTS.length) + EVENTS.length) % EVENTS.length];
function evtState() { const now = Date.now(), slot = Math.floor(now / EVT_SLOT), st = slot * EVT_SLOT; return { now, slot, st, on: now - st < EVT_ON }; }
function evtMsg() {
  const { now, slot, st, on } = evtState(), nx = evtAt(slot + 1), m = { t: 'evt', on, nx: { id: nx.id, n: nx.n, d: nx.d, in: st + EVT_SLOT - now } };
  if (on) { const cur = evtAt(slot), at = cur.at(); Object.assign(m, { id: cur.id, n: cur.n, d: cur.d, left: st + EVT_ON - now }); if (at) { m.x = at.x; m.z = at.z; } }
  return m;
}
let evtKey = '';
setInterval(() => {   // إعلان للكل لما تبدأ أو تخلص فعالية
  const s = evtState(), key = s.slot + ':' + s.on; if (key === evtKey) return; evtKey = key;
  const m = evtMsg(); for (const c of clients) if (c.ready) wsSend(c, m);
}, Math.min(2000, Math.max(100, Math.round(EVT_SLOT / 40))));
setInterval(() => {   // الحضور: كل دقيقة +5 عملات للي بمكان الفعالية (مرة لكل حساب حتى لو عنده أكثر من جهاز)
  const s = evtState(); if (!s.on) return; const cur = evtAt(s.slot), done = new Set(); let n = 0;
  for (const c of clients) {
    if (!c.ready || !c.dh || done.has(c.dh)) continue;
    let inside = false; try { inside = cur.in(c); } catch {} if (!inside) continue;
    done.add(c.dh); n++;
    ecoDo(c.dh, (e, evs) => { const g = ecoCoins(e, EVT_COINS, 'ev', EVT_CAP); if (g) evs.push(`🎉 +${g} 🪙 حضورك ${cur.n}`); });
  }
  if (n) { try { const x = stDay(); x.evm = (x.evm | 0) + n; stDirty = true; } catch {} }   // 📊 دقائق حضور الفعاليات (مجمّعة)
}, EVT_TICK);
// 📊 قمع البداية السريعة: كم حساب خلّص كل خطوة اليوم (tut[0..3]) وكم خلّصها كلها (tut[4]) — أرقام مجمّعة بلا هوية
function stTut(i) { try { const x = stDay(); if (!x.tut) x.tut = [0, 0, 0, 0, 0]; x.tut[i] = (x.tut[i] | 0) + 1; stDirty = true; } catch {} }
function stSaveNow() { try { fs.writeFileSync(STATS_FILE, JSON.stringify(stats)); stDirty = false; } catch (e) { console.error('حفظ الإحصاءات:', e.message); } }
setInterval(() => {   // كل دقيقة: عيّنة الأماكن + الذروة
  const x = stDay(), on = [...clients].filter(o => o.ready), hr = new Date(Date.now() + GULF).getUTCHours();
  if (on.length > x.pk) x.pk = on.length; if (on.length > x.h[hr]) x.h[hr] = on.length;
  for (const o of on) { let z = '🏙️ المدينة'; try { z = zoneOf(o); } catch {} x.z[z] = (x.z[z] || 0) + 1; }
  stDirty = true; fs.writeFile(STATS_FILE, JSON.stringify(stats), () => {}); stDirty = false;
}, ST_MIN_MS).unref();
function statsView() {
  const nb = {}; for (const h of houses) { const d = new Date((h.t > 1e9 ? h.t : 0) + GULF).toISOString().slice(0, 10); nb[d] = (nb[d] || 0) + 1; }
  return Object.keys(stats.days).sort().slice(-8).reverse().map(d => { const x = stats.days[d]; return { d, u: x.u, nw: x.nw, rb: x.rb, s: x.s, avg: x.s ? Math.round(x.ms / x.s / 6000) / 10 : 0, s5: x.s5, s30: x.s30, s60: x.s60, pk: x.pk, h: x.h, z: Object.entries(x.z).sort((a, b) => b[1] - a[1]).slice(0, 8), nb: nb[d] || 0, tut: x.tut || [0, 0, 0, 0, 0], evm: x.evm | 0 }; });
}

server.listen(PORT, HOST, () => console.log(`مدينة من الصفر تعمل على ${HOST}:${PORT} — البيوت: ${houses.length}`));
