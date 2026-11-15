// تشغيل أولي (قبل اللعبة): ميزات ناقصة بالأجهزة القديمة + رسالة واضحة وزر إعادة لو علق التحميل + تبليغ الخطأ للسيرفر
// مكتوب بجافاسكربت قديمة عمداً عشان يشتغل حتى على المتصفحات القديمة
(function () {
  // 1) CanvasRenderingContext2D.roundRect (ناقصة بآيفون قبل iOS 16 وكروم قبل 99) — اللعبة ترسم فيها الأسماء والفقاعات
  try {
    var P = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (P && !P.roundRect) {
      P.roundRect = function (x, y, w, h, r) {
        if (typeof r === 'object' && r) r = r[0] || 0; r = Math.max(0, Math.min(+r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
        this.moveTo(x + r, y); this.lineTo(x + w - r, y); this.quadraticCurveTo(x + w, y, x + w, y + r); this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h); this.lineTo(x + r, y + h); this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r); this.quadraticCurveTo(x, y, x + r, y); this.closePath(); return this;
      };
    }
  } catch (e) {}
  var sent = 0, failed = false;
  function report(kind, msg) {
    if (sent >= 3) return; sent++;
    try {
      var body = JSON.stringify({ k: kind, m: String(msg || '').slice(0, 300), st: String(window.__stage || ''), ua: navigator.userAgent.slice(0, 160), w: screen.width + 'x' + screen.height });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/cerr', new Blob([body], { type: 'application/json' }));
      else { var x = new XMLHttpRequest(); x.open('POST', '/api/cerr'); x.setRequestHeader('Content-Type', 'application/json'); x.send(body); }
    } catch (e) {}
  }
  function stuck(text, kind, msg) {
    var el = document.getElementById('load'); if (!el || !el.parentNode) return; failed = true;
    el.innerHTML = '<div style="max-width:320px;margin:0 auto;padding:0 16px;text-align:center;line-height:1.7">' + text +
      '<br><button id="loadRetry" style="margin-top:14px;font:inherit;font-weight:900;font-size:18px;padding:10px 26px;border:0;border-radius:14px;background:#ff8a00;color:#fff">🔄 إعادة المحاولة</button></div>';
    var b = document.getElementById('loadRetry'); if (b) b.onclick = function () { location.reload(); };
    report(kind, msg);
  }
  // 2) متصفح قديم ما يشغّل اللعبة أصلاً
  try {
    var s = document.createElement('script');
    if (!('noModule' in s)) { document.addEventListener('DOMContentLoaded', function () { stuck('متصفحك قديم وما يشغّل اللعبة 😔<br><small>حدّث المتصفح (كروم أو سفاري) وارجع</small>', 'old', 'no module support'); }); return; }
  } catch (e) {}
  // 3) خطأ أثناء التحميل → رسالة + تبليغ
  window.addEventListener('error', function (e) {
    var el = document.getElementById('load'); if (!el || !el.parentNode || failed) return;
    var own = location.origin;
    if (e && e.target && e.target !== window) {   // ملف ما تحمّل: نهتم بس بملفات اللعبة (سكربتات برّا مثل الإحصائيات أو اللي يحقنها تيك توك/انستقرام نتجاهلها)
      var src = e.target.src || e.target.href || '';
      if (!src || src.indexOf(own) !== 0 || e.target.tagName !== 'SCRIPT') return;
      stuck('ما قدرنا نشغّل اللعبة على هذا المتصفح 😔<br><small>افتح الرابط في سفاري أو كروم (مو من داخل تيك توك/انستقرام)، أو حدّث جوالك</small>', 'scriptfail', 'load fail: ' + src);
      return;
    }
    var fn = (e && e.filename) || '';
    if (fn && fn.indexOf(own) !== 0) return;   // خطأ من سكربت خارجي — مو من اللعبة
    var m = (e && (e.message || (e.error && e.error.message))) || 'error';
    if (window.__noGL || /WebGL/i.test(m)) { stuck('جهازك أو متصفحك ما يشغّل الرسومات ثلاثية الأبعاد 😔<br><small>افتح اللعبة في كروم أو سفاري (مو من داخل تطبيق ثاني)، وتأكد إن «تسريع الأجهزة» مفعّل، أو جرّب جهاز ثاني</small>', 'nogl', m); return; }
    stuck('صار خطأ أثناء تحميل المدينة 😔<br><small>جرّب مرة ثانية، ولو تكرر حدّث المتصفح</small>', 'error', m + ' @' + fn + ':' + ((e && e.lineno) || ''));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var el = document.getElementById('load'); if (!el || !el.parentNode || failed) return;
    report('reject', (e && e.reason && (e.reason.message || e.reason)) || 'rejection');
  });
  // 4) طوّل كثير؟ (نت بطيء أو جهاز ضعيف)
  setTimeout(function () {
    var el = document.getElementById('load'); if (!el || !el.parentNode || failed) return;
    if (!document.getElementById('loadHint')) { var d = document.createElement('div'); d.id = 'loadHint'; d.style.cssText = 'font-size:14px;margin-top:10px;opacity:.85'; d.textContent = 'التحميل أخذ وقت… لحظات (لو النت ضعيف ممكن يطوّل)'; el.appendChild(d); }
  }, 15000);
  setTimeout(function () {
    var el = document.getElementById('load'); if (!el || !el.parentNode || failed) return;
    stuck('المدينة أخذت وقت طويل وما فتحت ⏳<br><small>تأكد من النت واضغط إعادة المحاولة</small>', 'timeout', 'stuck 40s');
  }, 40000);
})();
