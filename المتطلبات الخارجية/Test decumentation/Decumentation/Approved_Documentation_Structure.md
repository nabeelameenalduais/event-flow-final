# تقرير المقارنة والهيكل المعتمد لتوثيق مشروع EventFlow

**المشروع:** EventFlow: نظام متكامل لإدارة الفعاليات  
**الجهة:** قسم علوم الحاسوب — كلية الهندسة وتقنية المعلومات — جامعة الجيل الجديد  
**الملف الناتج:** `EventFlow_Approved_Documentation_Template.docx`  
**الملف المرجعي للهيكل:** `Approved_Documentation_Structure.md`

---

## 1. ملخص تنفيذي

تم بناء قالب توثيق جديد لمشروع EventFlow اعتمادًا على قالب الجامعة المرفق مع دليل مشاريع التخرج، مع الحفاظ على القالب الأصلي والدليل دون أي تعديل. القالب الجديد:

- يحتفظ بالغلاف والصفحات الأمامية الأصلية وبترتيبها.
- يصحح أنماط الكتابة لتطابق جدول التنسيق في الدليل: A4، خط Times New Roman 12 للنص، العناوين 16/14/12، تباعد 1.5، هوامش 2.5 سم مع 3 سم لجهة التجليد، تعليل الفقرات، و6 نقاط قبل/بعد.
- يستبدل محتوى LTE/SINR الوارد في القالب الأصلي بمحتوى خاص بمشروع EventFlow.
- يضيف المراجع بصيغة IEEE، والملاحق A–H، وترقيم صفحات الملاحق `A1, B1, ...`.
- يضيف فهرس محتويات تلقائيًا وقوائم الأشكال والجداول والاختصارات والرموز الرياضية.
- يضع ملاحظات تحريرية (Template Notes) أسفل كل قسم توضح ما ينبغي كتابته والملفات التي يجب الرجوع إليها.

> **ملاحظة:** الملف الحالي قالب توثيق قابل للتعبئة، وليس الوثيقة النهائية. النصوص الموجودة فيه صيغ مبدئية صحيحة البنية، ويجب استبدال العلامات والملاحظات الرمادية والصور المؤقتة قبل التسليم.

---

## 2. تقرير مقارنة: الدليل × القالب الأصلي × القالب المعتمد

### 2.1 المقارنة العامة

| المحور | ما يطلبه الدليل | حالة القالب الأصلي | ما تم في القالب المعتمد |
|---|---|---|---|
| الغلاف | غلاف بالعنوان الإنجليزي والعنوان العربي وبيانات الطلاب والمشرف والسنة | موجود، لكن الحقول نصية عامة | أُعيد بناء الغلاف بمحتوى EventFlow مع الحفاظ على التخطيط |
| الملخص | صفحة واحدة تشمل المقدمة والمشكلة والأهداف والأدوات والنتائج والخاتمة | موجود بعنوان Summary | كُتب ملخص EventFlow في صفحة واحدة ويغطي العناصر المطلوبة |
| Authorization | غير مذكور في قائمة الدليل | موجود كصفحة إضافية | أُبقي كصفحة اختيارية، ولا يتعارض مع الدليل |
| الإهداء | صفحة اختيارية | موجود | موجودة |
| الشكر والتقدير | مطلوب | موجود | موجود |
| إقرار المشرف | مطلوب | موجود | موجود مع جدول توقيعات |
| لجنة الحكم والمناقشة | مطلوب | موجود باسم Examiner Committee | موجود باسم Examination Committee |
| جدول المحتويات | تلقائي | قائمة نصية قديمة/مخزنة | حقل TOC تلقائي تم تحديثه عبر Word |
| قائمة الأشكال | إن وجدت | قائمة نصية قديمة لمشروع LTE | حقل List of Figures تلقائي |
| قائمة الجداول | إن وجدت | قائمة نصية قديمة | حقل List of Tables تلقائي |
| الاختصارات | مطلوبة إن وجدت | موجودة | جدول اختصارات EventFlow |
| الرموز الرياضية | إن وجدت | موجودة | جدول رموز يستخدم في الفصول 3–6 |
| فصول المشروع | 7 فصول حسب القالب | 7 فصول، لكن المحتوى هندسي/اتصالات | 7 فصول بمحتوى EventFlow |
| صفحة غلاف لكل فصل | مطلوبة | موجودة لكن غير موحدة | صفحة غلاف موحدة لكل فصل 1–7 |
| المراجع | قائمة IEEE مرتبة حسب الظهور | **غير موجودة إطلاقًا** | 14 مرجعًا بصيغة IEEE مع استشهادات في النص |
| الملاحق | إن وجدت، وترقيم `A1, A2...` | عنوان Appendices فقط بدون محتوى | 8 ملاحق A–H مع ترقيم صفحات `A1, B1...` |
| ترقيم الصفحات | روماني للصفحات الأمامية، عربي من الفصل 1، والملاحق `A1` | غير مطبق بشكل صحيح | 19 قسمًا مع ترقيم روماني/عربي/ملاحق |
| التنسيق | 12/16/14/12، تباعد 1.5، هوامش 2.5/3، تعليل | أنماط غير متسقة (Heading 1 أزرق 22، Normal غير معرف) | أنماط موحدة ومطابقة للدليل |
| لغة الوثيقة | الإنجليزية مفضلة مع عنوان عربي | إنجليزية مع محتوى LTE | إنجليزية مع عنوان عربي وغلاف عربي |

### 2.2 الفجوات التي كانت في القالب الأصلي وتمت معالجتها

