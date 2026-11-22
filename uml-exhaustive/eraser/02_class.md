# 02 — مخطط الفئات (Class Diagram) — النسخة المطابقة للمشروع

> **النمط في Eraser:** كودان — **ER** للكيانات (أقرب ترميز لسمات UML Class)، و**Cloud/Flow** لطبقة الخدمات.
> **المرجع المعياري:** OMG UML 2.5.1 §11 — خانات اسم/سمات/عمليات، رؤية `+ - # ~`، تعدديات، composition.

## 1. الهدف الأكاديمي

توثيق البنية الاستاتيكية: كيانات النطاق كما في القاعدة الفعلية (users/roles/profiles وليس users.role مباشرة) + طبقة خدمات Repository تغلف كل الوصول — فصل الاهتمامات وقابلية الصيانة (NF6).

## 2. الفئات الرئيسية (مطابقة للقاعدة)

| الفئة | سمات جوهرية | ملاحظة معيارية |
|---|---|---|
| User | id, email UK, password_hash, suspended | جدول الاعتماد فقط |
| Role / Profile | role.name UK؛ profile(user_id UK, role_id FK, manages_all_events) | فصل الأدوار عن الهوية |
| Event | title, organizer_id, venue_id, category_id, capacity, registration_deadline, start/end_date, status, visibility, event_type, meeting_link | status: draft/published/archived |
| Session → Speaker | session(event_id, room_name) 1—* speaker(name,bio) | برنامج الفعالية |
| Registration | event_id, attendee_id, registered_at, status | confirmed/waitlisted/cancelled |
| Ticket | registration_id UK, unique_code UK, qr_code_url, status | valid/used/invalid |
| Attendance | ticket_id, check_in_time, check_out_time | سجل زمني |
| InvitationLink | email, code UK, used, used_at | دعوة أحادية |
| Evaluation سلسلة | evaluations(rating_type,privacy) → questions(options json) → submissions(attendee,rating,is_public,UNIQUE) → answers(answer,UNIQUE) | استبيان مهيكل |
| ChatChannel / Message | channel(channel_type general/private, organizer_id, attendee_id) / message(content) | دردشة لحظية |
| Feedback | event_id, attendee_id, rating, comment, response, responded_at | تقييم برد المنظم |
| Notification | type, message, read_at, link | إشعارات |
| EventCost | cost_type, item, need_type, quantity, unit_price | تكاليف مفصلة |
| DeviceSession | device_name, ip_address, token, last_active_at | الإبطال بالحذف |
| PasswordResetToken | token, expires_at, used_at | أحادي بمهلة |
| AuditLog | action, entity_type, entity_id, details, ip_address | append-only |

### العلاقات المعيارية

- User 1—1 Profile؛ Role 1—* Profile.
- Event 1—* Registration (**composition**)؛ Registration 1—0..1 Ticket؛ Ticket 1—* Attendance.
- Event *—1 Category/Venue؛ Event 1—* Session 1—* Speaker.
- Evaluation 1—* Questions و1—* Submissions؛ Submission 1—* Answers ← Question.
- Users 1—* DeviceSessions / Notifications / AuditLogs.

## 3. طبقة الخدمات (RPCs الفعلية داخلها)

AuthService يستدعي: `authenticate_user`, `register_user`, `get_session_user`, `revoke_session`, `revoke_session_by_id`, `request_password_reset`, `reset_password_with_token`, `user_exists` · EvaluationService: `submit_evaluation` · بقية الخدمات REST عبر SupabaseClient مع RateLimiter (30 طلب/60ث) وErrorMapper (PGRST→عربية).

## 4. كود Eraser — الكيانات

