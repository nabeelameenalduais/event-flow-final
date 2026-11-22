# EventFlow — حزمة UML ووثائق الهندسة الاستنفادية (Exhaustive)

> **الغرض:** توثيق تصميم نظام EventFlow (منصة إدارة الفعاليات) بمخططات UML/هندسة معيارية
> شاملة لجميع السيناريوهات (happy path، بدائل، فشل، حالات حافة)، مع قواميس بيانات،
> شروح عربية، ومصفوفة تتبع كود، ومربط أمني (JWT-less custom sessions / RBAC / RLS / RPCs).
>
> **للشرح التعليمي التفصيلي** (ما هو كل مخطط ولماذا نستخدمه وأجزاؤه):
> راجع [`DIAGRAMS_GUIDE.md`](./DIAGRAMS_GUIDE.md)
>
> **الأدوات المعتمدة (إلزامية):**
> | المخطط | الأداة | الامتداد |
> |---|---|---|
> | حالات الاستخدام (Use Case) | PlantUML | `01_use_case.puml` |
> | الفئات (Class) | PlantUML | `02_class.puml` (+ أجزاؤه `02_class_*.puml`) |
> | العلاقات (ERD) | Mermaid | `03_erd.mmd` |
> | التتابع (Sequence) | Mermaid | `04a–04f_sequence_*.mmd` |
> | النشاط (Activity) | Mermaid | `05a/05b_activity_*.mmd` |
> | الحالات (State Machine) | Mermaid | `07_state_machine.mmd` |
> | المكونات (Component) | Mermaid | `08_component.mmd` |
> | النشر (Deployment) | Mermaid | `09_deployment.mmd` |
> | الهندسة المعمارية (Architecture) | Mermaid | `06_architecture.mmd` |

> **قاعدة العرض:** تُفتح ملفات `.puml` بـ PlantUML (plantuml.com/plantuml أو ملحق VS Code)،
> وملفات `.mmd` عبر mermaid.live أو ملحق Mermaid في VS Code.

---

## 1. جرد الملفات (Artifact Inventory)

| # | الملف | النوع | الغرض |
|---|---|---|---|
| 1 | `01_use_case.puml` | PlantUML | 48 حالة استخدام، 4 فاعلين + 4 أنظمة خارجية، تعميم، include/extend |
| 2 | `02_class.puml` | PlantUML | مخطط الفئات متعدد الطبقات (كيانات/خدمات/سياقات/بنية) مع includes |
| 2a | `02_class_entities.puml` | PlantUML (part) | حزمة الكيانات (29 كيانًا + DTO) |
| 2b | `02_class_services.puml` | PlantUML (part) | حزمة الـ Enums + طبقة الخدمات (21 وحدة) |
| 2c | `02_class_platform.puml` | PlantUML (part) | السياقات + الحماية + البنية التحتية + Edge Function |
| 3 | `03_erd.mmd` | Mermaid | ERD كامل: 30 جدولًا، كل علاقة FK فعلية |
| 4a | `04a_sequence_auth.mmd` | Mermaid | مصادقة: login/register/restore/logout/استعادة كلمة المرور |
| 4b | `04b_sequence_registration.mmd` | Mermaid | تسجيل: عام/خاص/دعوة/إلغاء/ترقية قائمة انتظار |
| 4c | `04c_sequence_checkin.mmd` | Mermaid | دخول/خروج بالكاميرا أو يدويًا + حضور أونلاين تلقائي |
| 4d | `04d_sequence_chat.mmd` | Mermaid | قناة عامة/خاصة + Realtime |
| 4e | `04e_sequence_evaluation.mmd` | Mermaid | إنشاء/إرسال/نتائج التقييم (RPC خادمي) |
| 4f | `04f_sequence_chatbot.mmd` | Mermaid | مساعد الذكاء الاصطناعي + أدوات البيانات |
| 5a | `05a_activity_registration.mmd` | Mermaid | نشاط التسجيل الشامل (قرارات + أخطاء) |
| 5b | `05b_activity_checkin.mmd` | Mermaid | نشاط الدخول (كاميرا/يدوي/أونلاين) |
| 6 | `06_architecture.mmd` | Mermaid | الهندسة المعمارية الطبقية (Client-First on Supabase) |
| 7 | `07_state_machine.mmd` | Mermaid | آلة الحالات: تسجيل/تذكرة/حضور/فعالية/جلسة/تقييم/دعوة |
| 8 | `08_component.mmd` | Mermaid | المكونات المنطقية + الواجهات (ports) |
| 9 | `09_deployment.mmd` | Mermaid | النشر: العُقد والأدوات ومسارات النقل |

---

## 2. المخطط الأول: حالات الاستخدام (Use Case — PlantUML)

### 2.1 قاموس بيانات حالات الاستخدام

