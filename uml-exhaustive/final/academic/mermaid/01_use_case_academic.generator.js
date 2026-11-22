const fs = require("fs")

// ================================================================
//  EventFlow Use-Case diagram — MERGED (English)
//  Content  : the REAL events + associations (34 use cases, 4 actors
//             + external LM Studio), taken 1:1 from 01_use_case.mmd
//             (matched with routes/index.tsx + src/services/*)
//  Academic : actors OUTSIDE the boundary (stick figures), numbered
//             use cases UC01..UC34 grouped in columns, solid
//             associations, dashed «include», hollow-triangle
//             generalizations, notes + legend (easy to trace).
// ================================================================

const W = 1760, H = 1200

const SVG_CS = "framework-style"

// ---- layout geometry ----
const BY = 132, BH = 922                      // boundary rect
const BX = 300, BR = 1460                     // left/right edges (right = BX+BW)
const BW = BR - BX
const ROWS = [232, 308, 384, 460, 536, 612, 688, 764, 840, 916] // 10 lanes (pitch 76)
const ROWGAPS = ROWS.slice(1).map((r, i) => (ROWS[i] + r) / 2)
ROWGAPS.unshift(204)
ROWGAPS.push(986)

const COLX = { A: 500, B: 740, C: 990, D: 1240 }

const colsDef = [
  { cx: COLX.A, title: "Browsing, Account & Access", ids: ["UC01", "UC02", "UC03", "UC04", "UC05"] },
  { cx: COLX.B, title: "Attendee Actions & Participation", ids: ["UC06", "UC07", "UC08", "UC09", "UC10", "UC11", "UC12", "UC13", "UC14", "UC15"] },
  { cx: COLX.C, title: "Event Management (Organizer)", ids: ["UC16", "UC17", "UC18", "UC19", "UC20", "UC21", "UC22", "UC23", "UC24", "UC25"] },
  { cx: COLX.D, title: "Platform Administration", ids: ["UC26", "UC27", "UC28", "UC29", "UC30", "UC31", "UC32", "UC33", "UC34"] },
]

const UCLABELS = {
  UC01: "Browse & search\npublished events",
  UC02: "View event detail,\nschedule & reviews",
  UC03: "Register a\nnew account",
  UC04: "Log in with\nemail + password",
  UC05: "Forgot /\nreset password",
  UC06: "Register for public event\n(auto ticket / waitlist)",
  UC07: "Register for private event\nwith invitation code",
  UC08: "View / download\nQR ticket",
  UC09: "Cancel own registration\n(may auto-promote waitlist)",
  UC10: "Submit feedback\n(rating + comment)",
  UC11: "Submit event evaluation\n(questions)",
  UC12: "Chat: community\nor private 1:1",
  UC13: "Ask the AI assistant\n(LM Studio widget)",
  UC14: "View notifications\n& reminders",
  UC15: "Join online meeting\n(auto check-in)",
  UC16: "Create / edit / duplicate /\ndelete event",
  UC17: "Manage lifecycle:\ndraft / publish / archive",
  UC18: "Manage schedule:\nsessions & speakers",
  UC19: "Manage registrations\n& waitlist",
  UC20: "QR check-in /\ncheck-out attendees",
  UC21: "Generate & share\ninvitation links",
  UC22: "Manage event costs\n(planned / actual)",
  UC23: "Build evaluations &\ninvite attendees",
  UC24: "Review & respond\nto feedback",
  UC25: "Set online\nmeeting link",
  UC26: "Manage users, roles\n& suspension",
  UC27: "Manage\ncategories",
  UC28: "Manage\nvenues",
  UC29: "Manage\nglobal files",
  UC30: "Assign & manage\nevent organizers",
  UC31: "View reports\n& analytics",
  UC32: "Configure settings\n& email templates",
  UC33: "Security center: sessions\n+ audit log",
  UC34: "Manage all events\n(manage-all flag)",
}
const LMBLUE = "#0b3d91", INK = "#37474f", SUPPORT = "#8a97a8", RED = "#c62828"

