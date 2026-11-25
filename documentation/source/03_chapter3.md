<!-- CHAPTER:3|الفصل الثالث: تحليل المتطلبات والنمذجة|Requirements Analysis and Modeling -->

## 3.1 مقدمة

يُقصد بالمتطلبات الوظيفية التي يجب أن يؤديها النظام، وبالمتطلبات غير الوظيفية الخصائص التي تحدد جودة أدائه. ويُعد توثيق المتطلبات خطوة أساسية لأنها مرجع القبول في مراحل التصميم والتنفيذ والاختبار، ويوصي معيار IEEE Std 830-1998 بتمييز كل متطلب بمعرّف واضح ووصف قابل للتحقق [13]. اعتمد هذا الفصل على تسعة وثلاثين متطلباً وظيفياً تفصيلياً موزّعة على أحد عشر باباً، وربط كل متطلب بالصفحات والخدمات والجداول والاختبارات الداعمة له.

تُستخدم لغة UML لتمثيل الفاعلين وحالات الاستخدام، ومخطط العلاقات (ERD) لتمثيل الكيانات، ومخططات التسلسل والنشاط والحالات لتمثيل السلوك الديناميكي. جميع المخططات المدرجة مأخوذة من مجلد `uml-exhaustive/` المصدر، وليست رسوماً تقديرية، وتُراجع أسماء الكيانات والدوال مقابل `supabase/schema.sql` و`src/services/`.

## 3.2 أصحاب المصلحة وأدوار المستخدمين

يُعرّف النظام أربعة فاعلين: الزائر العام (Visitor) الذي يصل إلى الصفحات العامة دون مصادقة، والمشارك (attendee)، والمنظم (organizer)، والمسؤول (admin). وتشتق الأدوار الثلاثة الأخيرة من ثابت `ROLES` في `src/constants.ts`، بينما تُفرض حدود الوصول فعلياً عبر `ProtectedRoute` و`PublicRoute` في `src/routes/` وعبر سياسات `RLS` في قاعدة البيانات.

Table 3-1: EventFlow User Roles and Main Permissions

| Role | Main permissions | Primary interface |
| --- | --- | --- |
| Visitor | تصفح الفعاليات العامة المنشورة وتفاصيلها، واستخدام المساعد الذكي، وإنشاء حساب أو طلب استعادة كلمة المرور | `/`، `/events`، `/events/:id`، `/login`، `/register` |
| Attendee | التسجيل وإلغاء التسجيل، عرض التذكرة، الانضمام للمحادثة، تقديم التقييم، عرض الإشعارات، الانضمام للاجتماع الإلكتروني | `/events/:id/evaluate`، `/dashboard/tickets/:id`، `/dashboard/notifications` |
| Organizer | إنشاء الفعاليات وتعديلها ونشرها وأرشفتها ونسخها، إدارة الجلسات والتسجيلات والحضور والدعوات والتكاليف والتقييمات والمحادثات | `/dashboard/events/*`، `/dashboard/events/:eventId/*` |
| Admin | إدارة المستخدمين والأدوار والفئات والمواقع والملفات والإعدادات، وتعيين المنظمين، وعرض التقارير ومركز الأمان والبث العام وطلبات إعادة التعيين | `/dashboard/admin/*`، `/dashboard/security`، `/dashboard/event-requests` |

تجدر الإشارة إلى أن أكثر المسارات محمية بدور أو أكثر، وأن بعض المسارات مثل `/dashboard/profile` و`/dashboard/notifications` متاحة لأي مستخدم مصادَّق. كما توجد تمييزات دقيقة في قاعدة البيانات؛ فـ `events.organizer_id` يشير إلى `profiles.id`، بينما `event_organizers.user_id` و`chat_channels.organizer_id` يشيران إلى `users.id`، وهو ما يُوثَّق في ملحق قاعدة البيانات لتجنب الخلط عند التوسعة.

## 3.3 المتطلبات الوظيفية

### 3.3.1 المصادقة وإدارة الحسابات

- **FR-01.1:** تسجيل حساب جديد بالبريد وكلمة المرور والاسم عبر `register_user`، مع تعيين دور `attendee` افتراضياً.
- **FR-01.2:** تسجيل الدخول عبر `authenticate_user` مع تحقق كلمة المرور على الخادم باستخدام bcrypt، ودعم مسار توافق SHA-256 عند غياب الدالة (`PGRST202`).
- **FR-01.3:** طلب إعادة تعيين كلمة المرور عبر `request_password_reset` وإتمامها عبر `reset_password_with_token` مع إبطال جلسات الجهاز.
- **FR-01.4:** استعادة الحساب المحذوف خلال نافذة السماح المحددة بـ `VITE_ACCOUNT_DELETION_GRACE_DAYS` أو 30 يوماً افتراضياً.
- **FR-01.5:** تغيير كلمة المرور وإدارة الملف الشخصي من `ChangePassword.tsx` و`Profile.tsx`.
- **FR-01.6:** إنشاء جلسة جهاز عند الدخول، وعرضها وإبطالها عبر `list_user_sessions` و`revoke_session` و`revoke_session_by_id` و`revoke_other_sessions`.
- **FR-01.7:** منع تخمين كلمات المرور بحد خمس محاولات خلال خمس عشرة دقيقة عبر `auth_attempts`، وحد عميل إضافي في `rateLimit.ts`.

