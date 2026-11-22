import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Mail, ShieldQuestion, KeyRound, ArrowLeft, Copy, Check } from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { requestPasswordOtp, verifyPasswordOtp, requestAdminPasswordReset } from "../services/passwordResetService"

type Mode = "choose" | "otp" | "admin"

export function ForgotPassword() {
  const { t } = useLanguage()
  
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>("choose")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const sendOtp = async (e?: React.FormEvent) => {
  
    e?.preventDefault()
    setError("")
    if (!email.trim()) {
      setError(t("Enter your email address first."))
      return
    }
    setLoading(true)
    try {
      const result = await requestPasswordOtp(email)
      setMode("otp")
      setCooldown(60)
      setDevCode(result.code ?? "")
      toast.success(localizeToast(result.emailSent ? "A 6-digit code was sent to your email" : "Verification code generated"))
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to request a code"))
    } finally {
      setLoading(false)
    }
  }

  const verify = async (e: React.FormEvent) => {
  
    e.preventDefault()
    setError("")
    if (newPassword.length < 8) {
      setError(t("The new password must be at least 8 characters."))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t("The new passwords do not match."))
      return
    }
    setLoading(true)
    try {
      await verifyPasswordOtp(email, code, newPassword)
      toast.success(t("Password reset successfully. You can sign in now."))
      navigate("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Invalid or expired code"))
    } finally {
      setLoading(false)
    }
  }

  const requestAdmin = async (e: React.FormEvent) => {
  
    e.preventDefault()
    setError("")
    if (!email.trim()) {
      setError(t("Enter your email address first."))
      return
    }
    setLoading(true)
    try {
      await requestAdminPasswordReset(email, message)
      toast.success(t("Your request was sent to the administrators"))
      setMode("admin")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to send the request"))
    } finally {
      setLoading(false)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(devCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("Could not copy the code"))
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md space-y-6">
        {mode !== "choose" && (
          <button type="button" onClick={() => { setMode("choose"); setError("") }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> {t("Back")}
          </button>
        )}

        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-amber-500/20 flex items-center justify-center">
            <KeyRound size={26} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("Reset your password")}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "otp"
              ? t("Enter the 6-digit verification code and choose a new password.")
              : mode === "admin"
                ? t("Your request is with the administrators.")
                : t("Use a verification code or ask an administrator for help.")}
          </p>
        </div>

        {mode === "choose" && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Email")}</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={() => sendOtp()} disabled={loading} className="w-full gap-2">
              <Mail size={16} /> {loading ? "Sending..." : t("Send verification code")}
            </Button>
            <div className="relative text-center">
              <span className="relative z-10 bg-card px-3 text-xs text-muted-foreground">{t("or")}</span>
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Message to administrators (optional)")}</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                placeholder={t("Explain why you cannot access the account.")} />
            </div>
            <Button variant="outline" onClick={requestAdmin} disabled={loading} className="w-full gap-2">
              <ShieldQuestion size={16} /> {loading ? "Sending..." : t("Request admin assistance")}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {t("Codes are 6 digits, expire in 10 minutes, allow 5 attempts and can be used once. A new code can be requested after 60 seconds.")}
            </p>
          </div>
        )}

        {mode === "otp" && (
          <form onSubmit={verify} className="space-y-4 rounded-xl border border-border bg-card p-6">
            {devCode && (
              <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-sm">
                <p className="font-medium flex items-center gap-2"><Mail size={15} /> {t("Mock mode code")}</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-lg font-bold tracking-[0.3em]">{devCode}</code>
                  <Button type="button" size="sm" variant="ghost" onClick={copyCode}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t("Real email delivery requires the email provider environment variables.")}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">{t("Verification code")}</label>
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required inputMode="numeric" maxLength={6} placeholder="123456"
                className="text-center text-lg tracking-[0.4em]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("New password")}</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Confirm new password")}</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
              {loading ? "Resetting..." : t("Reset password")}
            </Button>
            <Button type="button" variant="outline" onClick={() => sendOtp()} disabled={loading || cooldown > 0} className="w-full">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : t("Resend code")}
            </Button>
          </form>
        )}

        {mode === "admin" && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm">
              {t("An administrator will review the request for")} <strong>{email}</strong> {t("and send a temporary password through your\n              in-app notification inbox. You will be asked to change it on first login.")}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">{t("Back to login")}</Link>
            </Button>
            <Button variant="ghost" onClick={() => setMode("choose")} className="w-full">
              {t("Submit another request")}
            </Button>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {t("Remember your password?")} <Link to="/login" className="text-primary hover:underline">{t("Login")}</Link>
          {" · "}
          <Link to="/restore-account" className="text-primary hover:underline">{t("Restore a deleted account")}</Link>
        </p>
      </div>
    </div>
  )
}
