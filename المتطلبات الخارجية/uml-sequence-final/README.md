# EventFlow — Final Sequence Diagram: Register for Event

This folder contains the source-verified UML 2.x sequence diagram for the implemented **Register for Event** use case. It models the attendee-facing flow only; account registration, invitation creation, organizer hard-delete, feedback, meeting, chat, check-in, and event reminders are not included.

## Files

| File | Purpose |
|---|---|
| `sequence_registration.puml` | Authoritative PlantUML source |
| `sequence_registration.png` | High-resolution PNG export, 300 DPI |
| `sequence_registration.svg` | Scalable vector export |

## Modeled flow

The diagram is organized into three frames:

1. **Page load and private invitation validation** — event loading, `?code=` handling, `getLinkByCode()`, link errors, and the `Wrong account` guard.
2. **`registerForEvent` validation** — event/profile guards, service-side private-code checks, ban RPC, duplicate registration check, and alternatives for failures or success.
3. **Commit registration** — capacity decision, confirmed registration with ticket/QR generation, waitlisted registration with position notification, private-link side effects, organizer notification, best-effort audience sync, and UI refresh.

UML `ref` frames encapsulate detailed guard logic while notes retain the source-defined error strings and lookup details.

## Source-verified behavior notes

- A confirmed registration generates an `EF-` + 12-character code, a base64url `EF1:` QR payload, and a database ticket row.
- A full event inserts a `waitlisted` registration and sends only an in-app `waitlist` notification; no ticket is created at that point.
- Registration and waitlist placement send **no email**.
- Later waitlist promotion after another attendee cancels creates a ticket, two in-app `waitlist_promotion` notifications (application plus DB trigger), and an email attempt that is mock by default.
- Private-registration link validation occurs both in `EventDetail` on page load and again inside `registerForEvent`.
- The organizer receives an in-app `invitation_used` notification; no email is sent by invitation registration.

## Regeneration

Exports were generated with **PlantUML 1.2023.13** using Java 8. From this folder in PowerShell:

```powershell
# Download once if plantuml.jar is not already available
Invoke-WebRequest `
  -Uri 'https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2023.13/plantuml-1.2023.13.jar' `
  -OutFile 'plantuml.jar'

$env:PLANTUML_LIMIT_SIZE = '16384'

java -jar .\plantuml.jar -tsvg -nometadata .\sequence_registration.puml
java -jar .\plantuml.jar -tpng -Sdpi=300 -nometadata .\sequence_registration.puml

python -c "from PIL import Image; p='sequence_registration.png'; im=Image.open(p); im.save(p, dpi=(300,300), optimize=True)"
```

`PLANTUML_LIMIT_SIZE=16384` is required because the 300 DPI PNG exceeds PlantUML's default 4096-pixel height limit.

## Verification status

Final independent source traceability check: **PASS**. Participants, message order, validation branches, notification behavior, ticket generation, invitation side effects, and explicit exclusions were verified against the current source.