الأدلة: `src/services/authService.ts`، `accountService.ts`، `passwordResetService.ts`، `deviceSessionService.ts`، `supabase/schema.sql`، `src/pages/Login.tsx`، `Register.tsx`، `ForgotPassword.tsx`، `ResetPassword.tsx`، `RestoreAccount.tsx`.

### 3.3.2 إدارة الفعاليات

- **FR-02.1:** إنشاء فعالية وتعديلها وحفظها كمسودة (`draft`) مع العنوان والوصف والفئة والموقع والسعة والموعد وموعد إغلاق التسجيل ونوع الفعالية وخصوصيتها.
- **FR-02.2:** نشر الفعالية إلى `published` وإلغاء النشر وإرشفتها إلى `archived` عبر `updateEventStatus`.
- **FR-02.3:** نسخ الفعالية كقالب جديد، وحذفها منطقياً عبر حقل `deleted_at` بدل الحذف المادي.
- **FR-02.4:** دعم الفعاليات `in_person` و`online` و`hybrid`، وتوليد رابط اجتماع للفعاليات الإلكترونية مع ضبط وقت الظهور.
- **FR-02.5:** إنشاء طلب فعالية جديد ومراجعته أو تحديثه من خلال `event_requests` وصفحات `EventRequests` و`EventRequestForm`.
- **FR-02.6:** تعيين أكثر من منظم للفعالية مع منظم أساسي عبر `event_organizers` وصفحة `EventOrganizers`.

الأدلة: `src/pages/Events.tsx`، `EventDetail.tsx`، `EventForm.tsx`، `EventManagement.tsx`، `EventMeeting.tsx`، `EventRequests.tsx`، `src/services/eventService.ts`، `eventRequestService.ts`، `meetingService.ts`.

### 3.3.3 التسجيل وقائمة الانتظار

- **FR-03.1:** تسجيل المشارك في فعالية منشورة قبل موعد الإغلاق عبر `registerForEvent`، مع تحقق من نوع الفعالية وخصوصيتها.
- **FR-03.2:** وضع التسجيل في حالة `waitlisted` عند اكتمال السعة C، ثم ترقيته تلقائياً إلى `confirmed` عند تحرير مقعد عبر المشغّل `notify_waitlist_promotion`.
- **FR-03.3:** إلغاء التسجيل من المشارك أو المنظم مع تحرير المقعد وتحديث قائمة الانتظار.
- **FR-03.4:** إنشاء روابط دعوة فريدة للفعاليات الخاصة عبر `invitation_links`، والتحقق من تطابق البريد واستهلاك الرمز بعد أول استخدام.
- **FR-03.5:** إدارة حالات التسجيل المعلنة `confirmed` و`cancelled` و`waitlisted`؛ أما القيمة `pending` فهي معرّفة في الثوابت ولا تُخزَّن كحالة فعلية في مخطط قاعدة البيانات.

الأدلة: `src/pages/RegistrationManagement.tsx`، `InvitationManagement.tsx`، `src/services/registrationService.ts`، `invitationService.ts`، `eventService.ts`، `supabase/schema.sql`.

### 3.3.4 التذاكر والتحقق من الحضور

تُصدر التذكرة لكل تسجيل مؤكد برمز فريد يبدأ بـ `EF-`، وتُشفَّر حمولتها لتتضمن نسخة الحمولة `v` والرمز ومعرّف الفعالية ومعرّف التسجيل وطريقة الحضور. ويُعرض الرمز بصيغة QR باستخدام مكتبة `qrcode`، ويُفحص بكاميرا الجهاز عبر `html5-qrcode`، ثم تُتحقق الحمولة مقابل بيانات التذكرة قبل تسجيل الحضور. ويستند شكل الرمز إلى المعيار ISO/IEC 18004:2015 [14].

