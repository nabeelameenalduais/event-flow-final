# 04e — مخطط التتابع: الاستبيان والتقييم (نسخة مطابقة للمخطط الفعلي)

> **النمط في Eraser:** Sequence.
> **المرجع المعياري:** OMG UML 2.5.1 §17 — كتلة alt للتحقق المسبق، رسالة RPC متزامنة بقيمة إرجاع. السلسلة الحقيقية: evaluations → evaluation_questions → evaluation_submissions → evaluation_answers.

## 1. الهدف الأكاديمي

نمذجة جمع تقييمات ما بعد الفعالية بضمانة **المرة الواحدة لكل حاضر لكل استبيان**: UNIQUE(evaluation_id, attendee_id) + فحص داخل دالة `submit_evaluation` (SECURITY DEFINER) — القيد الحرج في طبقة الثقة لا في الواجهة.

## 2. المشاركون

Evaluation UI · EvaluationService · Postgres RPC `submit_evaluation` · جداول evaluations / evaluation_questions / evaluation_submissions / evaluation_answers / notifications.

## 3. الوصف الكامل

1. **فتح الاستمارة:** fetchForm(eventId) → select evaluations where event_id ثم evaluation_questions where evaluation_id (question_type + options jsonb + sort_order).
2. **الإرسال:** UI يجمع الأجوبة → EvaluationService يستدعي RPC واحدًا بتمريرها JSON.
3. **داخل submit_evaluation (ذرية):**
   - التحقق أن attendee مسجل confirmed بالفعالية.
   - فحص وجود submission سابق لنفس (evaluation_id, attendee_id) → موجود؟ رفض «تم التقييم مسبقًا».
   - INSERT submission (rating إجمالي، is_public) ثم INSERT answers بالجملة في نفس المعاملة؛ قيد UNIQUE(submission_id, question_id) يمنع تكرار الإجابة على السؤال.
4. **بعد النجاح:** تعطيل زر الإرسال للعميل + إشعار شكر عبر notifications.
5. **المنظم لاحقًا:** نتائج مجمعة (متوسط rating، توزيع الأجوبة، is_public فقط للعرض العلني).

## 4. كود Eraser

```eraser
title Evaluation Sequence - evaluations questions submissions answers chain

participant EvalUI [icon: browser]
participant EvalSvc [icon: function]
participant SubmitRpc [icon: database, label: submit_evaluation security definer]
participant Questions [icon: list, label: evaluation_questions]
participant Submissions [icon: database, label: evaluation_submissions]
participant Answers [icon: database, label: evaluation_answers]

EvalUI > EvalSvc: fetchForm(eventId)
EvalSvc > Submissions: select evaluations where event_id
EvalSvc > Questions: select questions where evaluation_id order sort_order
Questions > EvalUI: form rendered rating and text types

EvalUI > EvalSvc: submitEvaluation(evaluationId answers)
EvalSvc > SubmitRpc: rpc submit_evaluation payload json

SubmitRpc > Submissions: check registration confirmed
SubmitRpc > Submissions: exists submission for evaluation plus attendee

alt already submitted {
  SubmitRpc > EvalUI: error evaluated before
} else first time {
  SubmitRpc > Submissions: insert submission rating is_public
  SubmitRpc > Answers: bulk insert answers same transaction unique per question
  SubmitRpc > EvalUI: success thanks notification inserted
  EvalUI > EvalUI: disable submit permanently
}

opt organizer later {
  EvalUI > EvalSvc: getResults(evaluationId)
  EvalSvc > Answers: aggregate averages and distribution
  Answers > EvalUI: results dashboard public rows only if is_public
}
```

## 5. نقاط النقاش أمام اللجنة

1. **طبقتا حماية للتفرد:** فحص منطقي داخل الدالة + UNIQUE(evaluation_id,attendee_id) كخط أخير ضد السباق — Defense in Depth.
2. **JSON payload واحد** بدل N طلبات: ذرية معاملية وأداء شبكي أفضل.
3. **privacy/is_public:** التحكم بمن يرى التقييمات — نقطة خصوصية مدروسة.
