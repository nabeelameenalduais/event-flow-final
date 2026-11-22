# 04d — مخطط التتابع: الدردشة اللحظية (Realtime Chat)

> **النمط في Eraser:** Sequence.
> **المرجع المعياري:** OMG UML 2.5.1 §17 — رسائل غير متزامنة (async) والعودات (reply)، مع نمذجة قناة بث Realtime كمشارك.

## 1. الهدف الأكاديمي

يبرز قدرة المنظومة على **التواصل ثنائي الاتجاه اللحظي** بين الحاضرين ومنظم الفعالية داخل قناة كل فعالية، عبر Postgres Changes (WebSocket) — نقطة تقنية تميز المشروع (F6.1).

## 2. المشاركون

Chat UI (useChat hook) · ChatService · Supabase REST (insert/select) · Realtime Channel (WSS broadcast من postgres_changes) · مشارك آخر (Attendee/Organizer).

## 3. الوصف الكامل

1. فتح صفحة الفعالية → `joinChannel(eventId)`:
   - التأكد من وجود chat_channels للفعالية (إنشاء إن غابت): channel_type=general عامة، أو private بثنائية organizer_id+attendee_id لرسائل مباشرة.
   - جلب آخر N رسالة (select order by created_at asc).
   - الاشتراك: channel.on(postgres_changes, INSERT, filter=channel_id).
2. الإرسال:
   - UI > ChatService: sendMessage(content).
   - تحقق: نص غير فارغ + عضوية/صلاحية القناة (RLS).
   - INSERT chat_messages(sender_id, content).
   - Postgres يبث الحدث عبر postgres_changes لكل المشتركين.
3. الاستقبال عند كل عميل مشترك:
   - callback يضيف الرسالة للحالة المحلية ويمررها للواجهة.
4. الخروج من الصفحة → unsubscribe وإغلاق القناة.
5. alt خطأ شبكة أثناء الإرسال → رسالة فاشلة بعلامة إعادة إرسال (إعادة محاولة يدوية).

ملاحظات تصميمية موثقة: لا تخزين مؤقت offline؛ الرسائل نصوص فقط؛ الصلاحيات عبر RLS (قراءة لأي مسجل بالفعالية، كتابة بنفس الشرط).

## 4. كود Eraser

```eraser
title Realtime Chat Sequence - join send receive leave

participant ChatUI [icon: browser]
participant ChatService [icon: function]
participant SupabaseREST [icon: database]
participant RealtimeChannel [icon: broadcast]
participant OtherClient [icon: browser]

ChatUI > ChatService: joinChannel(eventId)
ChatService > SupabaseREST: select or create chat_channel type general or private
SupabaseREST > ChatService: channel id and last messages
ChatService > RealtimeChannel: subscribe on insert filter channel id
RealtimeChannel > ChatUI: history rendered

loop while page open
  ChatUI > ChatService: sendMessage(content)
  ChatService > SupabaseREST: insert chat_messages
  SupabaseREST > RealtimeChannel: postgres_changes broadcast
  RealtimeChannel > ChatUI: new message callback
  RealtimeChannel > OtherClient: same message delivered
  OtherClient > OtherClient: append to local state
end

opt send failure network
  SupabaseREST > ChatUI: error mark message failed with retry
end

ChatUI > ChatService: leavePage
ChatService > RealtimeChannel: unsubscribe close socket
```

## 5. نقاط النقاش أمام اللجنة

1. **postgres_changes مقابل Broadcast مباشر:** اخترنا أولًا ليستفيد العملاء المتأخرون من السجل المخزن — اشرح المفاضلة.
2. **RLS على القراءة والكتابة:** لا يمكن قراءة قناة فعالية غير مسجل بها — أمان افتراضي.
3. **لماذا WSS وليس Polling؟** زمن استجابة أدنى وتكلفة طلبات أقل — قارن كميًا لو سُئلت.
