<!-- SECTION:APPENDIX_DIVIDER -->

تُرفق بهذا التقرير ثمانية ملاحق تغطي دليل المستخدم وملخص قاعدة البيانات ومرجع الواجهات ومصفوفة الاختبارات وبيانات العرض وخطة المشروع وهيكل الشيفرة وسياسات الأمان والهجرات. يبدأ ترقيم صفحات كل ملحق من 1 مع بادئة الحرف.

<!-- APPENDIX:A|Appendix A: User Manual|دليل المستخدم -->

## A.1 Getting Started

يتطلب استخدام النظام اتصالاً بمشروع Supabase وإنشاء حساب أو الدخول بحساب تجريبي. تُنشأ الجلسة عبر `device_sessions` ويُحفظ الرمز محلياً، ثم تُستعاد الجلسة عند فتح التطبيق. يبدأ الزائر بالصفحة العامة للفعاليات، وتظهر أدوات لوحة التحكم بعد المصادقة وفق دوره.

## A.2 Attendee Tasks

Table A-1: Attendee Tasks and Steps

| Task | Steps |
| --- | --- |
| Create an account | Select Register, enter the required personal data, accept the terms and submit the form. Complete the profile if prompted. |
| Log in | Select Login, enter the email address and password, and submit. A failed login displays an error and may be rate-limited. |
| Find an event | Open the Events page, use the search and filters, and select an event to view its details. |
| Register | On the event details page, select Register. If capacity is available the registration is confirmed; otherwise the system offers the waiting list. |
| View a ticket | Open My Tickets or the attendee dashboard, select the event and display the QR code. |
| Cancel a registration | Open the registration, select Cancel and confirm. A waitlisted attendee may be promoted automatically. |
| Use event chat | Open the event chat, select the general or private channel and send a message. |
| Submit an evaluation | Open the evaluation link after the event, answer the questions and submit the form. |
| Manage notifications | Open Notifications, review unread items and mark them as read. |

## A.3 Organizer Tasks

Table A-2: Organizer Tasks and Steps

| Task | Steps |
| --- | --- |
| Create an event | Open Event Management, select Create Event, complete the event form, choose the category, venue or online meeting option, and save as draft. |
| Publish an event | Review the event details, then change the status from draft to published. Published events appear on the public events page. |
| Manage registrations | Open Registration Management, review registrations and confirm or cancel as required. |
| Manage invitations | Open Invitation Management, add invitees and track their responses. |
| Scan tickets | Open Attendance Management, start the QR scanner, and scan the attendee ticket. The system validates the ticket and records check-in or check-out. |
| Manage sessions and speakers | Open Schedule Management, add sessions with times and rooms, and assign speakers. |
| Record costs | Open Event Costs, add estimated and actual cost items, and review the totals. |
| Create an evaluation | Open Evaluation Management, add questions, choose the privacy setting and publish the evaluation. |
| Review feedback | Open Feedback Management to read comments and view aggregate scores. |
| Export a report | Open Reports, apply the required filters and export to XLSX or PDF. |

## A.4 Administrator Tasks

Table A-3: Administrator Tasks and Steps

| Task | Steps |
| --- | --- |
| Manage users | Open User Management, search for a user and review the profile, role and account state. |
| Assign roles | Open the user record, select the required role (attendee, organizer or administrator) and save. |
| Suspend or ban a user | Open Bans or the user record, record the reason and the duration, and confirm the action. |
| Review security events | Open Security Center to inspect audit logs, failed logins and active sessions. |
| Manage categories and venues | Open Category Management or Venue Management, add or edit the records used by events. |
| Review event requests | Open Event Requests, review the submitted request and approve, reject or request more information. |
| Manage files | Open File Management to review uploaded files and remove invalid or unsafe content. |
| Configure settings | Open System Settings to update the supported languages, defaults and operational options. |

## A.5 Troubleshooting

أكثر الأخطاء شيوعاً هي: انتهاء رمز الدعوة أو عدم تطابق بريده مع بريد المدعو، ومحاولة التسجيل بعد موعد الإغلاق، وفحص تذكرة مستخدمة أو تابعة لفعالية أخرى، وتعذّر الاتصال بخادم LM Studio المحلي عند استخدام المساعد الذكي. تعرض الواجهة رسائل مفهومة لهذه الحالات عبر `supabaseErrors.ts` و`sonner`.