1. **غياب قسم المراجع بالكامل:** أضيف قسم References في نهاية الفصل 7، مع 14 مرجعًا IEEE واستشهادات مرقمة حسب أول ظهور.
2. **الملاحق فارغة:** أضيفت الملاحق A–H: دليل المستخدم، ملخص قاعدة البيانات، مرجع RPC/API، مصفوفة الاختبار، بيانات العرض، خطة المشروع، هيكل الكود، وضوابط الأمان والهجرة.
3. **ترقيم الملاحق:** كل ملحق قسم مستقل يبدأ من 1 مع بادئة الحرف، فتظهر الصفحات `A1, A2, B1...` أسفل الوسط.
4. **فصل 6 و7 بلا أقسام فرعية تقريبًا:** أضيفت أقسام 6.1–6.9 و7.1–7.3 مع محتوى قابل للتعبئة.
5. **محتوى LTE/SINR لا يمت للمشروع:** استُبدل بالكامل بمحتوى EventFlow المستند إلى الكود والوثائق الفعلية.
6. **أنماط غير قابلة للاستخدام:** أُعيد تعريف Normal وHeading 1–3 وCaption وReference Entry، وأضيفت أنماط صفحات الغلاف والجداول والملاحظات.
7. **فهرس المحتويات وقوائم الأشكال والجداول كانت نصوصًا ثابتة:** استُبدلت بحقول Word تلقائية وتم تحديثها.
8. **صفحات غلاف الفصول غير موحدة:** أُعيد بناء غلاف موحد لكل فصل برقم الفصل وعنوانه.
9. **الترقيم الروماني/العربي:** طُبق على مستويات الأقسام، مع إخفاء رأس/تذييل صفحة غلاف كل فصل.
10. **الاستشهادات:** أضيفت استشهادات `[1]`–`[14]` في الفصول 1–4 لتبرير ترتيب المراجع حسب الظهور.

### 2.3 ما لم يُغيَّر في القالب الأصلي

- لم يُعدَّل ملف `Graduation ProjectTamplet n.docx` نفسه.
- لم يُعدَّل ملف `دليل مشاريع التخرج.docx`.
- لم تُحذف صفحة Authorization، بل تُركت كصفحة اختيارية.
- لم تُضف ميزات غير موجودة في المشروع (مثل الدفع الإلكتروني أو تطبيق الجوال) إلى نطاق النظام؛ ذُكرت كأعمال مستقبلية أو قيود فقط.

---

## 3. الهيكل المعتمد للوثيقة

### 3.1 الصفحات الأمامية (ترقيم روماني)

| # | القسم | ما يُكتب فيه | الملفات/المصادر |
|---|---|---|---|
| 1 | الغلاف | عنوان المشروع بالإنجليزية والعربية، أسماء الطلاب وأرقامهم، المشرف، القسم، السنة | بيانات الفريق + `README.md` |
| 2 | Summary | ملخص من صفحة واحدة: المقدمة، المشكلة، الأهداف، الأدوات، النتائج، الخاتمة | `README.md`، `propusal_project/EventFlow_FivePoints.md` |
| 3 | Authorization | تفويض الجامعة بتوفير نسخ من التقرير (صفحة اختيارية) | نص القالب الأصلي |
| 4 | Dedication | إهداء قصير | نص القالب |
| 5 | Acknowledgment | شكر الله ثم المشرف والأسرة والقسم | نص القالب |
| 6 | Supervisor Certification | إقرار المشرف مع جدول أسماء الطلاب والتوقيعات | بيانات الفريق |
| 7 | Examination Committee | أسماء لجنة المناقشة والمناصب والتوقيعات | بيانات القسم |
| 8 | Table of Contents | حقل TOC تلقائي `1-3` | — |
| 9 | List of Figures | حقل TOC للأشكال | — |
| 10 | List of Tables | حقل TOC للجداول | — |
| 11 | List of Abbreviations | API, CRUD, ERD, FR, NFR, QR, RBAC, RLS, RPC, SPA, SQL, UML, UX... | `src/constants.ts`، `README.md` |
| 12 | Mathematical Notation | C, R, W, A, AR, S, V, p... | الفصول 3–6 |

**ملاحظات:**
- الترقيم الروماني يبدأ من صفحة Summary، ولا يظهر رقم على الغلاف.
- صفحة Authorization ليست مطلوبة في الدليل لكنها لا تتعارض معه؛ يمكن حذفها إذا طلب المشرف ذلك.
- لا تُدرج Summary أو Authorization في فهرس المحتويات إن رغب المشرف في فهرس يبدأ بالفصول فقط؛ حالياً هي مدرجة لأنها Heading 1.

---

### 3.2 الفصل الأول: Introduction

**صفحة الغلاف:** Chapter 1 — Introduction.

| القسم | ما يُكتب فيه | الملفات/المصادر |
|---|---|---|
| 1.1 Overview | تعريف EventFlow، الأدوار الثلاثة، نطاق النظام، دورة حياة الفعالية | `README.md`، `propusal_project/EventFlow_FivePoints.md`، `src/constants.ts` |
| 1.2 Problem Statement | تشتت البيانات بين Excel والرسائل والنماذج، ضعف قوائم الانتظار، بطء تسجيل الحضور، غياب الإحصاءات | `propusal_project/EventFlow_Analysis.md` |
| 1.3 Project Objectives | 9 أهداف مرتبطة بميزات فعلية | `README.md`، `src/routes/index.tsx` |
| 1.4 Project Scope and Limitations | ما يشمله النظام وما لا يشمله (لا دفع إلكتروني، لا تطبيق جوال أصلي، لا عمل دون اتصال) | `README.md`، `src/pages/` |
| 1.5 Project Methodology | المنهجية التكرارية/Agile، مراحل التحليل والتصميم والتنفيذ والاختبار | `propusal_project/` |
| 1.6 Report Organization | وصف الفصول 2–7 والمراجع والملاحق | هذا الملف |

**ملاحظة:** يجب استبدال الملاحظات الرمادية في 1.1–1.6 بنص نهائي مدعوم بالمراجع `[1]`–`[4]`.

---

### 3.3 الفصل الثاني: Background and Literature Review

**صفحة الغلاف:** Chapter 2 — Background and Literature Review.

| القسم | ما يُكتب فيه | الملفات/المصادر |
|---|---|---|
| 2.1 Background | مفهوم إدارة الفعاليات، التحول الرقمي، أهمية QR والحضور والتقييم | المراجع `[1]`–`[3]` |
| 2.2 Literature Review | 8–10 مصادر على الأقل: أنظمة إدارة الفعاليات، قابلية الاستخدام، الأمان، هندسة البرمجيات | المراجع `[1]`–`[7]`، `propusal_project/` |
| 2.3 Comparison of Existing Systems | مقارنة EventFlow مع Eventbrite وTicketmaster والنماذج/Excel | `README.md` + الوثائق الرسمية للمنصات |
| 2.4 Technologies Used | React 19، TypeScript، Vite 8، Tailwind 4، Radix UI، React Router 7، Supabase، PostgreSQL، Recharts، qrcode، XLSX، jsPDF، Vitest | `package.json` |
| 2.5 Summary | تلخيص الخلفية والفجوة التي يعالجها المشروع | — |

