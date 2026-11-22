# 04f — مخطط التتابع: المساعد الذكي (Chatbot — التنفيذ الفعلي)

> **النمط في Eraser:** Sequence.
> **المرجع المعياري:** OMG UML 2.5.1 §17 — نمذجة حلقة tool-calling بكتلة loop، ومسار الفشل باستخدام alt.
> **التنفيذ الفعلي:** `useChat.ts` — المتصفح يتصل مباشرة بنموذج **LM Studio المحلي** عبر `POST /lmstudio/v1/chat/completions`، والأدوات تُنفَّذ من المتصفح عبر **Supabase REST** مباشرة (بلا Edge Function وبلا مفاتيح سحابية في الواجهة).

## 1. الهدف الأكاديمي

عنصر تقني (F8.1): واجهة مساعد تربط نموذج لغوي بقاعدة بيانات عبر **استدعاء أدوات** (tool-calling),
والأدوات تُنفَّذ عميلًا عبر REST — تسامح مع الخطأ (LM Studio متوقف → رسالة خطأ واضحة)، وتبسيط أمني
(لا مفاتيح مزود مخزنة خادميًا).

## 2. المشاركون

ChatWidget UI (useChat) · LM Studio (خادم النموذج المحلي) · Supabase REST (البيانات) — معًا في المتصفح.

## 3. الوصف الكامل

1. المستخدم يطرح سؤالًا («هل تبقى مقاعد في فعالية X؟»).
2. UI > LMStudio: `POST /lmstudio/v1/chat/completions` (system prompt يصف الأدوات الست + رسالة المستخدم).
3. alt رد نصي نهائي → يُعرض مباشرة.
4. else رد بصيغة JSON أداة → `parseToolCalls` يفحص الأداة (من قائمة معروفة فقط).
5. تنفيذ الأداة من المتصفح عبر REST مباشرة: `search_events`، `get_upcoming_events`، `get_event_details`، `get_categories`، `get_venues`، `get_event_stats` (محددات `status`/`deleted_at` واقعية وRLS).
6. إعادة النتيجة للنموذج كرسالة tool result لإعادة الصياغة، مع **loop حتى 5 تكرارات**.
7. **alt فشل النموذج (LM Studio غير متصل/خطأ):** عرض رسالة خطأ (setError، لا رد مُلفّق — «NEVER make up data» في الـ system prompt).
8. **alt إلغاء من المستخدم:** abort() يعيق الطلب (AbortError بلا تحديث حالة).

## 4. كود Eraser

```eraser
title Chatbot Sequence - actual implementation (useChat + local LM Studio)

participant UserUI [icon: browser]
participant LMStudio [icon: cpu]
participant SupabaseREST [icon: database]

UserUI > UserUI: append user message, isLoading=true
UserUI > LMStudio: POST /lmstudio/v1/chat/completions (system tools + message)
alt final text reply {
  LMStudio > UserUI: assistant content
} else tool call JSON {
  LMStudio > UserUI: {"name": "search_events", "args": {...}}
  UserUI > UserUI: parseToolCalls -> known tools only
  UserUI > SupabaseREST: GET /rest/v1/events?status=eq.published... (executeTool)
  SupabaseREST > UserUI: rows
  loop until final answer or max 5 turns
    UserUI > LMStudio: tool results + "compose your response"
    LMStudio > UserUI: answer content
  end
}

opt LM Studio offline or error {
  LMStudio > UserUI: HTTP error
  UserUI > UserUI: setError(message), no fabricated reply
}

opt user aborts {
  UserUI > LMStudio: abort()
}
```

## 5. نقاط النقاش أمام اللجنة

1. **لماذا تنفيذ الأدوات عميلًا؟** لا حاجة لمفتاح خدمة؛ RLS تفصل كل استعلام، ونحن في بيئة تطوير محلية تشغّل النموذج على نفس الجهاز.
2. **Tool-calling مقابل RAG:** اخترنا أدوات استعلام محددة لأن البيانات مهيكلة علائيًا؛ الدقة أعلى من تضمين نصي.
3. **قيد الصدق:** الـ system prompt يمنع النموذج من اختلاق بيانات («NEVER make up data») ويصيغ النتائج حرفيًّا من أدوات REST.
4. **حد الدورات max 5** يمنع الحلقات اللانهائية — وعي هندسي موثق.