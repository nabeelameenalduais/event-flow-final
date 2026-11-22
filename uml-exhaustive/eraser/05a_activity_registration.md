# 05a — مخطط النشاط: تدفق التسجيل في فعالية (Activity — Registration)

> **النمط في Eraser:** Flow chart.
> **المرجع المعياري:** OMG UML 2.5.1 §15 (ActivityDiagrams) — عقدة بداية/نهاية، عقد قرار diamond بحرّيات، عقد إجراءات، مسارات فشل موازية تنتهي بعقدة نهاية خطأ.

## 1. الهدف الأكاديمي

يحوّل منطق `registerForEvent` من كود إلى **تدفق تحكم قابل للعرض على غير المبرمج** أمام اللجنة: كل معين (diamond) هو قاعدة عمل، وكل مستطيل إجراء تقني محدد مصدره.

## 2. الوصف الكامل للتدفق

1. **بداية:** طلب تسجيل في فعالية (مع رمز دعوة إن وُجد).
2. جلب بيانات الفعالية (title/capacity/visibility/status/deadlines).
3. **معين 1 — منشورة؟** لا → خطأ "not open for registration" → نهاية فشل.
4. **معين 2 — قبل registration_deadline؟** لا → خطأ → نهاية فشل.
5. **معين 3 — لم تنتهِ الفعالية؟** لا → خطأ → نهاية فشل.
6. **معين 4 — visibility؟**
   - **private:** هل أُدخل رمز دعوة؟ لا → خطأ "invitation required".
     - getLinkByCode ثم أربعة فحوص متسلسلة (موجود / غير مستخدم / يخص هذه الفعالية / البريد مطابق) — أول فشل يقفز لنهاية برسالته الخاصة.
   - **public:** تخطَّ إلى الفحص التالي مباشرة.
7. **معين 5 — مسجّل مسبقًا؟** نعم → خطأ "Already registered" → نهاية فشل.
8. عدّ المسجلين confirmed.
9. **معين 6 — count >= capacity؟**
   - **نعم:** INSERT waitlisted → إشعار «waitlist» → **نهاية: قائمة انتظار**.
   - **لا:** INSERT confirmed → generateTicket (unique_code+QR) → إشعار confirmation →
     - **معين 7 — فعالية خاصة؟** نعم: markLinkAsUsed + إشعار المنظم invitation_used؛ لا: تجاوز.
     - **نهاية النجاح:** تم التسجيل وتذكرة QR جاهزة.

ملاحظة أكاديمية: هذا نشاط بـ«مسار واحد ومتفرعات» (بدون fork/join حقيقي) لأن العملية متزامنة من منظور المستخدم.

## 3. كود Eraser

```eraser
title Activity Diagram - Event Registration Flow

Start [shape: oval, color: green]
FetchEvent [shape: rectangle]
CheckPublished [shape: diamond]
ErrClosed [shape: parallelogram, color: red]
CheckDeadline [shape: diamond]
ErrDeadline [shape: parallelogram, color: red]
CheckEnded [shape: diamond]
ErrEnded [shape: parallelogram, color: red]
CheckVisibility [shape: diamond]
HasCode [shape: diamond]
ErrCode [shape: parallelogram, color: red]
GetLink [shape: rectangle]
LinkValid [shape: diamond]
ErrInvitation [shape: parallelogram, color: red]
CheckDuplicate [shape: diamond]
ErrDuplicate [shape: parallelogram, color: red]
CountSeats [shape: rectangle]
IsFull [shape: diamond]
JoinWaitlist [shape: rectangle]
NotifyWaitlist [shape: rectangle]
EndWait [shape: oval, color: orange]
ConfirmInsert [shape: rectangle]
GenerateTicket [shape: rectangle]
NotifyConfirm [shape: rectangle]
IsPrivate [shape: diamond]
MarkLinkUsed [shape: rectangle]
EndOk [shape: oval, color: green]
EndFail [shape: oval, color: red]

Start > FetchEvent > CheckPublished
CheckPublished > no > ErrClosed
CheckPublished > yes > CheckDeadline
CheckDeadline > no > ErrDeadline
CheckDeadline > yes > CheckEnded
CheckEnded > no > ErrEnded
CheckEnded > yes > CheckVisibility

CheckVisibility > private > HasCode
HasCode > no > ErrCode
HasCode > yes > GetLink > LinkValid
LinkValid > invalid > ErrInvitation
LinkValid > ok > CheckDuplicate

CheckVisibility > public > CheckDuplicate
CheckDuplicate > yes > ErrDuplicate
CheckDuplicate > no > CountSeats > IsFull

IsFull > yes > JoinWaitlist > NotifyWaitlist > EndWait
IsFull > no > ConfirmInsert > GenerateTicket > NotifyConfirm > IsPrivate
IsPrivate > yes > MarkLinkUsed > EndOk
IsPrivate > no > EndOk

ErrClosed > EndFail
ErrDeadline > EndFail
ErrEnded > EndFail
ErrCode > EndFail
ErrInvitation > EndFail
ErrDuplicate > EndFail
```

## 4. نقاط النقاش أمام اللجنة

1. **ستة معايير قرار = ست قواعد عمل:** اقرأها بالترتيب وأنت تشرح؛ الترتيب مقصود (الأرخص أولًا: الحالة قبل العدّ).
2. **ثلاث نهايات مختلفة:** نجاح أخضر / انتظار برتقالي / فشل أحمر — توضح أن «رفض التسجيل» ليس خطأ نظامًا بل نتيجة أعمال مشروعة.
3. إذا سُئلت عن الفرق بين Activity وSequence: الأول يجيب «ما الخطوات والشروط؟» والثاني «من ينادي من ومتى؟» — وكلاهما موجودان لهذا السيناريو (04b).