- **FR-04.1:** توليد تذكرة فريدة مرتبطة بالتسجيل، ومنع تكرار الرمز.
- **FR-04.2:** عرض التذكرة وتنزيل صورة الرمز من صفحة `TicketDetail`.
- **FR-04.3:** فحص الرمز والتحقق من تطابق `eventId` و`registrationId` والرمز، مع رفض الحمولة المعدّلة.
- **FR-04.4:** تسجيل `check_in` عند الدخول وتحويل حالة التذكرة إلى `used`، وتسجيل `check_out` عند الانصراف.
- **FR-04.5:** رفض التذكرة المستخدمة أو غير الصالحة أو التابعة لفعالية أخرى مع سبب واضح.
- **FR-04.6:** دعم الإدخال اليدوي للحضور والحضور التلقائي للفعاليات الإلكترونية عبر `markAutoAttendance`.

الأدلة: `src/services/ticketService.ts`، `ticketCode.ts`، `attendanceService.ts`، `src/components/QrScanner.tsx`، `src/pages/TicketDetail.tsx`، `AttendanceManagement.tsx`.

### 3.3.5 الجلسات والمتحدثون

- **FR-05.1:** إنشاء جلسات داخل الفعالية بالعنوان والوصف ووقت البدء والانتهاء والقاعة.
- **FR-05.2:** إضافة متحدثين إلى الجلسة مع الاسم والسيرة والصورة، وربطهم بجدول `speakers`.
- **FR-05.3:** عرض الجدول للمشاركين ضمن تفاصيل الفعالية وصفحة `ScheduleManagement`.

الأدلة: `src/pages/ScheduleManagement.tsx`، `src/services/sessionService.ts`، جداول `sessions` و`speakers`.

### 3.3.6 التقييمات والتغذية الراجعة

- **FR-06.1:** إنشاء استبيان بالعنوان ونوع القياس `numeric` أو `stars` وخصوصية `secret` أو `public`.
- **FR-06.2:** إضافة أسئلة من نوع اختيار متعدد أو نص حر مع الخيارات وترتيب العرض.
- **FR-06.3:** منع أكثر من إرسال واحد لكل مشارك عبر القيد `UNIQUE(evaluation_id, attendee_id)` والدالة `submit_evaluation`.
- **FR-06.4:** اشتراط تسجيل مؤكد وحضور فعلي قبل قبول الإرسال، وعرض النتائج المجمعة أو الفردية بحسب إعداد الخصوصية.
- **FR-06.5:** السماح بإرسال مراجعة حرة بتقييم وتعليق، والرد عليها من المنظم عبر `feedbackService`.

الأدلة: `src/pages/EventEvaluation.tsx`، `EvaluationManagement.tsx`، `FeedbackManagement.tsx`، `src/services/evaluationService.ts`، `feedbackService.ts`، `supabase/schema.sql`.

### 3.3.7 المحادثات والإشعارات

- **FR-07.1:** إنشاء قناة عامة لكل فعالية والتحقق من عدم تكرارها عبر فهرس فريدة جزئي.
- **FR-07.2:** إنشاء قنوات خاصة ثنائية بين المشارك والمنظم مع منع التكرار لكل ثنائي.
- **FR-07.3:** إرسال الرسائل وعرض السجل مع اسم المرسل ودوره، والاشتراك في تحديثات Realtime.
- **FR-07.4:** توليد إشعارات لأنماط متعددة تشمل `registration_confirmation` و`event_reminder` و`waitlist_promotion` و`chat_message` و`evaluation` وغيرها، مع رابط وجهة وحالة قراءة.
- **FR-07.5:** إرسال رسائل إدارية عامة عبر `adminMessageService` وصفحة `Broadcast`.

الأدلة: `src/pages/EventChat.tsx`، `Notifications.tsx`، `Broadcast.tsx`، `src/components/chat/*`، `src/services/chatService.ts`، `notificationService.ts`، `adminMessageService.ts`.

### 3.3.8 التقارير والتحليلات

- **FR-08.1:** عرض مؤشرات عدد المستخدمين والفعاليات والتسجيلات المؤكدة والحضور والتغذية الراجعة والتكاليف في لوحة `Dashboard`.
- **FR-08.2:** عرض تقارير تفصيلية قابلة للتصفية حسب الفعالية والحالة والفترة في `Reports.tsx`.
- **FR-08.3:** تصدير البيانات إلى XLSX وPDF وCSV عبر `exportService` مع الحفاظ على أعمدة التقرير.
- **FR-08.4:** عرض تقارير المساعد الذكي وإحصاءات التسجيل عبر أداة `get_event_stats`.

الأدلة: `src/pages/Dashboard.tsx`، `Reports.tsx`، `src/services/dashboardService.ts`، `reportsService.ts`، `exportService.ts`.

### 3.3.9 الشؤون المالية والحملات

