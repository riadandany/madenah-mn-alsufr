# مدينة — لعبة مدينة ثلاثية الأبعاد (three.js + Node)

سيرفر بملف واحد بدون مكتبات (`server.js`) وواجهة في `public/`.

## التشغيل
```
npm install        # فقط لأدوات التطوير (Rapier)؛ السيرفر نفسه بلا مكتبات
node server.js     # http://127.0.0.1:3010
```
متغيرات بيئة اختيارية: `PORT`, `HOST`, `DATA_FILE`, `ADMIN_TOKEN` (رمز لوحة المشرف — اخترته بنفسك), `PUBLIC_URL`.
البيانات تُنشأ تلقائياً في `data/` (فارغة عند أول تشغيل).

## الاختبارات
`npm run check` فحص الصياغة · `npm run test:unit` · `npm run test:server` · `npm test` للكل.
اختبارات المتصفح (`tests/*.mjs`) تحتاج Chrome مثبّت وتُشغَّل يدوياً: `node tests/<الملف>.mjs <مسار server.js> <مجلد مخرجات>`.

## ملاحظات
- بعد أي تعديل على ملف بالواجهة عليه `?v=N`: شغّل `npm run versions:bump` ثم `npm run versions:check`.
- `REWARD_ORDER` لازم يتطابق بين `server.js` و`public/app.js`.
- لا توجد بيانات لاعبين ولا أسرار ولا عناوين سيرفرات بهذي النسخة.