// special dashed nodes (brown outline) inside the boundary
const TKT = { id: "TKT", cx: 870, cy: 985, label: "Generate QR ticket\n(unique code + QR)", dash: true }
const INV = { id: "INV", cx: 560, cy: 1000, label: "Invite-code validation:\nexists / unused / event &\nemail match, mark used", dash: true }
const TOOL = { id: "TOOL", cx: 1290, cy: 1000, label: "LM Studio tools\n(search / details /\ncategories / venues / stats)", dash: true }

const actorsDef = {
  AV: { cx: 142, cy: 300, name: "Visitor", role: "guest (unauthenticated)" },
  AT: { cx: 142, cy: 590, name: "Attendee", role: "registered user", ext: false },
  OR: { cx: 1616, cy: 300, name: "Organizer", role: "event manager" },
  AD: { cx: 1616, cy: 590, name: "Administrator", role: "platform admin" },
  LM: { cx: 1616, cy: 1010, name: "LM Studio Assistant", role: "external AI system", ext: true },
}

// ---------- items ----------
const items = []
const itemById = {}
for (const col of colsDef) col.ids.forEach((id, i) => items.push({ id, label: UCLABELS[id], cx: col.cx, cy: ROWS[i], col: col }) )

function width(s) {
  let w = 0
  for (const ch of s) { const c = ch.codePointAt(0); if (c === 0x20) w += 3.6; else if ((c >= 0x41 && c <= 0x7a)) w += 6.5; else w += 6.0 }
  return w
}
function sizeOf(it) {
  const lines = it.label.split("\n")
  const w = Math.max(...lines.map(width))
  const rx = w / 2 + 18
  const ry = 14 + 10.5 * lines.length
  return { rx, ry, L: lines.length }
}
function finalize() {
  for (const it of items) Object.assign(it, sizeOf(it))
  for (const it of items) itemById[it.id] = it
  for (const n of [TKT, INV, TOOL]) itemById[n.id] = Object.assign({ id: n.id, cx: n.cx, cy: n.cy, label: n.label, dash: n.dash }, sizeOf(n))
}
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// ---------- routing ----------
const segments = []
function addSegment(ax, ay, bx, by) { const s = { x1: ax, y1: ay, x2: bx, y2: by }; segments.push(s); return s }
function svgSeg(s, style, color, w2 = 1.5) {
  const dash = style === "dash" ? ` stroke-dasharray="7,5"` : ""
  return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${color}" stroke-width="${w2}"${dash}/>`
}
function edgeLabelAt(p1, p2, txt) {
  const mx = (p1.x1 + p2.x1) / 2, my = (p1.y1 + p2.y1) / 2
  const wl = width(txt) + 16
  return `<rect x="${mx - wl / 2}" y="${my - 10}" width="${wl}" height="20" rx="4" fill="#ffffff" stroke="#c9d3e8" stroke-width="0.8"/>` +
    `<text x="${mx}" y="${my + 3.5}" font-family="Segoe UI,Tahoma,Arial" font-size="11.5" text-anchor="middle" fill="#1a237e">${esc(txt)}</text>`
}
function arrowAt(x, y, ang, color, size = 9) {
  const a1 = ang - Math.PI / 6.5, a2 = ang + Math.PI / 6.5
  return `<polygon points="${x},${y} ${x + Math.cos(a1) * size},${y + Math.sin(a1) * size} ${x + Math.cos(a2) * size},${y + Math.sin(a2) * size}" fill="#ffffff" stroke="${color}" stroke-width="1.3"/>`
}
function clipToEllipse(sx, sy, target) {
  const dx = target.cx - sx, dy = target.cy - sy
  const fx0 = sx - target.cx, fy0 = sy - target.cy
  const A = (dx * dx) / (target.rx * target.rx) + (dy * dy) / (target.ry * target.ry)
  const B = 2 * ((fx0 * dx) / (target.rx * target.rx) + (fy0 * dy) / (target.ry * target.ry))
  const C = (fx0 * fx0) / (target.rx * target.rx) + (fy0 * fy0) / (target.ry * target.ry) - 1
  const disc = B * B - 4 * A * C
  const t = disc >= 0 ? (-B - Math.sqrt(disc)) / (2 * A) : 1
  const tt = Math.max(0, Math.min(1, t))
  return { x: sx + dx * tt, y: sy + dy * tt }
}
function corridorClear(lane, x1, x2) {
  const lo = Math.min(x1, x2), hi = Math.max(x1, x2)
  const all = [...items, itemById["TKT"], itemById["INV"], itemById["TOOL"]]
  const hit = o => (o.cx + o.rx) >= lo && (o.cx - o.rx) <= hi && (o.cy - o.ry) <= lane && lane <= (o.cy + o.ry)
  return !all.some(hit)
}
function routeToFrom(sx, sy, targetId, gutterX, label, styleSeg) {
  const t = itemById[targetId]
  const cands = ROWGAPS.slice().sort((p, q) => Math.abs(p - t.cy) - Math.abs(q - t.cy))
  let lane = cands.find(l => corridorClear(l, gutterX, t.cx)) ?? null
  if (lane == null) for (let y = 950; y > 150; y -= 3) { if (corridorClear(y, gutterX, t.cx)) { lane = y; break } }
  if (lane == null) lane = t.cy
  const dirx = t.cx >= gutterX ? 100000 : -100000
  const end = clipToEllipse(t.cx + dirx, lane, t)
  const path = [[sx, sy], [gutterX, sy], [gutterX, lane], [t.cx, lane], [end.x, end.y]]
  const segs = []
  let [px, py] = path[0]
  for (let i = 1; i < path.length; i++) { const [ax, ay] = path[i]; segs.push(addSegment(px, py, ax, ay)); px = ax; py = ay }
  segs.style = styleSeg
  if (label) segs.labelSvg = edgeLabelAt(segs[1], segs[segs.length - 1], label)
  return segs
}
// dashed «include» that rises from a use case top, crosses a clear corridor,
// then drops vertically into the target node from above (or from below for INV)
function includeDropAbove(fromId, toId, viaX) {
  const s = itemById[fromId], t = itemById[toId]
  const side = s.cy - s.ry - 3
  const end = clipToEllipse(viaX, -5000, t)
  const segs = []
  segs.push(addSegment(s.cx, side, viaX, side))
  segs.push(addSegment(viaX, side, end.x, end.y))
  const labelEdge = { x1: s.cx, y1: side, x2: s.cx + 60, y2: side }
  return { segs, end, labelSvg: edgeLabelAt(labelEdge, labelEdge, "«include»") }
}
function generalization(parentActor, childActor) {
  const a = parentActor, b = childActor
  const dx = b.cx - a.cx, dy = b.cy - a.cy
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const s1 = { x: b.cx - (dx / len) * 40, y: b.cy - (dy / len) * 40 }
  const s2 = { x: a.cx + (dx / len) * 52, y: a.cy + (dy / len) * 52 }
  const seg = addSegment(s1.x, s1.y, s2.x, s2.y)
  const arr = `<polygon points="${s2.x},${s2.y} ${s2.x - dy / len * 8 - dx / len * 11},${s2.y + dx / len * 8 - dy / len * 11} ${s2.x + dy / len * 8 - dx / len * 11},${s2.y - dx / len * 8 - dy / len * 11}" fill="#fff" stroke="#37474f" stroke-width="1.5"/>`
  return svgSeg(seg, "solid", "#37474f") + arr
}