<!-- APPENDIX:B|Appendix B: Database Schema Summary|ملخص مخطط قاعدة البيانات -->

## B.1 Schema Execution Order

يُنفَّذ `supabase/schema.sql` أولاً، ثم `supabase/schema-part2-security.sql`، ثم ملفات `supabase/migrations/` مرتبة زمنياً. يوضح الجدول B-1 الجداول المحورية ومفاتيحها وعلاقاتها كما وردت في المخطط والشيفرة.

Table B-1: Core Tables, Keys and Relationships

| Table | Primary key | Main columns | Main relationships |
| --- | --- | --- | --- |
| users | id | email, password_hash, suspended, created_at, updated_at, deleted_at | 1:1 profiles; 1:N notifications, audit_logs and device_sessions |
| profiles | id | user_id, first_name, last_name, phone_number, avatar_url, role_id, manages_all_events | N:1 users and roles; 1:N registrations |
| roles | id | name, description | 1:N profiles |
| events | id | title, description, organizer_id, venue_id, category_id, capacity, registration_deadline, start_date, end_date, status, visibility, event_type, meeting_link, deleted_at | N:1 categories, venues and profiles; 1:N registrations, sessions and event_costs |
| registrations | id | event_id, attendee_id, registered_at, status | N:1 events and profiles; 1:0..1 tickets |
| tickets | id | registration_id, unique_code, qr_code_url, issued_at, status | N:1 registrations; 1:N attendance |
| attendance | id | ticket_id, check_in_time, check_out_time | N:1 tickets |
| sessions | id | event_id, title, description, start_time, end_time, room_name | N:1 events; 1:N speakers |
| speakers | id | session_id, name, bio, image_url | N:1 sessions |
| evaluations | id | event_id, title, rating_type, privacy, created_by, created_at | N:1 events; 1:N questions and submissions |
| evaluation_questions | id | evaluation_id, question, question_type, options, sort_order | N:1 evaluations |
| evaluation_submissions | id | evaluation_id, attendee_id, rating, is_public, created_at | N:1 evaluations and profiles |
| notifications | id | user_id, type, message, read_at, created_at, link | N:1 users |
| chat_channels | id | event_id, channel_type, organizer_id, attendee_id, created_at | N:1 events and users; 1:N chat_messages |
| chat_messages | id | channel_id, sender_id, content, created_at | N:1 chat_channels and users |
| event_costs | id | event_id, cost_type, item, need_type, quantity, unit_price, notes, created_at, updated_at | N:1 events |
| audit_logs | id | user_id, action, entity_type, entity_id, details, ip_address, created_at | N:1 users |

يُذكَّر بأن `events.organizer_id` يشير إلى `profiles.id`، بينما `event_organizers.user_id` و`chat_channels.organizer_id` يشيران إلى `users.id`. كما أن مخطط ERD الموثق يضم ثلاثين جدولاً، وتضيف الهجرة الشاملة جداول مساندة للحظر وطلبات الفعاليات والتمويل والحملات والاجتماعات.

<!-- APPENDIX:C|Appendix C: RPC and API Reference|مرجع RPC وواجهة البرمجة -->

## C.1 Chatbot Interfaces

توجد دالة `supabase/functions/chatbot/index.ts` كمسار تصميمي بديل للمساعد الذكي عبر OpenRouter، وتعرّف ست أدوات: `search_events` و`get_event_details` و`get_categories` و`get_venues` و`get_upcoming_events` و`get_event_stats`. أما المسار الفعلي من الواجهة فهو `useChat` الذي يرسل الطلب إلى `/lmstudio/v1/chat/completions` عبر وكيل Vite إلى خادم LM Studio محلي، ثم ينفّذ أدوات البيانات مباشرة من المتصفح عبر REST.

Table C-1: Database Functions and Their Responsibilities

