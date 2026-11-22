# 04c — مخطط التتابع: تسجيل الحضور Check-in / Check-out

> **النمط في Eraser:** Sequence.
> **المرجع المعياري:** OMG UML 2.5.1 §17 — رسائل self (استدعاء ذاتي)، كتل alt لطرق الفحص الثلاث.

## 1. الهدف الأكاديمي

يوضح كيف تتحقق المنظومة من هوية الحضور عبر ثلاث قنوات (كاميرا QR / إدخال يدوي / حضور تلقائي أونلاين) بمنطق واحد مركزي **idempotent** — أي أن تكرار العملية لا يفسد البيانات — مع تدقيق كامل logAction.

## 2. المشاركون

Scanner UI (QrScanner + html5-qrcode) · ManualEntry UI · AttendanceService.checkIn/findTicketByCode/checkOut/markAutoAttendance · TicketService · Postgres (tickets, attendances, audit_logs).

## 3. الوصف الكامل

### المسار A — بالكاميرا
1. فتح الكاميرا عبر html5-qrcode → قراءة unique_code من صورة QR.
2. `checkIn(code)`:
   - findTicketByCode → alt: غير موجودة → رفض "Ticket not found".
   - alt: status != valid → "Ticket already checked in" أو "تذكرة غير صالحة".
   - alt: registration.status != confirmed → رفض.
3. التحديث الذري: UPDATE tickets SET status='used' WHERE id=... AND status='valid' (شرط يمنع السباق).
4. INSERT attendance(check_in_time=now) إن لم يوجد سجل.
5. logAction('checkin') → audit_logs.
6. عرض شاشة خضراء «تم الدخول بنجاح».

### المسار B — يدوي
نفس المنطق لكن الإدخال نصي للكود (شاشة ManualEntry) عند عجز الكاميرا/إضاءة سيئة.

### Check-out
1. اختيار الحاضر → checkOut(attendanceId): UPDATE check_out_time=now.
2. تحديث صف القائمة لحظيًا.

### المسار C — حضور تلقائي أونلاين (markAutoAttendance)
1. المستخدم يفتح رابط اجتماع فعالية أونلاين.
2. findTicketByAttendee(userId,eventId).
3. alt: توجد تذكرة مؤكدة ولا attendance سابق → INSERT attendance (idempotent by ticket_id unique) دون check_out_time.
4. alt: لا تذكرة مؤكدة → لا تسجيل حضور (NoAction صامت).

## 4. كود Eraser

```eraser
title Check-in Sequence - camera manual and auto online paths

participant GateUI [icon: browser]
participant Scanner [icon: qr-code]
participant AttendanceService [icon: function]
participant Postgres [icon: database]
participant AuditLog [icon: shield]

GateUI > Scanner: open camera html5-qrcode
Scanner > GateUI: decoded unique_code
GateUI > AttendanceService: checkIn(code)
AttendanceService > Postgres: select ticket join registration by code

if ticket not found {
  AttendanceService > GateUI: error Ticket not found then retry prompt
} else ticket status invalid or used {
  AttendanceService > GateUI: error already checked in or invalid
} else registration not confirmed {
  AttendanceService > GateUI: error registration not confirmed
} else all valid {
  AttendanceService > Postgres: update tickets set used where status valid
  AttendanceService > Postgres: insert attendance check_in_time now if absent
  AttendanceService > AuditLog: logAction CHECKIN
  AttendanceService > GateUI: success green screen
}

opt manual entry fallback {
  GateUI > AttendanceService: checkIn(typedCode)
}

opt later checkout {
  GateUI > AttendanceService: checkOut(attendanceId)
  AttendanceService > Postgres: update attendance set check_out_time now
}

Group Online event auto path {
  GateUI > AttendanceService: markAutoAttendance(userId eventId)
  AttendanceService > Postgres: findTicketByAttendee
  if confirmed ticket exists and no attendance row {
    AttendanceService > Postgres: insert attendance idempotent
  } else {
    AttendanceService > GateUI: no action silent
  }
}
```

## 5. نقاط النقاش أمام اللجنة

1. **Idempotency:** شرط `AND status='valid'` في UPDATE يجعل التكرار آمنًا — اشرح race condition بين جهازَي فحص لنفس التذكرة.
2. **لماذا ثلاث مسارات؟** توافر (availability): تعطل الكاميرا أو ضعف الشبكة لا يعطل البوابة — NF-موثوقية.
3. **التدقيق:** كل عملية دخول تترك أثرًا غير قابل للتغيير (append-only) — قابلية المساءلة Accountability.