// ---------- drawing ----------
function ucEllipse(it, fill = "#f4f8ff", stroke = LMBLUE, dash = false) {
  const lines = it.label.split("\n")
  const out = [`<ellipse cx="${it.cx}" cy="${it.cy}" rx="${it.rx}" ry="${it.ry}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"${dash ? ` stroke-dasharray="10,5"` : ""}/>`]
  out.push(`<text x="${it.cx}" y="${it.cy - it.ry - 4}" font-family="Segoe UI,Tahoma,Arial" font-size="10" text-anchor="middle" fill="#7b8b9a">${esc(it.id)}</text>`)
  lines.forEach((ln, i) => out.push(`<text x="${it.cx}" y="${it.cy - ((lines.length - 1) / 2) * 10.5 + i * 10.5 + 3.5}" font-family="Segoe UI,Tahoma,Arial" font-size="11.5" font-weight="bold" text-anchor="middle" fill="#0b3d91">${esc(ln)}</text>`))
  return out.join("\n")
}
function actorFigure(id, c, color) {
  const x = c.cx, y = c.cy
  const ring = c.ext ? "#fdf3e3" : "#e8eef7"
  const st = c.ext ? ` stroke-dasharray="9,4"` : ""
  const out = []
  out.push(`<circle cx="${x}" cy="${y - 30}" r="11" fill="${ring}" stroke="${color}" stroke-width="2"${st}/>`)
  out.push(`<path d="M${x} ${y - 19} L${x} ${y + 8}" fill="none" stroke="${color}" stroke-width="2"/>`)
  out.push(`<path d="M${x - 18} ${y - 8} L${x + 18} ${y - 8}" fill="none" stroke="${color}" stroke-width="2"/>`)
  out.push(`<path d="M${x} ${y + 8} L${x - 16} ${y + 26}" fill="none" stroke="${color}" stroke-width="2"/>`)
  out.push(`<path d="M${x} ${y + 8} L${x + 16} ${y + 26}" fill="none" stroke="${color}" stroke-width="2"/>`)
  out.push(`<text x="${x}" y="${y + 48}" font-family="Segoe UI,Tahoma,Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="#111">${esc(c.name)}</text>`)
  out.push(`<text x="${x}" y="${y + 65}" font-family="Segoe UI,Tahoma,Arial" font-size="11" text-anchor="middle" fill="#666">${esc(c.role)}</text>`)
  if (c.ext) out.push(`<text x="${x}" y="${y + 86}" font-family="Segoe UI,Tahoma,Arial" font-size="10" text-anchor="middle" fill="#888">«external system»</text>`)
  return out.join("\n")
}