- **FR-09.1:** تسجيل بنود التكاليف بوجهيها `planned` و`actual` مع الصنف والكمية وسعر الوحدة وحساب الإجمالي.
- **FR-09.2:** إدارة مصادر التمويل والمصروفات واعتمادها عبر `financeService` وصفحة `Finance`.
- **FR-09.3:** إنشاء حملات بريدية بحالات `draft` و`scheduled` و`sending` و`sent` و`failed` و`cancelled`، مع محاكاة الإرسال افتراضياً.
- **FR-09.4:** إدارة الجمهور (audience) واستهدافه في الحملات.

الأدلة: `src/pages/EventCosts.tsx`، `Finance.tsx`، `Campaigns.tsx`، `Audience.tsx`، `src/services/costService.ts`، `financeService.ts`، `campaignService.ts`.

### 3.3.10 الإدارة والأمان وطلبات الفعاليات

- **FR-10.1:** إدارة المستخدمين وعرض التفاصيل والإيقاف والتفعيل وتعيين صلاحية `manages_all_events`.
- **FR-10.2:** إدارة الفئات والمواقع والملفات وإعدادات النظام وقوالب البريد.
- **FR-10.3:** مراجعة طلبات الفعاليات بحالات `pending` و`reviewing` و`approved` و`rejected` و`needs_info`.
- **FR-10.4:** إدارة الحظر بنطاقات `global` و`event` و`category` عبر `banService`.
- **FR-10.5:** عرض سجل التدقيق ومركز الأمان وجلسات الأجهزة وتغيير كلمة المرور.
- **FR-10.6:** فرض سياسات `RLS` و grants على الجداول، وحماية الأعمدة الحساسة مثل `password_hash` و`device_sessions.token` و`password_reset_tokens`.

الأدلة: `src/pages/UserManagement.tsx`، `UserDetail.tsx`، `Bans.tsx`، `SecurityCenter.tsx`، `SystemSettings.tsx`، `CategoryManagement.tsx`، `VenueManagement.tsx`، `FileManagement.tsx`، `PasswordResets.tsx`، `EventRequests.tsx`، `supabase/schema-part2-security.sql`.

### 3.3.11 التعريب وإمكانية الوصول

- **FR-11.1:** توفير واجهة عربية كاملة مع اتجاه RTL عبر `src/i18n/ar.ts` و`LanguageContext`.
- **FR-11.2:** التبديل بين العربية والإنجليزية مع حفظ الاختيار، وتنسيق التواريخ والأرقام حسب اللغة.
- **FR-11.3:** دعم الثيمات الفاتحة والداكنة عبر `ThemeContext`، وتصميم متجاوب مع أحجام الشاشات.
- **FR-11.4:** عرض رسائل خطأ مفهومة عند فشل الاتصال بقاعدة البيانات عبر `supabaseErrors.ts` و`sonner`.

الأدلة: `src/i18n/`، `src/contexts/`، `src/components/ui/`، `src/index.css`.

Table 3-2: Functional Requirements Summary

| ID | Module | Primary actor | Main evidence |
| --- | --- | --- | --- |
| FR-01 | Authentication and accounts | Visitor / Attendee | `authService.ts`, `schema.sql`, `Login.tsx`, `Register.tsx` |
| FR-02 | Event management | Organizer / Admin | `eventService.ts`, `EventForm.tsx`, `EventManagement.tsx` |
| FR-03 | Registration and waitlist | Attendee / Organizer | `registrationService.ts`, `eventService.ts`, `notify_waitlist_promotion` |
| FR-04 | Ticketing and check-in | Attendee / Organizer | `ticketCode.ts`, `ticketService.ts`, `attendanceService.ts` |
| FR-05 | Sessions and speakers | Organizer | `sessionService.ts`, `ScheduleManagement.tsx`, `sessions`, `speakers` |
| FR-06 | Evaluations and feedback | Attendee / Organizer | `evaluationService.ts`, `feedbackService.ts`, `submit_evaluation` |
| FR-07 | Chat and notifications | All authenticated roles | `chatService.ts`, `notificationService.ts`, Realtime |
| FR-08 | Reports and analytics | Admin / Organizer | `dashboardService.ts`, `reportsService.ts`, `exportService.ts` |
| FR-09 | Finance and campaigns | Organizer / Admin | `costService.ts`, `financeService.ts`, `campaignService.ts` |
| FR-10 | Administration and security | Admin | `userService.ts`, `auditService.ts`, `schema-part2-security.sql` |
| FR-11 | Localization and accessibility | All roles | `src/i18n/`, `LanguageContext.tsx`, `ThemeContext.tsx` |

## 3.4 المتطلبات غير الوظيفية

Table 3-3: Non-Functional Requirements and Implementation Evidence

