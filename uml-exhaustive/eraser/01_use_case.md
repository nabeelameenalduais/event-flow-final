# 01 — مخطط حالات الاستخدام (Use Case Diagram)

> **النمط في Eraser:** Flow chart — الصق الكود كما هو.
> **المرجع المعياري:** OMG UML 2.5.1 §18 (UseCases) — الفاعلون stick figures، حالات الاستخدام ovals داخل حدود النظام (subject boundary)، علاقات «include» إلزامية و«extend» اختيارية بنقاط امتداد.

## 1. الهدف الأكاديمي

يوضح المخطط **الوظيفية الخارجية** للمنظومة من منظور الفاعلين دون الدخول في التفاصيل الداخلية، ويحدد حدود النظام (System Boundary) وما يحيط به من أنظمة خارجية. وهو نقطة الانطلاق لمصفوفة التتبع (§11 في الوثيقة الرئيسية): كل متطلب وظيفي F1–F10 يقابله حالة استخدام واحدة على الأقل.

## 2. الفاعلون

| الفاعل | الرمز | الدور |
|---|---|---|
| Guest | زائر غير مسجل | تصفح الفعاليات المنشورة، السؤال للمساعد الذكي |
| Attendee | مستخدم بدور attendee | كل ما سبق + التسجيل/الإلغاء، التذاكر QR، الحضور، الدردشة، التقييم، الإشعارات |
| Organizer | منظم فعالية | إدارة فعالياته وجلساته وتكاليفه وقوائم الحضور والتقييمات والتقارير |
| Admin | مدير النظام | إدارة المستخدمين والتصنيفات والأماكن والملفات والإعدادات ولوحة القيادة وسجلات التدقيق |

## 3. الأنظمة الثانوية (Secondary Actors خارج حدود النظام)

| النظام | يخدم |
|---|---|
| Supabase Platform | Auth + Postgres (RPC) + Realtime + Storage |
| Email Service | إرسال إشعارات (تأكيد تسجيل، waitlist، دعوة مستخدمة) |
| LLM Provider | OpenAI المتوافق مع tool-calling، وLM Studio كبديل محلي |

## 4. حزم حالات الاستخدام (UC01–UC48 مجمعة)

- **الحزمة A — المصادقة والحسابات:** تسجيل حساب attendee، تسجيل دخول (مع حد معدل 5 محاولات/15 دقيقة)، استعادة الجلسة، تسجيل خروج، طلب/إعادة تعيين كلمة المرور (رسالة عامة ضد تعداد الحسابات)، إدارة جلسات الأجهزة (عرض/إبطال/إبطال الكل).
- **الحزمة B — تصفح الفعاليات:** قائمة الفعاليات مع بحث وتصفية، تفاصيل فعالية، فعالياتي، أرشيف.
- **الحزمة C — التسجيل والتذاكر:** تسجيل في فعالية عامة، تسجيل برمز دعوة (خاص)، الإدراج بقائمة الانتظار عند الامتلاء، إلغاء التسجيل (مع ترقية أول منتظر تلقائيًا)، عرض التذكرة، تنزيل QR.
- **الحزمة D — الحضور:** Check-in بالكاميرا (QR)، Check-in يدوي بالكود، Check-out، حضور تلقائي للفعاليات الأونلاين.
- **الحزمة E — التواصل والتقييم:** دردشة فعالية لحظية، إرسال ملاحظات Feedback، تقديم تقييم (مرة واحدة فقط RPC).
- **الحزمة F — لوحة المنظم:** إنشاء/تعديل/حذف فعالية، نشر/إلغاء نشر/أرشفة، تكرار فعالية، إدارة جلسات الفعالية، التكاليف، قائمة المسجلين، عرض التقييمات، التقارير، إشعار «استُخدمت دعوتك».
- **الحزمة G — إدارة Admin:** المستخدمون والأدوار، التصنيفات، الأماكن، الملفات، الإعدادات، لوحة القيادة، سجل التدقيق.
- **الحزمة H — المساعد الذكي:** طرح سؤال → بحث سياق → tool-calling → إجابة (fallback إلى LM Studio).

## 5. علاقات «include» / «extend» الجوهرية

- «include»: أي UC يتطلب مصادقة يشمل **تسجيل الدخول/التحقق من JWT**؛ «تسجيل في فعالية» يشمل **عدّ المقاعد المؤكدة**؛ «Check-in» يشمل **التحقق من صلاحية التذكرة**؛ «تقديم التقييم» يشمل **فحص عدم التقييم السابق**.
- «extend»: **حد المعدل Rate-limit** يمدّد UC05 (تسجيل الدخول) وعملاء REST عمومًا عند تجاوز 30 طلبًا/60 ثانية؛ **رسائل الخطأ العربية** تمدد أي مسار فشل (PGRST202/PGRST205 mapping).

## 6. كود Eraser