// ---------- overlap check ----------
function segIntersectsEllipse(s, it) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1
  const fx0 = s.x1 - it.cx, fy0 = s.y1 - it.cy
  const A = (dx * dx) / (it.rx * it.rx) + (dy * dy) / (it.ry * it.ry)
  if (A === 0) return false
  const B = 2 * ((fx0 * dx) / (it.rx * it.rx) + (fy0 * dy) / (it.ry * it.ry))
  const C = (fx0 * fx0) / (it.rx * it.rx) + (fy0 * fy0) / (it.ry * it.ry) - 1
  const disc = B * B - 4 * A * C
  if (disc < 0) return false
  const sq = Math.sqrt(disc)
  const t1 = (-B - sq) / (2 * A), t2 = (-B + sq) / (2 * A)
  return (t1 > 0.02 && t1 < 0.98) || (t2 > 0.02 && t2 < 0.98)
}
function checkOverlaps() {
  const bad = []
  const all = [...items, itemById["TKT"], itemById["INV"], itemById["TOOL"]]
  for (const s of segments) for (const it of all) if (segIntersectsEllipse(s, it)) bad.push(`${Math.round(s.x1)},${Math.round(s.y1)} -> ${Math.round(s.x2)},${Math.round(s.y2)} x ${it.id}`)
  return bad
}

