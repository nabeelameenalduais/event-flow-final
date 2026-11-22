# 08 — مخطط المكونات (Component Diagram)

> **النمط في Eraser:** Cloud architecture (مجموعات = مكوّنات مجمعة، وصلات = اعتماديات).
> **المرجع المعياري:** OMG UML 2.5.1 §8 (Components) — مكوّن بواجهات provided (Lollipop) وrequired (Socket) واعتماديات. في ترميز Eraser تُمثّل الواجهة كلاحقة نصية باسم المكوّن (`::operation`) والاعتمادية كسهم موسوم.

## 1. الهدف الأكاديمي

إظهار المنظومة كـ**وحدات نشر واستبدال مستقلة** بعقود واجهات صريحة، بدل تفاصيل الفئات — المستوى المناسب للحديث عن قابلية الاستبدال والاختبار المعزول.

## 2. الوصف الكامل للمكونات

### مجموعة العميل (SPA)
- PresentationLayer: صفحات ومكونات React.
- AuthComponent: AuthContext + ProtectedRoute/PublicRoute + RBAC أدوار.
- ChatComponent: دردشة + واجهة المساعد (useChat).
- QRScanner: html5-qrcode + qrcode.
- ThemeComponent: ثيم داكن/فاتح.

### مجموعة الخدمات (Repository)
AuthServiceComponent :: login/register/restore/reset/sessions
EventManagementComponent :: CRUD/publish/archive/duplicate/register/cancel
RegistrationComponent :: invitations/waitlist/promotion
TicketComponent :: issue/verify/download-QR
AttendanceComponent :: checkIn/checkOut/autoAttendance
ChatServiceComponent :: channels/messages/realtime-subscribe
EvaluationComponent :: form/submit-RPC/results
SupportComponents :: notification/cost/feedback/user/organizer/category/venue/file/settings/dashboard/reports/audit

### البنية التحتية
- DataAccessComponent (SupabaseClient) === واجهة REST/RPC/WSS ===
- RateLimitComponent (30 req/60s)
- ErrorMapperComponent (PGRST → عربية)

### الخلفية
SupabasePlatform (Postgres+RLS, RPCs, Realtime, Storage) · ChatbotEdgeFunction (JWT guard + tool-calling) · LLM Providers (Cloud + LM Studio).

## 3. قواعد الاعتماد الجوهرية

1. كل مكون عرض يعتمد على خدمات فقط؛ لا REST مباشر من الصفحات.
2. كل الخدمات تعبر عبر DataAccessComponent حصرًا.
3. ChatbotEdgeFunction هو **المكوّن الوحيد** الذي يمسك service-role — عزل امتيازات صريح.
4. RateLimit/ErrorMapper مكونان عرضيان يُحقنان في مسار الطلبات.

## 4. كود Eraser

```eraser
title EventFlow Component Diagram - interfaces as contracts

Group Client SPA [color: lightblue] {
  PresentationLayer [icon: react]
  AuthComponent [icon: lock]
  ChatComponent [icon: message-square]
  QRScanner [icon: qr-code]
  ThemeComponent [icon: sun]
}
Group Service Components [color: lightgreen] {
  AuthServiceComponent [icon: box]
  EventManagementComponent [icon: box]
  RegistrationComponent [icon: box]
  TicketComponent [icon: box]
  AttendanceComponent [icon: box]
  ChatServiceComponent [icon: box]
  EvaluationComponent [icon: box]
  SupportComponents [icon: boxes]
}
Group Shared Infrastructure [color: lightyellow] {
  DataAccessComponent [icon: database]
  RateLimitComponent [icon: gauge]
  ErrorMapperComponent [icon: translate]
}
Group Backend [color: lightorange] {
  SupabasePlatform [icon: server]
  ChatbotEdgeFunction [icon: cpu]
  LLMProviders [icon: cloud]
}

PresentationLayer > AuthComponent
PresentationLayer > ThemeComponent
PresentationLayer > QRScanner
PresentationLayer > ChatComponent
AuthComponent > AuthServiceComponent: requires login register sessions
ChatComponent > ChatServiceComponent
ChatComponent > ChatbotEdgeFunction
QRScanner > TicketComponent: decode unique_code
PresentationLayer > EventManagementComponent
PresentationLayer > RegistrationComponent
PresentationLayer > TicketComponent: view download QR
PresentationLayer > AttendanceComponent
PresentationLayer > EvaluationComponent
PresentationLayer > SupportComponents

AuthServiceComponent > DataAccessComponent: login_user revoke_session rpc
EventManagementComponent > DataAccessComponent
RegistrationComponent > DataAccessComponent
TicketComponent > DataAccessComponent
AttendanceComponent > DataAccessComponent
ChatServiceComponent > DataAccessComponent: rest plus realtime subscribe
EvaluationComponent > DataAccessComponent: submit_evaluation rpc
SupportComponents > DataAccessComponent

DataAccessComponent > RateLimitComponent
RateLimitComponent > ErrorMapperComponent
ErrorMapperComponent > SupabasePlatform: mapped errors surfaced

ChatbotEdgeFunction > SupabasePlatform: service role internal only
ChatbotEdgeFunction > LLMProviders: openai compatible with lmstudio fallback
```

## 5. نقاط النقاش أمام اللجنة

1. **عقد الواجهة:** اللاحقات `::` تقابل Provided Interface في UML؛ سهم «requires» يقابل Required — اشرح المصطلحين بمثال واحد.
2. **قابلية الاستبدال:** تغيير مزود QR أو LLM لا يمس إلا مكوّنًا واحدًا — جوهر مبدأ Open/Closed عمليًا.
3. **عزل الامتياز:** لماذا ChatbotEdgeFunction وحده؟ لأنه يحتاج قراءات موسعة لبناء السياق — والحد الأدنى من الامتياز لموضع الحاجة.
