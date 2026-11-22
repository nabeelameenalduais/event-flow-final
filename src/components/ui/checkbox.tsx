import * as React from "react"
import { cn } from "../../lib/utils"

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: React.ReactNode
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, checked, onCheckedChange, ...props }, ref) => (
    <label htmlFor={id} className={cn("inline-flex items-center gap-2 cursor-pointer select-none", className)}>
      <input
        ref={ref}
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border border-input accent-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      {label != null && <span className="text-sm leading-none">{label}</span>}
    </label>
  ),
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
