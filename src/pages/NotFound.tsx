import { useLanguage } from "../contexts/LanguageContext"
import { Link } from "react-router-dom"
import { Compass, Home } from "lucide-react"
import { Button } from "../components/ui/button"

export function NotFound() {
  const { t } = useLanguage()
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-4">
      <div className="p-6 rounded-full bg-primary/10 text-primary">
        <Compass size={56} />
      </div>
      <h1 className="text-6xl font-black bg-gradient-to-r from-teal-500 to-amber-500 bg-clip-text text-transparent">404</h1>
      <h2 className="text-xl font-semibold">{t("Page not found")}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {t("The page you're looking for doesn't exist or has been moved.")}
      </p>
      <Link to="/">
        <Button className="gap-2">
          <Home size={16} /> {t("Back to Home")}
        </Button>
      </Link>
    </div>
  )
}