| Function | Purpose | Key parameters | Access |
| --- | --- | --- | --- |
| authenticate_user | Validate credentials, create a device session and return user, profile and role | p_email, p_password | Public via publishable key; 5 attempts/15 min |
| register_user | Create a user and attendee profile with a bcrypt hash | p_email, p_password, p_first_name, p_last_name | Public via publishable key |
| get_session_user | Validate a device-session token and refresh last activity | p_token | Public via publishable key; token checked in function |
| get_profile_by_email | Return identity and profile data without the password hash | p_email | Administrative/public-key RPC with internal checks |
| user_exists | Check whether an email exists without revealing hashes | p_email | Public via publishable key |
| request_password_reset | Issue a one-use reset token with a 30-minute expiry | p_email | Public via publishable key; anti-enumeration response |
| reset_password_with_token | Set a new password and revoke all sessions | p_token, p_new_password | Public via publishable key |
| list_user_sessions | List device sessions without exposing tokens | p_user_id, p_current_token | Session-validated |
| revoke_session | Delete one device session by token | p_token | Session-validated |
| revoke_other_sessions | Revoke all sessions except the current one | p_user_id, p_current_token | Session-validated |
| submit_evaluation | Store evaluation answers after registration and attendance checks | p_evaluation_id, p_attendee_id, p_rating, p_is_public, p_answers | Restricted by function; residual caller-supplied ID risk |
| check_in_ticket | Atomically validate and consume a ticket for an event | p_ticket_id, p_expected_event_id, p_mode, p_source, p_session_token | Session plus organizer/admin validation |
| notify_waitlist_promotion / auto_assign_all_events_organizers | Promote waitlisted attendees and repair organizer assignments | Event context | Trigger/helper; SECURITY DEFINER |

الجدول تمثيلي؛ وتعرّف ملفات SQL في المستودع 46 اسماً فريداً للدوال. يُوثَّق تكامل كل مجموعة دوال مع الواجهة في الملحق G، وتُذكر المخاطر المقبولة في الملحق H.

Table C-2: Chatbot Request and Response Fields

| Field or contract | Direction | Description |
| --- | --- | --- |
| messages[], temperature, max_tokens, stream | Active LLM request | Browser `useChat` sends `/lmstudio/v1/chat/completions`; Vite proxies `/lmstudio` to local LM Studio. |
| Tool-call object | Model output | Raw JSON `{"name":"...","args":{...}}` for the six verified data tools; at most five tool iterations. |
| Tool results | Request context | REST results are appended as a user message before the final response is composed. |
| ChatMessage | UI state | `id`, `role`, `content`, `timestamp`; the hook returns `messages`, `isLoading`, `error`, `sendMessage` and `clearMessages`. |
| message | Alternative Edge request | The unused `supabase/functions/chatbot` accepts JSON `{ message }`; a missing message returns HTTP 400. |
| reply / error | Alternative Edge response | Success returns `{ reply }`; failures return `{ error }` with HTTP 500. |

<!-- APPENDIX:D|Appendix D: Test Case Matrix|مصفوفة حالات الاختبار -->

يطابق الجدول D-1 سيناريوهات القبول الـ26 الواردة في القالب المعتمد. تُترك خانات النتيجة فارغة عمداً لأنه لا يوجد سجل تنفيذ مستقل لهذه السيناريوهات ضمن المستودع، ولا يجوز ملؤها بافتراض النجاح. أما الاختبارات الآلية المنفذة فعلاً فنتائجها موثقة في الفصل الخامس.

Table D-1: Detailed Test Case Matrix