**ملاحظة:** يجب التحقق من ادعاءات المنافسين من مواقعهم الرسمية وإضافة المراجع. لا تدرج ميزة لمنصة خارجية دون مصدر.

---

### 3.4 الفصل الثالث: Requirements Analysis and Modeling

**صفحة الغلاف:** Chapter 3 — Requirements Analysis and Modeling.

| القسم | ما يُكتب فيه | الملفات/المصادر |
|---|---|---|
| 3.1 Introduction | نظرة عامة على التحليل وأدوات النمذجة | `uml-exhaustive/` |
| 3.2 Stakeholders and User Roles | Public visitor, attendee, organizer, admin | `src/constants.ts` (`ROLES`)، `src/routes/index.tsx` |
| 3.3 Functional Requirements | 11 مجموعة FR-01–FR-11 مع وصف وأمثلة ملفات | `src/pages/`، `src/services/` |
| 3.3.1 Authentication | تسجيل، دخول، استعادة كلمة المرور، استعادة الحساب، تغيير كلمة المرور | `src/pages/Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `RestoreAccount.tsx`, `ChangePassword.tsx`, `Profile.tsx`; `src/services/authService.ts`, `accountService.ts`, `passwordResetService.ts` |
| 3.3.2 Event Management | إنشاء/تعديل/نشر/أرشفة/نسخ/حذف الفعالية، فعاليات online، طلبات الفعاليات | `src/pages/Events.tsx`, `EventDetail.tsx`, `EventForm.tsx`, `EventManagement.tsx`, `EventRequests.tsx`, `EventRequestForm.tsx`, `EventMeeting.tsx`; `src/services/eventService.ts`, `eventRequestService.ts`, `meetingService.ts` |
| 3.3.3 Registration and Waiting List | تسجيل، إلغاء، قائمة انتظار، ترقية تلقائية، دعوات | `src/pages/RegistrationManagement.tsx`, `InvitationManagement.tsx`, `AttendanceManagement.tsx`; `src/services/registrationService.ts`, `invitationService.ts`, `attendanceService.ts`; `supabase/schema.sql` |
| 3.3.4 Ticketing and Check-in | QR ticket، مسح، تحقق، check-in/out | `src/pages/TicketDetail.tsx`, `AttendanceManagement.tsx`; `src/services/ticketService.ts`, `ticketCode.ts`, `attendanceService.ts`; `supabase/schema.sql` |
| 3.3.5 Sessions and Speakers | جدول الجلسات والمتحدثين | `src/pages/ScheduleManagement.tsx`; `src/services/sessionService.ts` |
| 3.3.6 Evaluations and Feedback | إنشاء تقييم، أسئلة، خصوصية، إرسال، تجميع | `src/pages/EventEvaluation.tsx`, `EvaluationManagement.tsx`, `FeedbackManagement.tsx`; `src/services/evaluationService.ts`, `feedbackService.ts`; `submit_evaluation` |
| 3.3.7 Chat and Notifications | محادثات عامة/خاصة، إشعارات، رسائل إدارية | `src/pages/EventChat.tsx`, `Notifications.tsx`, `Broadcast.tsx`, `src/components/chat/*`; `src/services/chatService.ts`, `notificationService.ts`, `adminMessageService.ts` |
| 3.3.8 Reports and Analytics | لوحات إحصائية، تقارير، تصدير | `src/pages/Dashboard.tsx`, `Reports.tsx`; `src/services/dashboardService.ts`, `reportsService.ts`, `exportService.ts` |
| 3.3.9 Finance and Campaigns | تكاليف، نفقات، مصادر تمويل، حملات بريدية | `src/pages/EventCosts.tsx`, `Finance.tsx`, `Campaigns.tsx`; `src/services/costService.ts`, `financeService.ts`, `campaignService.ts` |
| 3.3.10 Administration, Security and Event Requests | مستخدمون، أدوار، حظر، أمان، إعدادات، طلبات فعاليات | `src/pages/UserManagement.tsx`, `UserDetail.tsx`, `Bans.tsx`, `SecurityCenter.tsx`, `SystemSettings.tsx`, `CategoryManagement.tsx`, `VenueManagement.tsx`, `FileManagement.tsx`, `PasswordResets.tsx`, `Audience.tsx`; `src/services/userService.ts`, `banService.ts`, `auditService.ts`, `settingsService.ts` |
| 3.3.11 Localization and Accessibility | عربي/إنجليزي، RTL، ثيمات، استجابة | `src/i18n/ar.ts`, `en.ts`; `src/contexts/LanguageContext.tsx`, `ThemeContext.tsx`, `SettingsContext.tsx`; `src/components/ui/` |
| 3.4 Non-Functional Requirements | أمان، قابلية استخدام، أداء، موثوقية، قابلية صيانة، نقل، توسع، توطين | `src/services/rateLimit.ts`، `supabase/schema-part2-security.sql` |
| 3.5 Use Case Modeling | مخطط use case + وصف كل حالة | `uml-exhaustive/EventFlow-Core-UseCases.png`، `01_use_case.puml` |
| 3.6 Data Modeling (ERD) | ERD كامل + قاموس بيانات | `uml-exhaustive/03_erd.mmd`، `supabase/schema.sql` |
| 3.7 Sequence Diagrams | 6 مخططات تسلسل | `04a_sequence_auth.mmd` … `04f_sequence_chatbot.mmd` |
| 3.8 Activity Diagrams | تسجيل/قائمة انتظار، مسح/check-in | `05a_activity_registration.mmd`, `05b_activity_checkin.mmd` |
| 3.9 State Machine Diagrams | حالات الفعالية والتسجيل والتذكرة والطلب والحملة | `src/constants.ts`، `06_state_machine.mmd` |
| 3.10 Requirements Traceability Matrix | ربط FR بالصفحات والخدمات والجداول والاختبارات | `src/pages/`, `src/services/`, `supabase/`, `src/**/__tests__` |

**ملاحظات:**
- يجب إضافة جدول وصف لكل Use Case: Actor، Preconditions، Main Flow، Alternative Flow، Postconditions.
- يجب إدراج مخططات sequence/activity/state الفعلية، وليس وصفها فقط.
- كل FR يجب أن يظهر في مصفوفة التتبع وفي الفصل 5.

---

### 3.5 الفصل الرابع: Project Design

**صفحة الغلاف:** Chapter 4 — Project Design.

| القسم | ما يُكتب فيه | الملفات/المصادر |
|---|---|---|
| 4.1 Introduction | نظرة عامة على التصميم | — |
| 4.2 System Architecture | معمارية SPA + Supabase، الطبقات، النشر | `uml-exhaustive/06_architecture.mmd`, `08_component.mmd`, `09_deployment.mmd`; `src/lib/supabase.ts` |
| 4.3 Database Design | الجداول، العلاقات، القيود، الفهارس، التطبيع | `supabase/schema.sql`, `schema-part2-security.sql`, `03_erd.mmd` |
| 4.4 Backend Design | RPC، Triggers، RLS، Storage، Realtime، Edge Function | `supabase/schema.sql`, `supabase/functions/chatbot/index.ts`, `supabase/migrations/` |
| 4.5 Frontend Design | Routing، Contexts، Services، Components، i18n، RTL | `src/App.tsx`, `src/routes/index.tsx`, `src/contexts/`, `src/services/`, `src/components/ui/` |
| 4.6 Security Design | الأدوار، RLS، grants، bcrypt، session، rate limiting، audit | `supabase/schema-part2-security.sql`, `src/services/rateLimit.ts`, `docs/SECURITY_ADVISORIES.md` |
| 4.7 UI/UX Design | Wireframes/Screenshots، الاستجابة، الثيمات، الحالات الفارغة | `src/pages/`, `src/components/ui/` |
| 4.8 Algorithms and Business Logic | capacity/waitlist، QR، check-in، notifications، evaluation aggregation، costs، exports | `supabase/schema.sql`, `src/services/`, `src/pages/` |
| 4.9 Summary | تلخيص التصميم | — |

**ملاحظات:**
- أدرج مخطط المعمارية الفعلي بدل الصندوق المؤقت.
- أضف مخططات component وdeployment.
- أضف نموذج تهديد (assets, actors, threats, mitigations) في 4.6.
- أضف pseudocode لكل خوارزمية في 4.8 مع المدخلات والمخرجات وحالات الخطأ.

---

### 3.6 الفصل الخامس: Implementation and Test

**صفحة الغلاف:** Chapter 5 — Implementation and Test.

| القسم | ما يُكتب فيه | الملفات/المصادر |
|---|---|---|
| 5.1 Introduction | نظرة عامة على التنفيذ والاختبار | — |
| 5.2 Development Environment and Tools | Node 20+، npm، Vite 8، TypeScript، React 19، Supabase، Vitest، Oxlint | `package.json`, `vite.config.ts` |
| 5.3 Implementation of Main Modules | وصف تنفيذ الوحدات + مقتطفات كود | `src/pages/`, `src/services/`, `src/components/` |
| 5.4 Database Implementation | ترتيب تنفيذ SQL والهجرات | `supabase/schema.sql`, `schema-part2-security.sql`, `supabase/migrations/*` |
| 5.5 Security Implementation | RLS، grants، session، rate limit، audit، storage policies | `supabase/schema-part2-security.sql`, `supabase/migrations/2026-11-19_security_hardening.sql`, `2026-11-18_storage_uploads_policy.sql`, `src/services/rateLimit.ts` |
| 5.6 Testing Strategy | اختبارات آلية (Vitest) + سيناريوهات يدوية | `src/**/__tests__`, `vitest.config.ts` |
| 5.7 Test Cases and Results | جدول حالات الاختبار والنتائج والأدلة | `Appendix D` + سجلات الاختبار |
| 5.8 Deployment | خطوات النشر، متغيرات البيئة، SPA fallback | `README.md`, `.env.example`, `vite.config.ts` |
| 5.9 Summary | تلخيص التنفيذ والاختبار | — |

**ملاحظات:**
- أدرج العدد الفعلي لملفات الاختبار وحالات الاختبار من المستودع.
- لا تدّعِ نسبة تغطية لم تُقس؛ اذكر ما تم قياسه فقط.
- استبدل حالات "Pass" في الجدول 5-2 بالنتائج الفعلية.
- أضف لقطات شاشة من التطبيق الفعلي في 5.3 و6.2.

---

### 3.7 الفصل السادس: Results and Discussions

**صفحة الغلاف:** Chapter 6 — Results and Discussions.

| القسم | ما يُكتب فيه | الملفات/المصادر |
|---|---|---|
| 6.1 Introduction | نظرة عامة على النتائج | — |
| 6.2 System Walkthrough | لقطات شاشة مرتبة حسب الدور | التطبيق الفعلي |
| 6.3 Achievement of Project Objectives | جدول الأهداف وما تحقق | `README.md`, `src/pages/` |
| 6.4 Results vs Requirements | جدول تغطية FR/NFR | الفصل 3 + الفصل 5 |
| 6.5 Performance and Usability Discussion | الأداء، التحميل الكسول، الفهارس، الاستجابة، i18n | `vite.config.ts`, `supabase/migrations/2026-11-19_index_maintenance.sql` |
| 6.6 Security and Reliability Discussion | RLS، audit، rate limit، القيود، النسخ الاحتياطي | `docs/SECURITY_ADVISORIES.md`, `supabase/schema-part2-security.sql` |
| 6.7 Limitations | لا دفع، لا تطبيق أصلي، لا عمل دون اتصال، لا قياس حمل إنتاجي | — |
| 6.8 Discussion | المقارنة مع الأدوات اليدوية والمنصات التجارية | الفصل 2 |
| 6.9 Summary | تلخيص النتائج | — |

**ملاحظات:**
- لا تضع mockups في 6.2؛ استخدم لقطات حقيقية فقط.
- إذا لم تُقس أزمنة الاستجابة، لا تذكر أرقامًا غير مدعومة.
- يجب أن يتطابق جدول 6-2 مع مصفوفة التتبع في 3.10 وجدول الاختبار في 5.7.

---

### 3.8 الفصل السابع: Conclusions and Recommendations

**صفحة الغلاف:** Chapter 7 — Conclusions and Recommendations.

| القسم | ما يُكتب فيه | الملفات/المصادر |
|---|---|---|
| 7.1 Conclusions | تلخيص الإنجاز مقابل الأهداف | الفصول 1، 5، 6 |
| 7.2 Recommendations and Future Work | تطبيق جوال، دفع إلكتروني، تقويم، توصيات، تحليلات، CI/CD، اختبار قابلية الاستخدام، مراقبة إنتاجية، وصولية | `README.md`, `propusal_project/` |
| 7.3 Summary | خاتمة موجزة | — |

**ملاحظة:** افصل التحسينات قصيرة المدى عن الاتجاهات البحثية طويلة المدى، ولا تقدّم أي عمل مستقبلي كأنه منفذ.

---

### 3.9 المراجع (References)

- 14 مرجعًا بصيغة IEEE، مرتبة حسب أول ظهور.
- الاستشهادات الحالية: `[1]` في 1.1، `[2]`–`[3]` في 1.2، `[4]` في 1.5، `[5]`–`[7]` في 2.2، `[8]`–`[12]` في 2.4، `[13]` في 3.1، `[14]` في 3.3.4.
- قبل التسليم: تحقق من كل مرجع، وأضف DOI/URL حيث يلزم، وأعد ترقيم القائمة إذا أضفت مصدرًا جديدًا يظهر قبل غيره.

---

### 3.10 الملاحق (Appendices)

| الملحق | العنوان | ما يُكتب فيه | المصادر |
|---|---|---|---|
| A | User Manual | خطوات الاستخدام لكل دور: attendee, organizer, admin | `src/pages/`, التطبيق الفعلي |
| B | Database Schema Summary | جدول الجداول والمفاتيح والعلاقات + ترتيب تنفيذ SQL | `supabase/schema.sql`, `schema-part2-security.sql`, `migrations/` |
| C | RPC and API Reference | تواقيع الدوال، المعاملات، القيم المرجعة، الصلاحيات + chatbot | `supabase/schema.sql`, `supabase/functions/chatbot/index.ts` |
| D | Test Case Matrix | 26 حالة اختبار مع المتطلبات والنتائج | `src/**/__tests__`, سجلات الاختبار |
| E | Demo Data and Accounts | حسابات العرض وكلمات المرور وخطوات التحميل | `supabase/seed_demo_accounts.sql` |
| F | Project Plan and Timeline | المراحل والجدول الزمني وGantt | خطة المشروع + نماذج المتابعة |
| G | Source Code Structure | شجرة المجلدات والملفات الرئيسية | المستودع |
| H | Security Policies and Migration Checklist | الضوابط، سياسات RLS، ترتيب الهجرات | `supabase/schema-part2-security.sql`, `migrations/`, `docs/SECURITY_ADVISORIES.md` |

**ملاحظة:** ترقيم صفحات كل ملحق يبدأ من 1 مع بادئة الحرف (`A1`, `B1`...). قد يعرض فهرس المحتويات أرقام الصفحات دون البادئة لأن Word لا يخزن بادئة التذييل داخل قيمة رقم الصفحة؛ هذا سلوك متوقع ويمكن توضيحه للمشرف أو إضافة البادئة يدويًا في الفهرس بعد التحديث النهائي.

---

## 4. جدول ربط الفصول بملفات المشروع

| الفصل | الملفات الأساسية | المخططات | الاختبارات/الأدلة |
|---|---|---|---|
| 1 | `README.md`, `propusal_project/*` | — | — |
| 2 | `package.json`, `README.md` | — | — |
| 3 | `src/routes/index.tsx`, `src/pages/`, `src/services/`, `src/constants.ts`, `supabase/schema*.sql` | `uml-exhaustive/01_use_case*`, `03_erd.mmd`, `04*_sequence*`, `05*_activity*`, `06_state_machine.mmd` | — |
| 4 | `src/App.tsx`, `src/routes/index.tsx`, `src/contexts/`, `src/services/`, `src/components/ui/`, `supabase/` | `06_architecture.mmd`, `08_component.mmd`, `09_deployment.mmd` | — |
| 5 | `src/pages/`, `src/services/`, `supabase/migrations/`, `vitest.config.ts` | — | `src/**/__tests__`, test logs |
| 6 | التطبيق الفعلي + `src/pages/` | — | Screenshots + test results |
| 7 | `README.md`, `propusal_project/` | — | — |
| A–H | `supabase/`, `src/`, `docs/`, `uml-exhaustive/` | — | — |

---

## 5. ملاحظات التنسيق والترقيم في الملف الناتج

| العنصر | الإعداد |
|---|---|
| حجم الورق | A4 (21 × 29.7 سم) |
| الهوامش | أعلى/أسفل/يمين 2.5 سم، يسار 3.0 سم (جهة التجليد) |
| النص | Times New Roman 12، تباعد 1.5، تعليل، 6 نقاط بعد الفقرة |
| العناوين | Heading 1: 16 عريض، Heading 2: 14 عريض، Heading 3: 12 عريض |
| العناوين العربية | Arial (عبر `w:cs`) |
| تسميات الجداول/الأشكال | 10 عريض، وسط، 6 نقاط قبل/بعد |
| الصفحات الأمامية | أرقام رومانية صغيرة (i, ii, iii...) |
| الفصول | أرقام عربية تبدأ من 1 عند الفصل الأول وتستمر |
| الملاحق | كل ملحق يبدأ من 1 مع بادئة الحرف (A1, B1...) |
| رأس الصفحة | `EventFlow — Graduation Project Report` |
| تذييل الصفحة | رقم الصفحة وسط الأسفل |
| غلاف الفصل | بدون رأس أو تذييل |

---

## 6. الملفات الناتجة

| الملف | الوصف |
|---|---|
| `EventFlow_Approved_Documentation_Template.docx` | القالب المعتمد الكامل، 64 صفحة، 19 قسمًا، 34 جدولًا، 28 تسمية، 14 مرجعًا، 8 ملاحق |
| `Approved_Documentation_Structure.md` | هذا الملف: تقرير المقارنة + الهيكل + الملاحظات + ربط الملفات |

---

## 7. خطوات الإكمال قبل التسليم

1. استبدال بيانات الغلاف: أسماء الطلاب، الأرقام الجامعية، اسم المشرف، السنة.
2. استبدال الملاحظات الرمادية (Template Notes) في جميع الفصول بمحتوى نهائي.
3. إدراج المخططات الفعلية بدلًا من الصناديق المؤقتة: المعمارية، component، deployment، sequence، activity، state، ERD.
4. إدراج لقطات شاشة حقيقية في 5.3 و6.2.
5. تعبئة جداول الاختبار بالنتائج الفعلية والأدلة.
6. التحقق من References وإعادة ترقيمها عند الحاجة.
7. تحديث TOC/List of Figures/List of Tables مرة أخيرة من Word (`References → Update Table` أو `F9`).
8. توقيع صفحات إقرار المشرف ولجنة المناقشة.
9. مراجعة لغوية وإملائية نهائية.
10. حفظ نسخة PDF بجانب DOCX للتسليم.

---

## 8. مواصفات التوليد الكاملة (الملحق التقني)

هذا القسم يوثق كل تفاصيل التوليد حتى يمكن إعادة بناء الملف من الصفر باستخدام `python-docx` وWord، دون الاعتماد على الذاكرة أو على القالب الأصلي.

### 8.1 إعداد الصفحة والأقسام (19 قسمًا)

| القسم | المحتوى | ترقيم الصفحات | رأس/تذييل |
|---|---|---|---|
| 1 | الغلاف | decimal يبدأ 1 لكنه مخفي | لا يوجد |
| 2 | الصفحات الأمامية (Summary … Mathematical Notation) | lowerRoman يبدأ 1 | رأس `EventFlow — Graduation Project Report` + رقم روماني |
| 3 | الفصل 1 (غلاف + محتوى) | decimal يبدأ 1 | غلاف بدون رأس/تذييل، ثم رأس + رقم عربي |
| 4 | الفصل 2 | decimal يستمر | غلاف بدون رأس/تذييل، ثم رأس + رقم عربي |
| 5 | الفصل 3 | decimal يستمر | نفس النمط |
| 6 | الفصل 4 | decimal يستمر | نفس النمط |
| 7 | الفصل 5 | decimal يستمر | نفس النمط |
| 8 | الفصل 6 | decimal يستمر | نفس النمط |
| 9 | الفصل 7 | decimal يستمر | نفس النمط |
| 10 | References | decimal يستمر | رأس `References` + رقم عربي |
| 11 | Appendices divider | decimal يستمر | رأس `Appendices` + رقم عربي |
| 12 | Appendix A | decimal يبدأ 1 | رأس `Appendix A: User Manual` + تذييل `A` + PAGE |
| 13 | Appendix B | decimal يبدأ 1 | `B` + PAGE |
| 14 | Appendix C | decimal يبدأ 1 | `C` + PAGE |
| 15 | Appendix D | decimal يبدأ 1 | `D` + PAGE |
| 16 | Appendix E | decimal يبدأ 1 | `E` + PAGE |
| 17 | Appendix F | decimal يبدأ 1 | `F` + PAGE |
| 18 | Appendix G | decimal يبدأ 1 | `G` + PAGE |
| 19 | Appendix H | decimal يبدأ 1 | `H` + PAGE |

**إعداد الصفحة لكل قسم:**
- A4: عرض 21.0 سم، ارتفاع 29.7 سم.
- الهوامش: أعلى 2.5، أسفل 2.5، يمين 2.5، يسار 3.0 سم.
- مسافة الرأس/التذييل: 1.25 سم.
- `different_first_page_header_footer = True` للفصول 1–7، مع تفريغ رأس وتذييل الصفحة الأولى (غلاف الفصل).
- رأس الصفحة: Times New Roman 10 مائل رمادي `#595959`، وسط، مع خط سفلي رفيع.
- تذييل الصفحة: Times New Roman 10، وسط، حقل `PAGE`، مع بادئة الحرف في الملاحق.

