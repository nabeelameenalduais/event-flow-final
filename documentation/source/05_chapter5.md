<!-- CHAPTER:5|الفصل الخامس: التنفيذ والاختبار|Implementation and Test -->

## 5.1 Introduction

يصف هذا الفصل كيف نُفّذ التصميم فعلياً، وما هي الوحدات الموجودة في المستودع، وكيف جرى اختبارها. تُؤخذ جميع الأرقام الواردة أدناه من ملفات المشروع أو من سجل تشغيل الاختبارات المحلي؛ فلا تُذكر نسبة تغطية أو زمن استجابة أو نتيجة اختبار لم تُرصد. كما يُفرَّق بين الاختبارات الآلية التي نفذت فعلاً وبين سيناريوهات القبول الـ26 المدرجة في الملحق D والتي لم يُعثر على سجل تنفيذ منفصل لها.

## 5.2 Development Environment and Tools

Table 5-1: Development and Testing Tools

| Tool | Version / role |
| --- | --- |
| Node.js | 20+ runtime for the Vite toolchain |
| npm | Dependency management and scripts (`dev`, `build`, `lint`, `test`, `test:watch`, `preview`) |
| Vite | 8.1.1 development server and production build |
| TypeScript | ~6.0.2 static typing; `tsc -b` runs before `build` |
| React / react-dom | 19.2.7 component library and renderer |
| Supabase JS | 2.110.2 client for REST, RPC, Realtime and Storage |
| PostgreSQL | Relational database hosted through Supabase |
| Vitest / Testing Library | 4.1.10 automated unit and component tests |
| Oxlint | 1.71.0 static analysis |
| Microsoft Word | Field and TOC update for this report |

## 5.3 Implementation of Main Modules

نُفّذت الوحدات وفق تقسيم الخدمات التالي:

- **المصادقة والحسابات:** `authService.ts` و`accountService.ts` و`passwordResetService.ts` و`deviceSessionService.ts`، مع صفحات `Login` و`Register` و`ForgotPassword` و`ResetPassword` و`RestoreAccount` و`ChangePassword` و`Profile`.
- **الفعاليات والتسجيل:** `eventService.ts` و`registrationService.ts` و`invitationService.ts`، مع صفحات `Events` و`EventDetail` و`EventForm` و`EventManagement` و`RegistrationManagement` و`InvitationManagement`.
- **التذاكر والحضور:** `ticketCode.ts` و`ticketService.ts` و`attendanceService.ts`، مع `QrScanner.tsx` و`TicketDetail.tsx` و`AttendanceManagement.tsx`.
- **الجلسات والتقييم والمحادثة:** `sessionService.ts` و`evaluationService.ts` و`feedbackService.ts` و`chatService.ts` و`notificationService.ts`، مع صفحات الإدارة والقنوات والإشعارات.
- **التقارير والمالية والحملات:** `dashboardService.ts` و`reportsService.ts` و`exportService.ts` و`costService.ts` و`financeService.ts` و`campaignService.ts`، مع صفحات `Dashboard` و`Reports` و`EventCosts` و`Finance` و`Campaigns` و`Audience`.
- **الإدارة والأمان:** `userService.ts` و`banService.ts` و`auditService.ts` و`settingsService.ts` و`rateLimit.ts`، مع `UserManagement` و`Bans` و`SecurityCenter` و`SystemSettings`.

نظراً لعدم وجود لقطات شاشة موثقة في المستودع، يُدرج أدناه إطار تحميل موسوم بوضوح؛ وهو بديل توثيقي فقط وليس صورة من التطبيق ولا نموذجاً أولياً مُدعىً أنه منتج نهائي.

<!-- IMAGE:assets/screenshot_placeholder.png -->

## 5.4 Database Implementation

نُفّذ مخطط قاعدة البيانات على مرحلتين رئيسيتين: `supabase/schema.sql` للجداول والقيود والدوال والمشغلات الأساسية، ثم `supabase/schema-part2-security.sql` للصلاحيات وسياسات `RLS`. بعد ذلك أُضيفت ثلاث عشرة هجرة في مجلد `supabase/migrations/` لتصحيح سياسات الرفع، وتقوية الأمان، وضبط ترتيب تواريخ الفعاليات، وإصلاح حمولة QR، وإضافة صلاحيات الحظر والتمويل وطلبات الفعاليات والبث والجمهور، وصيانة الفهارس.

يعتمد ترتيب التنفيذ على تطبيق `schema.sql` ثم `schema-part2-security.sql` ثم الهجرات مرتبة زمنياً. ويُوثَّق هذا الترتيب كاملاً في الملحق H مع وصف كل هجرة، دون الادعاء بتطبيقها على مشروع Supabase حيّ؛ فالتوثيق يصف ملفات المستودع فقط.

## 5.5 Security Implementation

تُطبَّق الضوابط الأمنية في أكثر من طبقة:

- تجزئة كلمات المرور عبر bcrypt داخل دوال `authenticate_user` و`register_user`، مع مسار توافق SHA-256 عند غياب الدالة وظهور الخطأ `PGRST202`.
- تحديد محاولات الدخول الفاشلة في `auth_attempts` و`rateLimit.ts`، ومنع كشف وجود البريد في طلبات الاستعادة.
- جلسات أجهزة فعلية عبر `device_sessions` ودوال `list_user_sessions` و`revoke_session` و`revoke_other_sessions`.
- سياسات `RLS` وصلاحيات أعمدة صريحة في `schema-part2-security.sql` والهجرات اللاحقة، مع حماية `password_hash` ورموز الاستعادة ورموز الجلسات.
- سجل تدقيق `audit_logs` وصفحة `SecurityCenter` لمراجعة العمليات الإدارية.
- سياسات Storage للملفات المرفوعة، وقيود على فحص التذاكر تمنع تعديل الحمولة أو فحص تذكرة تعود لفعالية أخرى.

