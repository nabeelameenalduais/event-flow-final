# 09 — مخطط النشر (Deployment Diagram)

> **النمط في Eraser:** Cloud architecture (عُقد = مجموعات، قطع أثرية = عقد داخلية، بروتوكولات على الأسهم).
> **المرجع المعياري:** OMG UML 2.5.1 §10 (Deployments) — Node، Artifact، CommunicationPath مع بروتوكول النقل. كل عقدة هنا قابلة للتحقق من `package.json` و`supabase/`.

## 1. الهدف الأكاديمي

يجيب عن «أين يعمل الكود فعليًا؟ وكيف تنتقل البيانات؟» — العقد المادية/السحابية، القطع الأثرية المنشورة، ومسارات الاتصال HTTPS/WSS. هذا هو مخطط أسئلة البنية التحتية المتوقعة في المناقشة.

## 2. الوصف الكامل للعقد

### Node 1: متصفح المستخدم
- Artifact: `bundle.js` (React 19 + TypeScript مبنية بـVite) + أصول ثابتة.
- يستهلك: HTTPS REST/RPC إلى Supabase + WSS للـRealtime.

### Node 2: استضافة الأصول الثابتة (CDN)
- Artifact: ناتج `vite build` (HTML/CSS/JS).
- خدمة SPA كاملة للعميل.

### Node 3: Supabase Cloud (مشروع واحد)
- Postgres 15: schema عام + سياسات RLS + دوال SECURITY DEFINER.
- Auth API: إدارة JWT وتوكنات.
- Realtime Server: postgres_changes عبر WSS.
- Storage: buckets للملفات.
- Edge Runtime: Artifact `functions/chatbot` (Deno TS) بمفاتيح بيئة سرية.

### Node 4: مزود LLM السحابي
- OpenAI-compatible chat completions + tool calling.

### Node 5: LM Studio المحلي (بديل)
- خادم OpenAI-compatible محلي عند فشل السحابة.

### مسارات الاتصال (Communication Paths)
- متصفح ↔ CDN: HTTPS (تحميل التطبيق).
- متصفح ↔ Supabase: HTTPS REST/RPC (بيانات) + WSS (لحظية).
- Edge Runtime ↔ Postgres: اتصال داخلي service-role.
- Edge Runtime ↔ مزودي LLM: HTTPS JSON.
- Postgres → Email Service: webhooks/notifications صادرة للإشعارات البريدية.

## 3. كود Eraser

```eraser
title EventFlow Deployment Diagram - nodes artifacts and protocols

Group Browser Device [color: lightblue] {
  ReactBundle [icon: chrome, label: artifact bundle.js React19 Vite]
}
Group Static Hosting CDN [color: lightgrey] {
  SpaAssets [icon: cloud, label: artifact vite build html css js]
}
Group Supabase Cloud Project [color: lightorange] {
  PostgresNode [icon: database, label: Postgres RLS SECURITY DEFINER rpcs]
  AuthNode [icon: key, label: JWT tokens]
  RealtimeNode [icon: broadcast, label: WSS postgres_changes]
  StorageNode [icon: folder, label: file buckets]
  EdgeRuntime [icon: server, label: artifact functions chatbot Deno]
}
Group External LLM Cloud [color: yellow] {
  OpenAICompatible [icon: cloud, label: chat completions tools]
}
Group Local Fallback [color: lightgreen] {
  LMStudioServer [icon: cpu, label: local openai compatible]
}
Group Mail Infrastructure [color: purple] {
  EmailService [icon: mail, label: notifications sender]
}

Browser Device > Static Hosting CDN: HTTPS download spa
Static Hosting CDN > Browser Device: assets served
Browser Device > AuthNode: HTTPS sign in token
Browser Device > PostgresNode: HTTPS REST and RPC with JWT
Browser Device > RealtimeNode: WSS subscribe changes
Browser Device > StorageNode: HTTPS file up down
EdgeRuntime > PostgresNode: internal service role queries
EdgeRuntime > OpenAICompatible: HTTPS json tool calls
EdgeRuntime > LMStudioServer: HTTP fallback same protocol
PostgresNode > EmailService: outbound notification hooks
```

## 4. نقاط النقاش أمام اللجنة

1. **لا خادم تطبيق تقليدي:** منطق الأعمال موزع بين العميل (عرض) وقاعدة البيانات (RPC) وEdge Function (ذكاء خارجي) — نموذج Serverless؛ اشرح الأثر على التكلفة والتوسع.
2. **بروتوكولان فقط للعميل:** HTTPS لكل شيء الحتمي، WSS للحظوي — بساطة سطح الهجوم.
3. **سرية service-role:** لا تصل المتصفح أبدًا؛ تُحقن في بيئة Edge Runtime — جوابك الجاهز عن سؤال «كيف تحمي مفاتيحك؟».
4. إذا سُئلت عن النسخ الاحتياطي/التوسع: Supabase يدير Postgres مدارًا (نسخ احتياطي يومي) والـCDN يتوسع تلقائيًا — نقاط NF7.
