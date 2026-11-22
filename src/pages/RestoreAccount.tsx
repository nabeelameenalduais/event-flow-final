import { useLanguage } from "../contexts/LanguageContext"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { RotateCcw, ArrowLeft } from "lucide-react"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { restoreAccount } from "../services/accountService"

export function RestoreAccount() {
  const { t } = useLanguage()
  
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
  
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await restoreAccount(email, password)
      toast.success(t("Your account has been restored. You can sign in now."))
      navigate("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to restore the account"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> {t("Back to login")}
        </Link>

        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-amber-500/20 flex items-center justify-center">
            <RotateCcw size={26} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("Restore your account")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Deleted accounts are kept for a recovery window (30 days by default). Enter your email and password to restore\n            your account and data.")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <label className="block text-sm font-medium mb-1">{t("Email")}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Password")}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Restoring..." : t("Restore account")}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {t("If the recovery window has ended, contact an administrator to restore the account manually.")}
          </p>
        </form>
      </div>
    </div>
  )
}
