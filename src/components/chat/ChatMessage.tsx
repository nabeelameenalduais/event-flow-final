import { cn } from "../../lib/utils"
import { Bot, User } from "lucide-react"
import type { ChatMessage } from "./useChat"

interface ChatMessageProps {
  message: ChatMessage
}

function formatContent(text: string) {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <div key={i} className="flex gap-2 ml-1">
          <span className="text-primary shrink-0">•</span>
          <span>{line.slice(2)}</span>
        </div>
      )
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      return (
        <div key={i} className="font-semibold mt-2">
          {line.replace(/\*\*/g, "")}
        </div>
      )
    }
    if (line.trim() === "") {
      return <div key={i} className="h-2" />
    }
    return <div key={i}>{line}</div>
  })
}

export default function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card text-card-foreground border border-border rounded-bl-md shadow-sm"
        )}
      >
        {isUser ? (
          <span>{message.content}</span>
        ) : (
          <div className="space-y-0.5">{formatContent(message.content)}</div>
        )}
      </div>
    </div>
  )
}
