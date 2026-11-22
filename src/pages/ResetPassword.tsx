import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"
import { resetPasswordWithToken } from "../services/authService"

export function ResetPassword() {
  const { t } = useLanguage()
  
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState(searchParams.get("token") ?? "")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) {
      toast.error(t("Reset token is required"))
      return
    }
    if (password !== confirm) {
      toast.error(t("Passwords do not match"))
      return
    }
    if (password.length < 6) {
      toast.error(t("Password must be at least 6 characters"))
      return
    }
    setLoading(true)
    try {
      await resetPasswordWithToken(token.trim(), password)
      setDone(true)
      setTimeout(() => navigate("/login", { replace: true }), 2500)
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to reset password"))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CheckCircle2 size={48} className="text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t("Password reset complete")}</h1>
        <p className="text-muted-foreground mb-6">{t("Your password has been updated. Redirecting to login...")}</p>
        <Link to="/login" className="text-primary hover:underline text-sm">{t("Back to login")}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-center mb-8">{t("Reset password")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("Reset token")}</label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("New password")}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("Confirm password")}</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          {loading ? "Resetting..." : t("Reset password")}
        </button>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">{t("Back to login")}</Link>
        </p>
      </form>
    </div>
  )
}