```eraser
title EventFlow - Use Case Diagram (OMG UML 2.5.1 style mapping)

// Actors (outside system boundary)
Guest [shape: oval, icon: user, color: grey]
Attendee [shape: oval, icon: user, color: blue]
Organizer [shape: oval, icon: user, color: orange]
Admin [shape: oval, icon: user, color: red]

Group EventFlow System Boundary [color: lightblue] {

  Group A Authentication and Accounts {
    Register Account [shape: oval]
    Login [shape: oval]
    Restore Session [shape: oval]
    Logout [shape: oval]
    Request Password Reset [shape: oval]
    Reset Password [shape: oval]
    Manage Device Sessions [shape: oval]
  }

  Group B Browse Events {
    List Events [shape: oval]
    Search and Filter Events [shape: oval]
    View Event Details [shape: oval]
    My Events [shape: oval]
    Events Archive [shape: oval]
  }

  Group C Registration and Tickets {
    Register Public Event [shape: oval]
    Register Private Event by Invitation [shape: oval]
    Join Waitlist [shape: oval]
    Cancel Registration [shape: oval]
    View Ticket [shape: oval]
    Download QR Ticket [shape: oval]
  }

  Group D Attendance {
    Check In via Camera QR [shape: oval]
    Check In Manual Code [shape: oval]
    Check Out [shape: oval]
    Auto Attendance Online [shape: oval]
  }

  Group E Communication and Evaluation {
    Realtime Event Chat [shape: oval]
    Submit Feedback [shape: oval]
    Submit Evaluation Once [shape: oval]
  }

  Group F Organizer Console {
    Manage Events CRUD [shape: oval]
    Publish Unpublish Archive Event [shape: oval]
    Duplicate Event [shape: oval]
    Manage Sessions [shape: oval]
    Manage Costs [shape: oval]
    View Registrants [shape: oval]
    View Evaluations Results [shape: oval]
    Generate Reports [shape: oval]
  }

  Group G Administration {
    Manage Users Roles [shape: oval]
    Manage Categories [shape: oval]
    Manage Venues [shape: oval]
    Manage Files [shape: oval]
    Manage Settings [shape: oval]
    Admin Dashboard [shape: oval]
    Audit Logs [shape: oval]
  }

  Group H AI Assistant {
    Ask Assistant Question [shape: oval]
  }

  // include relations
  Login > include > Verify JWT Session [shape: oval]
  Register Public Event > include > Count Confirmed Seats [shape: oval]
  Check In Manual Code > include > Validate Ticket [shape: oval]
  Check In via Camera QR > include > Validate Ticket [shape: oval]
  Submit Evaluation Once > include > Check Not Evaluated Before [shape: oval]

  // extend relations
  Rate Limit Guard [shape: oval] > extend > Login
  Arabic Error Mapping [shape: oval] > extend > Register Private Event by Invitation
}

// Secondary external systems
Supabase Platform [shape: oval, color: green]
Email Service [shape: oval, color: purple]
LLM Provider [shape: oval, color: yellow]

// Guest associations
Guest > List Events
Guest > View Event Details
Guest > Ask Assistant Question

// Attendee associations
Attendee > Register Account
Attendee > Login
Attendee > Restore Session
Attendee > Logout
Attendee > Request Password Reset
Attendee > Reset Password
Attendee > Manage Device Sessions
Attendee > List Events
Attendee > Search and Filter Events
Attendee > View Event Details
Attendee > My Events
Attendee > Events Archive
Attendee > Register Public Event
Attendee > Register Private Event by Invitation
Attendee > Cancel Registration
Attendee > View Ticket
Attendee > Download QR Ticket
Attendee > Check In via Camera QR
Attendee > Check In Manual Code
Attendee > Check Out
Attendee > Auto Attendance Online
Attendee > Realtime Event Chat
Attendee > Submit Feedback
Attendee > Submit Evaluation Once

// Organizer associations
Organizer > Login
Organizer > Manage Events CRUD
Organizer > Publish Unpublish Archive Event
Organizer > Duplicate Event
Organizer > Manage Sessions
Organizer > Manage Costs
Organizer > View Registrants
Organizer > View Evaluations Results
Organizer > Generate Reports
Organizer > Realtime Event Chat

// Admin associations
Admin > Login
Admin > Manage Users Roles
Admin > Manage Categories
Admin > Manage Venues
Admin > Manage Files
Admin > Manage Settings
Admin > Admin Dashboard
Admin > Audit Logs

// External system connections
EventFlow System Boundary > Supabase Platform: HTTPS REST RPC WSS
Join Waitlist > Email Service: waitlist notification
Register Public Event > Email Service: confirmation notification
Ask Assistant Question > LLM Provider: tool calling chat completion
```

## 7. نقاط النقاش أمام اللجنة

1. لماذا فصلنا الفاعلين الثانويين؟ لأن Supabase/Email/LLM **أنظمة خارجية** تستقبل رسائل ولا تتفاعل بشكل نشط — وهذا تمييز معياري في UML.
2. «include» مقابل «extend»: الأولى إلزامية دائمًا (تحقق JWT)، والثانية شرطية (تفعيل حد المعدل فقط عند التجاوز) — اشرحها بمثال واحد لكل نوع.
3. اربط أي سؤال بلجنة إلى المصفوفة: كل UC يقابل دوال محددة في `src/services` وجداول في `supabase/schema.sql`.