## 5.6 Testing Strategy

اعتمد الاختبار على مستويين:

1. **اختبارات آلية بلغة Vitest:** تغطي خدمات المصادقة والفعاليات ولوحة المؤشرات والإعدادات وترميز التذاكر، ودوال التاريخ والتنسيق والتعريب، ومكوّنات الواجهة الأساسية وسياق اللغة.
2. **مراجعات سيناريوهات يدوية:** صيغت 26 حالة اختبار في القالب المعتمد لتغطية FR-01 إلى FR-11 والمتطلب NFR-01، لكن لا يوجد سجل تنفيذ منفصل لها ضمن المستودع، لذلك تُترك نتيجتها فارغة في الملحق D ولا تُذكر كنتائج ناجحة.

## 5.7 Test Cases and Results

نُفّذ الأمر `npm.cmd test` محلياً؛ إذ تعذّر تشغيل `npm test` مباشرة بسبب سياسة تنفيذ السكربتات في PowerShell على هذا الجهاز، فاستُخدم المشغّل `npm.cmd` الذي ينفّذ نفس السكربت `vitest run`. كانت النتيجة الفعلية: **12 ملف اختبار ناجحاً من 12، و95 حالة اختبار ناجحة من 95، دون فشل، بمدة 12.00 ثانية**، وفق إصدار Vitest 4.1.10.

يوضح الجدول 5-2 عشر حالات آلية تمثيلية من هذه المجموعة. المعرّف `UT` يعني اختبار وحدة آلي، وهو مستقل عن معرّفات `TC` الخاصة بسيناريوهات القبول في الملحق D.

Table 5-2: Representative Test Cases

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| UT-01 | Login with valid credentials (`authService.test.ts`) | User, profile and role are returned | Pass |
| UT-02 | Login with invalid email (`authService.test.ts`) | An error is thrown | Pass |
| UT-03 | Register with a duplicate email (`authService.test.ts`) | Duplicate registration is rejected | Pass |
| UT-04 | Reset password with an invalid token (`authService.test.ts`) | The invalid token is rejected | Pass |
| UT-05 | Public event listing excludes deleted events (`eventService.test.ts`) | Only published non-deleted events are returned | Pass |
| UT-06 | Ticket payload points to another event (`ticketCode.test.ts`) | The payload is rejected | Pass |
| UT-07 | Ticket payload points to another registration (`ticketCode.test.ts`) | The payload is rejected | Pass |
| UT-08 | Seven trailing days including empty days (`dashboardService.test.ts`) | Seven local-time days are returned | Pass |
| UT-09 | Default language is Arabic with RTL (`LanguageContext.test.tsx`) | Arabic direction is applied | Pass |
| UT-10 | Arabic numerals in formatting (`formatters.test.ts`) | Arabic numerals are used | Pass |

توزّعت الحالات الـ95 على 12 ملف اختبار، منها 16 حالة في `i18n.test.ts`، و15 في `messageLocalizer.test.ts`، و14 في `formatters.test.ts`، و11 في `authService.test.ts`، و10 في `ticketCode.test.ts`، و9 في `eventDates.test.ts`، و7 في `LanguageContext.test.tsx`، و4 في `Button.test.tsx`، و3 في `Loading.test.tsx`، وحالتان لكل من `dashboardService.test.ts` و`eventService.test.ts` و`settingsService.test.ts`. لا تُذكر أي نسبة تغطية لأنها لم تُقس.

## 5.8 Deployment

يُنتج الأمر `npm run build` مجلد `dist` بعد فحص الأنواع، ويمكن نشره على أي مستضيف ملفات ثابتة مع توجيه SPA fallback إلى `index.html`. يعتمد التطبيق على متغيرات بيئة تبدأ بـ `VITE_`، وأهمها:

- `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` للاتصال بمشروع Supabase؛ ويوصى باستخدام المفتاح القابل للنشر في رفعات Storage.
- `VITE_APP_NAME` و`VITE_APP_URL` للبيانات الوصفية والروابط.
- `VITE_EMAIL_PROVIDER` و`VITE_EMAIL_API_KEY` و`VITE_EMAIL_FROM` اختيارية للإرسال الحقيقي، وإلا تُحاكى الحملات محلياً.
- `VITE_ACCOUNT_DELETION_GRACE_DAYS` لتحديد نافذة استعادة الحساب، والقيمة الافتراضية 30 يوماً.

لا يحتوي المستودع على ملف `.env` حقيقي، ولم تُستخدم أي بيانات اعتماد فعلية في هذا التقرير.

## 5.9 Summary

استعرض الفصل بيئة التطوير والوحدات المنفذة وترتيب تنفيذ قاعدة البيانات والضوابط الأمنية واستراتيجية الاختبار. وأظهرت النتائج الفعلية نجاح 12 ملف اختبار و95 حالة آلية، مع الإبقاء على سيناريوهات القبول الـ26 دون نتائج مفترضة. كما بيّن الفصل أن النشر يعتمد على حزمة ثابتة ومتغيرات بيئة موثقة في `.env.example`، وأن لا بيانات اعتماد حقيقية مضمّنة في المستودع.
