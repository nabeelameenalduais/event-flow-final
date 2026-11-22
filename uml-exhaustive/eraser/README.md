# حزمة مخططات EventFlow — نسخة Eraser (وصف أكاديمي + كود جاهز)

هذه الحزمة مبنية خصيصًا للاستخدام مع **Eraser.io** لتوليد المخططات وفق المعايير العالمية (OMG UML 2.5.1) لمشروع التخرج **EventFlow** — منصة إدارة فعاليات (React 19 + TypeScript + Vite + Supabase).

## طريقة الاستخدام

1. افتح eraser.io ثم أنشئ مخططًا جديدًا (New Diagram).
2. لكل ملف في هذه الحزمة:
   - اقرأ قسم «الوصف الكامل» — هو مرجعك أمام هيئة المناقشة.
   - انسخ محتوى قسم «كود Eraser» والصقه مباشرة على لوحة الرسم (Canvas) داخل Eraser، أو الصق الوصف الكامل في DiagramGPT ليولّد المخطط.
3. نوع المخطط المطلوب اختياره في Eraser مذكور أعلى كل ملف:
   - Use Case / Class / Activity / State / Component → تُرسم بنمط Flow chart.
   - ERD → نمط ER.
   - Sequence → نمط Sequence.
   - Architecture / Deployment → نمط Cloud architecture.

## قائمة الملفات

| # | الملف | المخطط | النمط في Eraser |
|---|---|---|---|
| 01 | `01_use_case.md` | مخطط حالات الاستخدام Use Case | Flow chart |
| 02 | `02_class.md` | مخطط الفئات Class (كيانات + خدمات) | Flow + ER |
| 03 | `03_erd.md` | مخطط الكيانات والعلاقات ERD | ER |
| 04a | `04a_sequence_auth.md` | تتابع: المصادقة وإدارة الجلسات | Sequence |
| 04b | `04b_sequence_registration.md` | تتابع: التسجيل والدعوات وقائمة الانتظار | Sequence |
| 04c | `04c_sequence_checkin.md` | تتابع: تسجيل الحضور Check-in/out | Sequence |
| 04d | `04d_sequence_chat.md` | تتابع: الدردشة اللحظية Realtime | Sequence |
| 04e | `04e_sequence_evaluation.md` | تتابع: الاستبيان والتقييم | Sequence |
| 04f | `04f_sequence_chatbot.md` | تتابع: المساعد الذكي Chatbot | Sequence |
| 05a | `05a_activity_registration.md` | نشاط: تدفق التسجيل الكامل | Flow chart |
| 05b | `05b_activity_checkin.md` | نشاط: تدفق الحضور عند البوابة | Flow chart |
| 06 | `06_architecture.md` | معمارية الطبقات Layered Architecture | Cloud architecture |
| 07 | `07_state_machine.md` | آلات الحالات للنطاقات الحرجة | Flow chart |
| 08 | `08_component.md` | مخطط المكونات Component | Cloud architecture |
| 09 | `09_deployment.md` | مخطط النشر Deployment | Cloud architecture |

## مصادر الحقيقة (من أين جاء كل وصف؟)

كل وصف مستخرج فعليًا من كود المشروع:

- `src/services/*.ts` — طبقة الخدمات (authService, eventService, ticketService, attendanceService, invitationService, chatService, evaluationService, notificationService, feedbackService, costService, deviceSessionService, settingsService, reportsService, auditService).
- `src/lib/supabase.ts`, `src/lib/rateLimit.ts`, `src/lib/errors.ts` — البنية التحتية.
- `supabase/schema.sql` (+ part2-security) — الجداول وRLS وRPCs وtrigger الترقية من قائمة الانتظار.
- `supabase/functions/chatbot/index.ts` — Edge Function للمساعد الذكي مع tool-calling وfallback إلى LM Studio.

## ملاحظة أكاديمية

- Eraser لا يملك ترميز UML أصليًا لكل الأنواع؛ لذلك رُبطت كل عناصر UML المعيارية بأقرب ترميز مدعوم (oval للـ actor/use case، diamond للقرار، groups لحدود النظام/الحزم). الفروقات موثقة داخل كل ملف في قسم «المرجع المعياري».
