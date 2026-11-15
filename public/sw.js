// عامل الخدمة: «حط اللعبة بشاشة جوالك» + 🔔 إشعارات الجوال — ما يخزّن شي (اللعبة دايماً تجيب آخر نسخة من السيرفر)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
// إشعار وصل من السيرفر (مشفّر، والمتصفح يفكّه): {t: عنوان, b: النص, g: نوعه}
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { b: e.data ? e.data.text() : '' }; }
  const show = self.registration.showNotification(d.t || 'مدينة من الصفر', { body: d.b || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.g || 'madinah', renotify: true, dir: 'rtl', lang: 'ar', data: { u: '/' } });
  const tell = self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.postMessage({ push: d })));   // للاختبار: الصفحة تعرف إنه وصل
  e.waitUntil(Promise.all([show, tell]));
});
// الضغط على الإشعار يفتح اللعبة (أو يرجّعك لها لو مفتوحة)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) if ('focus' in c) return c.focus(); return self.clients.openWindow('/'); }));
});
