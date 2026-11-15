# النشر على Render (بدل Vercel)

## ليش Vercel ما يشتغل؟
Vercel يشغّل دوال قصيرة (Serverless) ما تبقى شغّالة، والمشروع هذا سيرفر Node دائم يحتاج:
1. **WebSocket** للعب المباشر (`/ws`) — Vercel ما يدعمه.
2. **عملية دائمة** فيها مؤقتات وذاكرة مشتركة بين اللاعبين (الاقتصاد، الفعاليات، الإحصاءات).
3. **الكتابة على القرص** (`data/houses.json`…) — قرص Vercel للقراءة فقط وما يحتفظ بشي.

عشان كذا يطلع `500 FUNCTION_INVOCATION_FAILED`.

## الخطوات
1. ارفع المشروع على GitHub (الملفات اللي بهذا المجلد).
2. على render.com: **New → Blueprint** واختر المستودع (يقرأ `render.yaml` تلقائياً).
3. بعد أول نشر، في **Environment** حط `PUBLIC_URL` = رابط موقعك (https://…onrender.com).
4. رمز لوحة المشرف `ADMIN_TOKEN` يتولّد تلقائياً — شوفه من Environment.

القرص الدائم (`/data`) يحفظ البيوت والاقتصاد بين إعادات التشغيل. بدونه البيانات تضيع كل نشر.

## بدائل
Railway / Fly.io / أي VPS: استخدم الـ `Dockerfile` نفسه، وركّب مجلد دائم على `/data`.
متغيرات مهمة: `PORT` (تحدده الاستضافة)، `DATA_FILE`، `TRUST_PROXY` (1 أو 2)، `ADMIN_TOKEN`، `PUBLIC_URL`.