// ---------- assemble ----------
function build() {
  const parts = []
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`)
  parts.push(`<text x="${W / 2}" y="48" font-family="Segoe UI,Tahoma,Arial" font-size="24" font-weight="bold" text-anchor="middle" fill="${LMBLUE}">EventFlow — Use Case Diagram (English, Academic layout)</text>`)
  parts.push(`<text x="${W / 2}" y="96" font-family="Segoe UI,Tahoma,Arial" font-size="13" text-anchor="middle" fill="#667">34 use cases taken 1:1 from the implementation · actors outside the boundary · numbered UC01–UC34 · dashed «include» · hollow triangle = inheritance</text>`)

  const primary = INK, support = SUPPORT

  // actor -> use case associations (solid) — SAME links as 01_use_case.mmd
  const edges = [
    ["AV", "UC01"], ["AV", "UC02"], ["AV", "UC03"], ["AV", "UC04"], ["AV", "UC05"],
    ["AT", "UC06"], ["AT", "UC07"], ["AT", "UC08"], ["AT", "UC09"], ["AT", "UC10"],
    ["AT", "UC11"], ["AT", "UC12"], ["AT", "UC13"], ["AT", "UC14"], ["AT", "UC15"],
    ["OR", "UC16"], ["OR", "UC17"], ["OR", "UC18"], ["OR", "UC19"], ["OR", "UC20"],
    ["OR", "UC21"], ["OR", "UC22"], ["OR", "UC23"], ["OR", "UC24"], ["OR", "UC25"],
    ["AD", "UC26"], ["AD", "UC27"], ["AD", "UC28"], ["AD", "UC29"], ["AD", "UC30"],
    ["AD", "UC31"], ["AD", "UC32"], ["AD", "UC33"], ["AD", "UC34"],
    // Administrator inherits every Organizer use case (UC16–UC25) via generalization
  ]
  // supporting external system links (dashed) + include dependencies
  const lmEdges = [["LM", "UC13", "answers via the AI widget"], ["LM", "TOOL", "function calls"]]

  const edgeDraws = []
  for (const [a, b] of edges) {
    const act = actorsDef[a]
    const rightSide = (a === "OR" || a === "AD" || a === "LM")
    const gutter = rightSide ? BR - 6 : BX - 6
    const sx = rightSide ? act.cx - 16 : act.cx + 16
    const sy = act.cy - 8
    edgeDraws.push({ style: "solid", color: primary, segs: routeToFrom(sx, sy, b, gutter, null, "solid") })
  }
  for (const [a, b, label] of lmEdges) {
    const act = actorsDef[a]
    const sx = act.cx - 16, sy = act.cy - 8
    if (b === "TOOL") {
      const end = clipToEllipse(sx, sy, itemById["TOOL"])
      const seg = addSegment(sx, sy, end.x, end.y)
      parts.push(svgSeg(seg, "dash", support, 1.2))
      parts.push(edgeLabelAt(seg, seg, label))
      continue
    }
    edgeDraws.push({ style: "dash", color: support, segs: routeToFrom(sx, sy, b, BR - 6, label, "dash") })
  }

  const inc1 = includeDropAbove("UC06", "TKT", 856)   // public registration -> QR ticket
  const inc2 = includeDropAbove("UC07", "TKT", 882)   // private registration -> QR ticket
  const inc3 = includeDropAbove("UC07", "INV", 618)   // private registration -> invite-code validation

  for (const ed of edgeDraws) {
    for (const s of ed.segs) parts.push(svgSeg(s, ed.style, ed.color, ed.style === "solid" ? 1.5 : 1.2))
    if (ed.segs.labelSvg) parts.push(ed.segs.labelSvg)
  }
  for (const inc of [inc1, inc2, inc3]) {
    for (const s of inc.segs) parts.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${RED}" stroke-width="1.8" stroke-dasharray="8,4"/>`)
    parts.push(arrowAt(inc.end.x, inc.end.y, Math.PI / 2, RED, 9))
    parts.push(inc.labelSvg)
  }

  // generalizations (hollow triangles): Attendee is-a Visitor, Administrator is-a Organizer
  parts.push(generalization(actorsDef.AV, actorsDef.AT))
  parts.push(generalization(actorsDef.OR, actorsDef.AD))

  // column headers
  for (const col of colsDef) parts.push(`<text x="${col.cx}" y="${BY + 26}" font-family="Segoe UI,Tahoma,Arial" font-size="12.5" font-weight="bold" text-anchor="middle" fill="#7b8b9a">${esc(col.title)}</text>`)

  for (const it of items) parts.push(ucEllipse(it))
  for (const n of [TKT, INV, TOOL]) parts.push(ucEllipse(itemById[n.id], "#fdf3e3", "#8a6d1a", true))

  for (const k of Object.keys(actorsDef)) parts.push(actorFigure(k, actorsDef[k], "#455a64"))

  // boundary box on top
  parts.push(`<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" fill="#fbfcff" stroke="${LMBLUE}" stroke-width="2.6" rx="4"/>`)

  // notes
  const notes = [
    { x: 505, y: 1128, w: 640, lines: [
      "Registration events: public → confirmed with an auto ticket, full capacity",
      "→ waitlisted (no ticket). Private events also validate the invitation",
      "code (must exist, be unused, match the event + attendee email) then",
      "mark it used. Cancelling a confirmed registration may auto-promote",
      "the first waitlisted attendee.",
    ]},
    { x: 1245, y: 1128, w: 410, lines: [
      "No 'pending' state: available seat → confirmed,",
      "full capacity → waitlisted (auto-promoted on cancel).",
      "Administrator inherits every Organizer use case",
      "(UC16–UC25) through the inheritance arrow.",
    ]},
  ]
  for (const n of notes) {
    parts.push(`<rect x="${n.x - n.w / 2}" y="${n.y - 30}" width="${n.w}" height="${92}" rx="6" fill="#fff9e6" stroke="#f0c24b" stroke-width="1.2"/>`)
    n.lines.forEach((ln, i) => parts.push(`<text x="${n.x}" y="${n.y - 8 + i * 17}" font-family="Segoe UI,Tahoma,Arial" font-size="12" text-anchor="middle" fill="#5d4e0e">${esc(ln)}</text>`))
  }

  // legend
  const ly = 1080
  const lw = 1320, lx = W / 2
  parts.push(`<rect x="${lx - lw / 2}" y="${ly - 18}" width="${lw}" height="26" rx="5" fill="#eef2f8" stroke="#c9d3e8" stroke-width="1"/>`)
  const lg = [
    { d: 78, seg: `<line x1="${lx - lw / 2 + 18}" y1="${ly}" x2="${lx - lw / 2 + 66}" y2="${ly}" stroke="#37474f" stroke-width="1.5"/>`, t: "actor association" },
    { d: 290, seg: `<line x1="${lx - lw / 2 + 230}" y1="${ly}" x2="${lx - lw / 2 + 278}" y2="${ly}" stroke="#c62828" stroke-width="1.8" stroke-dasharray="8,4"/>`, t: "«include» (internal)" },
    { d: 470, seg: `<line x1="${lx - lw / 2 + 434}" y1="${ly}" x2="${lx - lw / 2 + 482}" y2="${ly}" stroke="#8a97a8" stroke-width="1.4" stroke-dasharray="7,5"/>`, t: "external / system link" },
    { d: 655, seg: `<polygon points="${lx - lw / 2 + 640},${ly - 7} ${lx - lw / 2 + 652},${ly + 1} ${lx - lw / 2 + 628},${ly + 1}" fill="#fff" stroke="#37474f" stroke-width="1.2"/><line x1="${lx - lw / 2 + 652}" y1="${ly + 1}" x2="${lx - lw / 2 + 706}" y2="${ly + 1}" stroke="#37474f" stroke-width="1.4"/>`, t: "inheritance (is-a)" },
    { d: 875, seg: `<ellipse cx="${lx - lw / 2 + 876}" cy="${ly}" rx="12" ry="9" fill="#f4f8ff" stroke="#0b3d91" stroke-width="1.2"/>`, t: "use case" },
    { d: 1095, seg: `<ellipse cx="${lx - lw / 2 + 1100}" cy="${ly}" rx="12" ry="9" fill="#fdf3e3" stroke="#8a6d1a" stroke-width="1.2" stroke-dasharray="4,3"/>`, t: "internal service node" },
  ]
  for (const g of lg) {
    parts.push(g.seg)
    parts.push(`<text x="${lx - lw / 2 + g.d + 16}" y="${ly + 3.5}" font-family="Segoe UI,Tahoma,Arial" font-size="11.5" text-anchor="start" fill="#37474f">${esc(g.t)}</text>`)
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${parts.join("\n")}\n</svg>`
  return { svg, bad: checkOverlaps() }
}

finalize()
const { svg, bad } = build()
const dest = "I:\\graduate_project\\my_work_on_project\\event-flow2\\event-flow\\uml-mermaid\\01_use_case_academic.svg"
fs.writeFileSync(dest, svg, "utf8")
console.log("written", fs.statSync(dest).size, "bytes | overlaps:", bad.length)
bad.slice(0, 60).forEach(b => console.log("  !!", b))