### 8.2 جدول الأنماط الكامل

| النمط | الخط | الحجم | عريض | تباعد الأسطر | قبل/بعد | المحاذاة | اللون |
|---|---|---|---|---|---|---|---|
| Normal | Times New Roman | 12 | لا | 1.5 | 0 / 6 | justified | أسود |
| Heading 1 | Times New Roman | 16 | نعم | 1.5 | 12 / 6 | left | أسود |
| Heading 2 | Times New Roman | 14 | نعم | 1.5 | 10 / 4 | left | أسود |
| Heading 3 | Times New Roman | 12 | نعم | 1.5 | 8 / 4 | left | أسود |
| Caption | Times New Roman | 10 | نعم | 1.0 | 6 / 6 | center | أسود |
| Reference Entry | Times New Roman | 12 | لا | 1.5 | 0 / 6 | left + hanging 0.5" | أسود |
| toc 1 | Times New Roman | 12 | نعم | 1.15 | 0 / 3 | left | أسود |
| toc 2 | Times New Roman | 12 | لا | 1.15 | 0 / 3 | left + 0.5 سم | أسود |
| toc 3 | Times New Roman | 12 | لا | 1.15 | 0 / 3 | left + 1.0 سم | أسود |
| table of figures | Times New Roman | 12 | لا | 1.15 | 0 / 3 | left | أسود |
| List Bullet | Times New Roman | 12 | لا | 1.5 | 0 / 3 | justified | أسود |
| Header | Times New Roman | 10 | لا | 1.0 | 0 / 0 | center | رمادي |
| Footer | Times New Roman | 10 | لا | 1.0 | 0 / 0 | center | أسود |
| Front Title | Times New Roman | 16 | نعم | 1.5 | 0 / 12 | center | أسود |
| Chapter Cover Number | Times New Roman | 24 | نعم | 1.0 | 0 / 6 | center | أسود |
| Chapter Cover Title | Times New Roman | 20 | نعم | 1.15 | 0 / 12 | center | أسود |
| Table Text | Times New Roman | 10 | لا | 1.0 | 0 / 0 | left | أسود |
| Table Header | Times New Roman | 10 | نعم | 1.0 | 0 / 0 | center | أسود |
| Template Note | Times New Roman | 10.5 | مائل | 1.15 | 2 / 8 | justified | رمادي `#595959` |

