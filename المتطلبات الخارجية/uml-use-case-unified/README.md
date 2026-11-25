# EventFlow System — Unified Use Case Diagram

This folder contains the implementation-verified UML use case diagram for EventFlow. The redesign keeps every valid use case and actor association from the verified model, removes the legacy external assistant actor, and rebuilds the layout as a three-column academic diagram with readable typography and orthogonal routing.

`use_case_diagram.drawio` is the editable, authoritative source. The `uml-use-case-final` folder was not modified.

## Deliverables

| File | Purpose |
|---|---|
| `use_case_diagram.drawio` | Editable Draw.io source (authoritative) |
| `use_case_diagram.puml` | Content-equivalent PlantUML backup |
| `use_case_diagram.svg` | Vector export, pure SVG text, opaque white background |
| `use_case_diagram.png` | High-resolution raster export, 300 DPI |
| `use_case_diagram.pdf` | One-page vector PDF for printing |
| `use_case_diagram_2.svg` / `.png` / `.pdf` | Identical copy of the final export |
| `use_case_diagram_2_2.svg` / `.png` / `.pdf` | Identical copy of the final export |

The three file-name variants are deliberate duplicates retained for compatibility with the previous delivery naming. Their contents and hashes are identical.

## Diagram scope

### Actors (8)

| Actor | Kind | Side |
|---|---|---|
| Platform User | `<<abstract>>` | Left |
| Visitor | Concrete | Left |
| Registered User | `<<abstract>>` | Left |
| Attendee | Concrete | Left |
| Organizer | Concrete | Left |
| Administrator | Concrete | Left |
| Email Service | External system | Right |
| Jitsi Meet | External system | Right |

Human actors are outside the left edge of the system boundary; the two external services are outside the right edge. There is no external `EventFlow Assistant` actor; `Ask EventFlow Assistant` remains an internal use case.

### Use cases (42)

| Section | Count | Contents |
|---|---:|---|
| A. Account & Access | 6 | Register, log in, recover/restore account, manage account, dashboard |
| B. Event Discovery | 4 | Browse, view details, private invitation access, assistant |
| C. Event Requests & Approval | 3 | Submit/track request, review requests, generate draft event |
| D. Event Participation | 8 | Register/cancel, waitlist, e-ticket, review, evaluation, chat, meeting |
| E. Event Operations | 9 | Create/edit, lifecycle, registrations, schedule, check-in/out, finance, feedback |
| F. Platform Administration & Governance | 12 | Users, roles, finance, bans, audience, audit, settings, reports, files |

The three section-C use cases share one row: `Submit and Track Event Request`, `Review Event Requests`, and `Generate Draft Event`.

### Relationships

**Generalizations (5), hollow triangle at the parent:**

- `Visitor → Platform User`
- `Registered User → Platform User`
- `Attendee → Registered User`
- `Organizer → Registered User`
- `Administrator → Organizer`

`Administrator → Organizer` is genuine inheritance, not a legacy artifact: administrators pass the organizer guards and `canManageEvent()` returns true in the implementation.

**`<<include>>` (2):**

- `Perform Check-In → Validate E-Ticket`
- `Review Event Requests → Generate Draft Event`

**`<<extend>>` (3):**

- `Restore Deleted Account → Recover Account Access`
- `Access Private Event via Invitation Code → View Event Details`
- `Join Event Waitlist → Register for Event`

## Semantic corrections

- `Attendee` is a left-side human actor, not a right-side external system.
- `Administrator` inherits from `Organizer`.
- `Participate in Event Chat` and `Join Online Meeting` are associated with `Registered User`, because attendees, organizers, and administrators all use them.
- `Restore Deleted Account` is associated with `Visitor`; self-restore is a public route.
- `Manage Audience and Campaigns` stays with `Organizer`; platform-wide audience access stays with `Administrator`.
- Check-in and check-out are separate use cases. Only `Perform Check-In` includes `Validate E-Ticket`.
- Approval atomically creates the draft event, so `Review Event Requests` includes `Generate Draft Event`.
- Chat and meeting are internal platform functions; the assistant has no separate external actor.

