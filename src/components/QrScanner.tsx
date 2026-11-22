import { useLanguage } from "../contexts/LanguageContext"
import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Input } from "./ui/input"
import { Button } from "./ui/button"

interface QrScannerProps {
  onScan: (code: string) => void
  onClose: () => void
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const { t } = useLanguage()
  
  // A unique id per mount avoids targeting a stale element on quick reopen.
  const scannerIdRef = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`)
  const stopRef = useRef<() => void>(() => {})
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [error, setError] = useState("")
  const [starting, setStarting] = useState(true)
  const [manualCode, setManualCode] = useState("")
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(scannerIdRef.current)
    let stopped = false
    const safeStop = () => {
      if (stopped) return
      stopped = true
      void scanner.stop().catch(() => {})
    }
    stopRef.current = safeStop

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        safeStop()
        onScanRef.current(decodedText)
      },
      () => {},
    ).catch((e: unknown) => {
  
      setError((e as { toString?: () => string })?.toString?.() ?? t("Camera unavailable"))
      setShowManual(true)
    }).finally(() => setStarting(false))

    return () => { safeStop() }
  }, [t])

  const openManualEntry = () => {
    stopRef.current()
    setShowManual(true)
  }

  const handleManualSubmit = () => {
    const code = manualCode.trim()
    if (code) onScan(code)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-xl p-4 shadow-xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        {showManual ? (
          <div className="w-full min-h-[16rem] rounded-lg overflow-hidden bg-muted flex flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground gap-3">
            {error && <p className="font-medium text-foreground">{t("Camera not available")}</p>}
            <div className="w-full max-w-xs space-y-2">
              <Input
                autoFocus
                placeholder={t("Enter ticket code (e.g. EF-ABCDEFGHIJKL)")}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              />
              <Button size="sm" className="w-full" onClick={handleManualSubmit} disabled={!manualCode.trim()}>
                {t("Submit")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div id={scannerIdRef.current} className="w-full aspect-square rounded-lg overflow-hidden bg-muted" />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted/85 text-sm text-muted-foreground">
                {t("Starting camera…")}
              </div>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground text-center mt-3">
          {showManual ? t("Enter the attendee's ticket code") : t("Point camera at the ticket QR code")}
        </p>
        {!showManual && (
          <button onClick={openManualEntry} className="mt-2 w-full text-center text-xs text-primary hover:underline">
            {t("Enter code instead")}
          </button>
        )}
        {error && showManual && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            {t("Camera requires HTTPS — use Chrome with HTTPS or enter the code manually")}
          </p>
        )}
        <button onClick={onClose} className="mt-3 w-full py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors">{t("Cancel")}</button>
      </div>
    </div>
  )
}
