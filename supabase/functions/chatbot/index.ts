import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODEL = "meta-llama/llama-3.2-3b-instruct:free"

const TOOL_DEFINITIONS = `
AVAILABLE TOOLS (use these to fetch real data):

1. search_events(query?: string, category?: string, status?: string, limit?: string)
   Search events by keyword, filter by category or status.

2. get_event_details(event_id: string)
   Get full details of a specific event by UUID.

3. get_categories()
   List all event categories.

4. get_venues()
   List all venues.

5. get_upcoming_events(limit?: string)
   Get upcoming published events.

6. get_event_stats(event_id: string)
   Get registration stats for an event.
`

const SYSTEM_PROMPT = `You are EventFlow Assistant, a helpful AI chatbot for the EventFlow event management platform.

Your role is to help users discover and learn about events, venues, and categories.

HOW TO USE TOOLS:
When you need data, output EXACTLY this format (one call per block, you may output multiple blocks):

<tool_call>
{"name": "tool_name", "args": {"key": "value"}}
</tool_call>

After the user provides tool results, compose a helpful response. NEVER make up event data.

RULES:
- Only answer questions about events, venues, categories, and event-related information.
- Always fetch real data using the provided tools before answering.
- Be conversational, friendly, and concise.
- Format responses nicely with bullet points when listing multiple items.
- Include relevant dates, locations, and capacity information when discussing events.
- If no events match a search, say so clearly and suggest broadening the search.

${TOOL_DEFINITIONS}`

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ParsedToolCall {
  name: string
  args: Record<string, unknown>
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

function supabaseHeaders() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  }
}

function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = []
  const regex = /<tool_call>\s*(\{.*?\})\s*<\/tool_call>/gs
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.name) {
        calls.push({
          name: parsed.name,
          args: parsed.args || {},
        })
      }
    } catch {
      // skip malformed JSON
    }
  }
  return calls
}

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const headers = supabaseHeaders()

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

      const total = regs.length
      const confirmed = regs.filter(
        (r: Record<string, unknown>) => r.status === "confirmed"
      ).length
      const pending = regs.filter(
        (r: Record<string, unknown>) => r.status === "pending"
      ).length
      const waitlisted = regs.filter(
        (r: Record<string, unknown>) => r.status === "waitlisted"
      ).length

      return {
        capacity,
        total_registrations: total,
        confirmed,
        pending,
        waitlisted,
        available_spots: Math.max(0, capacity - confirmed),
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callOpenRouterWithRetry(
  messages: ChatMessage[],
  apiKey: string,
  maxRetries = 5
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://eventflow.app",
        "X-Title": "EventFlow Chatbot",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    })

    if (response.status === 429) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 5000 + Math.random() * 3000
        await sleep(delay)
        continue
      }
      const err = await response.text()
      throw new Error(
        `OpenRouter rate limit exceeded after ${maxRetries} retries: ${err}`
      )
    }

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenRouter API error: ${err}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenRouter")
    }
    return content
  }
  throw new Error("OpenRouter API: max retries exceeded")
}

async function chat(userMessage: string): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY")
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set")
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ]

  for (let iteration = 0; iteration < 5; iteration++) {
    const assistantReply = await callOpenRouterWithRetry(messages, apiKey)

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

  return "I'm having trouble processing your request. Please try again."
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { message } = await req.json()

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const reply = await chat(message)

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