**قواعد إضافية:**
- النص العربي: `w:rFonts w:cs="Arial"` مع `w:rtl` و`w:lang w:bidi="ar-SA"`.
- النص الإنجليزي: `w:rFonts` لكل من ascii/hAnsi/eastAsia/cs = Times New Roman.
- لا يقل حجم خط أي جدول عن 9 pt.
- تسميات الجداول والأشكال: 10 pt عريض وسط.

### 8.3 الصفحات الأمامية — المحتوى الدقيق

1. **الغلاف:**
   - جدول بلا حدود: Republic of Yemen، Ministry of Education and Scientific Research، University of Al-Jeel Al-Jadeed، Faculty of Engineering and Information Technology، Department of Computer Science.
   - خانة شعار الجامعة.
   - `EventFlow` بحجم 28 عريض.
   - `An Integrated Web-Based Event Management System` بحجم 18 عريض.
   - `EventFlow: نظام متكامل لإدارة الفعاليات` بحجم 20 عريض Arial.
   - `Graduation Project Report` بحجم 14 عريض.
   - جدول 5 صفوف: Student Name / Student No.
   - `Supervised by` + Supervisor Name + Title.
   - نص التقديم للقسم + السنة 2026.

2. **Summary:** ست فقرات تغطي: تعريف النظام، المشكلة، الأهداف، الأدوات، النتائج، الخاتمة، مع ملاحظة أن الملخص لا يتجاوز صفحة واحدة.

