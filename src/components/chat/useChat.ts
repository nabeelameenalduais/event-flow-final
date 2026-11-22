import { useLanguage } from "../../contexts/LanguageContext"
import { runtimeLocalizeMessage } from "../../i18n/runtimeLocale"
import { useState, useCallback, useRef } from "react"

const LM_STUDIO_URL = "/lmstudio/v1/chat/completions"

const SYSTEM_PROMPT = `You are EventFlow Assistant, a helpful AI chatbot for the EventFlow event management platform.

CRITICAL RULE: When you need data, output ONLY a JSON object on a single line, nothing else. No explanation, no markdown, no code blocks. Just the raw JSON.

Example:
{"name": "get_upcoming_events", "args": {"limit": "5"}}

Example with no args:
{"name": "get_categories", "args": {}}

Example with search:
{"name": "search_events", "args": {"query": "music"}}

AVAILABLE TOOLS:
- get_upcoming_events(limit?: string) - Get upcoming events (default limit 5)
- get_categories() - List all categories
- get_venues() - List all venues  
- search_events(query?: string, category?: string, limit?: string) - Search events
- get_event_details(event_id: string) - Get event details by UUID
- get_event_stats(event_id: string) - Get registration stats

After receiving tool results, compose a friendly response with the data. NEVER make up data.

LANGUAGE RULE: Always respond in the same language the user wrote in. If the user writes in Arabic, respond entirely in natural Arabic. If the user writes in English, respond in English.`

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface LLMMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ParsedToolCall {
  name: string
  args: Record<string, unknown>
}

function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = []

  const knownTools = [
    "search_events", "get_event_details", "get_categories",
    "get_venues", "get_upcoming_events", "get_event_stats",
  ]

  // Find potential JSON objects by looking for {"name" patterns
  const nameRegex = /\{"name"\s*:/g
  let match
  while ((match = nameRegex.exec(text)) !== null) {
    // Find the matching closing brace
    let depth = 0
    let end = match.index
    for (let i = match.index; i < text.length; i++) {
      if (text[i] === "{") depth++
      if (text[i] === "}") depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }

    const jsonStr = text.substring(match.index, end)
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed.name && knownTools.includes(parsed.name)) {
        calls.push({ name: parsed.name, args: parsed.args || {} })
      }
    } catch {
      // skip
    }
  }

  return calls
}

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const headers = {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  }

  switch (name) {
    case "search_events": {
      const query = (args.query as string) || ""
      const status = (args.status as string) || "published"
      const limit = parseInt((args.limit as string) || "10", 10)

      let url = `${supabaseUrl}/rest/v1/events?status=eq.${status}&deleted_at=is.null&order=start_date.asc&limit=${limit}`

      if (query) {
        url += `&or=(title.ilike.%25${encodeURIComponent(query)}%25,description.ilike.%25${encodeURIComponent(query)}%25)`
      }

      const res = await fetch(url, { headers })
      const events = await res.json()

      if (args.category) {
        const catRes = await fetch(
          `${supabaseUrl}/rest/v1/categories?name=ilike.%25${encodeURIComponent(args.category as string)}%25&deleted_at=is.null`,
          { headers }
        )
        const cats = await catRes.json()
        if (cats.length > 0) {
          return events.filter(
            (e: Record<string, unknown>) => e.category_id === cats[0].id
          )
        }
        return []
      }

      return events
    }

    case "get_event_details": {
      const eventId = args.event_id as string
      const eventRes = await fetch(
        `${supabaseUrl}/rest/v1/events?id=eq.${eventId}&deleted_at=is.null`,
        { headers }
      )
      const events = await eventRes.json()
      if (events.length === 0) return { error: "Event not found" }

      const event = events[0]

      const [catRes, venueRes, sessionsRes, feedbackRes] = await Promise.all([
        event.category_id
          ? fetch(
              `${supabaseUrl}/rest/v1/categories?id=eq.${event.category_id}`,
              { headers }
            ).then((r) => r.json())
          : Promise.resolve([]),
        event.venue_id
          ? fetch(
              `${supabaseUrl}/rest/v1/venues?id=eq.${event.venue_id}`,
              { headers }
            ).then((r) => r.json())
          : Promise.resolve([]),
        fetch(
          `${supabaseUrl}/rest/v1/sessions?event_id=eq.${eventId}&order=start_time.asc`,
          { headers }
        ).then((r) => r.json()),
        fetch(
          `${supabaseUrl}/rest/v1/feedback?event_id=eq.${eventId}&order=submitted_at.desc&limit=5`,
          { headers }
        ).then((r) => r.json()),
      ])

      return {
        ...event,
        category: catRes[0] || null,
        venue: venueRes[0] || null,
        sessions: sessionsRes,
        recent_feedback: feedbackRes,
      }
    }

    case "get_categories": {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/categories?deleted_at=is.null&order=name.asc`,
        { headers }
      )
      return await res.json()
    }

    case "get_venues": {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/venues?deleted_at=is.null&order=name.asc`,
        { headers }
      )
      return await res.json()
    }

    case "get_upcoming_events": {
      const limit = parseInt((args.limit as string) || "5", 10)
      const now = new Date().toISOString()
      const res = await fetch(
        `${supabaseUrl}/rest/v1/events?status=eq.published&deleted_at=is.null&start_date=gte.${now}&order=start_date.asc&limit=${limit}`,
        { headers }
      )
      return await res.json()
    }

    case "get_event_stats": {
      const eventId = args.event_id as string
      const regRes = await fetch(
        `${supabaseUrl}/rest/v1/registrations?event_id=eq.${eventId}&select=status`,
        { headers }
      )
      const regs = await regRes.json()

      const eventRes = await fetch(
        `${supabaseUrl}/rest/v1/events?id=eq.${eventId}&select=capacity`,
        { headers }
      )
      const events = await eventRes.json()
      const capacity = events[0]?.capacity || 0

      const confirmed = regs.filter(
        (r: Record<string, unknown>) => r.status === "confirmed"
      ).length

      return {
        capacity,
        total_registrations: regs.length,
        confirmed,
        pending: regs.filter(
          (r: Record<string, unknown>) => r.status === "pending"
        ).length,
        waitlisted: regs.filter(
          (r: Record<string, unknown>) => r.status === "waitlisted"
        ).length,
        available_spots: Math.max(0, capacity - confirmed),
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

async function callLLM(messages: LLMMessage[]): Promise<string> {
  const response = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: false,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LM Studio error: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ""
}

async function chatWithTools(userMessage: string): Promise<string> {
  const messages: LLMMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ]

  for (let iteration = 0; iteration < 5; iteration++) {
    const assistantReply = await callLLM(messages)

    const toolCalls = parseToolCalls(assistantReply)

    if (toolCalls.length === 0) {
      return assistantReply
    }

    messages.push({ role: "assistant", content: assistantReply })

    let toolResults = ""
    for (const tc of toolCalls) {
      const result = await executeTool(tc.name, tc.args)
      toolResults += `Tool "${tc.name}" result:\n${JSON.stringify(result, null, 2)}\n\n`
    }

    messages.push({
      role: "user",
      content: `Here are the tool results:\n${toolResults}\nNow compose your response to the user based on this data.`,
    })
  }

  return runtimeLocalizeMessage("I'm having trouble processing your request. Please try again.")
}

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
}

export function useChat(): UseChatReturn {
  const { localizeError } = useLanguage()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    try {
      const reply = await chatWithTools(content.trim())

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      const message = localizeError(err instanceof Error ? err.message : "Something went wrong")
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, localizeError])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, isLoading, error, sendMessage, clearMessages }
}
