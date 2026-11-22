import type { ReactNode } from "react"
import { Inbox } from "lucide-react"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center animate-fade-in-up">
      <div className="text-muted-foreground/30">
        {icon ?? <Inbox size={48} strokeWidth={1} />}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