3. **Authorization:** فقرة تفويض الجامعة + جدول توقيعات 5 طلاب.

4. **Dedication:** فقرتان قصيرتان وسط الصفحة.

5. **Acknowledgment:** ثلاث فقرات: الشكر لله، الشكر للمشرف، الشكر للأسرة والقسم.

6. **Supervisor Certification:** فقرة إقرار + جدول طلاب + سطر توقيع المشرف.

7. **Examination Committee:** عنوان المشروع + جدول 4 صفوف: Supervisor، Internal Examiner، External Examiner، Department Head.

8. **Table of Contents:** حقل `TOC \o "1-3" \h \z \u`.

9. **List of Figures:** حقل `TOC \h \z \c "Figure"`.

10. **List of Tables:** حقل `TOC \h \z \c "Table"`.

11. **List of Abbreviations:** جدول من 22 اختصارًا: API، CRUD، CSS، ERD، FR، HTML، IEEE، JWT، KPI، NFR، QR، RBAC، RLS، RPC، SPA، SQL، UI، UML، UX، XLSX، PDF، CSV.

12. **Mathematical Notation:** جدول الرموز: C، R، W، A، AR، sᵢ، n، S، E، Ac، V، p.

### 8.4 الفصول — العناوين الدقيقة

| الفصل | العنوان | الأقسام |
|---|---|---|
| 1 | Introduction | 1.1 Overview، 1.2 Problem Statement، 1.3 Project Objectives، 1.4 Project Scope and Limitations، 1.5 Project Methodology، 1.6 Report Organization |
| 2 | Background and Literature Review | 2.1 Background، 2.2 Literature Review، 2.3 Comparison of Existing Systems، 2.4 Technologies Used، 2.5 Summary |
| 3 | Requirements Analysis and Modeling | 3.1 Introduction، 3.2 Stakeholders and User Roles، 3.3 Functional Requirements (3.3.1–3.3.11)، 3.4 Non-Functional Requirements، 3.5 Use Case Modeling، 3.6 Data Modeling (ERD)، 3.7 Sequence Diagrams، 3.8 Activity Diagrams، 3.9 State Machine Diagrams، 3.10 Requirements Traceability Matrix |
| 4 | Project Design | 4.1 Introduction، 4.2 System Architecture، 4.3 Database Design، 4.4 Backend Design، 4.5 Frontend Design، 4.6 Security Design، 4.7 UI/UX Design، 4.8 Algorithms and Business Logic، 4.9 Summary |
| 5 | Implementation and Test | 5.1 Introduction، 5.2 Development Environment and Tools، 5.3 Implementation of Main Modules، 5.4 Database Implementation، 5.5 Security Implementation، 5.6 Testing Strategy، 5.7 Test Cases and Results، 5.8 Deployment، 5.9 Summary |
| 6 | Results and Discussions | 6.1 Introduction، 6.2 System Walkthrough، 6.3 Achievement of Project Objectives، 6.4 Results vs Requirements، 6.5 Performance and Usability Discussion، 6.6 Security and Reliability Discussion، 6.7 Limitations، 6.8 Discussion، 6.9 Summary |
| 7 | Conclusions and Recommendations | 7.1 Conclusions، 7.2 Recommendations and Future Work، 7.3 Summary |