## Layout and typography

- Page: **4100 × 3580** drawing units.
- System boundary: **2500 × 3360**, centred at `(1000, 100)`.
- Three use-case columns at `x = 1220, 2020, 2820`; each oval is **560 × 110**.
- Human actors at `x = 260`; external services at `x = 3640`.
- Association exits are anchored at the actor's arm line; generalization arrows use the arm line with separated entry points, so no line floats away from the figure.
- Associations are solid lines with no arrowheads. Generalizations are solid lines with hollow triangles at the parent. Includes/extends are dashed open arrows.
- Orthogonal routing uses dedicated trunk lanes, target row-gap corridors, and column gaps. No connector passes through an oval, actor, label, stereotype, heading, or unrelated section.
- Typography: title **26 px**, section headings **18 px bold**, use cases **16 px**, actors **16 px**, stereotypes **14 px**, relationship labels **13 px**.
- Long labels wrap to two lines inside the ovals.

## Verification

| Check | Result |
|---|---|
| Actors | 8 |
| Use cases | 42 |
| Actor associations | 45 |
| Generalizations | 5, correct direction |
| `<<extend>>` / `<<include>>` | 3 / 2 |
| Total edges | 55 |
| Connector/oval, connector/actor, connector/text intersections | 0 |
| Oval/heading overlaps | 0 |
| Clipped or out-of-bounds text | 0 |
| SVG `foreignObject` / `<switch>` / export footer | 0 / 0 / 0 |
| SVG text elements | 64 (62 multi-line `tspan`s) |
| SVG background | Opaque white rect |
| PNG | 11913 × 10550 px, RGB, 300 DPI, white corners |
| PDF | 1 page, vector, no raster images, 2950 × 2577 pt |

The cleaned SVG was rendered in a browser and inspected at full resolution. The PNG was inspected in full-page and high-resolution crops. All 42 use-case labels, 8 actor labels, 6 section headings, title, stereotypes, and relationship labels are present and legible.

## Editing and regeneration

Open `use_case_diagram.drawio` in [diagrams.net](https://app.diagrams.net/) or the Draw.io desktop app. Keep the three-column grid, the section rows, and the routing corridors when editing; the verification above depends on that geometry.

For a fresh export from the authoritative Draw.io source:

```powershell
$dir = 'C:\Users\MT\Desktop\event_flow-final-system\المتطلبات الخارجية\uml-use-case-unified'
$drawio = 'C:\Program Files\draw.io\draw.io.exe'

& $drawio -x -f svg --svg-theme light -b 12 -o "$dir\use_case_diagram.svg" "$dir\use_case_diagram.drawio"
& $drawio -x -f pdf -b 12 -o "$dir\use_case_diagram.pdf" "$dir\use_case_diagram.drawio"
```

Draw.io's PNG renderer truncates this 4100 × 3580 page above roughly 2× scale. The delivered 300-DPI PNG is therefore rasterized from the normalized SVG with headless Chrome, using the SVG's 3812 × 3376 CSS-pixel canvas at a 3.125 device scale factor:

```powershell
$dir = 'C:\Users\MT\Desktop\event_flow-final-system\المتطلبات الخارجية\uml-use-case-unified'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'

& $chrome --headless=new --disable-gpu --hide-scrollbars `
  --force-device-scale-factor=3.125 --window-size=3812,3376 `
  --screenshot="$dir\use_case_diagram.png" `
  "file:///C:/path/to/use_case_diagram.svg"
```

Draw.io's default SVG export embeds HTML fallback labels and a "Text is not SVG" footer. The delivered SVG has been normalized to pure SVG text with an opaque white background, so it renders consistently in document pipelines and image viewers. If you re-export the SVG, repeat that normalization before delivery.

The PNG is a true 3.125× raster (96 DPI × 3.125 = 300 DPI). If the rasterizer writes an unset DPI tag, set it explicitly:

```python
from PIL import Image
p = r"...\use_case_diagram.png"
im = Image.open(p).convert("RGB")
im.save(p, dpi=(300, 300), optimize=True)
```

No application source code was changed for this diagram revision.
