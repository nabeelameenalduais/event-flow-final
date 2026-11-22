# 07 — مخطط آلة الحالات (State Machine Diagram)

> **النمط في Eraser:** Flow chart (حالات كعقد مستديرة، انتقالات بأسهم موسومة).
> **المرجع المعياري:** OMG UML 2.5.1 §14 (StateMachines) — حالة أولية `[*]`، انتقالات trigger/guard/action. رُسمت الآلات مسطحة لكل نطاق داخل مجموعة مستقلة بدل الحالات المركّبة (Composite) لتوافق أفضل مع أدوات التوليد — والفصل بين النطاقات بحدود مجموعات يعوض الدلالة.

## 1. الهدف الأكاديمي

يوثق **دورة حياة** الكائنات الحرجة: ما الحالات الممكنة؟ وما الانتقالات المشروعة؟ أي سؤال «هل يمكن أن تكون التذكرة used ثم تعود valid؟» يُجاب من هذا المخطط — وهو أساس اختبارات الحالات الانتقالية (Transition-based testing).

## 2. الوصف الكامل للآلات الست

### A — Registration
- [*] → confirmed: سعة متاحة (إدراج مباشر + توليد تذكرة)
- [*] → waitlisted: capacity full
- waitlisted → confirmed: **ترقية تلقائية** عبر trigger عند إلغاء مؤكد (أقدم بالترتيب registered_at)
- confirmed/waitlisted → cancelled: إلغاء المستخدم أو المنظم
- cancelled → [*]
- ملاحظة دقيقة: **لا توجد حالة pending إطلاقًا** — `schema.sql` لا يعرفها، والتسجيل يُدرج `confirmed` أو `waitlisted` مباشرة فقط.

### B — Ticket
- [*] → valid: تصدر عند confirmed فقط
- valid → used: أول check-in ناجح (نهائي — لا عودة)
- valid → invalid: إبطال إداري من المنظم

### C — Attendance
- [*] → لا سجل
- لا سجل → checked_in: checkIn أو حضور تلقائي أونلاين (idempotent)
- checked_in → checked_out: checkOut يضبط check_out_time

### D — Event
- [*] → draft
- draft ↔ published: publish / unpublish
- published ↔ archived: archive / إعادة نشر من الأرشيف
- قيد: لا تسجيل إلا في published؛ غير المنشور مخفي عن الزوار (RLS+استعلام)

### E — DeviceSession
- [*] → active: عند login
- active → revoked: revoke_session (حذف الصف) / revoke_session_by_id لجهاز محدد / حذف الكل عند إعادة تعيين كلمة المرور
- ملاحظة موثقة: لا انتهاء صلاحية زمني صريح؛ last_active_at للتشخيص فقط

### F — InvitationLink وEvaluationSubmission
- InvitationLink: [*] → unused → used (markLinkAsUsed بعد تسجيل الضيف) — أحادي الاستخدام
- EvaluationSubmission: [*] → submitted (نهائي؛ مضمون بقيود RPC+UNIQUE)

## 3. كود Eraser

```eraser
title State Machines for Critical Domains - flat per aggregate

Group Registration lifecycle [color: lightblue] {
  RegStart [shape: oval, color: black]
  Confirmed [shape: round, color: green]
  Waitlisted [shape: round, color: orange]
  Cancelled [shape: round, color: red]
  RegEnd [shape: oval, color: black]

  RegStart > seats free > Confirmed
  RegStart > capacity full > Waitlisted
  Waitlisted > auto promotion by trigger > Confirmed
  Waitlisted > cancel > Cancelled
  Confirmed > cancel > Cancelled
  Cancelled > RegEnd
}

Group Ticket lifecycle [color: lightgreen] {
  TStart [shape: oval]
  Valid [shape: round, color: green]
  Used [shape: round, color: grey]
  Invalid [shape: round, color: red]

  TStart > issued on confirm > Valid
  Valid > first successful checkin > Used
  Valid > organizer invalidation > Invalid
}

Group Attendance lifecycle [color: lightyellow] {
  AStart [shape: oval]
  NoRecord [shape: round]
  CheckedIn [shape: round, color: green]
  CheckedOut [shape: round, color: grey]

  AStart > NoRecord
  NoRecord > checkin or auto online idempotent > CheckedIn
  CheckedIn > checkout sets time > CheckedOut
}

Group Event lifecycle [color: lightorange] {
  EStart [shape: oval]
  Draft [shape: round]
  Published [shape: round, color: green]
  Archived [shape: round, color: grey]

  EStart > Draft
  Draft > publish > Published
  Published > unpublish > Draft
  Published > archive > Archived
  Archived > republish > Published
}

Group DeviceSession lifecycle [color: lightred] {
  SStart [shape: oval]
  Active [shape: round, color: green]
  Revoked [shape: round, color: red]

  SStart > on login > Active
  Active > logout or remote revoke or password reset all > Revoked
}

Group Single use entities [color: lightgrey] {
  IStart [shape: oval]
  UnusedInvitation [shape: round]
  UsedInvitation [shape: round, color: grey]
  EvalSubmitted [shape: round, color: blue]
  EvalEnd [shape: oval]

  IStart > UnusedInvitation
  UnusedInvitation > markLinkAsUsed after guest registers > UsedInvitation
  IStart > EvalSubmitted
  EvalSubmitted > EvalEnd
}
```

## 4. نقاط النقاش أمام اللجنة

1. **انتقالات نهائية مقصودة:** used وsubmitted لا رجوع فيهما — سلامة أعمال وليست قصورًا.
2. **waitlisted → confirmed:** الانتقال الوحيد الذي تقوم به قاعدة البيانات ذاتيًا (trigger) — اذكر الذرية ومنع سباق المقاعد.
3. **Event دائري (draft↔published↔archived)** مقابل Ticket خطي — اشرح الفلسفة: المحتوى قابل للتحرير، الإثباتات (تذكرة/تقييم) غير قابلة للنقض.
4. إذا طُلب Composite States: اشرح أن كل مجموعة هنا تكافئ آلة مركّبة واحدة وأن الفصل حسّن القراءة.
