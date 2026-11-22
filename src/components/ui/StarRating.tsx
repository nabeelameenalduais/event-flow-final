import { useState, useRef, useCallback } from "react"
import { Star } from "lucide-react"
import { cn } from "../../lib/utils"
import { useLanguage } from "../../contexts/LanguageContext"

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  halfSteps?: boolean
  className?: string
}

/**
 * Interactive star rating.
 * - Supports whole or half stars.
 * - Click to set, or click-and-drag to scrub then release to select.
 */
export function StarRating({ value, onChange, halfSteps = true, className }: StarRatingProps) {
  const { t } = useLanguage()
  const step = halfSteps ? 0.5 : 1
  const max = 5
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const computeValue = useCallback(
    (clientX: number): number => {
      const el = containerRef.current
      if (!el) return value
      const rect = el.getBoundingClientRect()
      const ratio = (clientX - rect.left) / rect.width
      const raw = Math.max(0, Math.min(1, ratio)) * max
      const stepped = Math.round(raw / step) * step
      return Math.max(step, stepped)
    },
    [value, step],
  )

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    onChange(computeValue(e.clientX))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true)
    onChange(computeValue(e.clientX))
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handlePointerUp = () => setDragging(false)

  return (
    <div
      ref={containerRef}
      className={cn("inline-flex items-center gap-1 touch-none select-none", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setDragging(false)}
      role="slider"
      aria-label={t("Rating")}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
    >
      {Array.from({ length: max }).map((_, i) => {
        const starValue = (i + 1) * step
        const filled = value >= starValue
        const halfFilled = halfSteps && value >= starValue - step && value < starValue
        return (
          <span key={i} className="relative inline-flex">
            <Star
              size={28}
              className={cn(
                "transition-colors",
                filled ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30",
              )}
            />
            {halfFilled && !filled && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                <Star size={28} className="text-amber-500 fill-amber-500" />
              </span>
            )}
          </span>
        )
      })}
      <span className="ml-2 text-sm font-medium text-muted-foreground">{value.toFixed(halfSteps ? 1 : 0)} / {max}</span>
    </div>
  )
}

interface NumericRatingProps {
  value: number
  onChange: (value: number) => void
  max?: number
  className?: string
}

/**
 * Numeric rating (1-10) with click and drag support.
 */
export function NumericRating({ value, onChange, max = 10, className }: NumericRatingProps) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const computeValue = useCallback(
    (clientX: number): number => {
      const el = containerRef.current
      if (!el) return value
      const rect = el.getBoundingClientRect()
      const ratio = (clientX - rect.left) / rect.width
      const raw = Math.round(Math.max(0, Math.min(1, ratio)) * (max - 1)) + 1
      return raw
    },
    [value, max],
  )

  return (
    <div
      ref={containerRef}
      className={cn("flex items-center gap-2 touch-none select-none", className)}
      onPointerDown={(e) => { setDragging(true); onChange(computeValue(e.clientX)); e.currentTarget.setPointerCapture?.(e.pointerId) }}
      onPointerMove={(e) => dragging && onChange(computeValue(e.clientX))}
      onPointerUp={() => setDragging(false)}
      role="slider"
      aria-label={t("Rating")}
      aria-valuemin={1}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
    >
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className={cn(
              "h-9 w-9 rounded-lg text-sm font-semibold border transition-colors",
              value >= i + 1
                ? "bg-gradient-to-br from-teal-500 to-amber-500 text-white border-transparent shadow"
                : "bg-card text-muted-foreground border-border hover:border-primary",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-muted-foreground">{value} / {max}</span>
    </div>
  )
}