```eraser
title EventFlow Domain Classes - matching real schema

users [id PK, email UK, password_hash, suspended]
roles [id PK, name UK, description]
profiles [id PK, user_id FK UK, first_name, last_name, phone_number, avatar_url, role_id FK, manages_all_events]
categories [id PK, name, description, icon_url, color_code]
venues [id PK, name, address, capacity, facilities json, image_urls json]
events [id PK, title, description, cover_image_url, organizer_id FK, venue_id FK, category_id FK, capacity, registration_deadline, start_date, end_date, status, visibility, contact_email, event_type, meeting_link]
event_images [id PK, event_id FK, image_url, description]
sessions [id PK, event_id FK, title, description, start_time, end_time, room_name]
speakers [id PK, session_id FK, name, bio, image_url]
registrations [id PK, event_id FK, attendee_id FK, registered_at, status]
tickets [id PK, registration_id FK UK, unique_code UK, qr_code_url, issued_at, status]
attendance [id PK, ticket_id FK, check_in_time, check_out_time]
invitation_links [id PK, event_id FK, email, code UK, used, used_at]
evaluations [id PK, event_id FK, title, rating_type, privacy, created_by FK]
evaluation_questions [id PK, evaluation_id FK, question, question_type, options json, sort_order]
evaluation_submissions [id PK, evaluation_id FK, attendee_id FK, rating, is_public]
evaluation_answers [id PK, submission_id FK, question_id FK, answer]
chat_channels [id PK, event_id FK, channel_type, organizer_id FK, attendee_id FK]
chat_messages [id PK, channel_id FK, sender_id FK, content, created_at]
feedback [id PK, event_id FK, attendee_id FK, rating, comment, response, submitted_at, responded_at]
notifications [id PK, user_id FK, type, message, read_at, link]
event_costs [id PK, event_id FK, cost_type, item, need_type, quantity, unit_price numeric, created_by FK, updated_by FK]
files [id PK, name, url, type, size, uploaded_by FK]
device_sessions [id PK, user_id FK, device_name, ip_address, token, last_active_at]
password_reset_tokens [id PK, user_id FK, token, expires_at, used_at]
audit_logs [id PK, user_id FK, action, entity_type, entity_id, details, ip_address]

users 1-1 profiles
roles 1-* profiles
categories 1-* events
venues 1-* events
profiles 1-* events
events 1-* event_images
events 1-* sessions
sessions 1-* speakers
events 1-* registrations
profiles 1-* registrations
registrations 1-1 tickets
tickets 1-* attendance
events 1-* invitation_links
events 1-* evaluations
evaluations 1-* evaluation_questions
evaluations 1-* evaluation_submissions
profiles 1-* evaluation_submissions
evaluation_submissions 1-* evaluation_answers
evaluation_questions 1-* evaluation_answers
events 1-* chat_channels
chat_channels 1-* chat_messages
users 1-* chat_messages
events 1-* feedback
profiles 1-* feedback
users 1-* notifications
events 1-* event_costs
profiles 1-* files
users 1-* device_sessions
users 1-* password_reset_tokens
```

## 5. كود Eraser — طبقة الخدمات

```eraser
title EventFlow Service Layer - Repository Pattern with real rpc names

Group Presentation [color: lightblue] {
  Pages Components [icon: react]
}
Group Services [color: lightgreen] {
  AuthService [icon: function]
  EventService [icon: function]
  TicketService [icon: function]
  AttendanceService [icon: function]
  InvitationService [icon: function]
  ChatService [icon: function]
  EvaluationService [icon: function]
  SupportServices [icon: boxes]
}
Group Infrastructure [color: lightyellow] {
  SupabaseClient [icon: plug]
  RateLimiter [icon: gauge]
  ErrorMapper [icon: translate]
}

Pages Components > AuthService
Pages Components > EventService
Pages Components > TicketService
Pages Components > AttendanceService
Pages Components > ChatService
Pages Components > EvaluationService
Pages Components > SupportServices

AuthService > SupabaseClient: authenticate_user register_user revoke_session rpc
EvaluationService > SupabaseClient: submit_evaluation rpc
EventService > SupabaseClient: rest rls guarded
TicketService > SupabaseClient
AttendanceService > SupabaseClient
InvitationService > SupabaseClient
ChatService > SupabaseClient: rest plus realtime wss
SupportServices > SupabaseClient
SupabaseClient > RateLimiter: 30 req per 60 s
RateLimiter > ErrorMapper: pgrst codes to arabic
```

## 6. نقاط النقاش أمام اللجنة

1. **Repository Pattern:** عزل React عن SDK — تغيير الخلفية يمس طبقة واحدة (NF6).
2. **composition** بين Event وRegistration مقابل 0..1 للتذكرة: التذكرة تُولّد عند confirmed فقط.
3. **فصل roles/profiles:** تطبيع الأدوار وتجنب تكرار نص الدور — وسهل الإضافة المستقبلية لأدوار جديدة دون تعديل بنية.