| ID | Requirement | Scenario | Expected result | Type | Result |
| --- | --- | --- | --- | --- | --- |
| TC-01 | FR-01 | Register with valid data | Account created and session established | Functional |  |
| TC-02 | FR-01 | Register with an existing email | Validation error; no duplicate account | Negative |  |
| TC-03 | FR-01 | Log in with valid credentials | Dashboard opens with the correct role | Functional |  |
| TC-04 | FR-01 | Log in with invalid credentials | Access denied and a clear error is shown | Negative |  |
| TC-05 | FR-01 | Request and complete a password reset | Password changed and old password rejected | Functional |  |
| TC-06 | FR-02 | Create a draft event | Event saved and visible only to authorized users | Functional |  |
| TC-07 | FR-02 | Publish an event | Event visible on the public events page | Functional |  |
| TC-08 | FR-02 | Archive an event | Event removed from public discovery | Functional |  |
| TC-09 | FR-03 | Register below capacity | Registration confirmed and ticket issued | Functional |  |
| TC-10 | FR-03 | Register at full capacity | Registration waitlisted with a position | Boundary |  |
| TC-11 | FR-03 | Cancel a confirmed registration | Place released and next attendee promoted | Integration |  |
| TC-12 | FR-04 | Scan a valid QR ticket | Ticket accepted and attendance recorded | Functional |  |
| TC-13 | FR-04 | Scan a used ticket | Ticket rejected with the correct reason | Negative |  |
| TC-14 | FR-04 | Scan a ticket for another event | Ticket rejected; no attendance record | Security |  |
| TC-15 | FR-05 | Add a session and assign a speaker | Session appears in the event schedule | Functional |  |
| TC-16 | FR-06 | Submit an evaluation | Answers stored and aggregate score updated | Functional |  |
| TC-17 | FR-06 | Submit an evaluation twice | Duplicate submission rejected | Negative |  |
| TC-18 | FR-07 | Send a chat message | Message appears for authorized participants | Functional |  |
| TC-19 | FR-07 | Open notifications | Unread items are listed and can be marked read | Functional |  |
| TC-20 | FR-08 | Export a report to XLSX | File contains the filtered data | Functional |  |
| TC-21 | FR-08 | Export a report to PDF | File contains the filtered data and correct headers | Functional |  |
| TC-22 | FR-09 | Record an event cost | Totals update correctly | Functional |  |
| TC-23 | FR-10 | Open an admin page as an attendee | Access denied by the route guard and RLS | Security |  |
| TC-24 | FR-10 | Suspend a user | Suspended user cannot log in | Security |  |
| TC-25 | FR-11 | Switch the interface to Arabic | Layout becomes RTL and labels are translated | Usability |  |
| TC-26 | NFR-01 | Load the public events page | Page loads without console errors | Performance |  |

<!-- APPENDIX:E|Appendix E: Demo Data and Accounts|بيانات العرض والحسابات -->

## E.1 Loading the Demo Data

يوفّر `supabase/seed_demo_accounts.sql` ثلاثة حسابات تجريبية محلية للعرض. كلمات المرور أدناه مأخوذة من ملف البذرة نفسه، وهي بيانات عرض فقط وليست بيانات اعتماد إنتاجية.

Table E-1: Demo Accounts Created by the Seed Script

| Role | Email | Password | Profile |
| --- | --- | --- | --- |
| Administrator | admin@eventflow.com | one | Alice Admin; manages all events |
| Organizer | organizer@eventflow.com | one | Bob Organizer; manages assigned events |
| Attendee | attendee@eventflow.com | one | Charlie Attendee; registers for events |

لتحميل البيانات يُنفَّذ ملف البذرة بعد تطبيق المخطط والهجرات على مشروع Supabase محلي، ثم يُشغَّل التطبيق ويُستبدل ملف `.env` بالقيم المحلية وفق `.env.example`. لا تتضمن هذه الوثيقة أي رابط مشروع أو مفتاح حقيقي.

<!-- APPENDIX:F|Appendix F: Project Plan and Timeline|خطة المشروع والجدول الزمني -->

يوضح الجدول أدناه المراحل الثماني ومددها التقديرية كما وردت في قالب التوثيق المعتمد. لا تتوفر تواريخ أكاديمية فعلية في المصادر، ولذلك يُعرض الجدول الزمني بالمدد النسبية فقط دون ادعاء تواريخ محددة.

Table 0-0: Project Phases, Deliverables and Planned Duration

| Phase | Main activities | Deliverables | Duration |
| --- | --- | --- | --- |
| 1. Initiation | Select the topic, define the problem and scope, and obtain approval | Approved proposal | 2 weeks |
| 2. Requirements | Collect requirements, identify stakeholders and define FR/NFR | Requirements specification | 2-3 weeks |
| 3. Analysis and modeling | Build use case, ERD, sequence, activity and state models | Analysis models | 3-4 weeks |
| 4. Design | Design the architecture, database, interfaces and security | Design document and prototypes | 3-4 weeks |
| 5. Implementation | Build the front end, database, services and security controls | Working system and source code | 6-8 weeks |
| 6. Testing | Run automated and manual tests, fix defects and retest | Test report and evidence | 2-3 weeks |
| 7. Documentation | Write the report, prepare figures and tables, and review references | Final report | 3-4 weeks |
| 8. Defense preparation | Prepare the presentation and demonstrate the system | Slides and demo | 1-2 weeks |

<!-- IMAGE_TABLE:assets/gantt.png -->
Caption: Figure F-1: Project Timeline (Gantt Chart)