**قاعدة:** كل فصل يبدأ بصفحة غلاف مستقلة: `Chapter N` بحجم 24 عريض، ثم عنوان الفصل بحجم 20 عريض، ثم خط فاصل، ثم `Graduation Project Report` بحجم 12 مائل.

### 8.5 الجداول والأشكال الدقيقة

| المعرف | العنوان | الفصل/الملحق | الأعمدة/المحتوى |
|---|---|---|---|
| Table 2-1 | Feature Comparison of EventFlow and Representative Alternatives | 2 | Capability، EventFlow، Eventbrite، Ticketmaster، Forms/spreadsheets |
| Table 2-2 | EventFlow Technology Stack | 2 | Layer، Technology، Role |
| Table 3-1 | EventFlow User Roles and Main Permissions | 3 | Role، Main permissions، Primary interface |
| Table 3-2 | Functional Requirements Summary | 3 | ID، Module، Primary actor، Main evidence |
| Table 3-3 | Non-Functional Requirements and Implementation Evidence | 3 | Quality attribute، Requirement، Evidence |
| Table 3-4 | Main EventFlow Data Entities | 3 | Entity، Purpose |
| Table 3-5 | Main Event, Registration and Ticket States | 3 | Entity، States، Transitions |
| Table 3-6 | Requirements Traceability Summary | 3 | Requirement group، Primary pages، Primary services/database، Tests |
| Table 4-1 | Core Database Tables | 4 | Table، Main purpose |
| Figure 3-1 | EventFlow Core Use Case Diagram | 3 | `uml-exhaustive/EventFlow-Core-UseCases.png` |
| Figure 4-1 | EventFlow System Architecture | 4 | `uml-exhaustive/06_architecture.mmd` (placeholder) |
| Table 5-1 | Development and Testing Tools | 5 | Tool، Version/role |
| Table 5-2 | Representative Test Cases | 5 | ID، Scenario، Expected result، Status |
| Table 6-1 | Project Objectives and Delivered Features | 6 | Objective، Delivered evidence، Status |
| Table 6-2 | Requirement Coverage Summary | 6 | Requirement group، Coverage، Evidence |
| Table A-1 | Attendee Tasks and Steps | A | Task، Steps |
| Table A-2 | Organizer Tasks and Steps | A | Task، Steps |
| Table A-3 | Administrator Tasks and Steps | A | Task، Steps |
| Table B-1 | Core Tables, Keys and Relationships | B | Table، Primary key، Main columns، Relationships |
| Table C-1 | Database Functions and Their Responsibilities | C | Function، Purpose، Key parameters، Access |
| Table C-2 | Chatbot Request and Response Fields | C | Field، Direction، Description |
| Table D-1 | Detailed Test Case Matrix | D | ID، Requirement، Scenario، Expected result، Type، Result |
| Table E-1 | Demo Accounts Created by the Seed Script | E | Role، Email، Password، Profile |
| Figure F-1 | Project Timeline (Gantt Chart) | F | Placeholder |
| Table G-1 | Key Source Files and Responsibilities | G | Path، Responsibility |
| Table H-1 | Security Controls and Implementation Evidence | H | Control، Implementation، Verification |
| Table H-2 | Database Migration Checklist | H | Order، File، Purpose، Applied |

