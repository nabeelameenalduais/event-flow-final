import { useLanguage } from "../../contexts/LanguageContext"
import { useState, useRef, type KeyboardEvent } from "react"
import { Send } from "lucide-react"
import { cn } from "../../lib/utils"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t } = useLanguage()
  
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!value.trim() || disabled) return
    onSend(value)
    setValue("")
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-border bg-card/50 backdrop-blur-sm">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("Ask about events, venues, categories...")}
        disabled={disabled}
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5",
          "text-sm placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary",
          "transition-all duration-200",
          "min-h-[40px] max-h-[120px]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className={cn(
          "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
          "bg-primary text-primary-foreground shadow-sm",
          "hover:bg-primary/90 hover:shadow-md active:scale-95",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        )}
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}
