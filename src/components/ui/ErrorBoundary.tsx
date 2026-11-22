import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { useLanguage } from "../../contexts/LanguageContext"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

function ErrorFallback({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t, localizeError } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertTriangle size={48} className="text-destructive" />
      <h2 className="text-xl font-semibold">{t("Something went wrong")}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {localizeError(message ?? t("An unexpected error occurred."))}
      </p>
      <button
        onClick={onRetry}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90"
      >
        {t("Try again")}
      </button>
    </div>
  )
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <ErrorFallback
          message={this.state.error?.message}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}