### 8.6 المراجع [1]–[14]

1. D. Getz, Event Studies, 2nd ed., Butterworth-Heinemann, 2012.
2. J. Nielsen, Usability Engineering, Morgan Kaufmann, 1994.
3. ISO 9241-210:2019.
4. I. Sommerville, Software Engineering, 10th ed., Pearson, 2016.
5. R. T. Fielding, Ph.D. dissertation, UC Irvine, 2000.
6. M. Fowler, Patterns of Enterprise Application Architecture, Addison-Wesley, 2002.
7. OWASP Top 10:2021.
8. React documentation.
9. TypeScript documentation.
10. Vite documentation.
11. Supabase documentation.
12. PostgreSQL documentation.
13. IEEE Std 830-1998.
14. ISO/IEC 18004:2015.

**أماكن الاستشهاد:** [1] في 1.1، [2]–[3] في 1.2، [4] في 1.5، [5]–[7] في 2.2، [8]–[12] في 2.4، [13] في 3.1، [14] في 3.3.4.

### 8.7 خطوات إعادة التوليد البرمجية

1. إنشاء `Document()` جديد، وضبط الأنماط عبر `configure_styles`.
2. ضبط خصائص المستند: العنوان، المؤلف، الموضوع، الكلمات المفتاحية، اللغة `en-US`.
3. إضافة الغلاف في القسم 1.
4. إضافة قسم جديد `lowerRoman` للصفحات الأمامية، ثم إضافة Summary … Mathematical Notation.
5. لكل فصل 1–7: إضافة قسم `decimal` (الفصل 1 يبدأ 1، والباقي يستمر)، مع `first_page_blank=True`، ثم صفحة الغلاف، ثم عنوان الفصل، ثم الأقسام.
6. إضافة قسم References (decimal يستمر).
7. إضافة قسم Appendices divider (decimal يستمر).
8. لكل ملحق A–H: قسم `decimal` يبدأ 1 مع `footer_prefix=letter`، ثم عنوان الملحق ومحتواه.
9. حفظ الملف `*_raw.docx`.
10. تشغيل `update_toc.py` لتحديث TOC وكل الحقول.
11. تشغيل `postprocess.py` لضبط الخطوط والأنماط والجداول والتسميات.
12. تشغيل `update_toc.py` مرة ثانية لتحديث أرقام الصفحات بعد تغيير الأنماط وأحجام الجداول.
13. التحقق عبر `validate_docx.py` وWord COM.
14. تصدير PDF للمعاينة النهائية.

### 8.8 قائمة التحقق النهائية

- [ ] 19 قسمًا.
- [ ] 7 فصول، كل فصل بصفحة غلاف.
- [ ] 34 جدولًا (منها جداول الغلاف والتوقيعات).
- [ ] 28 تسمية جدول/شكل.
- [ ] 14 مرجعًا IEEE.
- [ ] 8 ملاحق A–H.
- [ ] لا يوجد جدول بخط أقل من 9 pt.
- [ ] كل العناوين Times New Roman 16/14/12 عريض.
- [ ] كل التسميات 10 pt عريض وسط.
- [ ] الصفحات الأمامية رومانية.
- [ ] الفصول عربية متصلة.
- [ ] الملاحق A1/B1/C1…
- [ ] لا توجد صفحات فارغة.
- [ ] TOC وList of Figures وList of Tables محدثة.
- [ ] الملف يفتح في Word دون إصلاح.

### 8.9 ملاحظة معروفة حول فهرس المحتويات والملاحق

Word يخزن رقم الصفحة في TOC كقيمة رقمية من `PAGEREF`، ولا يضم بادئة التذييل (`A`, `B`). لذلك قد يعرض TOC:

```
Appendix A: User Manual    1
```

بينما التذييل يعرض `A1`. هذا سلوك متوقع. الحلول:

1. قبول الأرقام الرقمية في TOC مع بقاء التذييل `A1` (الأكثر أمانًا).
2. بعد آخر تحديث لـ TOC، تعديل نص أرقام صفحات الملاحق يدويًا لإضافة الحرف، مع عدم تحديث TOC بعدها.
3. استخدام حقل `PAGEREF` مخصص مع `\* CHARFORMAT` لا يضيف البادئة؛ لا يوجد حل تلقائي مباشر في Word.

---

## 9. ملاحظة حول ملكية الملفات الأصلية

- `Graduation ProjectTamplet n.docx` لم يُعدَّل.
- `دليل مشاريع التخرج.docx` لم يُعدَّل.
- جميع المخرجات الجديدة داخل مجلد `المتطلبات الخارجية/Test decumentation/`.
- يمكن التحقق من ذلك عبر `git status` أو مقارنة بصمات الملفات الأصلية.

---

**إعداد:** فريق مشروع EventFlow  
**التاريخ:** 2026
