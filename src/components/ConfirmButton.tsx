import { useState } from 'react'

// Bouton à confirmation en deux temps (pas de pop-up du navigateur).
export default function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'text-muted underline',
  confirmClassName = 'font-semibold text-over underline',
  ariaLabel,
}: {
  label: React.ReactNode
  confirmLabel: React.ReactNode
  onConfirm: () => void
  className?: string
  confirmClassName?: string
  ariaLabel?: string
}) {
  const [confirming, setConfirming] = useState(false)
  return confirming ? (
    <button
      type="button"
      autoFocus
      onClick={() => {
        setConfirming(false)
        onConfirm()
      }}
      className={confirmClassName}
    >
      {confirmLabel}
    </button>
  ) : (
    <button type="button" onClick={() => setConfirming(true)} aria-label={ariaLabel} className={className}>
      {label}
    </button>
  )
}
