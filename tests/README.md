# اختبارات لعبة مدينة من الصفر

كلها تشتغل محلياً على سيرفر مؤقت ببيانات مؤقتة — ما تلمس الموقع الحي أبداً.

## قبل أول تشغيل
```
node tests/make-local-houses.mjs        # يبني tests/madinah_local_houses.json من القائمة العامة للموقع
```

## اختبارات السيرفر (بدون متصفح)
```
node tests/madinah_test.mjs      server.js     # واجهات API: بناء، رمز، استرجاع، لايكات، جوائز، style
node tests/madinah_chat_test.cjs server.js     # WebSocket: رسائل، فلتر، قرب، سيارات
node tests/madinah_mod_test.cjs  server.js     # بلاغات، مشرف، منع/طرد/حذف، هوية المالك
```

## اختبارات المتصفح (Chrome headless عبر CDP، الصور تنحفظ بمجلد تعطيه)
```
node tests/madinah_plaza.mjs   server.js  <مجلد_الصور>   # الساحة والسيارات
node tests/madinah_life.mjs    server.js  <مجلد_الصور>   # الجوائز والخزانة والحياة
node tests/madinah_start.mjs server.js  <مجلد_الصور>   # أول دخول: لوحة «ابنِ بيتك» + عندي بيت (بدل madinah_welcome القديم)
node tests/madinah_cc_test.cjs server.js   # مركز الشكاوي (29)
node tests/madinah_block.mjs   server.js  <مجلد_الصور>   # حظر لاعب
node tests/madinah_adminui.mjs server.js  <مجلد_الصور>   # تبليغ + لوحة المشرف
node tests/madinah_owner.mjs   server.js  <مجلد_الصور>   # هوية صاحب المدينة
node tests/madinah_mp.mjs      server.js  <مجلد_الصور>   # لاعبين بمتصفحين
```
- مسار Chrome مكتوب بأول كل سكربت (`C:/Program Files/Google/Chrome/Application/chrome.exe`) — عدّله لو مختلف.
- المنافذ 9333/9334 للمتصفح و3987-3999 للسيرفر المؤقت.
- بعد كل تشغيل تأكد ما بقي Chrome شغّال على المنفذ 9333 (بدون ما تقفل Chrome حقك).
- رمز المدير داخل الاختبارات وهمي (`admintoken1`)؛ **لا تكتب رمز الموقع الحقيقي هنا**.
- لو غيّرت `app.js` ارفع `?v=` في index.html وإلا المتصفح يستخدم النسخة القديمة من الكاش.

## الوظائف + الشرطة والسجن + المستشفى + الحرامي
```
node tests/madinah_jobs_test.cjs server.js              # سيرفر (46): تقديم/قبول/تلقائي/مشرف/فصل/سجن وحدوده/اعتراض/كفالة/إصابة/علاج/هدية المول/صفارة/حرامي/راتب
node tests/madinah_jobsui.mjs    server.js <مجلد_الصور>  # متصفح (34): 💼 واللوحة، المباني صلبة، الزنزانة، المستشفى، الحرامي، بطاقة الشخص — احذف chrome-prof-jobs قبله
```
