/**
 * Email delivery.
 *
 * By default the app runs in "mock" mode: messages are logged to the browser
 * console and reported as sent so the whole flow can be tested without keys.
 * When VITE_EMAIL_PROVIDER, VITE_EMAIL_API_KEY and VITE_EMAIL_FROM are all set
 * the message is sent through the selected provider.
 *
 * NOTE: calling provider APIs directly from a browser is only suitable for
 * demos. Production deployments should proxy this through a Supabase Edge
 * Function (or another backend) because provider APIs may reject browser
 * origins (CORS) and the API key would be exposed.
 */

import { runtimeT } from "../i18n/runtimeLocale"

export type EmailProvider = "mock" | "resend" | "sendgrid"

export interface EmailMessage {
  to: string
  subject: string
  body: string
  from?: string
}

export interface EmailResult {
  ok: boolean
  provider: EmailProvider
  error?: string
}

function env(key: string): string {
  return (import.meta.env[key] as string | undefined)?.trim() ?? ""
}

export function getEmailProvider(): EmailProvider {
  const raw = env("VITE_EMAIL_PROVIDER").toLowerCase()
  if (raw === "resend" || raw === "sendgrid") return raw
  return "mock"
}

export function isEmailConfigured(): boolean {
  const provider = getEmailProvider()
  if (provider === "mock") return false
  return Boolean(env("VITE_EMAIL_API_KEY") && env("VITE_EMAIL_FROM"))
}

export function getEmailFrom(): string {
  return env("VITE_EMAIL_FROM") || "no-reply@eventflow.local"
}

export function getEmailModeLabel(): string {
  const provider = getEmailProvider()
  return provider === "mock" ? runtimeT("Mock (no email is actually sent)") : runtimeT("Live · {provider}", { provider })
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = getEmailProvider()
  const from = message.from || getEmailFrom()

  if (provider === "mock") {
    // eslint-disable-next-line no-console
    console.info("[email:mock]", { to: message.to, subject: message.subject, from })
    return { ok: true, provider }
  }

  const apiKey = env("VITE_EMAIL_API_KEY")
  if (!apiKey || !from) {
    return {
      ok: false,
      provider,
      error: "Email provider is not fully configured (VITE_EMAIL_API_KEY / VITE_EMAIL_FROM).",
    }
  }

  try {
    let response: Response
    if (provider === "resend") {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.body,
        }),
      })
    } else {
      response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: from },
          subject: message.subject,
          content: [{ type: "text/html", value: message.body }],
        }),
      })
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      return {
        ok: false,
        provider,
        error: `Provider returned ${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`,
      }
    }
    return { ok: true, provider }
  } catch (err) {
    return {
      ok: false,
      provider,
      error: err instanceof Error ? err.message : "Failed to reach the email provider",
    }
  }
}

/** Replaces {{key}} placeholders in a template body/subject. */
export function renderEmailTemplate(template: string, values: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key]
    return value === undefined || value === null ? "" : String(value)
  })
}

/** Plain-text to simple HTML paragraphs, preserving line breaks. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br/>")}</p>`)
    .join("\n")
}