| Quality attribute | Requirement | Implementation evidence |
| --- | --- | --- |
| Security | حماية كلمات المرور بتجزئة bcrypt بملح فريد، ومنع قراءة الأعمدة الحساسة من العميل | `authenticate_user`, `register_user`, `REVOKE` في `schema-part2-security.sql` |
| Usability | واجهة عربية RTL بمصطلحات ثابتة ورسائل خطأ مفهومة وتصميم متجاوب | `src/i18n/ar.ts`, `src/contexts/`, `src/components/ui/`, `sonner` |
| Performance | تحميل صفحات المسارات عند الطلب، وفهارس على Foreign Keys والحقول المكثفة الاستعلام، دون ادعاء زمن استجابة مقيس | `namedLazy` في `src/routes/index.tsx`, `2026-11-19_index_maintenance.sql` |
| Reliability | قيود تفرد و مفاتيح أجنبية وعمليات حذف متتالية، ومنع تكرار الإرسال والقنوات | `UNIQUE(evaluation_id, attendee_id)`, فهارس `chat_channels` الجزئية، FKs في `schema.sql` |
| Maintainability | فصل Pages عن Services، وأنواع TypeScript مشددة، وخدمات ذات مسؤولية واحدة | `src/services/*.ts`, `src/types/`, `tsconfig.app.json` |
| Scalability | بنية عميل/خادم تعتمد Supabase، وسطح RPC يمكن استهلاكه من واجهات أخرى | `@supabase/supabase-js`, `supabase/functions/`, `09_deployment.mmd` |
| Portability | حزم ويب قياسية قابلة للنشر على أي مستضيف ملفات ثابتة مع SPA fallback | `npm run build`, `dist/`, `README.md` |
| Localization | دعم كامل للعربية والإنجليزية وتنسيق التواريخ والأرقام | `src/i18n/formatters.ts`, `runtimeLocale.ts`, `messageLocalizer.ts` |

## 3.5 نمذجة حالات الاستخدام

يُظهر الشكل 3-1 الفاعلين الأربعة وأهم حالات الاستخدام، ويُستند إلى الملف `uml-exhaustive/EventFlow-Core-UseCases.png` المصدر المولّد من `01_use_case.puml` الذي يضم 48 حالة استخدام. وتُوضّح العلاقات أن `Attendee` و`Organizer` يرثان من `Visitor`، وأن `Admin` يرث من `Organizer`، بما يعكس نموذج RBAC. كما تظهر أنظمة خارجية مثل Supabase وLM Studio والكاميرا وبوابة البريد بحسب ما هو موثق في حزمة UML.

<!-- IMAGE:assets/fig3-1.png -->
Caption: Figure 3-1: EventFlow Core Use Case Diagram

يُكمل الجدول 3-2 وصف المتطلبات، بينما يُفصّل الجدول 3-6 الربط بينها وبين الصفحات والخدمات والاختبارات. وفيما يلي أوصاف مختارة لأهم حالات الاستخدام بصيغة أكاديمية:

**حالة استخدام: التسجيل في فعالية (UC10)**

- **Actor:** Attendee،مع مشاركة Visitor عند إنشاء الحساب.
- **Preconditions:** وجود فعالية منشورة وغير محذوفة، وعدم تجاوز موعد إغلاق التسجيل، ووجود حساب مصادَّق أو إمكانية إنشاء حساب.
- **Main Flow:** يفتح المشارك صفحة الفعالية → يتحقق النظام من الحالة والموعد والسعة → يُرسل طلب التسجيل → يُنشأ سجل `confirmed` وتُصدر تذكرة → يُرسل إشعار تأكيد.
- **Alternative Flow:** إذا اكتملت السعة C يُنشأ السجل بحالة `waitlisted`، ثم يُرقَّى تلقائياً عند تحرير مقعد عبر المشغّل `notify_waitlist_promotion`. أما الفعالية الخاصة فيُطلب رمز دعوة صالح قبل إتمام التسجيل.
- **Postconditions:** وجود تسجيل مرتبط بالمستخدم والفعالية، وتذكرة فريدة إذا كان التسجيل مؤكداً، وإشعار محفوظ في `notifications`.

**حالة استخدام: التحقق من الحضور (UC25)**

- **Actor:** Organizer أو Admin.
- **Preconditions:** صلاحية الوصول إلى صفحة `AttendanceManagement`، وتذكرة `_qr` صالحة معروضة على جهاز الحاضر.
- **Main Flow:** فتح الماسح → قراءة الحمولة → فك ترميزها والتحقق من `v` و`code` و`eventId` و`registrationId` → البحث عن التذكرة → التحقق من حالة التسجيل → تسجيل `check_in` وتحويل التذكرة إلى `used`.
- **Alternative Flow:** تُرفض التذكرة المستخدمة أو غير الصالحة أو التابعة لفعالية أخرى برسالة سبب واضح. ويُدعم الإدخال اليدوي والحضور التلقائي للفعاليات الإلكترونية.
- **Postconditions:** سجل حضور واحد على الأقل، وتحديث حالة التذكرة، وعدم قبول نفس الرمز مرة ثانية.

