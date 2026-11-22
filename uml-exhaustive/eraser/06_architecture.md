# 06 — مخطط المعمارية: الطبقات (Layered Architecture)

> **النمط في Eraser:** Cloud architecture (مجموعات + وصلات بروتوكولية).
> **المرجع المعياري:** نمط الطبقات الكلاسيكي (Layers pattern) مع Serverless BaaS؛ يتوافق مع توصيات 4+1 Views (Logical/Deployment view) في التوثيق المعماري الأكاديمي.

## 1. الهدف الأكاديمي

عرض **الهيكل العام للمنظومة** في صورة واحدة تشرح اتجاه الاعتمادية الصارم من أعلى إلى أسفل، ولماذا لا يلمس أي مكوّن React قاعدة البيانات مباشرة — جوهر NF6.

## 2. الوصف الكامل للطبقات

### L1 — طبقة العرض (Presentation)
React 19 SPA مبنية بـVite: صفحات (فعاليات/تفاصيل/تذاكر/دردشة/لوحات)، سياق مصادقة AuthContext، حماية مسارات ProtectedRoute/PublicRoute بحسب الدور (RBAC على مستوى التوجيه).

### L2 — طبقة الخدمات (Application/Repository)
`src/services/*.ts` واجهات برمجية نقية لكل نطاق (auth, event, ticket, attendance, invitation, chat, evaluation, notification, feedback, cost, settings, reports, audit). لا حالة UI هنا؛ تحويل بيانات خالص.

### L3 — البنية التحتية المشتركة (Cross-cutting)
SupabaseClient موحد · RateLimiter (30 طلب/60 ثانية) · ErrorMapper (PGRST202/205 → عربية) · أدوات QR وتنسيق.

### L4 — المنصة الخلفية (Supabase BaaS)
Postgres + RLS · دوال RPC SECURITY DEFINER للمهام الحساسة (login_user, register_user, submit_evaluation, revoke_session...) · Realtime (postgres_changes) · Storage للملفات · Edge Functions runtime.

### L5 — خدمات خارجية
Email Service للإشعارات · مزود LLM متوافق OpenAI + LM Studio محلي كبديل.

**قاعدة الاعتمادية:** سهم واحد الاتجاه L1→L2→L3→L4→L5؛ لا تجاوز طبقات ولا أسهم رجوع.

## 3. كود Eraser

```eraser
title EventFlow Layered Architecture

Group L1 Presentation [color: lightblue] {
  ReactSPA [icon: react]
  AuthContext RBAC [icon: lock]
}
Group L2 Application Services [color: lightgreen] {
  DomainServices [icon: layers]
}
Group L3 Shared Infrastructure [color: lightyellow] {
  SupabaseClient [icon: plug]
  RateLimiter [icon: gauge]
  ErrorMapper [icon: translate]
}
Group L4 Supabase Platform [color: lightorange] {
  PostgresRLS [icon: database]
  SecurityDefinerRPCs [icon: shield]
  RealtimeWSS [icon: broadcast]
  Storage [icon: folder]
  EdgeFunctions [icon: server]
}
Group L5 External [color: lightgrey] {
  EmailService [icon: mail]
  CloudLLM [icon: cloud]
  LMStudioLocal [icon: cpu]
}

ReactSPA > DomainServices: typed calls
AuthContext RBAC > DomainServices
DomainServices > SupabaseClient
DomainServices > RateLimiter
RateLimiter > ErrorMapper

SupabaseClient > PostgresRLS: HTTPS REST RLS enforced
SupabaseClient > SecurityDefinerRPCs: rpc call
SupabaseClient > RealtimeWSS: wss subscribe
SupabaseClient > Storage: file up down
EdgeFunctions > PostgresRLS: service role internal
EdgeFunctions > CloudLLM: tool calling https
EdgeFunctions > LMStudioLocal: fallback http

PostgresRLS > EmailService: db webhooks notifications
```

## 4. نقاط النقاش أمام اللجنة

1. **لماذا BaaS بدل خادم مخصص؟** تقليل سطح العمليات، تركيز الجهد على منطق الأعمال، أمان مُدار (RLS/JWT) — والمقايضة: ارتباط بمزود، عولج جزئيًا بعزل الاستخدام داخل L3.
2. **اتجاه الاعتمادية أحادي:** أي سهم صاعد = رائحة تصميم؛ لم يحدث في المشروع.
3. اربط كل طبقة بمثال ملف فعلي عند السؤال: صفحة → `src/pages/*`، خدمة → `src/services/ticketService.ts`، بنية تحتية → `src/lib/rateLimit.ts`.