| UC | الاسم | الفاعل | الوصف | التتبع للكود |
|---|---|---|---|---|
| UC01 | تصفح الفعاليات المنشورة | Visitor | عرض قائمة فعاليات published وغير محذوفة | `eventService.listEvents`, `events` (RLS: `deleted_at is null`) |
| UC02 | عرض تفاصيل فعالية | Visitor | تفاصيل + جلسات + مكان + تقييمات | `eventService.getEvent`, `03_erd` |
| UC03 | سؤال المساعد الذكي | Visitor | بحث/اكتشاف عبر LLM + أدوات بيانات | `supabase/functions/chatbot/index.ts`, `04f` |
| UC04 | إنشاء حساب | Visitor | RPC `register_user` (bcrypt) | `authService.register`, `04a` |
| UC05 | تسجيل الدخول | Visitor | RPC `authenticate_user` + جلسة جهاز | `authService.login`, `04a` |
| UC06 | طلب استعادة كلمة المرور | Visitor | RPC `request_password_reset` (استجابة موحدة) | `authService.requestPasswordReset` |
| UC07 | إعادة تعيين كلمة المرور | Visitor | RPC `reset_password_with_token` + إبطال الجلسات | `authService.resetPasswordWithToken` |
| UC08 | صفحات التواصل/عن المنصة | Visitor | محتوى ثابت | `src/pages` |
| UC10 | التسجيل في فعالية | Attendee | تحقق الحالة/الموعد/السعة + تذكرة | `eventService.registerForEvent`, `04b/05a` |
| UC11 | إلغاء التسجيل الخاص | Attendee | تحديث الحالة + ترقية القائمة | `eventService.cancelRegistration`, `04b` |
| UC12 | عرض التذكرة (QR) | Attendee | تذكرة مملوكة وconfirmed فقط | `ticketService.getTicketForOwner` |
| UC13 | تنزيل التذكرة | Attendee | توليد QR وتنزيل صورة | `ticketService.downloadTicket` |
| UC14 | إرسال تقييم (مراجعة) | Attendee | تقييم + تعليق | `feedbackService.submit` |
| UC15 | إرسال تقييم استبيان | Attendee | RPC `submit_evaluation` (تحقق صارم) | `evaluationService.submitEvaluation`, `04e` |
| UC16 | الانضمام لدردشة الفعالية | Attendee | قناة عامة/خاصة + Realtime | `chatService`, `04d` |
| UC17 | عرض الإشعارات | Attendee | قائمة + قراءة/مسح | `notificationService.listForUser` |
| UC18 | الانضمام لاجتماع أونلاين | Attendee | حضور تلقائي (idempotent) | `attendanceService.markAutoAttendance` |
| UC20 | إنشاء/تعديل/حذف منطقي لفعالية | Organizer | CRUD كامل | `eventService.createEvent/updateEvent/deleteEvent` |
| UC21 | نشر/أرشفة/إلغاء نشر | Organizer | تغيير الحالة | `eventService.updateEventStatus` |
| UC22 | تكرار الفعالية | Organizer | نسخ قالب الفعالية | `src/pages/organizer` |
| UC23 | إدارة الجدول (جلسات/متحدثون) | Organizer | CRUD sessions + speakers | `sessionService`, `03_erd` |
| UC24 | إدارة التسجيلات (إلغاء) | Organizer | إلغاء نيابة عن الحاضر | `eventService.cancelRegistration` |
| UC25 | فحص الدخول/الخروج (QR) | Organizer | تحقق + تسجيل حضور | `attendanceService.checkIn/checkOut`, `04c/05b` |
| UC26 | توليد روابط دعوة (فردي/دفعة) | Organizer | روابط لبرامج خاصة | `invitationService`, `04b` |
| UC27 | إدارة تكاليف الفعالية | Organizer | planned/actual + إجماليات | `costService.addCost/updateCost` |
| UC28 | بناء استبيان تقييم | Organizer | أسئلة + خيارات + ترتيب | `evaluationService.createEvaluation` |
| UC29 | عرض نتائج التقييم | Organizer | مجمّع (secret) أو فردي (public) | `evaluationService.getSubmissions/getStats` |
| UC30 | الرد على المراجعات | Organizer | رد على feedback | `feedbackService.respond` |
| UC31 | إدارة الملف الشخصي وجلسات الأجهزة | Organizer | ملف + قائمة/إبطال جلسات | `deviceSessionService`, `sessionService` |
| UC32 | إرسال تذكير فعالية | Organizer | إشعار event_reminder | `notificationService` |
| UC33 | ضبط رابط اجتماع أونلاين | Organizer | توليد/تعديل meeting_link | `eventService.generateMeetingLink` |
| UC40 | إدارة المستخدمين (إيقاف/تفعيل) | Admin | CRUD + suspend/activate | `userService` |
| UC41 | إدارة التصنيفات | Admin | CRUD categories | `categoryService` |
| UC42 | إدارة الأماكن | Admin | CRUD venues | `venueService` |
| UC43 | إدارة الملفات (Storage) | Admin | رفع/حذف/قائمة | `fileService` |
| UC44 | تعيين منظمي الفعاليات | Admin | إضافة/إزالة event_organizers | `organizerService` |
| UC45 | التقارير والتصدير CSV | Admin | تقارير + تصدير | `reportsService.exportEventReport` |
| UC46 | إعدادات النظام وقوالب البريد | Admin | app_settings + email_templates | `settingsService` |
| UC47 | مركز الأمان (سجل الحادثات) | Admin | audit_logs للعرض فقط | `auditService.list` |
| UC48 | ضبط علم إدارة كل الفعاليات | Admin | `manages_all_events` على المنظمين | `userService.updateProfile` |