**حالة استخدام: إنشاء فعالية (UC20)**

- **Actor:** Organizer،وقد يكون Admin.
- **Preconditions:** دور `organizer` أو `admin`، ووجود فئة وموقع صالحين للفعاليات الحضورية.
- **Main Flow:** إدخال البيانات الأساسية → اختيار النوع والخصوصية → تحديد السعة والمواعيد → حفظ المسودة → النشر إلى `published`.
- **Alternative Flow:** يُمكن حفظ الفعالية كمسودة، أو نسخها، أو أرشفتها، أو إلغاء نشرها، أو تعيين منظمين إضافيين.
- **Postconditions:** صف فعالية في `events`، وعلاقات في `event_organizers` عند تعيين منظمين، وظهور الفعالية في التصفح العام إذا كانت `public` و`published`.

**حالة استخدام: إرسال تقييم (UC15)**

- **Actor:** Attendee.
- **Preconditions:** تسجيل `confirmed` وحضور مسجل، ووجود استبيان مرتبط بالفعالية.
- **Main Flow:** فتح نموذج التقييم → الإجابة على الأسئلة → استدعاء RPC `submit_evaluation` → حفظ الإرسال والإجابات → تحديث الإحصاء.
- **Alternative Flow:** يُرفض الإرسال المكرر أو إرسال من غير الحاضرين أو من تسجيل غير مؤكد.
- **Postconditions:** صف واحد في `evaluation_submissions` لكل مشارك لكل استبيان، وإجابات مرتبطة بالأسئلة.

**حالة استخدام: إدارة المستخدمين (UC40)**

- **Actor:** Admin.
- **Preconditions:** دور `admin` وجلسة صالحة.
- **Main Flow:** عرض قائمة المستخدمين → فتح تفاصيل مستخدم → إيقاف أو تفعيل الحساب → تسجيل العملية في `audit_logs`.
- **Alternative Flow:** رفض الوصول إذا كان المستخدم الحالي غير `admin`، أو عرض رسالة خطأ عند فشل الاستدعاء.
- **Postconditions:** تحديث حالة `suspended`، وإبطال جلسات المستخدم عند الإيقاف، ووجود سجل تدقيق.

**حالة استخدام: سؤال المساعد الذكي (UC03)**

- **Actor:** Visitor أو أي مستخدم مصادَّق.
- **Preconditions:** توفر خادم LM Studio محلي في المسار الفعلي، وإمكانية الوصول إلى واجهة البيانات.
- **Main Flow:** إدخال سؤال → تحديد الحاجة إلى أداة بيانات → استدعاء إحدى الأدوات الست → إعادة النتائج → صياغة إجابة داخل واجهة المحادثة.
- **Alternative Flow:** إذا تعذّر الاتصال بخادم النموذج تظهر رسالة خطأ، ويُرفض السؤال خارج نطاق الفعاليات والمواقع والفئات.
- **Postconditions:** إجابة مستندة إلى بيانات قاعدة البيانات أو رسالة رفض/خطأ واضحة.

## 3.6 نمذجة البيانات ومخطط ERD

يُميّز في قاعدة البيانات بين الكيانات الأساسية التي تمثل دورة حياة الفعالية والكيانات المساندة التي تدعم الإدارة والأمان. ويُظهر مخطط ERD المأخوذ من `uml-exhaustive/final/svg/03_erd.svg` ثلاثين جدولاً، وكل علاقة فيه مقابلة لقيد Foreign Key فعلي في `supabase/schema.sql`. ويُعرض المخطط في الفصل الرابع ضمن تصميم قاعدة البيانات، ويُلخَّص في الجدول 3-4.

Table 3-4: Main EventFlow Data Entities

| Entity | Purpose |
| --- | --- |
| `users` / `roles` / `profiles` | الحسابات والأدوار والملفات الشخصية وصلاحية إدارة كل الفعاليات |
| `categories` / `venues` | تصنيف الفعاليات وأماكن الانعقاد والسعة والمرافق |
| `events` / `event_images` / `event_organizers` | بيانات الفعالية وصورها والعلاقة متعددة المنظمين |
| `sessions` / `speakers` | البرنامج الزمني والجلسات والمتحدثون |
| `registrations` | طلبات المشاركة وحالاتها وربطها بالمستخدم والفعالية |
| `tickets` | التذاكر الفريدة وحالتها وارتباطها بالتسجيل |
| `attendance` | تسجيل الدخول والخروج ومصدر الحضور |
| `invitation_links` | دعوات الفعاليات الخاصة ورموزها واستهلاكها |
| `evaluations` / `evaluation_questions` / `evaluation_submissions` / `evaluation_answers` | الاستبيانات وإجابات المشاركين |
| `event_costs` / `finance` | التكاليف المخططة والفعلية والمصادر المالية |
| `notifications` / `chat_channels` / `chat_messages` | الإشعارات والمحادثات العامة والخاصة |
| `audit_logs` / `device_sessions` / `auth_attempts` / `password_reset_tokens` | التدقيق وجلسات الأجهزة وحدود المحاولات ورموز الاستعادة |

