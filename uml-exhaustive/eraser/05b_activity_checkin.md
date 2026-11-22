# 05b — مخطط النشاط: تدفق الحضور عند البوابة (Activity — Check-in)

> **النمط في Eraser:** Flow chart.
> **المرجع المعياري:** OMG UML 2.5.1 §15 — قرار متعدد الحالات (حالة التذكرة valid/used/invalid)، حلقة إعادة المحاولة، وقسم مسار أونلاين الموازي.

## 1. الهدف الأكاديمي

يغطي أكثر تدفق تشغيلي حساسية في الفعالية: البوابة. يوضح التعامل مع كل حالات الرفض، وحلقة «إعادة فحص؟» التي تحاكي واقع الطوابير، ومسار الحضور التلقائي للفعاليات الأونلاين.

## 2. الوصف الكامل للتدفق

### القسم الرئيسي (البوابة)
1. **بداية:** حضور حاضر عند البوابة.
2. **معين 1 — طريقة الفحص؟**
   - كاميرا: قراءة QR عبر html5-qrcode → الحصول على unique_code.
   - يدوي: إدخال الكود نصيًا → نفس النقطة.
3. `findTicketByCode / checkIn`.
4. **معين 2 — تذكرة موجودة؟** لا → رفض "Ticket not found" → **معين إعادة فحص؟**
5. **معين 3 — حالة التذكرة؟**
   - used → رفض "already checked in" → إعادة فحص؟
   - invalid → رفض تذكرة غير صالحة → إعادة فحص؟
   - valid → متابعة.
6. **معين 4 — حالة التسجيل confirmed؟** لا → رفض → إعادة فحص؟
7. UPDATE tickets SET used → INSERT attendance(check_in_time) → logAction checkin → شاشة خضراء «تم الدخول».
8. **معين 5 — سيغادر لاحقًا؟** نعم: لاحقًا checkOut يضبط check_out_time → نهاية سجل حضور كامل؛ لا: نهاية مباشرة.

### حلقة الإعادة
- «إعادة فحص؟» نعم → العودة لاختيار طريقة الفحص (سلوك موظف البوابة الطبيعي).
- لا → **نهاية: حُرم الدخول** (مساءلة كاملة عبر audit).

### القسم الموازي — فعاليات أونلاين
1. فتح رابط الاجتماع → findTicketByAttendee.
2. تذكرة مؤكدة؟ لا → لا تسجيل حضور.
3. نعم → سجل حضور سابق؟ نعم → لا شيء (idempotent)؛ لا → UPDATE tickets=used + INSERT attendance → لا شيء إضافي.

## 3. كود Eraser

```eraser
title Activity Diagram - Gate Check-in and Online Auto Attendance

Start [shape: oval, color: green]
ChooseMode [shape: diamond]
ScanQR [shape: rectangle]
ManualEntry [shape: rectangle]
GetCode [shape: rectangle]
Lookup [shape: rectangle]
TicketFound [shape: diamond]
ErrNotFound [shape: parallelogram, color: red]
TicketState [shape: diamond]
ErrUsed [shape: parallelogram, color: red]
ErrInvalid [shape: parallelogram, color: red]
RegConfirmed [shape: diamond]
ErrReg [shape: parallelogram, color: red]
MarkUsed [shape: rectangle]
InsertAttendance [shape: rectangle]
AuditCheckin [shape: rectangle]
ShowSuccess [shape: rectangle, color: green]
WillLeave [shape: diamond]
DoCheckout [shape: rectangle]
DoneFull [shape: oval, color: green]
Retry [shape: diamond]
Denied [shape: oval, color: red]

Start > ChooseMode
ChooseMode > camera > ScanQR > GetCode
ChooseMode > manual > ManualEntry > GetCode
GetCode > Lookup > TicketFound
TicketFound > no > ErrNotFound
TicketFound > yes > TicketState
TicketState > used > ErrUsed
TicketState > invalid > ErrInvalid
TicketState > valid > RegConfirmed
RegConfirmed > no > ErrReg
RegConfirmed > yes > MarkUsed > InsertAttendance > AuditCheckin > ShowSuccess > WillLeave
WillLeave > yes > DoCheckout > DoneFull
WillLeave > no > DoneFull

ErrNotFound > Retry
ErrUsed > Retry
ErrInvalid > Retry
ErrReg > Retry
Retry > yes > ChooseMode
Retry > no > Denied

Group Online events auto path {
  OpenMeetingLink [shape: oval, color: blue]
  FindByAttendee [shape: rectangle]
  HasConfirmedTicket [shape: diamond]
  NoAction [shape: oval, color: grey]
  PrevAttendance [shape: diamond]
  AutoMark [shape: rectangle]

  OpenMeetingLink > FindByAttendee > HasConfirmedTicket
  HasConfirmedTicket > no > NoAction
  HasConfirmedTicket > yes > PrevAttendance
  PrevAttendance > yes > NoAction
  PrevAttendance > no > AutoMark > NoAction
}
```

## 4. نقاط النقاش أمام اللجنة

1. **حلقة إعادة المحاولة ليست تفصيلًا تجميليًا:** نمذجة سلوك تشغيلي حقيقي وتقلل زمن خدمة الطابور.
2. **ترتيب الفحوص:** الوجود ثم الحالة ثم التسجيل — كل رفض برسالة محددة تساعد موظف البوابة على الحسم فورًا.
3. **Idempotency ظاهرة مرتين:** شرط status='valid' في التحديث + فحص سجل الحضور السابق في المسار الأونلاين — نقطة هندسية قوية إذا سُئلت عن تكرار العمليات.