### 2.2 شرح عربي للمخطط

- **الفاعلون:** `Visitor` (زائر غير مسجل) → يتفرع منه `Attendee` (حاضر مسجل) و`Organizer` (منظم)، ومن الأخير يتفرع `Admin` (مدير). هذا التعميم يمنح المخطط مرجعية RBAC مباشرة: كل حالة استخدام قابلة للوصول عبر الأدوار المتوارثة فقط.
- **الأنظمة الخارجية:** `Supabase` (المصادقة والتخزين)، `LM Studio` (خادم النموذج المحلي — المسار الفعلي للمساعد)، `Camera/QR` (فحص التذاكر)، و`Email Gateway` (توصيل روابط إعادة التعيين — محاكى في العرض). (يوجد `OpenRouter` كمسار تصميمي بديل عبر Edge Function غير مستخدم في الواجهة الحالية).
- **علاقات `<<include>>`:** مسارات فرعية إلزامية، مثل: التسجيل (UC10) يشمل دائمًا توليد تذكرة QR (UC12) عند التأكيد وإشعار الحاضر (UC17)؛ والفحص (UC25) يشمل التحقق من ملكية التذكرة وحالتها؛ والدخول (UC05) يشمل إنشاء جلسة الجهاز وتسجيل الحادثة.
- **علاقات `<<extend>>` مع نقاط تمديد (Extension Points):** مسارات شرطية:
  - UC10 ↔ UC26: عند `private event + invite code`، مع التحقق من صحة الرمز وصدور الردود (مستخدم/مستخدم مسبقًا/لفعالية أخرى/بريد مختلف).
  - UC10 → UC11: عند امتلاء السعة يتحول التسجيل إلى قائمة انتظار.
  - UC10 → UC17: عند انتهاء الموعد/الموعد النهائي.
  - UC18 → UC12/UC25: ظهور رابط الاجتماع قبل ساعة من البدء، وحضور تلقائي idempotent.
  - UC03 → UC02: تنفيذ أداة `get_event_details` عبر LLM.

### 2.3 السيناريوهات المغطاة (مختصر)

كل حالة استخدام حُمّلت بملاحظات في ملف `.puml` توثق: مسار النجاح، البدائل، الفشل، والـ fallback
(مثل مسار Legacy عند غياب RPC — PGRST202). انظر Notes داخل `01_use_case.puml`.
 
---

## 3. المخطط الثاني: الفئات (Class Diagram — PlantUML)

### 3.1 قاموس بيانات الكيانات

| الكيان | الجدول | الوصف | مفتاح/قيود بارزة |
|---|---|---|---|
| `User` | `users` | حساب نظام (بريد + كلمة مرور مخزنة خادميًا) | PK; `email` UK; `password_hash` غير قابل للقراءة |
| `Role` | `roles` | دور (admin/organizer/attendee) | PK; `name` UK |
| `Profile` | `profiles` | الملف التفصيلي للمستخدم | FK `user_id` UNIQUE; FK `role_id`; `manages_all_events` |
| `Category` | `categories` | تصنيف الفعاليات | حذف منطقي `deleted_at` |
| `Venue` | `venues` | مكان إقامة الفعالية | سعة + مرافق JSONB |
| `Event` | `events` | الفعالية | `event_type` in_person/online; `venue_id` nullable للأونلاين; `meeting_link` |
| `EventOrganizer` | `event_organizers` | علاقة منظم↔فعالية | UNIQUE(event_id,user_id); `is_primary` |
| `Session` | `sessions` | جلسة/قاعة داخل الفعالية | FK event_id |
| `Speaker` | `speakers` | متحدث في جلسة | FK session_id |
| `Registration` | `registrations` | تسجيل حاضر | status: confirmed/cancelled/waitlisted |
| `Ticket` | `tickets` | تذكرة QR | FK registration_id UNIQUE; `unique_code` UK; status valid/used/invalid |
| `Attendance` | `attendance` | سجل الحضور | FK ticket_id; check_in/check_out |
| `InvitationLink` | `invitation_links` | رابط دعوة لبرنامج خاص | `code` UK; `used` |
| `ChatChannel` | `chat_channels` | قناة عامة أو خاصة 1:1 | partial unique indexes |
| `ChatMessage` | `chat_messages` | رسالة | FK channel/sender; Realtime |
| `ChatMessageWithSender` | — | DTO (اسم المرسل/دوره) | تجميع من JOIN |
| `Evaluation` | `evaluations` | استبيان تقييم | rating_type; privacy secret/public |
| `EvaluationQuestion` | `evaluation_questions` | سؤال الاستبيان | multiple_choice/text; options JSONB |
| `EvaluationSubmission` | `evaluation_submissions` | إرسال الحاضر | UNIQUE(evaluation_id,attendee_id) |
| `EvaluationAnswer` | `evaluation_answers` | إجابة | UNIQUE(submission_id,question_id) |
| `EventCost` | `event_costs` | بند تكلفة | cost_type planned/actual; quantity; unit_price |
| `Notification` | `notifications` | إشعار | نوع + `link`؛ read_at |
| `FileItem` | `files` | ملف مرفوع | FK uploaded_by |
| `EmailTemplate` | `email_templates` | قالب بريد | type فريد |
| `AppSettings` | `app_settings` | إعدادات عامة | صف واحد عمليًا |
| `Feedback` | `feedback` | مراجعة حرة | rating + comment + response |
| `DeviceSession` | `device_sessions` | جلسة جهاز | `token` لا يُقرأ من العميل |
| `AuditLog` | `audit_logs` | سجل حادثات | append-only عبر RPC |

