import { useLanguage } from "../../contexts/LanguageContext"
import { useState, useEffect, useRef } from "react"
import { MessageSquare, X, Trash2, Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { useChat } from "./useChat"
import ChatMessageBubble from "./ChatMessage"
import ChatInput from "./ChatInput"
import SuggestionChips from "./SuggestionChips"

export default function ChatWidget() {
  const { t } = useLanguage()
  
  const [isOpen, setIsOpen] = useState(false)
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus()
    }
  }, [isOpen])

  return (
    <>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "fixed bottom-20 right-5 z-50 w-[380px] h-[520px]",
          "bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden",
          "transition-all duration-300 ease-out",
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">
                {t("EventFlow Assistant")}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {t("Ask about events, venues & more")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title={t("Clear chat")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-thin scrollbar-thumb-border"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-card-foreground mb-1">
                {t("Hi there!")}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("I can help you discover events, check venues, explore categories, and more. What would you like to know?")}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}

          {isLoading && (
            <div className="flex gap-2.5">
              <div className="shrink-0 w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-xl border border-destructive/20">
                {error}
              </div>
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <SuggestionChips onSelect={sendMessage} disabled={isLoading} />
        )}

        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-5 right-5 z-50 w-14 h-14 rounded-2xl",
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
          "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
          "flex items-center justify-center",
          "transition-all duration-300 ease-out",
          "hover:scale-105 active:scale-95",
          isOpen && "rotate-90"
        )}
        title={t("Chat with EventFlow Assistant")}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageSquare className="w-5 h-5" />
        )}
      </button>
    </>
  )
}
