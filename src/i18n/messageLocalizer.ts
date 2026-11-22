import { hasTranslation, translate, type Language, type TranslationVars } from "./index"

type Pattern = [RegExp, (match: RegExpMatchArray, tr: (key: string, vars?: TranslationVars) => string, language: Language) => string]

const patterns: Pattern[] = [
  [/^Rate limit exceeded\. Try again in (\d+) seconds\.$/, (m, tr) =>
    tr("Rate limit exceeded. Try again in {seconds} seconds.", { seconds: m[1] })],

  [/^Only (.+?) is available in this funding source$/, (m, tr) =>
    tr("Only {amount} is available in this funding source", { amount: m[1] })],

  [/^Reminder: "(.*)" starts (.*)!$/, (m, tr) =>
    tr('Reminder: "{title}" starts {date}!', { title: m[1], date: m[2] })],

  [/^(.+) checked in$/, (m, tr) => tr("{name} checked in", { name: m[1] })],

  [/^A new expense of (.+?) needs approval: (.+)\.$/, (m, tr) =>
    tr("A new expense of {amount} needs approval: {purpose}.", { amount: m[1], purpose: m[2] })],
  [/^Your expense "(.*)" was approved\.$/, (m, tr) =>
    tr('Your expense "{purpose}" was approved.', { purpose: m[1] })],
  [/^Your expense "(.*)" was rejected\.$/, (m, tr) =>
    tr('Your expense "{purpose}" was rejected.', { purpose: m[1] })],
  [/^Your expense "(.*)" was rejected: (.*)$/, (m, tr) =>
    tr('Your expense "{purpose}" was rejected: {reason}', { purpose: m[1], reason: m[2] })],

  [/^(.+) sent a message in (the event community|a private chat) of "(.*)"\.$/, (m, tr) =>
    tr('{senderName} sent a message in {label} of "{title}".', {
      senderName: m[1],
      label: tr(m[2]),
      title: m[3],
    })],

  [/^"(.*)" deleted$/, (m, tr) => tr('"{name}" deleted', { name: m[1] })],
  [/^"(.*)" uploaded$/, (m, tr) => tr('"{name}" uploaded', { name: m[1] })],
  [/^"(.*)" duplicated as draft$/, (m, tr) => tr('"{name}" duplicated as draft', { name: m[1] })],
  [/^"(.*)" published$/, (m, tr) => tr('"{name}" published', { name: m[1] })],
  [/^"(.*)" archived$/, (m, tr) => tr('"{name}" archived', { name: m[1] })],
  [/^"(.*)" moved to draft$/, (m, tr) => tr('"{name}" moved to draft', { name: m[1] })],

  [/^Template "(.*)" saved$/, (m, tr) => tr('Template "{type}" saved', { type: m[1] })],

  [/^Account disabled\. You can restore it until (.+)\.$/, (m, tr) =>
    tr("Account disabled. You can restore it until {date}.", { date: m[1] })],

  [/^Downloading (.+)$/, (m, tr) => tr("Downloading {name}", { name: m[1] })],

  [/^Signed out (\d+) other sessions?$/, (m, tr, language) => {
    const count = Number(m[1])
    return new Intl.PluralRules(language === "ar" ? "ar-EG" : "en-US").select(count) === "one"
      ? tr("Signed out {count} other session", { count })
      : tr("Signed out {count} other sessions", { count })
  }],

  [/^Delivered (\d+) due messages?$/, (m, tr, language) => {
    const count = Number(m[1])
    return new Intl.PluralRules(language === "ar" ? "ar-EG" : "en-US").select(count) === "one"
      ? tr("Delivered {count} due message", { count })
      : tr("Delivered {count} due messages", { count })
  }],

  [/^Sent (\d+) due campaigns?$/, (m, tr, language) => {
    const count = Number(m[1])
    return new Intl.PluralRules(language === "ar" ? "ar-EG" : "en-US").select(count) === "one"
      ? tr("Sent {count} due campaign", { count })
      : tr("Sent {count} due campaigns", { count })
  }],

  [/^Created (\d+) invitation link\(s\)$/, (m, tr) =>
    tr("Created {count} invitation link(s)", { count: m[1] })],

  [/^Invitation created for (.+)$/, (m, tr) => tr("Invitation created for {email}", { email: m[1] })],
  [/^User created and invited \((.+)\)$/, (m, tr) =>
    tr("User created and invited ({email})", { email: m[1] })],
  [/^Signed in with (.+)$/, (m, tr) => tr("Signed in with {email}", { email: m[1] })],
  [/^Reminder sent to (\d+) attendees?$/, (m, tr) =>
    tr(
      Number(m[1]) === 1 ? "Reminder sent to {count} attendee" : "Reminder sent to {count} attendees",
      { count: m[1] },
    )],

  [/^Request marked as (.+)$/, (m, tr) =>
    tr("Request marked as {status}", { status: m[1].replace(/\s+/g, "_") })],

  [/^Your evaluation for "(.*)" has been recorded\.$/, (m, tr) =>
    tr('Your evaluation for "{title}" has been recorded.', { title: m[1] })],
  [/^You'll be able to rate "(.*)" once it ends\.$/, (m, tr) =>
    tr('You\'ll be able to rate "{title}" once it ends.', { title: m[1] })],

  [/^Access expires (.+)\.$/, (m, tr) => tr("Access expires {date}.", { date: m[1] })],

  [/^Event is full — you are number (\d+) on the waiting list\.$/, (m, tr) =>
    tr("Event is full — you are number {position} on the waiting list.", { position: m[1] })],

  [/^(\d+) (minute|minutes|hour|hours|day|days) ago$/, (m, tr, language) => {
    const count = Number(m[1])
    const unit = m[2]
    const singular = `{count} ${unit.replace(/s$/, "")}`
    const pluralKey = `{count} ${unit.endsWith("s") ? unit : `${unit}s`}`
    const label = tr(count === 1 ? singular : pluralKey, { count })
    return language === "ar" ? `منذ ${label}` : `${label} ago`
  }],

  [/^Your \{mode\} registration for "(.*)" has been confirmed\..*$/, (m, tr) =>
    tr('Your {mode} registration for "{title}" has been confirmed. Your ticket is ready in your dashboard.', { title: m[1] })],

  [/^An administrator is reviewing your event request "(.*)"\.$/, (m, tr) =>
    tr('An administrator is reviewing your event request "{title}".', { title: m[1] })],

  // Event request notifications. Admin notes are appended as " Note: ...", so
  // match the optional suffix instead of leaving the whole message in English.
  [/^New event request "(.*)" from a registered user is waiting for review\.$/, (m, tr) =>
    tr('New event request "{title}" from a registered user is waiting for review.', { title: m[1] })],
  [/^Your event request "(.*)" is pending review\.$/, (m, tr) =>
    tr('Your event request "{title}" is pending review.', { title: m[1] })],
  [/^Your event request "(.*)" was approved and a draft event was created\.$/, (m, tr) =>
    tr('Your event request "{title}" was approved and a draft event was created.', { title: m[1] })],
  [/^Your event request "(.*)" was not approved\.(?: Note: (.*))?$/, (m, tr) => {
    const base = tr('Your event request "{title}" was not approved.', { title: m[1] })
    return m[2] ? `${base} ${tr("Note: {note}", { note: m[2] })}` : base
  }],
  [/^More information is needed for your event request "(.*)"\.(?: Note: (.*))?$/, (m, tr) => {
    const base = tr('More information is needed for your event request "{title}".', { title: m[1] })
    return m[2] ? `${base} ${tr("Note: {note}", { note: m[2] })}` : base
  }],

  // Ban workflow notifications and the registration guard message.
  [
    /^You have been restricted by (a global ban|a ban for this event|a ban in this event category)\.\s*(?:Reason: (.*?)\.\s*(?=(?:It ends on |This ban is permanent\.|You can still use your account)))?(?:(It ends on .+?|This ban is permanent\.)\s*)?You can still use your account but cannot register for new events covered by this ban\.$/,
    (m, tr) => {
      const parts = [tr("You have been restricted by {ban}.", { ban: tr(m[1]) })]
      if (m[2]) parts.push(tr("Reason: {reason}.", { reason: m[2] }))
      if (m[3]) {
        if (m[3] === "This ban is permanent.") {
          parts.push(tr("This ban is permanent."))
        } else {
          parts.push(tr("It ends on {date}.", { date: m[3].replace(/^It ends on /, "").replace(/\.$/, "") }))
        }
      }
      parts.push(tr("You can still use your account but cannot register for new events covered by this ban."))
      return parts.map((part) => part.trim()).join(" ")
    },
  ],
  [/^The restriction on your account has been lifted\.(?: Note: (.*))?$/, (m, tr) => {
    const base = tr("The restriction on your account has been lifted.")
    return m[1] ? `${base} ${tr("Note: {reason}", { reason: m[1] })}` : base
  }],
  [
    /^An organizer requested (a global ban|a ban for this event|a ban in this event category) for a user\. Approval is required before it takes effect\.(?: (The user has no existing registrations\.|The user currently has (\d+) existing registration(?:s)? that will not be cancelled\.))?$/,
    (m, tr) => {
      const base = tr("An organizer requested {ban} for a user. Approval is required before it takes effect.", { ban: tr(m[1]) })
      if (!m[2]) return base
      if (m[2] === "The user has no existing registrations.") {
        return `${base} ${tr("The user has no existing registrations.")}`
      }
      const count = Number(m[3])
      const key = count === 1
        ? "The user currently has {count} existing registration that will not be cancelled."
        : "The user currently has {count} existing registrations that will not be cancelled."
      return `${base} ${tr(key, { count })}`
    },
  ],
  [/^An organizer requested to lift a user ban\. Review it on the Bans page\.$/, (_m, tr) =>
    tr("An organizer requested to lift a user ban. Review it on the Bans page.")],
  [
    /^You cannot register for this event because of (a global ban|a ban for this event|a ban in this event category)( until .+?)?\.(?: Reason: (.*))?$/,
    (m, tr) => {
      let result = tr("You cannot register for this event because of {ban}{expiry}.", {
        ban: tr(m[1]),
        expiry: m[2] ? tr("until {date}", { date: m[2].replace(/^ until /, "") }) : "",
      })
      if (m[3]) result += tr(" Reason: {reason}.", { reason: m[3] })
      return result
    },
  ],

  // Notification type badges strip underscores before lookup.
  [/^event request update$/, (_m, tr) => tr("event_request_update")],
  [/^event request$/, (_m, tr) => tr("event_request")],
  [/^ban notice$/, (_m, tr) => tr("ban_notice")],
  [/^ban request$/, (_m, tr) => tr("ban_request")],
  [/^ban approved$/, (_m, tr) => tr("ban_approved")],
];

/** Localize service, validation and notification messages at the UI boundary. */
export function localizeMessage(language: Language, message: unknown): string {
  if (message === null || message === undefined) return ""
  const source = String(message)
  if (!source) return ""
  const trimmed = source.trim()

  if (hasTranslation(language, trimmed)) return translate(language, trimmed)
  if (language === "en") return source

  for (const [pattern, build] of patterns) {
    const match = trimmed.match(pattern)
    if (match) return build(match, (key, vars) => translate(language, key, vars), language)
  }

  return source
}
