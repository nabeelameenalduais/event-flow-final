# الحزمة النهائية — مخططات EventFlow الأكاديمية

هذه الحزمة الموحدة لمشروع التخرج: **مصادر المخططات** (as-code) + **المخرجات المولدة** (SVG / HTML / PDF)، وفق منهجية مجلد `المتطلبات الخارجية\uml`.

## المحتويات

| المصدر | المخطط | الترميز المعياري |
|---|---|---|
| `01_use_case.puml` | حالات الاستخدام UC01–UC48 (4 فاعلين + 3 أنظمة ثانوية) | PlantUML · OMG UML 2.5.1 §18 — include/extend بنقاط امتداد |
| `02_class.puml` (+ entities/services/platform) | الفئات الكامل عبر `!include` | §11 — خانات السمات/العمليات، التعدديات، composition |
| `03_erd.mmd` | 30 جدولًا فعليًا من `supabase/schema.sql` | Crow's Foot — كل علاقة FK حقيقية |
| `04a–04f_sequence_*.mmd` | ستة تتابعات: مصادقة، تسجيل، حضور، دردشة، تقييم، chatbot | §17 — lifelines/activation/alt-opt-loop frames |
| `05a–05b_activity_*.mmd` | نشاطا التسجيل والحضور | §15 — عقد قرار بحرّيات ومسارات فشل |
| `06_architecture.mmd` | معمارية الطبقات الخمس | نمط Layers + BaaS |
| `07_state_machine.mmd` | آلات حالات 6 نطاقات حرجة | §14 — initial/final، انتقالات موسومة |
| `08_component.mmd` | المكونات وعقود الواجهات | §8 — provided/required approximated |
| `09_deployment.mmd` | العقد والقطع الأثرية وبروتوكولات النقل | §10 — Node/Artifact/CommunicationPath |

## المخرجات المولدة

- `svg/*.svg` — 15 مخططًا متجهيًا (PlantUML v1.2024.7 + mermaid-cli 11).
- `eventflow-uml.html` — صفحة موحدة بفهرس تنقّل تضم كل المخططات.
- `eventflow-uml.pdf` — نسخة طباعة A4 أفقيّة (~44 صفحة) للمناقشة.

## ضمانات المطابقة (تم التحقق آليًا)

1. كل جداول الـERD وأعمدتها مطابقة لـ`supabase/schema.sql` واستدعاءات `.from()` في `src/services`.
2. أسماء دوال RPC في مخططات التتابع هي الأسماء الفعلية (`authenticate_user`, `register_user`, `get_session_user`, `revoke_session`, `revoke_session_by_id`, `request_password_reset`, `reset_password_with_token`, `submit_evaluation`) ودور `trigger_waitlist_promotion` كما في المخطط.
3. أعمدة الدعوات (`email/code/used/used_at`) وجدول `attendance` المفرد وقنوات الدردشة `general/private` مطابقة.

## إعادة التوليد

```powershell
# Mermaid → SVG
mmdc -i <name>.mmd -o svg\<name>.svg
# PlantUML → SVG
java -jar plantuml.jar -tsvg -charset UTF-8 -o svg <name>.puml
# HTML + PDF
node build-final.js   # من مجلد الأدوات المؤقتة uml-render
```