## 3.7 مخططات التسلسل

تُظهر مخططات التسلسل الستة ترتيب الرسائل بين الفاعل والواجهة والخدمات وقاعدة البيانات، مع إبراز مسارات النجاح والفشل. مصدر هذه المخططات هو `uml-exhaustive/04a_sequence_auth.mmd` حتى `04f_sequence_chatbot.mmd`.

**المصادقة (04a):** يرسل المستخدم بيانات الدخول إلى `authService`، الذي يستدعي RPC `authenticate_user` بعد فحص `RateLimiter`. عند نجاح التحقق تُنشأ جلسة جهاز ويُحفظ token محلياً، بينما يُسجَّل فشل المحاولة في `auth_attempts`. وإذا عاد RPC بالخطأ `PGRST202` يُستخدم المسار القديم للتحقق من تجزئة SHA-256.

**التسجيل (04b):** يرسل المشارك طلب التسجيل إلى `eventService`، الذي يتحقق من السعة والموعد والخصوصية قبل الإدراج. عند اكتمال السعة يُدرج السجل بحالة `waitlisted`، وعند تحرير مقعد ينفذ المشغّل ترقية أول مسجل في الانتظار وينشئ إشعاراً.

**فحص الحضور (04c):** يقرأ `QrScanner` الحمولة، ويستدعي `attendanceService.findTicketByCode` ثم `checkIn`. ويُرفض الطلب إذا كانت التذكرة مستخدمة أو غير صالحة أو مرتبطة بتسجيل غير مؤكد، بينما يُسجَّل `check_out` لاحقاً.

**المحادثة (04d):** تضمن الخدمة وجود قناة عامة أو خاصة فريدة، ثم تدرج الرسالة ويبثّ Supabase Realtime التحديث للأطراف المشتركة.

**التقييم (04e):** ينشئ المنظم الاستبيان والأسئلة، ويتحقق النظام من `hasSubmitted` قبل استدعاء `submit_evaluation`، ويرفض الإرسال المكرر أو غير المؤكد على مستوى الخادم.

**المساعد الذكي (04f):** يرسل المستخدم سؤالاً إلى `useChat`، الذي يتواصل مع LM Studio عبر `/lmstudio`، ثم ينفّذ الأدوات الست مباشرة عبر REST من المتصفح، وتُعاد النتائج إلى النموذج لصياغة الإجابة. وتُذكر دالة `supabase/functions/chatbot/index.ts` كمسار تصميمي بديل غير مستخدم من الواجهة الحالية.

تُدرج المخططات الفعلية أدناه دون تسميات قوائم إضافية، التزاماً بعدد التسميات المعتمد في القالب:

<!-- IMAGE:assets/seq_auth.png -->

<!-- IMAGE:assets/seq_registration.png -->

<!-- IMAGE:assets/seq_checkin.png -->

<!-- IMAGE:assets/seq_chat.png -->

<!-- IMAGE:assets/seq_evaluation.png -->

<!-- IMAGE:assets/seq_chatbot.png -->

## 3.8 مخططات الأنشطة

يغطي مخطط النشاط الأول (`05a_activity_registration.mmd`) مسار التسجيل كاملاً: التحقق من النشر والموعد، والتمييز بين فعالية عامة وأخرى خاصة تتطلب رمز دعوة، والتحقق من تكرار التسجيل، ثم فحص السعة C، ثم إصدار التذكرة أو الإدراج في قائمة الانتظار، مع مسارات الفشل لكل شرط. ويغطي المخطط الثاني (`05b_activity_checkin.mmd`) مسار الدخول عبر الكاميرا أو الإدخال اليدوي، وأعطال التذكرة الثلاثة، وتسجيل الانصراف، والحضور التلقائي للفعاليات الإلكترونية.

<!-- IMAGE:assets/act_registration.png -->

<!-- IMAGE:assets/act_checkin.png -->

## 3.9 مخططات الحالات

