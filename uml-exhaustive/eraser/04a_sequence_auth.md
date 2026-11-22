# 04a — مخطط التتابع: المصادقة وإدارة الجلسات (نسخة مطابقة للكود)

> **النمط في Eraser:** Sequence.
> **المرجع المعياري:** OMG UML 2.5.1 §17 — خطوط حياة، تنشيط، كتل alt/opt بحرّيات. أسماء الرسائل هنا هي أسماء الدوال الحقيقية من `supabase/schema.sql` و`src/services/authService.ts`.

## 1. الهدف الأكاديمي

إظهار التفاعل الزمني للمصادقة مع إبراز أن **التحقق يتم داخل قاعدة البيانات** (دوال SECURITY DEFINER): bcrypt + توافق قديم SHA-256، حد معدل عبر auth_attempts، جلسات أجهزة تُبطل بالحذف، ورموز إعادة تعيين أحادية الاستخدام.

## 2. المشاركون

React UI · AuthService · Supabase Postgres RPCs: `authenticate_user`, `register_user`, `get_session_user`, `revoke_session`, `revoke_session_by_id`, `request_password_reset`, `reset_password_with_token` · جداول device_sessions / auth_attempts / password_reset_tokens / audit_logs.

## 3. الوصف الكامل

1. **دخول:** UI → `authenticate_user(email,password)`؛ داخل الدالة: فحص auth_attempts (5 فاشلة/15 دقيقة → قفل)، bcrypt.compare، وتوافق حسابات قديمة بـSHA-256 — كل ذلك خادميًا (hash لا يغادر القاعدة).
2. النجاح → إنشاء صف device_sessions (token عشوائي يُخزن نصًا + device_name/ip_address) وحفظه في localStorage (`eventflow_session`) + audit_logs(LOGIN).
3. **استعادة الجلسة:** `get_session_user(token)` يعيد المستخدم ويحدّث last_active_at (لا انتهاء زمني صريح — موثق في 07).
4. **تسجيل attendee:** فحص مسبق `user_exists/get_profile_by_email` ثم `register_user(email,password,first,last)` — رسائل عامة ضد التعداد.
5. **كلمة المرور:** `request_password_reset` يستجيب دائمًا بنفس الرسالة؛ `reset_password_with_token` يفحص expires_at وused_at ثم يحذف كل جلسات المستخدم.
6. **خروج:** `revoke_session(token)` أو `revoke_session_by_id(userId,sessionId)` — الإبطال = **حذف الصف** (لا عمود revoked_at في المخطط الفعلي).

## 4. كود Eraser

```eraser
title Authentication Sequence - real rpc names from schema.sql

participant UI [icon: browser]
participant AuthSvc [icon: function]
participant RateGuard [icon: gauge, label: auth_attempts 5 per 15 min]
participant DbRpc [icon: database, label: security definer functions]
participant Sessions [icon: smartphone, label: device_sessions]

UI > AuthSvc: login(email password)
AuthSvc > RateGuard: recent failures for email
RateGuard > AuthSvc: allowed or locked
AuthSvc > DbRpc: rpc authenticate_user(email password)

alt locked too many attempts {
  DbRpc > AuthSvc: AUTH_LOCKED
} else bcrypt match or legacy sha256 match {
  DbRpc > AuthSvc: user json payload
} else invalid {
  DbRpc > AuthSvc: INVALID_CREDENTIALS
  AuthSvc > UI: arabic error message
}

AuthSvc > Sessions: insert device session token device_name ip_address
Sessions > AuthSvc: session row
AuthSvc > UI: store eventflow_session localStorage
AuthSvc > DbRpc: insert audit_logs LOGIN

opt app start restore
  UI > AuthSvc: restoreSession()
  AuthSvc > DbRpc: rpc get_session_user(token)
  DbRpc > Sessions: update last_active_at
  DbRpc > AuthSvc: profile plus role
  AuthSvc > UI: authenticated context
end

opt register attendee
  UI > AuthSvc: register(email password names)
  AuthSvc > DbRpc: rpc user_exists then get_profile_by_email guard
  AuthSvc > DbRpc: rpc register_user(email password first_name last_name)
  DbRpc > AuthSvc: created profile
end

opt forgot password
  UI > AuthSvc: requestReset(email)
  AuthSvc > DbRpc: rpc request_password_reset(email)
  DbRpc > UI: same generic response always anti enumeration
  UI > AuthSvc: resetPassword(token newPassword)
  AuthSvc > DbRpc: rpc reset_password_with_token(token pwd)
  DbRpc > Sessions: delete all sessions of user
end

UI > AuthSvc: logout()
AuthSvc > DbRpc: rpc revoke_session(token)
DbRpc > Sessions: delete session row
AuthSvc > UI: clear storage redirect login
```

## 5. نقاط النقاش أمام اللجنة

1. **SECURITY DEFINER:** الهاش يُقارن داخل القاعدة ولا يُسرب للعميل — والفرق عن INVOKER مع RLS.
2. **توافق SHA-256 القديم داخل الدالة نفسها** وليس في العميل — ترحيل آمن دون كسر الحسابات القديمة.
3. **الإبطال بالحذف:** بساطة الاستعلام (وجود الصف = جلسة صالحة) — ومسار `revoke_session_by_id` لإبطال جهاز محدد من لوحة الجلسات.
4. **رسالة الاستعادة العامة** تمنع تعداد الحسابات.
