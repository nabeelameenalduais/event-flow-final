# 04b — مخطط التتابع: التسجيل والدعوات وقائمة الانتظار (Registration)

> **النمط في Eraser:** Sequence.
> **المرجع المعياري:** OMG UML 2.5.1 §17 — كتل alt متداخلة لقرارات السعة والرؤية، رسائل إنشاء (create) للتذكرة.

## 1. الهدف الأكاديمي

أكثر سيناريو غنى بالقواعد العملية في المشروع: يجمع **التحقق المتسلسل**، و**الدعوات الخاصة**، و**إدارة المقاعد**، و**الترقية التلقائية من قائمة الانتظار** عبر trigger — مثال ممتاز لتوضيح تكامل منطق التطبيق مع قيود قاعدة البيانات (NF4, NF5).

## 2. المشاركون

React UI · EventService.registerForEvent · InvitationService.getLinkByCode · TicketService.generateTicket · NotificationService · Postgres (registrations + trigger notify_waitlist_promotion) · Email Service (ثانوي).

## 3. الوصف الكامل للتفاعل (registerForEvent)

1. UI يستدعي `registerForEvent(eventId, invitationCode?)`.
2. جلب بيانات الفعالية: title/capacity/visibility/status/deadlines.
3. **alt: غير منشورة؟** → خطأ "This event is not open for registration".
4. **alt: تجاوز registration_deadline؟** → خطأ مقابلة.
5. **alt: الفعالية انتهت (end_time مضى)؟** → خطأ.
6. **alt: visibility = private؟**
   - لا رمز دعوة → خطأ "An invitation code is required".
   - `getLinkByCode(code)` ثم سلسلة فحوص: موجود؟ / used = false؟ / event_id يطابق؟ / email = بريد المستخدم الحالي؟
   - أي فشل → رسالة عربية محددة (ErrorMapper).
7. **فحص التكرار:** تسجيل قائم لنفس المستخدم/الفعالية → "Already registered".
8. عدّ confirmed: count(*) where status=confirmed.
9. **alt: count >= capacity**
   - INSERT registrations(status=waitlisted) + إشعار waitlist.
   - **else:** INSERT registrations(status=confirmed).
     - generateTicket: unique_code عشوائي + توليد QR + status=valid.
     - إشعار confirmation عبر Email Service.
10. **بعد النجاح في خاص:** markLinkAsUsed(used=true, used_at=now) + إشعار المنظم invitation_used.
11. **مسار الإلغاء cancelRegistration:** UPDATE status=cancelled → التطبيق يرقّي أقدم waitlisted (order by registered_at limit 1) بتحديثه إلى confirmed → يُنشئ تذكرة → **trigger_waitlist_promotion** (notify_waitlist_promotion) يكتشف الانتقال waitlisted→confirmed ويدرج إشعار waitlist_promotion للمستخدم المرقّى تلقائيًا.

## 4. كود Eraser

```eraser
title Registration Sequence with invitations and waitlist promotion

participant UI [icon: browser]
participant EventService [icon: function]
participant InvitationService [icon: function]
participant TicketService [icon: function]
participant Postgres [icon: database]
participant Trigger [icon: bolt]
participant EmailService [icon: mail]

UI > EventService: registerForEvent(eventId, invitationCode)
EventService > Postgres: select event by id
Postgres > EventService: title capacity visibility status deadlines

if event not published {
  EventService > UI: error not open for registration
} else deadline passed {
  EventService > UI: error registration deadline passed
} else event ended {
  EventService > UI: error already ended
} else visibility private {

  if no invitation code {
    EventService > UI: error invitation required
  } else {
    EventService > InvitationService: getLinkByCode(code)
    InvitationService > Postgres: select invitation_links by code
    InvitationService > EventService: link or validation error
    if invalid or used or wrong event or wrong email {
      EventService > UI: Arabic specific error
    }
  }
}

EventService > Postgres: count registrations where confirmed
Postgres > EventService: count

if count >= capacity {
  EventService > Postgres: insert registrations status waitlisted
  EventService > EmailService: send waitlist notification
  EventService > UI: joined waitlist
} else {
  EventService > Postgres: insert registrations status confirmed
  EventService > TicketService: generateTicket(registrationId)
  TicketService > Postgres: insert tickets unique_code status valid
  TicketService > EventService: ticket with QR
  EventService > EmailService: send confirmation notification

  opt private event success path {
    EventService > InvitationService: markLinkAsUsed(linkId)
    InvitationService > Postgres: update used true used_at now
    EventService > EmailService: notify organizer invitation_used
  }
  EventService > UI: registered with QR ticket
}

UI > EventService: cancelRegistration(registrationId)
EventService > Postgres: update registrations set cancelled
EventService > Postgres: promote oldest waitlisted to confirmed
EventService > TicketService: create promoted ticket
Postgres > Trigger: trigger_waitlist_promotion fires on status change
Trigger > Postgres: insert notification waitlist_promotion
Postgres > UI: cancellation done
```

## 5. نقاط النقاش أمام اللجنة

1. **لماذا التحقق في التطبيق وقاعدة البيانات معًا؟** الدفاع العميق: RLS + CHECK تمنع التجاوز حتى لو اختُرق العميل.
2. **فصل المسؤوليات في الترقية:** التطبيق يقرأ من يُرقّى (أقدم waitlisted) ويحدّثه، والـtrigger يضمن أن كل انتقال waitlisted→confirmed يولّد إشعارًا تلقائيًا حتى لو حدث من مسار غير متوقع — طبقتا ضمان.
3. **سلسلة فحوص الدعوة الأربعة:** كل فشل له رسالة مستقلة (UX) لكن دون كشف معلومات عن الآخرين.
4. اعرض التعددية 1—0..1 بين Registration وTicket هنا عمليًا: waitlisted بلا تذكرة، confirmed بتذكرة.