<!-- APPENDIX:G|Appendix G: Source Code Structure|هيكل الشيفرة المصدرية -->

Table G-1: Key Source Files and Responsibilities

| Path | Responsibility |
| --- | --- |
| src/App.tsx | Application root, chat widget and route outlet |
| src/routes/index.tsx | Route map, named lazy loading, protected and public routes |
| src/contexts/AuthContext.tsx | Session state, login, logout and role checks |
| src/services/ | 35 service modules for Supabase queries, RPC calls and data mapping |
| src/pages/ | Route-level screens for public and dashboard modules |
| src/i18n/ | Arabic and English dictionaries, formatters and message localization |
| supabase/schema.sql | Base tables, functions, triggers and RLS policies |
| supabase/schema-part2-security.sql | Grants and column-level security |
| supabase/migrations/ | Thirteen chronological hardening and access migrations |
| supabase/functions/chatbot/index.ts | Alternative Edge Function chatbot design |

<!-- APPENDIX:H|Appendix H: Security Policies and Migration Checklist|سياسات الأمان وقائمة الهجرات -->

## H.1 Security Controls and Implementation Evidence

Table H-1: Security Controls and Implementation Evidence

| Control | Implementation | Verification |
| --- | --- | --- |
| Authentication | authenticate_user, register_user and session RPCs; bcrypt password hashing | Valid and invalid login tests |
| Role-based access | profiles.role_id, route guards and role checks in src/routes | Open each role's pages and confirm access |
| Row-level security | Policies in schema.sql, schema-part2-security.sql and security migrations | Query each table as each role |
| Column protection | Column grants and restricted fields | Attempt to read or write restricted fields |
| Secure functions | SECURITY DEFINER functions with explicit checks | Review function definitions and test invalid calls |
| Storage protection | uploads bucket policies in the storage migration | Upload and read files as each role |
| Audit logging | audit_logs and Security Center | Perform an administrative action and inspect the log |
| Rate limiting | src/services/rateLimit.ts and auth_attempts | Repeat failed logins and confirm the limit |
| Account moderation | Bans, suspensions and revoke_session | Suspend a user and confirm that login fails |

## H.2 Database Migration Checklist

Table H-2: Database Migration Checklist

| Order | File | Purpose | Applied |
| --- | --- | --- | --- |
| 1 | 2026-11-06_all_additions.sql | Meetings, bans, event requests, finance, audiences, campaigns and admin messages | Recorded in repository |
| 2 | 2026-11-17_event_date_order.sql | Validation of event date ordering | Recorded in repository |
| 3 | 2026-11-17_ticket_qr_fix.sql | Ticket QR payload and code corrections | Recorded in repository |
| 4 | 2026-11-18_check_in_ticket_auth.sql | Session-token validation for ticket check-in | Recorded in repository |
| 5 | 2026-11-18_storage_uploads_policy.sql | Upload, select and delete policies for the uploads bucket | Recorded in repository |
| 6 | 2026-11-19_harden_self_service_rpcs.sql | Hardening of self-service password and account RPCs | Recorded in repository |
| 7 | 2026-11-19_index_maintenance.sql | Index maintenance and duplicate index cleanup | Recorded in repository |
| 8 | 2026-11-19_security_hardening.sql | Restricted access, search-path pinning and column protection | Recorded in repository |
| 9 | 2026-11-21_event_requests_access.sql | RPC access and helper revocation for event requests | Recorded in repository |
| 10 | 2026-11-22_bans_access.sql | RPC access and helper revocation for bans | Recorded in repository |
| 11 | 2026-11-22_finance_access.sql | Client grants for finance tables | Recorded in repository |
| 12 | 2026-11-24_audience_access.sql | Client grants for audience tables | Recorded in repository |
| 13 | 2026-11-24_broadcast_access.sql | Client grants for admin broadcast tables | Recorded in repository |

«Applied» تعني أن الملف موجود وموثق في المستودع؛ ولا يدّعي هذا التقرير أن الهجرات طُبقت على مشروع Supabase حيّ. وتُذكر المخاطر المقبولة وتفاصيل تنبيهات مستشار الأمان في `docs/SECURITY_ADVISORIES.md`، مع الإشارة إلى أن المراجعة الدورية لا تزال مطلوبة.
