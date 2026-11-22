import { useLanguage } from "../../contexts/LanguageContext"
import { CalendarDays, MapPin, Search, Ticket } from "lucide-react"

interface SuggestionChipsProps {
  onSelect: (message: string) => void
  disabled?: boolean
}

const suggestions = [
  {
    label: "Upcoming events",
    message: "Show me upcoming events",
    icon: CalendarDays,
  },
  {
    label: "Find by category",
    message: "What event categories are available?",
    icon: Search,
  },
  {
    label: "Available venues",
    message: "What venues are available?",
    icon: MapPin,
  },
  {
    label: "Get tickets",
    message: "How do I register for an event?",
    icon: Ticket,
  },
]

export default function SuggestionChips({
  onSelect,
  disabled,
}: SuggestionChipsProps) {
  const { t } = useLanguage()

  return (
    <div className="flex gap-2 px-3 pb-2 overflow-x-auto scrollbar-none">
      {suggestions.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(t(s.message))}
          disabled={disabled}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary border border-border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <s.icon className="w-3 h-3" />
          {t(s.label)}
        </button>
      ))}
    </div>
  )
}
