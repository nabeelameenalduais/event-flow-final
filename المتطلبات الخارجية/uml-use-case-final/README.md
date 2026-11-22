# EventFlow — Final UML Use Case Diagram

This folder contains the source-verified UML 2.x use case diagram for EventFlow. The diagram models only functionality that is present in this repository; no planned, demo-only, or unreachable code paths are included.

## Files

| File | Purpose |
|---|---|
| `use_case_diagram.puml` | Authoritative PlantUML source |
| `use_case_diagram.png` | High-resolution PNG export, 300 DPI |
| `use_case_diagram.svg` | Scalable vector export |

## Model scope

- **Actors:** `Platform User` (abstract), `Visitor`, `Registered User` (abstract), `Attendee`, `Organizer`, `Administrator`, plus secondary actors `Email Service`, `Jitsi Meet`, and `EventFlow Assistant`.
- **Use cases:** 41 total — 36 base use cases, 3 `<<extend>>` use cases, and 2 `<<include>>` use cases.
- **System boundary:** `EventFlow Event Management System`.
- **Internal packages:** Account & Access, Event Discovery, Event Participation, Event Operations, Platform Administration, System Behaviors.
- **Infrastructure note:** Supabase Auth, Postgres/RLS, Storage, Realtime, and the Edge environment are shown as infrastructure, not as an actor.

### Relationships modeled

`<<extend>>`

- `Access Private Event via Invitation Code` → `View Event Details`
- `Restore Deleted Account` → `Recover Account Access`
- `Join Event Waitlist` → `Register for Event`

`<<include>>`

- `Review Event Requests` → `Generate Draft Event`
- `Perform Check-In/Check-Out` → `Validate E-Ticket`

### Explicitly excluded

The following are implemented but intentionally outside the approved diagram scope: the `Contact.tsx` demo form, static `About.tsx`, service-only `updateEventRequest`, `deleteEventRequest`, `adminRestoreAccount`, and `markAutoAttendance`, the unlinked `ResetPassword.tsx` token path, and the OpenRouter edge-function chatbot path that the frontend does not call.

## Regeneration

The exports were generated with **PlantUML 1.2023.13** using Java 8. The `1.2023.13` jar is used because it is compatible with the installed Java runtime; newer PlantUML releases may require a newer JDK.

From this folder in PowerShell:

```powershell
# Download once if plantuml.jar is not already available
Invoke-WebRequest `
  -Uri 'https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2023.13/plantuml-1.2023.13.jar' `
  -OutFile 'plantuml.jar'

$env:PLANTUML_LIMIT_SIZE = '16384'

java -jar .\plantuml.jar -tsvg -nometadata .\use_case_diagram.puml
java -jar .\plantuml.jar -tpng -Sdpi=300 -nometadata .\use_case_diagram.puml
```

PlantUML writes the PNG without a DPI header in some environments. To restore the 300 DPI metadata after generation:

```powershell
python -c "from PIL import Image; p='use_case_diagram.png'; im=Image.open(p); im.save(p, dpi=(300,300), optimize=True)"
```

`PLANTUML_LIMIT_SIZE=16384` is required because the 300 DPI PNG is taller than PlantUML's default 4096-pixel limit.

## Interpretation notes

- Solid lines are actor-to-use-case associations.
- Dashed lines labeled `<<include>>` represent mandatory reused behavior.
- Dashed lines labeled `<<extend>>` represent conditional extensions.
- Hollow triangles show actor role generalization. `Administrator` inherits `Organizer` behavior because administrator accounts pass organizer route guards and organizer management checks return true for admins.
- `Participate in Event Chat` and `Join Online Meeting` are associated with the abstract `Registered User` role because attendee, organizer, and administrator routes/services all expose those capabilities.
- Email delivery defaults to the mock provider; Resend/SendGrid require configuration. Event reminders are in-app only.
- The frontend assistant path calls the local LM Studio-compatible endpoint; the OpenRouter edge function is not part of the modeled frontend behavior.