### 3.2 قاموس بيانات الـ Enums

| Enum | القيم |
|---|---|
| `RoleName` | `admin` \| `organizer` \| `attendee` |
| `EventStatus` | `draft` \| `published` \| `archived` |
| `EventVisibility` | `public` \| `private` |
| `EventType` | `in_person` \| `online` |
| `RegistrationStatus` | `confirmed` \| `cancelled` \| `waitlisted` |
| `TicketStatus` | `valid` \| `used` \| `invalid` |
| `ChatChannelType` | `event` \| `direct` |
| `RatingType` | `stars` \| `emoji` \| `custom` |
| `EvaluationPrivacy` | `secret` \| `public` |
| `EvaluationQuestionType` | `rating` \| `text` \| `choice` |
| `CostType` | `planned` \| `actual` |
| `NotificationType` | `registration_confirmed`, `event_reminder`, `event_cancelled`, `new_message`, `invitation_accepted`, `new_invitation`, `event_update` |
| `AuditAction` | `create`, `update`, `delete`, `login`, `logout`, `register`, `attendance`, `evaluation`, `checkin`, `password_reset` |
| `AuthErrorCode` | `USER_NOT_FOUND`, `INVALID_CREDENTIALS`, `USER_SUSPENDED`, `RATE_LIMITED`, `ACCOUNT_LOCKED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `SESSION_NOT_FOUND` |

### 3.3 شرح عربي للمخطط

- **هيكل الطبقات:** المخطط مقسم إلى حزم عبر `!include` (كيانات النطاق، الـ Enums، طبقة الخدمات بنمط Repository، السياقات، الحماية، البنية التحتية، وEdge Function) مع تلوين stereotypes.
- **طبقة الخدمات** تحمل واجهات فعلية مأخوذة من `src/services/*.ts`، وتُظهر اعتمادها على `supabaseClient` (Singleton) و`RateLimiter` و`SupabaseErrorMapper`.
- **طبقة العرض** (AuthContext/ThemeContext/ProtectedRoute/PublicRoute) تفوض كل منطق المصادقة إلى الخدمات، والحماية تعتمد على `RoleName` في RBAC.
- **التتبع:** كل علاقة مرقمة بمصدرها في `schema.sql` أو `src/services`. ملاحظات المخطط توثق آلات الحالة (التسجيل/الدخول) وقيود RLS.

---

## 4. المخطط الثالث: العلاقات (ERD — Mermaid)

### 4.1 قاموس بيانات الجداول (30)

| الجدول | الوصف المختصر | أبرز الأعمدة |
|---|---|---|
| `users` | الحسابات | email UK, password_hash (مغلق), suspended |
| `roles` | الأدوار | name UK |
| `profiles` | ملفات المستخدمين | user_id FK/UK, role_id FK, manages_all_events |
| `categories` | تصنيفات | deleted_at (منطقي) |
| `venues` | أماكن | capacity, facilities JSONB |
| `events` | الفعاليات | organizer_id FK, category_id FK, venue_id FK (nullable), event_type, status, visibility, meeting_link |
| `event_images` | صور الفعالية | event_id FK |
| `sessions` | الجلسات | event_id FK, start/end_time |
| `speakers` | المتحدثون | session_id FK |
| `registrations` | التسجيلات | event_id FK, attendee_id FK, status |
| `tickets` | التذاكر | registration_id FK/UK, unique_code UK, status |
| `attendance` | الحضور | ticket_id FK, check_in/out |
| `feedback` | المراجعات | event_id FK, attendee_id FK, rating |
| `notifications` | الإشعارات | user_id FK, type, read_at, link |
| `files` | الملفات | uploaded_by FK |
| `audit_logs` | سجل الحادثات | user_id FK (SET NULL), action |
| `invitation_links` | روابط الدعوة | event_id FK, code UK, used |
| `event_organizers` | منظمي الفعالية | UNIQUE(event_id,user_id) |
| `chat_channels` | قنوات الدردشة | channel_type general/private; فهارس فريدة جزئية |
| `chat_messages` | الرسائل | channel_id FK, sender_id FK; Realtime |
| `evaluations` | الاستبيانات | event_id FK, rating_type, privacy |
| `evaluation_questions` | أسئلة الاستبيان | evaluation_id FK, options JSONB |
| `evaluation_submissions` | إرسالات | UNIQUE(evaluation_id,attendee_id), is_public |
| `evaluation_answers` | إجابات | UNIQUE(submission_id,question_id) |
| `event_costs` | التكاليف | event_id FK, cost_type, unit_price |
| `device_sessions` | جلسات الأجهزة | user_id FK, token (مغلق) |
| `password_reset_tokens` | توكنات إعادة التعيين | user_id FK, token UK, expires_at, used_at (مغلق) |
| `app_settings` | إعدادات النظام | صف واحد |
| `email_templates` | قوالب البريد | type |
| `auth_attempts` | سجل المحاولات | email, attempted_at (بلا FK) |

### 4.2 شرح عربي

- كل سهم في `03_erd.mmd` يمثل **قيد FK فعلي** (من `schema.sql`)، والتعدديات تتبع صيغة Crow's Foot في Mermaid.
- `auth_attempts` لا يرتبط بأي جدول (كتابته عبر RPC فقط)، وهو أساس حد 5 محاولات/15 دقيقة.
- **الطبقة الأمنية** (في نهاية الملف) توثق أن `password_reset_tokens` و`auth_attempts` مغلقة كليًا، وأن `users.password_hash` و`device_sessions.token` غير قابلين للقراءة/التحديث من العميل.
 
---

## 5. مخططات التتابع (Sequence — Mermaid)

### 5.1 قاموس المشاركين والمصادر

| المخطط | المشاركون | السيناريوهات المغطاة | المصدر |
|---|---|---|---|
| `04a_sequence_auth.mmd` | U, AuthContext, authService, RateLimiter, DB (RPC/RLS), auditService | login (نجاح/فشل/حد/حساب معلّق/fallback SHA-256 عند PGRST202)، register (بريد مستخدم/fallback SHA-256)، restoreSession (جلسة منتهية/حساب معلّق)، password reset (رسالة موحّدة ضد التخمين، توكن منتهٍ/قاصر)، logout | `AuthContext.tsx`, `authService.ts`, `deviceSessionService.ts`, `schema.sql:195,337,388,448,667,697` |
| `04b_sequence_registration.mmd` | U, UI, eventService, invitationService, ticketService, notificationService, DB | تسجيل عام (سعة متاحة/ممتلئة→waitlist)، فعالية خاصة + تحقق رمز الدعوة (6 حالات)، إلغاء + ترقية قائمة انتظار، إنشاء دعوة | `eventService.ts:236`, `invitationService.ts`, `ticketService.generateTicket` |
| `04c_sequence_checkin.mmd` | O (المنظم), Camera, UI, attendanceService, DB | فحص QR (نجاح/تذكرة غير موجودة/مستخدمة/تسجيل غير مؤكد)، دخول يدوي، خروج، حضور أونلاين تلقائي idempotent — بلا خطوة audit في checkIn | `attendanceService.ts` (checkIn, checkOut, findTicketByCode, markAutoAttendance) |
| `04d_sequence_chat.mmd` | Organizer, Attendee, chatService, DB, Realtime | ضمان القناة العامة، قناة خاصة 1:1 فريدة، إرسال + بث Realtime، جلب السجل مع أسماء المرسلين، فشل RLS/انقطاع | `chatService.ts`, `schema.sql:55-82,816-817` |
| `04e_sequence_evaluation.mmd` | Organizer, Attendee, UI, evaluationService, DB (RPC) | إنشاء استبيان، فحص hasSubmitted، إرسال عبر `submit_evaluation` (أخطاء: غير مؤكد/لا حضور/تكرار)، عرض نتائج secret/public | `evaluationService.ts`, `schema.sql:574-643` |
| `04f_sequence_chatbot.mmd` | U, UI, useChat, LM Studio (محلي), DB (REST) | رد مباشر، دورة Tool-Calling (حتى 5 تكرارات)، الأدوات الست المنفَّذة من المتصفح عبر REST مباشرة، فشل (LM Studio غير متصل/خطأ)، إلغاء (Abort) | `useChat.ts` (المسار الفعلي)؛ `supabase/functions/chatbot/index.ts` (تصميم بديل غير مستخدم) |

### 5.2 شرح عربي عام

تستخدم المخططات إطارات `rect` لتجميع السيناريوهات، و`alt/opt` لتفريعات النجاح والفشل، و`loop` للحلقات
(مثل إعادة المحاولة في الـ LLM والترقيات). تُظهر بوضوح نقطة التحول إلى المسار Legacy عند `PGRST202`
واستمرار الاتساق الأمني (لا قراءة للـ tokens أو كلمات المرور من العميل).

---

## 6. مخططا النشاط (Activity — Mermaid)

| المخطط | الغرض | النقاط |
|---|---|---|
| `05a_activity_registration.mmd` | نشاط التسجيل الكامل (يبدأ بالنشاط ثم الشروط داخل مساره) | النشاط: التسجيل → تحقق النشر/الموعد/الانتهاء أثنائه، عام/خاص + 5 تحققات للرمز، تكرار، سعة، waitlist، تذكرة، إشعارات |
| `05b_activity_checkin.mmd` | نشاط الدخول الكامل (يبدأ بالنشاط ثم الشروط داخل مساره) | النشاط: الدخول → كاميرا/يدوي، 3 أعطال للتذكرة + شرط confirmed أثناء الفحص، إعادة محاولة، خروج، وحضور أونلاين تلقائي |

---

## 7. الهندسة المعمارية (Architecture — Mermaid)

`06_architecture.mmd` يرسم البنية الطبقية:
- **طبقة العرض:** صفحات + سياقات + حماية المسارات + واجهة المساعد + QR.
- **طبقة الخدمات (Repository):** auth/domain/support/misc + أدوات (rateLimit, supabaseErrors).
- **الواجهة الخلفية:** Postgres (30 جدول + RLS + RPCs)، Realtime، Storage، Edge Functions.
- **أنظمة خارجية:** LM Studio (المسار الفعلي للروبوت من المتصفح)، البريد، الكاميرا، OpenRouter (مسار تصميمي عبر Edge Function غير مستخدم).
- **الاتصالات:** anon key + RLS من العميل، وservice-role key من الـ Edge Function فقط، وترقيم أمني للطبقات.

---

## 8. آلة الحالات (State Machine — Mermaid)

### 8.1 قاموس بيانات الحالات والانتقالات

| كائن النطاق | الحالات | الانتقالات الرئيسية | الشرط/المشغّل | التتبع للكود |
|---|---|---|---|---|
| `Registration` | confirmed, cancelled, waitlisted | confirmed→cancelled، waitlisted→confirmed (ترقية)، waitlisted→cancelled | إدراج مباشر (confirmed/waitlisted)؛ ترقية عبر trigger `notify_waitlist_promotion` | `eventService.registerForEvent`, `schema.sql:822` |
| `Ticket` | valid, used, invalid | valid→used (checkIn/auto-attendance)، valid→invalid (إبطال) | تحقق: تسجيل confirmed مسبقًا | `attendanceService.checkIn`, `ticketService` |
| `Attendance` | NoAttendance, CheckedIn, CheckedOut | NoAttendance→CheckedIn، CheckedIn→CheckedOut | checkIn idempotent أونلاين | `attendanceService` |
| `Event` | draft, published, archived | draft→published، published→draft (unpublish)، published→archived، archived→published | `updateEventStatus` | `eventService` |
| `AuthSession` (device_session) | active, revoked | active→revoked (logout / إبطال عن بُعد / إعادة تعيين كلمة المرور) | RPC `revoke_session*`, `reset_password_with_token` | `authService`, `schema.sql:448,762,774` |
| `EvaluationSubmission` | submitted | [*]→submitted (مرة واحدة فريدة) | `submit_evaluation` | `schema.sql:574` |
| `InvitationLink` | unused, used | unused→used | `markLinkAsUsed` بعد تسجيل الضيف | `invitationService` |

### 8.2 شرح عربي

مخطط `stateDiagram-v2` بوحدات مجمّعة لكل كائن نطاق. ملاحظتان مهمتان موثقتان داخل المخطط:
1) لا انتهاء صلاحية صريح للجلسة حاليًا (`last_active_at` يتحدث عبر `get_session_user` فقط) — قيد تصميم معروف يُغطى في القيود؛
2) `pending` غير موجود إطلاقًا في `schema.sql` — تدفق التسجيل الفعلي يُدرج `confirmed` أو `waitlisted` مباشرة فقط.

---

## 9. مخطط المكونات (Component — Mermaid)

### 9.1 قاموس المكونات والواجهات

| المكوّن | النوع | الواجهة/المنفذ | المصدر |
|---|---|---|---|
| `PresentationLayer` | مكوّن عرض | يعتمد على كل مكوّنات الخدمات | `src/pages` |
| `AuthComponent` | مكوّن عرض | واجهة `login/register/restore/logout` + RBAC | `AuthContext.tsx`, `ProtectedRoute.tsx` |
| `ChatComponent` | مكوّن عرض | واجهة إرسال/اشتراك + استدعاء LM Studio عبر `/lmstudio/v1/chat/completions` | `useChat.ts` |
| `QRScanner` | مكوّن عرض | إدخال فيديو + فك ترميز QR | `QrScanner.tsx` |
| `AuthServiceComponent` | مكوّن خدمة | RPC auth + rate limit | `authService.ts`, `deviceSessionService.ts` |
| `EventManagementComponent` | مكوّن خدمة | CRUD الفعاليات + النشر/الأرشفة | `eventService.ts` |
| `RegistrationComponent` | مكوّن خدمة | تسجيل/إلغاء/دعوات/waitlist | `eventService.ts`, `invitationService.ts` |
| `TicketComponent` | مكوّن خدمة | إصدار/تحقق/تنزيل QR | `ticketService.ts` |
| `AttendanceComponent` | مكوّن خدمة | checkIn/checkOut/حضور تلقائي | `attendanceService.ts` |
| `ChatServiceComponent` | مكوّن خدمة | قنوات/رسائل + Realtime | `chatService.ts` |
| `EvaluationComponent` | مكوّن خدمة | استبيان + submit عبر RPC | `evaluationService.ts` |
| `SupportComponents` | مكوّنات خدمة | notification/cost/feedback/user/organizer/category/venue/file/settings/dashboard/reports/audit | `src/services/*` |
| `DataAccessComponent` | بنية تحتية | منفذ REST/RPC (SupabaseClient singleton) | `src/lib/supabase.ts` |
| `RateLimitComponent` | بنية تحتية | 30/60 ثانية | `rateLimit.ts` |
| `ErrorMapperComponent` | بنية تحتية | PGRST202/205 → رسائل عربية | `supabaseErrors.ts` |
| `ChatbotFunction` | مكوّن خلفي (بديل تصميمي غير مستخدم في الواجهة الحالية) | منفذ HTTP `/functions/v1/chatbot` + service-role key | `supabase/functions/chatbot/index.ts` |
| `LMStudioEndpoint` | نظام خارجي (محلي) | منفذ HTTP `/lmstudio/v1/chat/completions` — المسار الفعلي للروبوت | `useChat.ts` |
| `TriggerComponents` | مكوّنات خلفي | waitlist_promotion / auto_assign_organizers | `schema.sql:822,851` |

### 9.2 شرح عربي

المخطط يرسم فئات المكوّنات المستقلة واعتمادياتها الحقيقية (استيراد واستدعاء)، ويفصل منافذ الواجهات
(ports) المميزة بـ `===`: منفذ REST/RPC، منفذ الاشتراك Realtime، منفذ Storage، ومنفذ HTTP للمساعد
(الفعلي: LM Studio محلي؛ والـ`ChatbotFunction` تبقى مسارًا تصميميًا يتصل بقاعدة البيانات بـ service-role key
خادمًا فقط، بينما العميل عبر anon key + RLS).

---

## 10. مخطط النشر (Deployment — Mermaid)

### 10.1 قاموس العُقد والأدوات

| العقدة (Node) | النوع | الأدوات (Artifacts) المثبّتة | المصدر |
|---|---|---|---|
| جهاز المستخدم (المتصفح) | Device | `EventFlow SPA` (حزمة Vite)، وصول الكاميرا | `package.json` |
| استضافة الملفات الثابتة | Host/CDN | ملفات `dist` (index.html + assets) | build Vite |
| Supabase Cloud | PaaS | PostgreSQL (schema.sql + RLS + RPCs + Triggers)، Edge Runtime (chatbot)، Realtime، Storage | `supabase/` |
| LM Studio | Local Dev | خادم HTTP محلي `/lmstudio/v1/chat/completions` — المسار الفعلي للروبوت | `useChat.ts` |
| OpenRouter | External Cloud (بديل تصميمي) | LLM API (`llama-3.2-3b-instruct:free`) عبر Edge Function غير مستخدم | `chatbot/index.ts` |
| Email Gateway | External | تسليم روابط إعادة التعيين (محاكى) | `schema.sql:646` |

### 10.2 شرح عربي

يوضح المخطط مسارات النقل: `HTTPS` لتحميل الـ SPA والاستدعاءات (REST/RPC/Storage/Edge)، و`WSS`
لاشتراكات Realtime، واتصال الروبوت الفعلي عبر `HTTP` محلي إلى LM Studio (مع أدوات REST مباشرة من المتصفح)،
والكاميرا عبر إدخال فيديو محلي.

---

## 11. مصفوفة تتبع المتطلبات (Traceability Matrix)

| المعرّف | الوصف | المخططات المصمِّمة | ملفات الكود المرجعية |
|---|---|---|---|
| F1.1 | تسجيل الدخول (RPC + fallback) | UC05, `02`, `04a` | `authService.login`, `schema.sql:195` |
| F1.2 | إنشاء حساب (دور attendee) | UC04, `04a` | `authService.register`, `schema.sql:337` |
| F1.3 | استعادة كلمة المرور (توكن أحادي الاستخدام) | UC06, UC07, `04a`, `03` | `authService.request/resetPassword`, `schema.sql:651-729` |
| F1.4 | جلسات الأجهزة (list/revoke/revoke-all) | UC31, `02`, `04a` | `deviceSessionService`, `schema.sql:736-787` |
| F1.5 | حماية الخصوصية (مغلقة على العميل) | `03`, `02` | `schema-part2-security.sql` |
| F1.6 | حد المحاولات (5/15 دقيقة) | UC05, `04a`, `03` | `schema.sql:184-190`, `rateLimit.ts` |
| F2.1 | تصفح/تفاصيل الفعاليات | UC01, UC02, `03` | `eventService.list/getEvent` |
| F2.2 | تسجيل عام/خاص/دعوة + waitlist | UC10, UC26, `04b`, `05a` | `eventService.registerForEvent`, `invitationService` |
| F2.3 | تذاكر QR (إصدار/عرض/تنزيل/ملكية) | UC12, UC13, `02`, `03` | `ticketService.*` |
| F2.4 | دخول/خروج + حضور أونلاين تلقائي | UC18, UC25, `04c`, `05b` | `attendanceService.*` |
| F3.1 | إدارة الفعالية (CRUD/نشر/أرشفة/تكرار) | UC20-UC22, `02` | `eventService.*` |
| F3.2 | إدارة الجدول (جلسات/متحدثون) | UC23, `03` | `sessionService`, `03_erd` |
| F3.3 | إدارة التكاليف | UC27, `02` | `costService.*` |
| F4.1 | التقييمات والاستبيانات (RPC خادمي) | UC15, UC28, UC29, `04e` | `evaluationService.*`, `schema.sql:574` |
| F5.1 | المراجعات والردود | UC14, UC30, `02` | `feedbackService.*` |
| F6.1 | الدردشة (عامة/خاصة + Realtime) | UC16, `04d`, `06` | `chatService.*`, `schema.sql:816` |
| F7.1 | الإشعارات (أنواع + رابط) | UC17, UC32, `02` | `notificationService.*` |
| F8.1 | المساعد الذكي (أدوات بيانات) | UC03, `04f`, `06` | `supabase/functions/chatbot/index.ts`, `useChat.ts` |
| F9.1 | الإدارة: مستخدمون/تصنيفات/أماكن/ملفات | UC40-UC43, UC48, `02` | `user/category/venue/fileService` |
| F9.2 | إعدادات النظام وقوالب البريد | UC46, `03` | `settingsService.*` |
| F10.1 | التقارير والتصدير | UC45, `02` | `reportsService.*` |
| F10.2 | مركز الأمان (سجل الحادثات) | UC47, `02`, `03` | `auditService.*`, `schema.sql:793` |
| NF1 | RBAC (حماية المسارات) | `01`, `02`, `06` | `ProtectedRoute.tsx`, `PublicRoute.tsx` |
| NF2 | RLS على كل الجداول | `03`, `06` | `schema.sql:460+` |
| NF3 | تكامل قيود العمل خادميًا (تقييم/تذكرة) | `04e`, `05b` | `submit_evaluation`, `checkIn` |
| NF4 | حجز/سعة الفعالية + قائمة انتظار | UC10, `04b`, `05a` | `registerForEvent` |
| NF5 | دورة حياة الحالات المقيدة (تحويلات صالحة فقط) | `07`, `04b` | `updateEventStatus`, `checkIn`, `submit_evaluation` |
| NF6 | فصل المكونات والواجهات (قابلية الاستبدال) | `08` | `src/services/*`, `src/lib/supabase.ts` |
| NF7 | نشر سحابي قابل للتوسع وعزل المفاتيح | `09`, `06` | `supabase/`, `package.json` |

---

## 12. الطبقة الأمنية (Security Overlay)

1. **المصادقة:** لا JWT خارجي؛ توكن جلسة عشوائي (`crypto.randomUUID`) يُخزن في `localStorage` تحت `eventflow_session`، وتُتحقق كلمة المرور عبر RPC `SECURITY DEFINER` (bcrypt)، مع fallback SHA-256 للأنظمة القديمة عند `PGRST202`.
2. **RLS:** تفعيل على كل الجداول؛ القراءة العامة للفعاليات غير المحذوفة، وأقفال العمود عبر REVOKE.
3. **قفل الاعتمادات:** `password_hash` و`device_sessions.token` و`password_reset_tokens` و`auth_attempts` غير قابلة للقراءة من العميل.
4. **ضدّ الاستنتاج (Anti-Enumeration):** `request_password_reset` يعيد نفس الاستجابة للبريدين الموجود وغير الموجود.
5. **أحداث الحادثات:** `audit_logs` يُكتب عبر `record_audit` فقط (append-only).
6. **الحدود:** `rateLimit.ts` (30/60 ثانية) من جهة العميل + `auth_attempts` (5/15 دقيقة) من جهة الخادم.
7. **عزل الـ Edge Function:** تتصل ببيانات Supabase عبر service-role key (خادم فقط) — لا تمر عبر RLS الخاصة بالعميل.

---

## 13. ملاحظات التحقق النهائي

- **التقطيع:** كل ملفات الحزمة كاملة بلا اختصار (تحقق آلي من `Length` لكل ملف).
- **PlantUML:** `02_class.puml` يستخدم `!include` لملفات نسبية في نفس المجلد (تُفتح من جذر المشروع في VS Code/Mermaid + PlantUML). *ملاحظة: PlantUML غير مثبت محليًا حتى الآن، فصحة `01` و`02` لم تُختبر بالرندر — الصياغة قياسية.*
- **Mermaid:** الأسماء مطرودة (quoted) في التسميات الحاوية على شرطات أو نقاط، والنصوص العربية محصورة في `%%` تعليقات أو `note`/`title`/أعمدة آمنة.
- **توازن البنية (تحقق آلي):** في كل مخططات التتابع `alt + loop + rect = end`، وفي مخططات flowchart `subgraph = end`، وفي `07_state_machine.mmd` كل `state` مجمّعة مغلقة بإغلاق كتلها.
- **التكامل:** المخططات مترابطة: `01` (ماذا يحدث) ← `02`/`03` (البنية) ← `04a-04f` (كيف يحدث) ← `05a/05b` (التحقق) ← `07` (الحالات) ← `08`/`09`/`06` (المكونات/النشر/الهندسة)، ومصفوفة التتبع في §11 تربط الكل بالمتطلبات والكود.
- **توافق عالمي معروف (قيود صريحة):** ERD بـ Mermaid (وليس UML) كما قرر المشروع؛ وثيقة العمارة على شكل مخطط طبقيات وليست AD كاملة ببنية ISO/IEC 42010؛ وأرقام المتطلبات في المصفوفة مشتقة ذاتيًا لغياب وثيقة متطلبات رسمية في `المتطلبات الخارجية/`.