يُوحّد `uml-exhaustive/07_state_machine.mmd` آلات حالات التسجيل والتذكرة والحضور والفعالية والجلسة والتقييم والدعوة. ويُبيّن الجدول 3-5 الحالات الأساسية وانتقالاتها كما هي مطبقة في الشيفرة والمخطط القاعدي.

Table 3-5: Main Event, Registration and Ticket States

| Entity | States | Transitions to document |
| --- | --- | --- |
| `events` | `draft`, `published`, `archived` | `draft → published` عند النشر، `published → draft` عند إلغاء النشر، `published → archived` عند الأرشفة |
| `registrations` | `confirmed`, `waitlisted`, `cancelled` | `waitlisted → confirmed` عند الترقية، `confirmed → cancelled` عند الإلغاء |
| `tickets` | `valid`, `used`, `invalid` | `valid → used` عند الفحص الناجح أو الحضور التلقائي، `valid → invalid` عند الإبطال |
| `attendance` | لا حضور، `checked_in`, `checked_out` | الإدراج عند الدخول، ثم تحديث وقت الانصراف |
| `event_requests` | `pending`, `reviewing`, `approved`, `rejected`, `needs_info` | انتقالات المراجعة حسب قرار المسؤول |

<!-- IMAGE:assets/state_machine.png -->

تُظهر آلة الحالات قيدين مهمين: لا تنتهي صلاحية جلسة الجهاز صراحةً في التنفيذ الحالي، إذ يُحدَّث `last_active_at` عند استدعاء `get_session_user` فقط؛ ولا تُخزَّن حالة `pending` للتسجيل في المخطط القاعدي رغم ورودها في الثوابت. ويُسجَّل هذان الأمران ضمن القيود في الفصل السادس.

## 3.10 مصفوفة تتبع المتطلبات

يربط الجدول 3-6 بين مجموعات المتطلبات والصفحات والخدمات والجداول والاختبارات. وتُستخدم المعرّفات FR-01 إلى FR-11 كما وردت في قالب التوثيق المعتمد وجدول حالات الاختبار، لضمان اتساق الترقيم بين التحليل والتنفيذ والنتائج.

Table 3-6: Requirements Traceability Summary

| Requirement group | Primary pages | Primary services / database | Tests |
| --- | --- | --- | --- |
| FR-01 Authentication | `Login`, `Register`, `ForgotPassword`, `ResetPassword`, `RestoreAccount` | `authService`, `passwordResetService`, `auth_attempts` | `authService.test.ts`، TC-01…TC-05 |
| FR-02 Event management | `Events`, `EventForm`, `EventManagement`, `EventMeeting` | `eventService`, `events`, `event_organizers` | `eventService.test.ts`، TC-06…TC-08 |
| FR-03 Registration and waitlist | `RegistrationManagement`, `InvitationManagement` | `registrationService`, `invitationService`, `notify_waitlist_promotion` | TC-09…TC-11 |
| FR-04 Ticketing and check-in | `TicketDetail`, `AttendanceManagement` | `ticketCode`, `ticketService`, `attendanceService` | `ticketCode.test.ts`، TC-12…TC-14 |
| FR-05 Sessions and speakers | `ScheduleManagement` | `sessionService`, `sessions`, `speakers` | TC-15 |
| FR-06 Evaluations and feedback | `EventEvaluation`, `EvaluationManagement`, `FeedbackManagement` | `evaluationService`, `feedbackService`, `submit_evaluation` | TC-16، TC-17 |
| FR-07 Chat and notifications | `EventChat`, `Notifications`, `Broadcast` | `chatService`, `notificationService`, `chat_channels` | TC-18، TC-19 |
| FR-08 Reports and analytics | `Dashboard`, `Reports` | `dashboardService`, `reportsService`, `exportService` | `dashboardService.test.ts`، TC-20، TC-21 |
| FR-09 Finance and campaigns | `EventCosts`, `Finance`, `Campaigns`, `Audience` | `costService`, `financeService`, `campaignService` | TC-22 |
| FR-10 Administration and security | `UserManagement`, `SecurityCenter`, `Bans`, `SystemSettings` | `userService`, `auditService`, `RLS`, `rateLimit` | TC-23، TC-24 |
| FR-11 Localization and accessibility | `src/i18n/*`, `src/contexts/*` | `LanguageContext`, `ThemeContext`, `formatters` | `i18n.test.ts`، `formatters.test.ts`، `messageLocalizer.test.ts`، TC-25 |

تُكمل الاختبارات الآلية الموجودة في المستودع هذه المصفوفة، منها اختبارات `eventDates.test.ts` و`settingsService.test.ts`، إلى جانب اختبارات الخدمات المذكورة أعلاه. وتُسجَّل النتائج الفعلية لهذه الاختبارات في الفصل الخامس والملحق D دون ادعاء نتائج لم تُرصد.
