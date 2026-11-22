# 03 — مخطط الكيانات والعلاقات (ERD) — النسخة المطابقة للقاعدة الفعلية

> **النمط في Eraser:** ER (Crow's Foot).
> **المرجع المعياري:** Crow's Foot القياسي؛ يعادل UML Class لطبقة البيانات. **مصدر الحقيقة:** `المتطلبات الخارجية\uml\03_erd.mmd` المُتحقق منه ضد `supabase/schema.sql` وأكواد الخدمات — 30 جدولًا وكل علاقة FK حقيقية.

## 1. الهدف الأكاديمي

توثيق المخطط المنطقي للبيانات: الكيانات، PK/FK، التعدديات، قيود التفرد — وإثبات التطبيع (3NF) وفصل الأدوار عبر جدولي roles/profiles.

## 2. القرارات التصميمية الجوهرية

1. **فصل الهوية عن الملف الشخصي:** users (اعتماد فقط: email/password_hash/suspended) ↔ profiles (بيانات + role_id FK + manages_all_events).
2. **تذكرة لكل تسجيل مؤكد:** tickets.registration_id UNIQUE (1—0..1).
3. **تقييم مرة واحدة:** UNIQUE(evaluation_id, attendee_id) على evaluation_submissions، محمي أيضًا بـRPC `submit_evaluation` (SECURITY DEFINER).
4. **منظمون متعددون لفعالية:** event_organizers مع UNIQUE(event_id,user_id) وis_primary.
5. **دردشة بنوعين قنوات:** chat_channels.channel_type = general / private (organizer_id أو attendee_id حسب النوع).
6. **أمان:** device_sessions (token نصي + last_active_at، الإبطال بالحذف عبر revoke_session)، password_reset_tokens (expires_at/used_at)، auth_attempts (email+attempted_at لحد 5/15د)، audit_logs append-only.
7. **إعدادات مهيكلة:** app_settings صف واحد (app_name/timezone/theme...) + email_templates جدول مستقل.

## 3. كود Eraser

```eraser
title EventFlow ERD - 30 tables matching supabase schema

users [id PK, email UK, password_hash, suspended, created_at, updated_at]
roles [id PK, name UK, description]
profiles [id PK, user_id FK UK, first_name, last_name, phone_number, avatar_url, role_id FK, manages_all_events]
categories [id PK, name, description, icon_url, color_code, deleted_at]
venues [id PK, name, address, capacity, facilities json, image_urls json, deleted_at]
events [id PK, title, description, cover_image_url, organizer_id FK, venue_id FK, capacity, registration_deadline, start_date, end_date, status, visibility, contact_email, category_id FK, event_type, meeting_link, meeting_link_generated_by FK, meeting_link_created_at, deleted_at]
event_images [id PK, event_id FK, image_url, description]
sessions [id PK, event_id FK, title, description, start_time, end_time, room_name]
speakers [id PK, session_id FK, name, bio, image_url]
registrations [id PK, event_id FK, attendee_id FK, registered_at, status]
tickets [id PK, registration_id FK UK, unique_code UK, qr_code_url, issued_at, status]
attendance [id PK, ticket_id FK, check_in_time, check_out_time]
feedback [id PK, event_id FK, attendee_id FK, rating, comment, response, submitted_at, responded_at]
notifications [id PK, user_id FK, type, message, read_at, created_at, link]
files [id PK, name, url, type, size, uploaded_by FK, created_at]
audit_logs [id PK, user_id FK, action, entity_type, entity_id, details, ip_address, created_at]
invitation_links [id PK, event_id FK, email, code UK, used, used_at, created_at]
event_organizers [id PK, event_id FK, user_id FK, is_primary, created_by FK, created_at]
chat_channels [id PK, event_id FK, channel_type, organizer_id FK, attendee_id FK, created_at]
chat_messages [id PK, channel_id FK, sender_id FK, content, created_at]
evaluations [id PK, event_id FK, title, rating_type, privacy, created_by FK, created_at]
evaluation_questions [id PK, evaluation_id FK, question, question_type, options json, sort_order]
evaluation_submissions [id PK, evaluation_id FK, attendee_id FK, rating, is_public, created_at]
evaluation_answers [id PK, submission_id FK, question_id FK, answer]
event_costs [id PK, event_id FK, cost_type, item, need_type, quantity, unit_price numeric, notes, created_by FK, updated_by FK, created_at, updated_at]
device_sessions [id PK, user_id FK, device_name, ip_address, token, last_active_at, created_at]
password_reset_tokens [id PK, user_id FK, token, created_at, expires_at, used_at]
app_settings [id PK, app_name, timezone, date_format, primary_color, logo_url, favicon_url, updated_at]
email_templates [id PK, type, subject, body]
auth_attempts [id PK, email, attempted_at]

users 1-1 profiles
roles 1-* profiles
categories 1-* events
venues 1-* events
profiles 1-* events
users 1-* events
events 1-* event_images
events 1-* sessions
sessions 1-* speakers
events 1-* registrations
profiles 1-* registrations
registrations 1-0..1 tickets
tickets 1-* attendance
events 1-* feedback
profiles 1-* feedback
users 1-* notifications
profiles 1-* files
users 1-* audit_logs
events 1-* invitation_links
events 1-* event_organizers
users 1-* event_organizers
events 1-* chat_channels
users 1-* chat_channels
chat_channels 1-* chat_messages
users 1-* chat_messages
events 1-* evaluations
users 1-* evaluations
evaluations 1-* evaluation_questions
evaluations 1-* evaluation_submissions
profiles 1-* evaluation_submissions
evaluation_submissions 1-* evaluation_answers
evaluation_questions 1-* evaluation_answers
events 1-* event_costs
users 1-* event_costs
users 1-* device_sessions
users 1-* password_reset_tokens
```

## 4. نقاط النقاش أمام اللجنة

1. **لماذا users منفصل عن profiles؟** تقليل سطح الجدول الحساس (اعتماد) عن بيانات العرض — ومساحة أسماء أنظف لـRLS.
2. **3NF:** لا سمات مشتقة أو مكررة؛ مثال مضاد مقصود: لم نضع role في users بل عبر role_id.
3. **UNIQUE الثلاثية الحرجة:** tickets.registration_id / evaluation_submissions(evaluation_id,attendee_id) / event_organizers(event_id,user_id) — كل واحدة تحمي قاعدة عمل.
4. إذا سُئلت عن M:N: event_organizers هي جدول الوصل الصريح بين users وevents بدور المنظم المشترك.
